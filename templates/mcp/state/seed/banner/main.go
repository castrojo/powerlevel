package main

import (
	"context"
	"fmt"
	"os"

	"github.com/castrojo/opencode-state-mcp/db"
)

type panel struct {
	id        string
	title     string
	content   string
	sortOrder int
}

var panels = []panel{
	{"step-1", "Preflight", "sync state, surface active work", 1},
	{"step-2", "Design", "explore requirements, define scope", 2},
	{"step-3", "Plan", "break into tasks, map dependencies", 3},
	{"step-4", "Build", "run iterations in container", 4},
	{"step-5", "Gate", "review output, advance phase", 5},
	{"step-6", "Postflight", "ship, backport, commit, sync", 6},
}

func main() {
	ctx := context.Background()
	pool, err := db.NewPool(ctx)
	if err != nil {
		fmt.Fprintf(os.Stderr, "db: %v\n", err)
		os.Exit(1)
	}
	defer pool.Close()

	for _, p := range panels {
		_, qerr := pool.Exec(ctx,
			`INSERT INTO ui_panels (panel_id, title, content, sort_order, updated_at)
			 VALUES ($1, $2, $3, $4, NOW())
			 ON CONFLICT (panel_id) DO UPDATE
			 SET title=$2, content=$3, sort_order=$4, updated_at=NOW()`,
			p.id, p.title, p.content, p.sortOrder,
		)
		if qerr != nil {
			fmt.Fprintf(os.Stderr, "upsert %s: %v\n", p.id, qerr)
		} else {
			fmt.Printf("seeded: %s — %s\n", p.title, p.content)
		}
	}
}
