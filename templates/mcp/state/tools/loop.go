package tools

import (
	"context"
	"encoding/json"
	"fmt"
	"strconv"
	"strings"
	"time"

	"github.com/jackc/pgx/v5"
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

	s.AddTool(mcp.NewTool("record_run_complete",
		mcp.WithDescription("Composite: append_run_summary + optional update_task_status + set_loop_state in one atomic transaction"),
		mcp.WithString("repo", mcp.Required(), mcp.Description("Repository name")),
		mcp.WithNumber("run_num", mcp.Required(), mcp.Description("The run number just completed")),
		mcp.WithString("summary", mcp.Required(), mcp.Description("One-paragraph run summary")),
		mcp.WithString("phase", mcp.Required(), mcp.Description("Current phase label")),
		mcp.WithString("goal", mcp.Required(), mcp.Description("Loop goal text")),
		mcp.WithString("findings", mcp.Description("Bullet-point findings or [GAP] items")),
		mcp.WithString("plan_id", mcp.Description("Plan identifier; if provided, task_num is also used")),
		mcp.WithNumber("task_num", mcp.Description("Task number to mark done; required if plan_id is provided")),
		mcp.WithString("new_phase", mcp.Description("If provided, override the phase in the loop state update (for phase transitions)")),
	), func(ctx context.Context, req mcp.CallToolRequest) (*mcp.CallToolResult, error) {
		repo, err := req.RequireString("repo")
		if err != nil {
			return nil, err
		}
		runNumF, err := req.RequireFloat("run_num")
		if err != nil {
			return nil, err
		}
		runNum := int(runNumF)
		summary, err := req.RequireString("summary")
		if err != nil {
			return nil, err
		}
		phase, err := req.RequireString("phase")
		if err != nil {
			return nil, err
		}
		goal, err := req.RequireString("goal")
		if err != nil {
			return nil, err
		}
		findings := req.GetString("findings", "")
		planID := req.GetString("plan_id", "")
		taskNumF := req.GetFloat("task_num", 0)
		taskNum := int(taskNumF)
		newPhase := req.GetString("new_phase", "")
		if newPhase == "" {
			newPhase = phase
		}

		// REPEATABLE READ gives a consistent snapshot at transaction start,
		// preventing another transaction from modifying loop_state between
		// our read of the current run total and our write of the new run string.
		tx, txErr := pool.BeginTx(ctx, pgx.TxOptions{IsoLevel: pgx.RepeatableRead})
		if txErr != nil {
			return nil, fmt.Errorf("record_run_complete begin: %w", txErr)
		}
		defer tx.Rollback(ctx)

		// Determine run string inside the transaction.
		// Read the current total from loop_state, then write "<run_num>/<total>".
		var currentRun string
		_ = tx.QueryRow(ctx, `SELECT run FROM loop_state WHERE repo = $1`, repo).Scan(&currentRun)
		total := runNum // fallback: total = runNum if no existing state
		if currentRun != "" {
			parts := strings.SplitN(currentRun, "/", 2)
			if len(parts) == 2 {
				if t, parseErr := strconv.Atoi(parts[1]); parseErr == nil && t > 0 {
					total = t
				}
			}
		}
		newRun := fmt.Sprintf("%d/%d", runNum, total)

		// 1. INSERT run summary
		_, qerr := tx.Exec(ctx,
			`INSERT INTO run_history (repo, plan_id, phase, run_num, summary, findings)
			 VALUES ($1, NULLIF($2,''), NULLIF($3,''), $4, $5, NULLIF($6,''))`,
			repo, planID, phase, runNum, summary, findings,
		)
		if qerr != nil {
			return nil, fmt.Errorf("record_run_complete insert run_history: %w", qerr)
		}

		// 2. UPDATE plan task status if plan_id provided
		if planID != "" && taskNum > 0 {
			_, qerr = tx.Exec(ctx,
				`UPDATE plan_tasks SET status='done', updated_at=NOW()
				 WHERE repo=$1 AND plan_id=$2 AND task_num=$3`,
				repo, planID, taskNum,
			)
			if qerr != nil {
				return nil, fmt.Errorf("record_run_complete update plan_task: %w", qerr)
			}
		}

		// 3. UPSERT loop state
		_, qerr = tx.Exec(ctx,
			`INSERT INTO loop_state (repo, phase, run, goal, updated_at)
			 VALUES ($1, $2, $3, $4, NOW())
			 ON CONFLICT (repo) DO UPDATE
			 SET phase = $2, run = $3, goal = $4, updated_at = NOW()`,
			repo, newPhase, newRun, goal,
		)
		if qerr != nil {
			return nil, fmt.Errorf("record_run_complete upsert loop_state: %w", qerr)
		}

		if commitErr := tx.Commit(ctx); commitErr != nil {
			return nil, fmt.Errorf("record_run_complete commit: %w", commitErr)
		}

		return mcp.NewToolResultText(fmt.Sprintf("run %d recorded: summary inserted, loop_state updated to %s/%s", runNum, newPhase, newRun)), nil
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
			   AND ($3 = '' OR search_vec @@ plainto_tsquery('english', $3))
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
