package tools

import (
	"context"
	"encoding/json"
	"fmt"

	"github.com/jackc/pgx/v5/pgxpool"
	"github.com/mark3labs/mcp-go/mcp"
	"github.com/mark3labs/mcp-go/server"
)

func RegisterSessionTools(s *server.MCPServer, pool *pgxpool.Pool) {
	s.AddTool(mcp.NewTool("get_session_context",
		mcp.WithDescription("Get a compact session summary: loop state, pending task count, and latest run. Call at session start instead of loading loop-state.md and plan files."),
		mcp.WithString("repo", mcp.Required(), mcp.Description("Repository name")),
		mcp.WithReadOnlyHintAnnotation(true),
	), func(ctx context.Context, req mcp.CallToolRequest) (*mcp.CallToolResult, error) {
		repo, err := req.RequireString("repo")
		if err != nil {
			return nil, err
		}

		type sessionCtx struct {
			Repo         string  `json:"repo"`
			Phase        string  `json:"phase"`
			Run          string  `json:"run"`
			Goal         string  `json:"goal"`
			PendingCount int     `json:"pending_tasks"`
			ProgressBar  string  `json:"progress_bar,omitempty"`
			LatestRun    *string `json:"latest_run_summary,omitempty"`
		}

		var sc sessionCtx
		sc.Repo = repo

		// Single CTE: fetch loop state, pending task count, and latest run in one round-trip.
		var phase, run, goal, pending, latestSummary, latestCreatedAt *string
		_ = pool.QueryRow(ctx, `
			WITH loop AS (
				SELECT phase, run, goal FROM loop_state WHERE repo = $1
			),
			pending AS (
				SELECT COUNT(*)::text AS cnt FROM plan_tasks
				WHERE repo = $1 AND status = 'pending'
			),
			latest_run AS (
				SELECT summary, created_at::text FROM run_history
				WHERE repo = $1 ORDER BY created_at DESC LIMIT 1
			)
			SELECT
				l.phase, l.run, l.goal,
				p.cnt,
				r.summary, r.created_at
			FROM (SELECT 1) AS dummy
			LEFT JOIN loop l ON TRUE
			LEFT JOIN pending p ON TRUE
			LEFT JOIN latest_run r ON TRUE
		`, repo).Scan(&phase, &run, &goal, &pending, &latestSummary, &latestCreatedAt)

		if phase != nil {
			sc.Phase = *phase
		}
		if run != nil {
			sc.Run = *run
		}
		if goal != nil {
			sc.Goal = *goal
		}
		if sc.Run != "" {
			sc.ProgressBar = progressBar(sc.Run)
		}
		if pending != nil {
			fmt.Sscanf(*pending, "%d", &sc.PendingCount)
		}
		if latestSummary != nil && latestCreatedAt != nil {
			s := fmt.Sprintf("[%s] %s", (*latestCreatedAt)[:16], *latestSummary)
			sc.LatestRun = &s
		}

		b, _ := json.Marshal(sc)
		return mcp.NewToolResultText(string(b)), nil
	})
}
