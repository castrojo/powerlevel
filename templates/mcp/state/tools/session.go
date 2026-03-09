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
			LatestRun    *string `json:"latest_run_summary,omitempty"`
		}

		var sc sessionCtx
		sc.Repo = repo

		// loop state — ignore error (no row = empty state)
		var goal *string
		pool.QueryRow(ctx,
			`SELECT phase, run, goal FROM loop_state WHERE repo=$1`, repo,
		).Scan(&sc.Phase, &sc.Run, &goal)
		if goal != nil {
			sc.Goal = *goal
		}

		// pending task count
		pool.QueryRow(ctx,
			`SELECT COUNT(*) FROM plan_tasks WHERE repo=$1 AND status='pending'`, repo,
		).Scan(&sc.PendingCount)

		// latest run summary
		var summary string
		var createdAt time.Time
		runErr := pool.QueryRow(ctx,
			`SELECT summary, created_at FROM run_history WHERE repo=$1
			 ORDER BY created_at DESC LIMIT 1`, repo,
		).Scan(&summary, &createdAt)
		if runErr == nil {
			s := fmt.Sprintf("[%s] %s", createdAt.Format("15:04"), summary)
			sc.LatestRun = &s
		}

		b, _ := json.Marshal(sc)
		return mcp.NewToolResultText(string(b)), nil
	})
}
