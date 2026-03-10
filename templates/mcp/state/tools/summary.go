package tools

import (
	"context"
	"encoding/json"
	"fmt"
	"sort"
	"strings"
	"sync"
	"time"

	"github.com/jackc/pgx/v5/pgxpool"
	"github.com/mark3labs/mcp-go/mcp"
	"github.com/mark3labs/mcp-go/server"
	"golang.org/x/sync/errgroup"
)

// relAge returns a human-readable relative age string for a past time.
func relAge(t time.Time) string {
	d := time.Since(t)
	switch {
	case d < 2*time.Minute:
		return "just now"
	case d < 60*time.Minute:
		return fmt.Sprintf("%dm ago", int(d.Minutes()))
	case d < 24*time.Hour:
		return fmt.Sprintf("%dh ago", int(d.Hours()))
	default:
		return fmt.Sprintf("%dd ago", int(d.Hours()/24))
	}
}

// trendArrow returns an arrow + delta string for a DB total trend.
// current is the live count; prev is the count that existed before the window.
func trendArrow(current, prev int) string {
	delta := current - prev
	switch {
	case delta > 0:
		return fmt.Sprintf("↑%d", delta)
	case delta < 0:
		return fmt.Sprintf("↓%d", -delta)
	default:
		return "→"
	}
}

