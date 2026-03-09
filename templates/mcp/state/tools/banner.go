package tools

import (
	"context"
	"encoding/json"
	"fmt"
	"strings"
	"time"

	"github.com/jackc/pgx/v5/pgxpool"
	"github.com/mark3labs/mcp-go/mcp"
	"github.com/mark3labs/mcp-go/server"
)

// uiPanel mirrors a row in the ui_panels table.
type uiPanel struct {
	ID        string
	Title     string
	Content   string
	SortOrder int
}

// progressBar converts a "current/total" run string into a 16-char ASCII bar.
// Returns empty string if the input is not parseable or total is zero.
func progressBar(run string) string {
	parts := strings.SplitN(run, "/", 2)
	if len(parts) != 2 {
		return ""
	}
	var current, total int
	fmt.Sscan(parts[0], &current)
	fmt.Sscan(parts[1], &total)
	if total == 0 {
		return ""
	}
	const width = 16
	filled := (current * width) / total
	bar := strings.Repeat("█", filled) + strings.Repeat("░", width-filled)
	return fmt.Sprintf("[%s] %d/%d", bar, current, total)
}

// bannerState holds the result of the state machine.
type bannerState struct {
	activeStep int    // 1–6
	nextLine   string // text for the ▶ NEXT row
}

// resolveState maps loop_state fields + pending task count to a bannerState.
func resolveState(phase, run string, pending int) bannerState {
	switch {
	case phase == "" && pending == 0:
		return bannerState{1, `"session-start" — sync state and orient`}
	case phase == "" && pending > 0:
		return bannerState{4, fmt.Sprintf(`"loop-start" — %d tasks ready to execute`, pending)}
	case phase == "loop-end-ready":
		return bannerState{6, `"loop-end" — close loop and ship`}
	default:
		// Active loop: determine current position from run "X/Y"
		parts := strings.SplitN(run, "/", 2)
		var current, total int
		if len(parts) == 2 {
			fmt.Sscan(parts[0], &current)
			fmt.Sscan(parts[1], &total)
		}
		if total > 0 && current >= total {
			return bannerState{5, `"loop-gate" — review output, advance phase`}
		}
		return bannerState{4, fmt.Sprintf(`"loop-task" — run iteration %d of %d`, current+1, total)}
	}
}

// innerWidth is the number of content characters between the box borders.
// Box total width = innerWidth + 2 (for "│ " and " │") = 59 chars.
const innerWidth = 57

func pad(s string, width int) string {
	if len(s) >= width {
		return s[:width]
	}
	return s + strings.Repeat(" ", width-len(s))
}

func row(content string) string {
	return "│ " + pad(content, innerWidth) + " │\n"
}

func divider() string {
	return "├" + strings.Repeat("─", innerWidth+2) + "┤\n"
}

// renderBanner assembles the complete rounded-box banner string.
func renderBanner(panels []uiPanel, state bannerState, phase, run, lastRun, repo string) string {
	var b strings.Builder

	top := "╭─ OpenCode Workflow " + strings.Repeat("─", innerWidth-18) + "╮\n"
	bot := "╰" + strings.Repeat("─", innerWidth+2) + "╯\n"

	b.WriteString(top)

	for _, p := range panels {
		marker := "  "
		if p.SortOrder == state.activeStep {
			marker = "▶ "
		}
		line := fmt.Sprintf("%d. %s%-11s %s", p.SortOrder, marker, p.Title, p.Content)
		b.WriteString(row(line))
	}

	b.WriteString(divider())

	// Dynamic state row
	if phase != "" {
		bar := progressBar(run)
		b.WriteString(row(fmt.Sprintf("%s · %s · %s", repo, bar, phase)))
	} else {
		activity := "no active work"
		if repo != "" {
			activity = repo + " · no active work"
		}
		b.WriteString(row(activity))
	}

	// Last run row (optional)
	if lastRun != "" {
		lr := "Last: " + lastRun
		if len(lr) > innerWidth {
			lr = lr[:innerWidth-1] + "…"
		}
		b.WriteString(row(lr))
	}

	b.WriteString(divider())
	b.WriteString(row("▶  NEXT: " + state.nextLine))
	b.WriteString(bot)

	return b.String()
}

// RegisterBannerTools registers the get_welcome_banner MCP tool.
func RegisterBannerTools(s *server.MCPServer, pool *pgxpool.Pool) {
	s.AddTool(mcp.NewTool("get_welcome_banner",
		mcp.WithDescription("Pre-rendered opening banner: 6-step workflow map with active step marked, progress bar, and next action. Output verbatim — no model rendering needed."),
		mcp.WithString("repo", mcp.Description("Repository name. If omitted, uses most recently active repo.")),
		mcp.WithReadOnlyHintAnnotation(true),
	), func(ctx context.Context, req mcp.CallToolRequest) (*mcp.CallToolResult, error) {
		repo := req.GetString("repo", "")

		// If no repo given, find most recently updated loop_state
		if repo == "" {
			pool.QueryRow(ctx,
				`SELECT repo FROM loop_state ORDER BY updated_at DESC LIMIT 1`,
			).Scan(&repo)
		}

		// Fetch step panels
		rows, err := pool.Query(ctx,
			`SELECT panel_id, title, content, sort_order
			 FROM ui_panels ORDER BY sort_order`)
		if err != nil {
			return nil, fmt.Errorf("get_welcome_banner panels: %w", err)
		}
		var panels []uiPanel
		for rows.Next() {
			var p uiPanel
			if scanErr := rows.Scan(&p.ID, &p.Title, &p.Content, &p.SortOrder); scanErr != nil {
				rows.Close()
				return nil, scanErr
			}
			panels = append(panels, p)
		}
		rows.Close()

		// Fetch live loop state
		var phase, run string
		var goal *string
		pool.QueryRow(ctx,
			`SELECT phase, run, goal FROM loop_state WHERE repo=$1`, repo,
		).Scan(&phase, &run, &goal)

		// Fetch pending task count
		var pending int
		pool.QueryRow(ctx,
			`SELECT COUNT(*) FROM plan_tasks WHERE repo=$1 AND status='pending'`, repo,
		).Scan(&pending)

		// Fetch last run summary
		var lastRun string
		var lastTime time.Time
		if scanErr := pool.QueryRow(ctx,
			`SELECT summary, created_at FROM run_history WHERE repo=$1
			 ORDER BY created_at DESC LIMIT 1`, repo,
		).Scan(&lastRun, &lastTime); scanErr == nil {
			lastRun = fmt.Sprintf("[%s] %s", lastTime.Format("15:04"), lastRun)
		}

		state := resolveState(phase, run, pending)
		banner := renderBanner(panels, state, phase, run, lastRun, repo)

		result := map[string]any{
			"banner":      banner,
			"repo":        repo,
			"active_step": state.activeStep,
		}
		b, _ := json.Marshal(result)
		return mcp.NewToolResultText(string(b)), nil
	})
}
