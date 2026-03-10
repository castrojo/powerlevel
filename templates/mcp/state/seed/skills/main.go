package main

import (
	"bufio"
	"context"
	"fmt"
	"os"
	"path/filepath"
	"regexp"
	"strings"

	"github.com/castrojo/opencode-state-mcp/db"
	"github.com/jackc/pgx/v5/pgxpool"
)

var sectionRe = regexp.MustCompile(`^#{1,3}\s+(.+)`)

func main() {
	skillsDirs := []string{
		os.ExpandEnv("$HOME/.config/opencode/skills/personal"),
		os.ExpandEnv("$HOME/.config/opencode/skills/superpowers"),
		os.ExpandEnv("$HOME/.config/opencode/agents/skills"),
	}

	ctx := context.Background()
	pool, err := db.NewPool(ctx)
	if err != nil {
		fmt.Fprintf(os.Stderr, "db: %v\n", err)
		os.Exit(1)
	}
	defer pool.Close()

	for _, dir := range skillsDirs {
		matches, _ := filepath.Glob(filepath.Join(dir, "*/SKILL.md"))
		for _, path := range matches {
			skillName := filepath.Base(filepath.Dir(path))
			if err := seedSkill(ctx, pool, skillName, path); err != nil {
				fmt.Fprintf(os.Stderr, "seed %s: %v\n", skillName, err)
			}
		}
	}
}

func seedSkill(ctx context.Context, pool *pgxpool.Pool, skillName, path string) error {
	f, err := os.Open(path)
	if err != nil {
		return fmt.Errorf("open: %w", err)
	}
	defer f.Close()

	type section struct{ heading, content string }
	var sections []section
	var cur section
	scanner := bufio.NewScanner(f)
	for scanner.Scan() {
		line := scanner.Text()
		if m := sectionRe.FindStringSubmatch(line); m != nil {
			if cur.heading != "" && strings.TrimSpace(cur.content) != "" {
				sections = append(sections, cur)
			}
			cur = section{heading: m[1]}
		} else {
			cur.content += line + "\n"
		}
	}
	if cur.heading != "" && strings.TrimSpace(cur.content) != "" {
		sections = append(sections, cur)
	}

	// Collect the headings that exist on disk for this skill.
	liveHeadings := make([]string, 0, len(sections))
	for _, sec := range sections {
		liveHeadings = append(liveHeadings, sec.heading)
	}

	// Delete any DB rows whose section heading is no longer in the SKILL.md.
	// This is what makes the seeder declarative: DB state = disk state after every run.
	tag, err := pool.Exec(ctx,
		`DELETE FROM skill_sections WHERE skill=$1 AND NOT (section = ANY($2))`,
		skillName, liveHeadings,
	)
	if err != nil {
		return fmt.Errorf("delete orphans %s: %w", skillName, err)
	}
	if tag.RowsAffected() > 0 {
		fmt.Printf("pruned:  %s — %d orphaned section(s) removed\n", skillName, tag.RowsAffected())
	}

	// Upsert all live sections.
	for i, sec := range sections {
		_, qerr := pool.Exec(ctx,
			`INSERT INTO skill_sections (skill, section, content, position, updated_at)
			 VALUES ($1, $2, $3, $4, NOW())
			 ON CONFLICT (skill, section) DO UPDATE
			 SET content=$3, position=$4, updated_at=NOW()`,
			skillName, sec.heading, sec.heading+"\n\n"+sec.content, i,
		)
		if qerr != nil {
			return fmt.Errorf("upsert %s/%s: %w", skillName, sec.heading, qerr)
		}
		fmt.Printf("seeded:  %s / %s\n", skillName, sec.heading)
	}
	return nil
}