func RegisterSummaryTools(s *server.MCPServer, pool *pgxpool.Pool) {
	s.AddTool(mcp.NewTool("get_session_summary",
		mcp.WithDescription("Session activity summary: skills/rules updated, tasks completed, loop runs, DB totals and size. Default window: 24 hours."),
		mcp.WithString("since", mcp.Description("Interval string, e.g. '24 hours', '8 hours'. Defaults to '24 hours'.")),
		mcp.WithReadOnlyHintAnnotation(true),
	), func(ctx context.Context, req mcp.CallToolRequest) (*mcp.CallToolResult, error) {
		since := req.GetString("since", "24 hours")

		type skillUpdate struct {
			Skill       string `json:"skill"`
			Sections    int    `json:"sections"`
			LastUpdated string `json:"last_updated"`
		}
		type ruleUpdate struct {
			ID          string `json:"id"`
			Domain      string `json:"domain"`
			Description string `json:"description"`
			UpdatedAt   string `json:"updated_at"`
			ts          time.Time
		}
		type memoryUpdate struct {
			Block     string `json:"block"`
			Summary   string `json:"summary"`
			CreatedAt string `json:"created_at"`
			ts        time.Time
		}
		type taskCompleted struct {
			Repo   string `json:"repo"`
			PlanID string `json:"plan_id"`
			Count  int    `json:"count"`
		}
		type loopRun struct {
			Repo  string `json:"repo"`
			Count int    `json:"count"`
		}
		type totals struct {
			Rules         int `json:"rules"`
			SkillSections int `json:"skill_sections"`
			PlanTasks     int `json:"plan_tasks"`
			RunHistory    int `json:"run_history"`
		}
		type summary struct {
			Window         string          `json:"window"`
			SkillsUpdated  []skillUpdate   `json:"skills_updated"`
			RulesUpdated   []ruleUpdate    `json:"rules_updated"`
			MemoryUpdates  []memoryUpdate  `json:"memory_updates"`
			TasksCompleted []taskCompleted `json:"tasks_completed"`
			LoopRuns       []loopRun       `json:"loop_runs"`
			Totals         totals          `json:"totals"`
			DBSize         string          `json:"db_size"`
			RenderedBox    string          `json:"rendered_box"`
		}

		result := summary{
			Window:         since,
			SkillsUpdated:  []skillUpdate{},
			RulesUpdated:   []ruleUpdate{},
			MemoryUpdates:  []memoryUpdate{},
			TasksCompleted: []taskCompleted{},
			LoopRuns:       []loopRun{},
		}

		// Run all 7 queries concurrently using errgroup.
		// Each goroutine gets its own connection from the pool.
		var mu sync.Mutex
		var (
			rulesNow, rulesPrev int
			secNow, secPrev     int
			tasksNow, tasksPrev int
			runsNow, runsPrev   int
		)

		g, gctx := errgroup.WithContext(ctx)

		// 1. Skills updated in window
		g.Go(func() error {
			rows, err := pool.Query(gctx,
				`SELECT skill, COUNT(section) AS sections, MAX(updated_at) AS last_updated
				 FROM skill_sections
				 WHERE updated_at > NOW() - $1::interval
				 GROUP BY skill ORDER BY last_updated DESC`,
				since)
			if err != nil {
				return fmt.Errorf("get_session_summary skills: %w", err)
			}
			defer rows.Close()
			var skills []skillUpdate
			for rows.Next() {
				var su skillUpdate
				var t time.Time
				if scanErr := rows.Scan(&su.Skill, &su.Sections, &t); scanErr != nil {
					return scanErr
				}
				su.LastUpdated = t.Format(time.RFC3339)
				skills = append(skills, su)
			}
			mu.Lock()
			result.SkillsUpdated = skills
			mu.Unlock()
			return nil
		})

		// 2. Rules updated in window
		g.Go(func() error {
			rows, err := pool.Query(gctx,
				`SELECT id, domain, LEFT(content, 160) AS description, updated_at FROM rules
				 WHERE updated_at > NOW() - $1::interval
				 ORDER BY updated_at DESC`,
				since)
			if err != nil {
				return fmt.Errorf("get_session_summary rules: %w", err)
			}
			defer rows.Close()
			var rules []ruleUpdate
			for rows.Next() {
				var ru ruleUpdate
				if scanErr := rows.Scan(&ru.ID, &ru.Domain, &ru.Description, &ru.ts); scanErr != nil {
					return scanErr
				}
				ru.UpdatedAt = ru.ts.Format(time.RFC3339)
				rules = append(rules, ru)
			}
			mu.Lock()
			result.RulesUpdated = rules
			mu.Unlock()
			return nil
		})

		// 3. Memory updates in window
		g.Go(func() error {
			rows, err := pool.Query(gctx,
				`SELECT block, summary, created_at FROM memory_updates
				 WHERE created_at > NOW() - $1::interval
				 ORDER BY created_at DESC`,
				since)
			if err != nil {
				return fmt.Errorf("get_session_summary memory: %w", err)
			}
			defer rows.Close()
			var mems []memoryUpdate
			for rows.Next() {
				var mu2 memoryUpdate
				if scanErr := rows.Scan(&mu2.Block, &mu2.Summary, &mu2.ts); scanErr != nil {
					return scanErr
				}
				mu2.CreatedAt = mu2.ts.Format(time.RFC3339)
				mems = append(mems, mu2)
			}
			mu.Lock()
			result.MemoryUpdates = mems
			mu.Unlock()
			return nil
		})

		// 4. Tasks completed in window
		g.Go(func() error {
			rows, err := pool.Query(gctx,
				`SELECT repo, plan_id, COUNT(*) AS count
				 FROM plan_tasks
				 WHERE status = 'done' AND claimed_at > NOW() - $1::interval
				 GROUP BY repo, plan_id ORDER BY repo`,
				since)
			if err != nil {
				return fmt.Errorf("get_session_summary tasks: %w", err)
			}
			defer rows.Close()
			var tasks []taskCompleted
			for rows.Next() {
				var tc taskCompleted
				if scanErr := rows.Scan(&tc.Repo, &tc.PlanID, &tc.Count); scanErr != nil {
					return scanErr
				}
				tasks = append(tasks, tc)
			}
			mu.Lock()
			result.TasksCompleted = tasks
			mu.Unlock()
			return nil
		})

		// 5. Loop runs in window
		g.Go(func() error {
			rows, err := pool.Query(gctx,
				`SELECT repo, COUNT(*) AS count
				 FROM run_history
				 WHERE created_at > NOW() - $1::interval
				 GROUP BY repo ORDER BY repo`,
				since)
			if err != nil {
				return fmt.Errorf("get_session_summary runs: %w", err)
			}
			defer rows.Close()
			var runs []loopRun
			for rows.Next() {
				var lr loopRun
				if scanErr := rows.Scan(&lr.Repo, &lr.Count); scanErr != nil {
					return scanErr
				}
				runs = append(runs, lr)
			}
			mu.Lock()
			result.LoopRuns = runs
			mu.Unlock()
			return nil
		})

		// 6. Totals with trends
		g.Go(func() error {
			return pool.QueryRow(gctx, `
				SELECT
					(SELECT COUNT(*) FROM rules),
					(SELECT COUNT(*) FROM rules WHERE updated_at < NOW() - $1::interval),
					(SELECT COUNT(*) FROM skill_sections),
					(SELECT COUNT(*) FROM skill_sections WHERE updated_at < NOW() - $1::interval),
					(SELECT COUNT(*) FROM plan_tasks),
					(SELECT COUNT(*) FROM plan_tasks WHERE created_at < NOW() - $1::interval),
					(SELECT COUNT(*) FROM run_history),
					(SELECT COUNT(*) FROM run_history WHERE created_at < NOW() - $1::interval)
			`, since).Scan(&rulesNow, &rulesPrev, &secNow, &secPrev, &tasksNow, &tasksPrev, &runsNow, &runsPrev)
		})

		// 7. DB size
		g.Go(func() error {
			var dbSize string
			if err := pool.QueryRow(gctx,
				`SELECT pg_size_pretty(pg_database_size(current_database()))`,
			).Scan(&dbSize); err != nil {
				return err
			}
			mu.Lock()
			result.DBSize = dbSize
			mu.Unlock()
			return nil
		})

		if err := g.Wait(); err != nil {
			return nil, err
		}

		result.Totals.Rules = rulesNow
		result.Totals.SkillSections = secNow
		result.Totals.PlanTasks = tasksNow
		result.Totals.RunHistory = runsNow

		// --- Build rendered_box ---
		var box strings.Builder
		headerSuffix := innerWidth - 24 - len(since)
		if headerSuffix < 0 {
			headerSuffix = 0
		}
		box.WriteString("╭─ Session Summary (last " + since + ") " +
			strings.Repeat("─", headerSuffix) + "╮\n")

		// WORKFLOW IMPROVEMENTS section
		box.WriteString(row("WORKFLOW IMPROVEMENTS"))
		box.WriteString(row(""))

		// Merge rules + memory into a single chronological slice
		type improvement struct {
			age    string
			kind   string // "rule" or "memory"
			id     string
			domain string
			desc   string
			ts     time.Time
		}
		var improvements []improvement
		for _, ru := range result.RulesUpdated {
			improvements = append(improvements, improvement{
				age:    relAge(ru.ts),
				kind:   "rule",
				id:     ru.ID,
				domain: ru.Domain,
				desc:   ru.Description,
				ts:     ru.ts,
			})
		}
		for _, mu2 := range result.MemoryUpdates {
			improvements = append(improvements, improvement{
				age:  relAge(mu2.ts),
				kind: "memory",
				id:   mu2.Block,
				desc: mu2.Summary,
				ts:   mu2.ts,
			})
		}
		// Sort most-recent first
		sort.Slice(improvements, func(i, j int) bool {
			return improvements[i].ts.After(improvements[j].ts)
		})

		descWidth := innerWidth - 14 // indent "             " = 13 chars + 1 space

		if len(improvements) == 0 {
			box.WriteString(row("  No workflow changes recorded this session."))
		} else {
			for _, imp := range improvements {
				var header string
				if imp.kind == "rule" {
					header = fmt.Sprintf("  %-8s  [rule]    %s  [%s]", imp.age, imp.id, imp.domain)
				} else {
					header = fmt.Sprintf("  %-8s  [memory]  %s", imp.age, imp.id)
				}
				box.WriteString(row(header))
				if imp.desc != "" {
					desc := imp.desc
					// Truncate to fit
					runes := []rune(desc)
					if len(runes) > descWidth {
						desc = string(runes[:descWidth-1]) + "…"
					}
					box.WriteString(row(fmt.Sprintf("             %s", desc)))
				}
				box.WriteString(row(""))
			}
		}

		// ACTIVITY section
		box.WriteString(divider())
		totalRuns := 0
		for _, lr := range result.LoopRuns {
			totalRuns += lr.Count
		}
		totalTasks := 0
		for _, tc := range result.TasksCompleted {
			totalTasks += tc.Count
		}
		box.WriteString(row(fmt.Sprintf("ACTIVITY  %d tasks · %d runs across %d repos",
			totalTasks, totalRuns, len(result.LoopRuns))))

		// Per-repo run breakdown — top 4, then "+N more"
		const maxRepos = 4
		runParts := make([]string, 0, maxRepos+1)
		for i, lr := range result.LoopRuns {
			if i >= maxRepos {
				runParts = append(runParts, fmt.Sprintf("+%d more", len(result.LoopRuns)-maxRepos))
				break
			}
			runParts = append(runParts, fmt.Sprintf("%s: %d", lr.Repo, lr.Count))
		}
		if len(runParts) > 0 {
			box.WriteString(row("  " + strings.Join(runParts, "  ")))
		}

		// DB STATS with trend indicators
		box.WriteString(divider())
		box.WriteString(row(fmt.Sprintf("DB  %d rules %s · %d sections %s · %d tasks %s · %d runs %s · %s",
			rulesNow, trendArrow(rulesNow, rulesPrev),
			secNow, trendArrow(secNow, secPrev),
			tasksNow, trendArrow(tasksNow, tasksPrev),
			runsNow, trendArrow(runsNow, runsPrev),
			result.DBSize,
		)))
		box.WriteString("╰" + strings.Repeat("─", innerWidth+2) + "╯\n")

		result.RenderedBox = box.String()

		b, _ := json.Marshal(result)
		return mcp.NewToolResultText(string(b)), nil
	})
}
