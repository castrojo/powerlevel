package tools

import (
	"context"
	"encoding/json"
	"fmt"
	"strings"
	"time"

	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"
	"github.com/mark3labs/mcp-go/mcp"
	"github.com/mark3labs/mcp-go/server"
)

type Task struct {
	TaskNum     int    `json:"task_num"`
	Description string `json:"description"`
}

func RegisterPlanTools(s *server.MCPServer, pool *pgxpool.Pool) {
	s.AddTool(mcp.NewTool("import_plan",
		mcp.WithDescription("Seed plan tasks into the DB from a parsed plan. Upserts — safe to re-run."),
		mcp.WithString("repo", mcp.Required(), mcp.Description("Repository name")),
		mcp.WithString("plan_id", mcp.Required(), mcp.Description("Plan identifier, e.g. '2026-03-09-workflow-db'")),
		mcp.WithString("tasks", mcp.Required(), mcp.Description("JSON array of {task_num, description}")),
	), func(ctx context.Context, req mcp.CallToolRequest) (*mcp.CallToolResult, error) {
		repo, err := req.RequireString("repo")
		if err != nil {
			return nil, err
		}
		planID, err := req.RequireString("plan_id")
		if err != nil {
			return nil, err
		}
		tasksJSON, err := req.RequireString("tasks")
		if err != nil {
			return nil, err
		}
		var tasks []Task
		if err := json.Unmarshal([]byte(tasksJSON), &tasks); err != nil {
			return nil, fmt.Errorf("import_plan: parse tasks: %w", err)
		}
		tx, txErr := pool.Begin(ctx)
		if txErr != nil {
			return nil, fmt.Errorf("import_plan begin: %w", txErr)
		}
		defer tx.Rollback(ctx)
		for _, t := range tasks {
			_, qerr := tx.Exec(ctx,
				`INSERT INTO plan_tasks (repo, plan_id, task_num, description, status)
				 VALUES ($1, $2, $3, $4, 'pending')
				 ON CONFLICT (repo, plan_id, task_num) DO UPDATE
				 SET description = $4`,
				repo, planID, t.TaskNum, t.Description,
			)
			if qerr != nil {
				return nil, fmt.Errorf("import_plan task %d: %w", t.TaskNum, qerr)
			}
		}
		if commitErr := tx.Commit(ctx); commitErr != nil {
			return nil, fmt.Errorf("import_plan commit: %w", commitErr)
		}
		return mcp.NewToolResultText(fmt.Sprintf("imported %d tasks", len(tasks))), nil
	})

	s.AddTool(mcp.NewTool("claim_task",
		mcp.WithDescription("Atomically claim the next pending task for an agent. Safe for parallel subagents."),
		mcp.WithString("repo", mcp.Required(), mcp.Description("Repository name")),
		mcp.WithString("plan_id", mcp.Required(), mcp.Description("Plan identifier")),
		mcp.WithString("agent_id", mcp.Required(), mcp.Description("Unique agent identifier")),
	), func(ctx context.Context, req mcp.CallToolRequest) (*mcp.CallToolResult, error) {
		repo, err := req.RequireString("repo")
		if err != nil {
			return nil, err
		}
		planID, err := req.RequireString("plan_id")
		if err != nil {
			return nil, err
		}
		agentID, err := req.RequireString("agent_id")
		if err != nil {
			return nil, err
		}

		tx, txErr := pool.Begin(ctx)
		if txErr != nil {
			return nil, fmt.Errorf("claim_task begin: %w", txErr)
		}
		defer tx.Rollback(ctx)

		var taskNum int
		var description string
		scanErr := tx.QueryRow(ctx,
			`SELECT task_num, description FROM plan_tasks
			 WHERE repo = $1 AND plan_id = $2 AND status = 'pending'
			 ORDER BY task_num
			 LIMIT 1
			 FOR UPDATE SKIP LOCKED`,
			repo, planID,
		).Scan(&taskNum, &description)
		if scanErr != nil {
			return mcp.NewToolResultText(`{"claimed":false,"reason":"no pending tasks"}`), nil
		}

		_, updErr := tx.Exec(ctx,
			`UPDATE plan_tasks SET status='in_progress', claimed_by=$3, claimed_at=NOW(), updated_at=NOW()
			 WHERE repo=$1 AND plan_id=$2 AND task_num=$4`,
			repo, planID, agentID, taskNum,
		)
		if updErr != nil {
			return nil, fmt.Errorf("claim_task update: %w", updErr)
		}
		if commitErr := tx.Commit(ctx); commitErr != nil {
			return nil, fmt.Errorf("claim_task commit: %w", commitErr)
		}

		result := map[string]any{
			"claimed": true, "task_num": taskNum,
			"description": description, "agent_id": agentID,
		}
		b, _ := json.Marshal(result)
		return mcp.NewToolResultText(string(b)), nil
	})

	s.AddTool(mcp.NewTool("get_plan_tasks",
		mcp.WithDescription("List tasks for a plan, optionally filtered by status"),
		mcp.WithString("repo", mcp.Required(), mcp.Description("Repository name")),
		mcp.WithString("plan_id", mcp.Required(), mcp.Description("Plan identifier")),
		mcp.WithString("status", mcp.Description("Filter: pending, in_progress, done, skipped")),
		mcp.WithReadOnlyHintAnnotation(true),
	), func(ctx context.Context, req mcp.CallToolRequest) (*mcp.CallToolResult, error) {
		repo, err := req.RequireString("repo")
		if err != nil {
			return nil, err
		}
		planID, err := req.RequireString("plan_id")
		if err != nil {
			return nil, err
		}
		status := req.GetString("status", "")

		var rows pgx.Rows
		var qerr error
		if status != "" {
			rows, qerr = pool.Query(ctx,
				`SELECT task_num, description, status, claimed_by, notes
				 FROM plan_tasks WHERE repo=$1 AND plan_id=$2 AND status=$3
				 ORDER BY task_num`, repo, planID, status)
		} else {
			rows, qerr = pool.Query(ctx,
				`SELECT task_num, description, status, claimed_by, notes
				 FROM plan_tasks WHERE repo=$1 AND plan_id=$2
				 ORDER BY task_num`, repo, planID)
		}
		if qerr != nil {
			return nil, fmt.Errorf("get_plan_tasks: %w", qerr)
		}
		defer rows.Close()

		type row struct {
			TaskNum     int     `json:"task_num"`
			Description string  `json:"description"`
			Status      string  `json:"status"`
			ClaimedBy   *string `json:"claimed_by,omitempty"`
			Notes       *string `json:"notes,omitempty"`
		}
		var result []row
		for rows.Next() {
			var r row
			if scanErr := rows.Scan(&r.TaskNum, &r.Description, &r.Status, &r.ClaimedBy, &r.Notes); scanErr != nil {
				return nil, scanErr
			}
			result = append(result, r)
		}
		b, _ := json.Marshal(result)
		return mcp.NewToolResultText(string(b)), nil
	})

	s.AddTool(mcp.NewTool("update_task_status",
		mcp.WithDescription("Update a task's status and optional notes"),
		mcp.WithString("repo", mcp.Required(), mcp.Description("Repository name")),
		mcp.WithString("plan_id", mcp.Required(), mcp.Description("Plan identifier")),
		mcp.WithNumber("task_num", mcp.Required(), mcp.Description("Task number")),
		mcp.WithString("status", mcp.Required(), mcp.Description("New status: pending, in_progress, done, skipped")),
		mcp.WithString("notes", mcp.Description("Optional completion notes")),
	), func(ctx context.Context, req mcp.CallToolRequest) (*mcp.CallToolResult, error) {
		repo, err := req.RequireString("repo")
		if err != nil {
			return nil, err
		}
		planID, err := req.RequireString("plan_id")
		if err != nil {
			return nil, err
		}
		taskNumF, err := req.RequireFloat("task_num")
		if err != nil {
			return nil, err
		}
		status, err := req.RequireString("status")
		if err != nil {
			return nil, err
		}
		notes := req.GetString("notes", "")
		_, qerr := pool.Exec(ctx,
			`UPDATE plan_tasks SET status=$4, notes=NULLIF($5,''), updated_at=NOW()
			 WHERE repo=$1 AND plan_id=$2 AND task_num=$3`,
			repo, planID, int(taskNumF), status, notes,
		)
		if qerr != nil {
			return nil, fmt.Errorf("update_task_status: %w", qerr)
		}
		return mcp.NewToolResultText("ok"), nil
	})

	s.AddTool(mcp.NewTool("export_plan",
		mcp.WithDescription("Export plan tasks as a markdown checklist for git commit"),
		mcp.WithString("repo", mcp.Required(), mcp.Description("Repository name")),
		mcp.WithString("plan_id", mcp.Required(), mcp.Description("Plan identifier")),
		mcp.WithReadOnlyHintAnnotation(true),
	), func(ctx context.Context, req mcp.CallToolRequest) (*mcp.CallToolResult, error) {
		repo, err := req.RequireString("repo")
		if err != nil {
			return nil, err
		}
		planID, err := req.RequireString("plan_id")
		if err != nil {
			return nil, err
		}
		rows, qerr := pool.Query(ctx,
			`SELECT task_num, description, status, notes FROM plan_tasks
			 WHERE repo=$1 AND plan_id=$2 ORDER BY task_num`, repo, planID)
		if qerr != nil {
			return nil, fmt.Errorf("export_plan: %w", qerr)
		}
		defer rows.Close()

		var sb strings.Builder
		sb.WriteString(fmt.Sprintf("# Plan: %s / %s\n\n", repo, planID))
		sb.WriteString(fmt.Sprintf("_Exported: %s_\n\n", time.Now().Format("2006-01-02 15:04")))
		for rows.Next() {
			var taskNum int
			var description, status string
			var notes *string
			if scanErr := rows.Scan(&taskNum, &description, &status, &notes); scanErr != nil {
				return nil, scanErr
			}
			check := " "
			if status == "done" {
				check = "x"
			} else if status == "skipped" {
				check = "~"
			}
			sb.WriteString(fmt.Sprintf("- [%s] **Task %d:** %s\n", check, taskNum, description))
			if notes != nil && *notes != "" {
				sb.WriteString(fmt.Sprintf("  - %s\n", *notes))
			}
		}
		return mcp.NewToolResultText(sb.String()), nil
	})
}
