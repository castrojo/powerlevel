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

func RegisterLoopTools(s *server.MCPServer, pool *pgxpool.Pool) {
	s.AddTool(mcp.NewTool("get_loop_state",
		mcp.WithDescription("Get active loop state for a repository"),
		mcp.WithString("repo", mcp.Required(), mcp.Description("Repository name, e.g. 'powerlevel'")),
		mcp.WithReadOnlyHintAnnotation(true),
	), func(ctx context.Context, req mcp.CallToolRequest) (*mcp.CallToolResult, error) {
		repo, err := req.RequireString("repo")
		if err != nil {
			return nil, err
		}
		var phase, run string
		var goal *string
		var updatedAt time.Time
		qerr := pool.QueryRow(ctx,
			`SELECT phase, run, goal, updated_at FROM loop_state WHERE repo = $1`, repo,
		).Scan(&phase, &run, &goal, &updatedAt)
		if qerr != nil {
			return mcp.NewToolResultText("no active loop state"), nil
		}
		goalStr := ""
		if goal != nil {
			goalStr = *goal
		}
		result := map[string]any{
			"repo": repo, "phase": phase, "run": run,
			"goal": goalStr, "updated_at": updatedAt.Format(time.RFC3339),
		}
		b, _ := json.Marshal(result)
		return mcp.NewToolResultText(string(b)), nil
	})

	s.AddTool(mcp.NewTool("set_loop_state",
		mcp.WithDescription("Upsert loop state for a repository"),
		mcp.WithString("repo", mcp.Required(), mcp.Description("Repository name")),
		mcp.WithString("phase", mcp.Required(), mcp.Description("Current phase, e.g. 'fix 1/1'")),
		mcp.WithString("run", mcp.Required(), mcp.Description("Run progress, e.g. '2/3'")),
		mcp.WithString("goal", mcp.Description("Loop goal description")),
	), func(ctx context.Context, req mcp.CallToolRequest) (*mcp.CallToolResult, error) {
		repo, err := req.RequireString("repo")
		if err != nil {
			return nil, err
		}
		phase, err := req.RequireString("phase")
		if err != nil {
			return nil, err
		}
		run, err := req.RequireString("run")
		if err != nil {
			return nil, err
		}
		goal := req.GetString("goal", "")
		_, qerr := pool.Exec(ctx,
			`INSERT INTO loop_state (repo, phase, run, goal, updated_at)
			 VALUES ($1, $2, $3, $4, NOW())
			 ON CONFLICT (repo) DO UPDATE
			 SET phase = $2, run = $3, goal = $4, updated_at = NOW()`,
			repo, phase, run, goal,
		)
		if qerr != nil {
			return nil, fmt.Errorf("set_loop_state: %w", qerr)
		}
		return mcp.NewToolResultText("ok"), nil
	})

	s.AddTool(mcp.NewTool("append_run_summary",
		mcp.WithDescription("Record a completed loop run's summary and findings"),
		mcp.WithString("repo", mcp.Required(), mcp.Description("Repository name")),
		mcp.WithNumber("run_num", mcp.Required(), mcp.Description("Run number")),
		mcp.WithString("summary", mcp.Required(), mcp.Description("One-paragraph run summary")),
		mcp.WithString("findings", mcp.Description("Bullet-point findings or discoveries")),
		mcp.WithString("plan_id", mcp.Description("Plan ID if run was part of a plan")),
		mcp.WithString("phase", mcp.Description("Phase label")),
	), func(ctx context.Context, req mcp.CallToolRequest) (*mcp.CallToolResult, error) {
		repo, err := req.RequireString("repo")
		if err != nil {
			return nil, err
		}
		runNum, err := req.RequireFloat("run_num")
		if err != nil {
			return nil, err
		}
		summary, err := req.RequireString("summary")
		if err != nil {
			return nil, err
		}
		findings := req.GetString("findings", "")
		planID := req.GetString("plan_id", "")
		phase := req.GetString("phase", "")
		_, qerr := pool.Exec(ctx,
			`INSERT INTO run_history (repo, plan_id, phase, run_num, summary, findings)
			 VALUES ($1, NULLIF($2,''), NULLIF($3,''), $4, $5, NULLIF($6,''))`,
			repo, planID, phase, int(runNum), summary, findings,
		)
		if qerr != nil {
			return nil, fmt.Errorf("append_run_summary: %w", qerr)
		}
		return mcp.NewToolResultText("ok"), nil
	})

	s.AddTool(mcp.NewTool("get_run_history",
		mcp.WithDescription("List run history for a repo. Replaces podman exec psql for reviewing past loop runs. Supports optional keyword filter and phase filter."),
		mcp.WithString("repo", mcp.Required(), mcp.Description("Repository name")),
		mcp.WithString("filter", mcp.Description("Optional keyword to filter summary/findings (case-insensitive, e.g. '[GAP]')")),
		mcp.WithString("phase", mcp.Description("Optional phase label to filter by, e.g. 'audit'")),
		mcp.WithReadOnlyHintAnnotation(true),
	), func(ctx context.Context, req mcp.CallToolRequest) (*mcp.CallToolResult, error) {
		repo, err := req.RequireString("repo")
		if err != nil {
			return nil, err
		}
		filter := req.GetString("filter", "")
		phase := req.GetString("phase", "")

		rows, qerr := pool.Query(ctx,
			`SELECT run_num, phase, summary, findings, created_at
			 FROM run_history
			 WHERE repo = $1
			   AND ($2 = '' OR phase = $2)
			   AND ($3 = '' OR summary ILIKE '%' || $3 || '%' OR findings ILIKE '%' || $3 || '%')
			 ORDER BY created_at DESC
			 LIMIT 20`,
			repo, phase, filter)
		if qerr != nil {
			return nil, fmt.Errorf("get_run_history: %w", qerr)
		}
		defer rows.Close()

		type runRow struct {
			RunNum    *int    `json:"run_num,omitempty"`
			Phase     *string `json:"phase,omitempty"`
			Summary   *string `json:"summary,omitempty"`
			Findings  *string `json:"findings,omitempty"`
			CreatedAt string  `json:"created_at"`
		}
		var result []runRow
		for rows.Next() {
			var r runRow
			var createdAt time.Time
			if scanErr := rows.Scan(&r.RunNum, &r.Phase, &r.Summary, &r.Findings, &createdAt); scanErr != nil {
				return nil, scanErr
			}
			r.CreatedAt = createdAt.Format(time.RFC3339)
			result = append(result, r)
		}
		if result == nil {
			result = []runRow{}
		}
		b, _ := json.Marshal(result)
		return mcp.NewToolResultText(string(b)), nil
	})
}
