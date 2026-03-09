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

func RegisterRulesTools(s *server.MCPServer, pool *pgxpool.Pool) {
	s.AddTool(mcp.NewTool("search_rules",
		mcp.WithDescription("Full-text search over workflow rules. Use instead of loading AGENTS.md."),
		mcp.WithString("query", mcp.Required(), mcp.Description("Search terms, e.g. 'git commit conventions'")),
		mcp.WithString("domain", mcp.Description("Optional domain filter, e.g. 'git', 'pr', 'loop', 'mcp'")),
		mcp.WithReadOnlyHintAnnotation(true),
	), func(ctx context.Context, req mcp.CallToolRequest) (*mcp.CallToolResult, error) {
		query, err := req.RequireString("query")
		if err != nil {
			return nil, err
		}
		domain := req.GetString("domain", "")

		type result struct {
			ID      string   `json:"id"`
			Domain  string   `json:"domain"`
			Content string   `json:"content"`
			Tags    []string `json:"tags"`
			Rank    float32  `json:"rank"`
		}

		var rows pgx.Rows
		var qerr error
		if domain != "" {
			rows, qerr = pool.Query(ctx,
				`SELECT id, domain, content, tags,
				        ts_rank(search_vec, websearch_to_tsquery('english',$1)) AS rank
				 FROM rules
				 WHERE domain = $2
				   AND search_vec @@ websearch_to_tsquery('english',$1)
				 ORDER BY rank DESC LIMIT 10`,
				query, domain)
		} else {
			rows, qerr = pool.Query(ctx,
				`SELECT id, domain, content, tags,
				        ts_rank(search_vec, websearch_to_tsquery('english',$1)) AS rank
				 FROM rules
				 WHERE search_vec @@ websearch_to_tsquery('english',$1)
				 ORDER BY rank DESC LIMIT 10`,
				query)
		}
		if qerr != nil {
			return nil, fmt.Errorf("search_rules: %w", qerr)
		}
		defer rows.Close()

		var results []result
		for rows.Next() {
			var r result
			if scanErr := rows.Scan(&r.ID, &r.Domain, &r.Content, &r.Tags, &r.Rank); scanErr != nil {
				return nil, scanErr
			}
			results = append(results, r)
		}
		b, _ := json.Marshal(results)
		return mcp.NewToolResultText(string(b)), nil
	})

	s.AddTool(mcp.NewTool("upsert_rule",
		mcp.WithDescription("Insert or replace a workflow rule"),
		mcp.WithString("id", mcp.Required(), mcp.Description("Unique rule ID, e.g. 'git-commit-footer'")),
		mcp.WithString("domain", mcp.Required(), mcp.Description("Domain: git, pr, loop, mcp, session, etc.")),
		mcp.WithString("content", mcp.Required(), mcp.Description("Full rule text")),
		mcp.WithString("tags", mcp.Description("Comma-separated tags")),
	), func(ctx context.Context, req mcp.CallToolRequest) (*mcp.CallToolResult, error) {
		id, err := req.RequireString("id")
		if err != nil {
			return nil, err
		}
		domain, err := req.RequireString("domain")
		if err != nil {
			return nil, err
		}
		content, err := req.RequireString("content")
		if err != nil {
			return nil, err
		}
		tagsStr := req.GetString("tags", "")
		var tags []string
		if tagsStr != "" {
			for _, t := range strings.Split(tagsStr, ",") {
				tags = append(tags, strings.TrimSpace(t))
			}
		}
		_, qerr := pool.Exec(ctx,
			`INSERT INTO rules (id, domain, content, tags, updated_at)
			 VALUES ($1, $2, $3, $4, NOW())
			 ON CONFLICT (id) DO UPDATE
			 SET domain=$2, content=$3, tags=$4, updated_at=NOW()`,
			id, domain, content, tags,
		)
		if qerr != nil {
			return nil, fmt.Errorf("upsert_rule: %w", qerr)
		}
		return mcp.NewToolResultText("ok"), nil
	})

	s.AddTool(mcp.NewTool("search_skill",
		mcp.WithDescription("Full-text search within a skill's sections. Use instead of loading full SKILL.md."),
		mcp.WithString("skill_name", mcp.Required(), mcp.Description("Skill name, e.g. 'loop-task'")),
		mcp.WithString("query", mcp.Required(), mcp.Description("Search terms")),
		mcp.WithReadOnlyHintAnnotation(true),
	), func(ctx context.Context, req mcp.CallToolRequest) (*mcp.CallToolResult, error) {
		skillName, err := req.RequireString("skill_name")
		if err != nil {
			return nil, err
		}
		query, err := req.RequireString("query")
		if err != nil {
			return nil, err
		}

		rows, qerr := pool.Query(ctx,
			`SELECT section, content,
			        ts_rank(search_vec, websearch_to_tsquery('english',$2)) AS rank
			 FROM skill_sections
			 WHERE skill = $1
			   AND search_vec @@ websearch_to_tsquery('english',$2)
			 ORDER BY rank DESC LIMIT 5`,
			skillName, query)
		if qerr != nil {
			return nil, fmt.Errorf("search_skill: %w", qerr)
		}
		defer rows.Close()

		type result struct {
			Section string  `json:"section"`
			Content string  `json:"content"`
			Rank    float32 `json:"rank"`
		}
		var results []result
		for rows.Next() {
			var r result
			if scanErr := rows.Scan(&r.Section, &r.Content, &r.Rank); scanErr != nil {
				return nil, scanErr
			}
			results = append(results, r)
		}
		b, _ := json.Marshal(results)
		return mcp.NewToolResultText(string(b)), nil
	})

	s.AddTool(mcp.NewTool("upsert_skill_section",
		mcp.WithDescription("Insert or replace a skill section"),
		mcp.WithString("skill", mcp.Required(), mcp.Description("Skill name")),
		mcp.WithString("section", mcp.Required(), mcp.Description("Section heading")),
		mcp.WithString("content", mcp.Required(), mcp.Description("Section content")),
		mcp.WithString("tags", mcp.Description("Comma-separated tags")),
	), func(ctx context.Context, req mcp.CallToolRequest) (*mcp.CallToolResult, error) {
		skill, err := req.RequireString("skill")
		if err != nil {
			return nil, err
		}
		section, err := req.RequireString("section")
		if err != nil {
			return nil, err
		}
		content, err := req.RequireString("content")
		if err != nil {
			return nil, err
		}
		tagsStr := req.GetString("tags", "")
		var tags []string
		if tagsStr != "" {
			for _, t := range strings.Split(tagsStr, ",") {
				tags = append(tags, strings.TrimSpace(t))
			}
		}
		_, qerr := pool.Exec(ctx,
			`INSERT INTO skill_sections (skill, section, content, tags, updated_at)
			 VALUES ($1, $2, $3, $4, NOW())
			 ON CONFLICT (skill, section) DO UPDATE
			 SET content=$3, tags=$4, updated_at=NOW()`,
			skill, section, content, tags,
		)
		if qerr != nil {
			return nil, fmt.Errorf("upsert_skill_section: %w", qerr)
		}
		return mcp.NewToolResultText("ok"), nil
	})

	s.AddTool(mcp.NewTool("get_recent_skill_updates",
		mcp.WithDescription("List skills updated within a time window. Use in loop-end byproduct check instead of raw psql. Default window: 24 hours."),
		mcp.WithString("since", mcp.Description("Interval string, e.g. '24 hours', '7 days'. Defaults to '24 hours'.")),
		mcp.WithReadOnlyHintAnnotation(true),
	), func(ctx context.Context, req mcp.CallToolRequest) (*mcp.CallToolResult, error) {
		since := req.GetString("since", "24 hours")
		rows, qerr := pool.Query(ctx,
			`SELECT skill, MAX(updated_at) AS last_updated
			 FROM skill_sections
			 WHERE updated_at > NOW() - $1::interval
			 GROUP BY skill
			 ORDER BY last_updated DESC`,
			since)
		if qerr != nil {
			return nil, fmt.Errorf("get_recent_skill_updates: %w", qerr)
		}
		defer rows.Close()

		type skillUpdate struct {
			Skill       string `json:"skill"`
			LastUpdated string `json:"last_updated"`
		}
		var result []skillUpdate
		for rows.Next() {
			var su skillUpdate
			var t time.Time
			if scanErr := rows.Scan(&su.Skill, &t); scanErr != nil {
				return nil, scanErr
			}
			su.LastUpdated = t.Format(time.RFC3339)
			result = append(result, su)
		}
		if result == nil {
			result = []skillUpdate{}
		}
		b, _ := json.Marshal(result)
		return mcp.NewToolResultText(string(b)), nil
	})

	s.AddTool(mcp.NewTool("list_skills",
		mcp.WithDescription("List all skill names registered in the DB. Use instead of filesystem scans to discover available skills."),
		mcp.WithReadOnlyHintAnnotation(true),
	), func(ctx context.Context, req mcp.CallToolRequest) (*mcp.CallToolResult, error) {
		rows, qerr := pool.Query(ctx,
			`SELECT DISTINCT skill FROM skill_sections ORDER BY skill`)
		if qerr != nil {
			return nil, fmt.Errorf("list_skills: %w", qerr)
		}
		defer rows.Close()

		var skills []string
		for rows.Next() {
			var sk string
			if scanErr := rows.Scan(&sk); scanErr != nil {
				return nil, scanErr
			}
			skills = append(skills, sk)
		}
		if skills == nil {
			skills = []string{}
		}
		b, _ := json.Marshal(skills)
		return mcp.NewToolResultText(string(b)), nil
	})
}
