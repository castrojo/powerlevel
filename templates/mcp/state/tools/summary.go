package tools

import (
	"context"
	"encoding/json"
	"fmt"
	"time"

	"github.com/jackc/pgx/v5/pgxpool"
	"github.com/mark3labs/mcp-go/mcp"
	"github.com/mark3labs/mcp-go/server"
)

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
			ID        string `json:"id"`
			Domain    string `json:"domain"`
			UpdatedAt string `json:"updated_at"`
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
			TasksCompleted []taskCompleted `json:"tasks_completed"`
			LoopRuns       []loopRun       `json:"loop_runs"`
			Totals         totals          `json:"totals"`
			DBSize         string          `json:"db_size"`
		}

		result := summary{
			Window:         since,
			SkillsUpdated:  []skillUpdate{},
			RulesUpdated:   []ruleUpdate{},
			TasksCompleted: []taskCompleted{},
			LoopRuns:       []loopRun{},
		}

		// 1. Skills updated in window
		skillRows, err := pool.Query(ctx,
			`SELECT skill, COUNT(section) AS sections, MAX(updated_at) AS last_updated
			 FROM skill_sections
			 WHERE updated_at > NOW() - $1::interval
			 GROUP BY skill ORDER BY last_updated DESC`,
			since)
		if err != nil {
			return nil, fmt.Errorf("get_session_summary skills: %w", err)
		}
		for skillRows.Next() {
			var su skillUpdate
			var t time.Time
			if scanErr := skillRows.Scan(&su.Skill, &su.Sections, &t); scanErr != nil {
				skillRows.Close()
				return nil, scanErr
			}
			su.LastUpdated = t.Format(time.RFC3339)
			result.SkillsUpdated = append(result.SkillsUpdated, su)
		}
		skillRows.Close()

		// 2. Rules updated in window
		ruleRows, err := pool.Query(ctx,
			`SELECT id, domain, updated_at FROM rules
			 WHERE updated_at > NOW() - $1::interval
			 ORDER BY updated_at DESC`,
			since)
		if err != nil {
			return nil, fmt.Errorf("get_session_summary rules: %w", err)
		}
		for ruleRows.Next() {
			var ru ruleUpdate
			var t time.Time
			if scanErr := ruleRows.Scan(&ru.ID, &ru.Domain, &t); scanErr != nil {
				ruleRows.Close()
				return nil, scanErr
			}
			ru.UpdatedAt = t.Format(time.RFC3339)
			result.RulesUpdated = append(result.RulesUpdated, ru)
		}
		ruleRows.Close()

		// 3. Tasks completed in window (claimed_at approximates completion time)
		taskRows, err := pool.Query(ctx,
			`SELECT repo, plan_id, COUNT(*) AS count
			 FROM plan_tasks
			 WHERE status = 'done' AND claimed_at > NOW() - $1::interval
			 GROUP BY repo, plan_id ORDER BY repo`,
			since)
		if err != nil {
			return nil, fmt.Errorf("get_session_summary tasks: %w", err)
		}
		for taskRows.Next() {
			var tc taskCompleted
			if scanErr := taskRows.Scan(&tc.Repo, &tc.PlanID, &tc.Count); scanErr != nil {
				taskRows.Close()
				return nil, scanErr
			}
			result.TasksCompleted = append(result.TasksCompleted, tc)
		}
		taskRows.Close()

		// 4. Loop runs in window
		runRows, err := pool.Query(ctx,
			`SELECT repo, COUNT(*) AS count
			 FROM run_history
			 WHERE created_at > NOW() - $1::interval
			 GROUP BY repo ORDER BY repo`,
			since)
		if err != nil {
			return nil, fmt.Errorf("get_session_summary runs: %w", err)
		}
		for runRows.Next() {
			var lr loopRun
			if scanErr := runRows.Scan(&lr.Repo, &lr.Count); scanErr != nil {
				runRows.Close()
				return nil, scanErr
			}
			result.LoopRuns = append(result.LoopRuns, lr)
		}
		runRows.Close()

		// 5. Table row counts (no window — always current totals)
		pool.QueryRow(ctx,
			`SELECT
				(SELECT COUNT(*) FROM rules),
				(SELECT COUNT(*) FROM skill_sections),
				(SELECT COUNT(*) FROM plan_tasks),
				(SELECT COUNT(*) FROM run_history)`,
		).Scan(&result.Totals.Rules, &result.Totals.SkillSections,
			&result.Totals.PlanTasks, &result.Totals.RunHistory)

		// 6. DB size
		pool.QueryRow(ctx,
			`SELECT pg_size_pretty(pg_database_size(current_database()))`,
		).Scan(&result.DBSize)

		b, _ := json.Marshal(result)
		return mcp.NewToolResultText(string(b)), nil
	})
}
