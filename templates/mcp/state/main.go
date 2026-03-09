package main

import (
	"context"
	_ "embed"
	"fmt"
	"os"

	"github.com/castrojo/opencode-state-mcp/db"
	"github.com/castrojo/opencode-state-mcp/tools"
	"github.com/mark3labs/mcp-go/server"
)

//go:embed schema.sql
var schema string

func main() {
	ctx := context.Background()

	pool, err := db.NewPool(ctx)
	if err != nil {
		fmt.Fprintf(os.Stderr, "db connect: %v\n", err)
		os.Exit(1)
	}
	defer pool.Close()

	if err := db.Migrate(ctx, pool, schema); err != nil {
		fmt.Fprintf(os.Stderr, "migrate: %v\n", err)
		os.Exit(1)
	}

	s := server.NewMCPServer(
		"workflow-state",
		"1.0.0",
		server.WithToolCapabilities(true),
	)

	tools.RegisterLoopTools(s, pool)
	tools.RegisterPlanTools(s, pool)
	tools.RegisterRulesTools(s, pool)
	tools.RegisterSessionTools(s, pool)

	if err := server.ServeStdio(s); err != nil {
		fmt.Fprintf(os.Stderr, "serve: %v\n", err)
		os.Exit(1)
	}
}
