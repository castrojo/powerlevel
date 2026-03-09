package main

import (
	"bufio"
	"context"
	"fmt"
	"os"
	"regexp"
	"strings"

	"github.com/castrojo/opencode-state-mcp/db"
)

var headingRe = regexp.MustCompile(`^##\s+(.+)`)

func main() {
	agentsPath := os.ExpandEnv("$HOME/.config/opencode/AGENTS.md")
	f, err := os.Open(agentsPath)
	if err != nil {
		fmt.Fprintf(os.Stderr, "open: %v\n", err)
		os.Exit(1)
	}
	defer f.Close()

	ctx := context.Background()
	pool, err := db.NewPool(ctx)
	if err != nil {
		fmt.Fprintf(os.Stderr, "db: %v\n", err)
		os.Exit(1)
	}
	defer pool.Close()

	type section struct{ heading, content string }
	var sections []section
	var cur section
	scanner := bufio.NewScanner(f)
	for scanner.Scan() {
		line := scanner.Text()
		if m := headingRe.FindStringSubmatch(line); m != nil {
			if cur.heading != "" && strings.TrimSpace(cur.content) != "" {
				sections = append(sections, cur)
			}
			cur = section{heading: m[1]}
		} else {
			cur.content += line + "\n"
		}
	}
	if cur.heading != "" {
		sections = append(sections, cur)
	}

	for _, sec := range sections {
		id := strings.ToLower(strings.ReplaceAll(sec.heading, " ", "-"))
		id = regexp.MustCompile(`[^a-z0-9-]`).ReplaceAllString(id, "")
		domain := inferDomain(sec.heading)
		_, qerr := pool.Exec(ctx,
			`INSERT INTO rules (id, domain, content, updated_at)
			 VALUES ($1, $2, $3, NOW())
			 ON CONFLICT (id) DO UPDATE SET domain=$2, content=$3, updated_at=NOW()`,
			id, domain, sec.heading+"\n\n"+sec.content,
		)
		if qerr != nil {
			fmt.Fprintf(os.Stderr, "upsert %s: %v\n", id, qerr)
		} else {
			fmt.Printf("seeded: %s (%s)\n", id, domain)
		}
	}
}

func inferDomain(heading string) string {
	h := strings.ToLower(heading)
	switch {
	case strings.Contains(h, "git") || strings.Contains(h, "commit") || strings.Contains(h, "branch"):
		return "git"
	case strings.Contains(h, "pr") || strings.Contains(h, "pull request"):
		return "pr"
	case strings.Contains(h, "loop"):
		return "loop"
	case strings.Contains(h, "mcp"):
		return "mcp"
	case strings.Contains(h, "session"):
		return "session"
	case strings.Contains(h, "container") || strings.Contains(h, "devaipod"):
		return "container"
	default:
		return "general"
	}
}
