package main

import (
	"fmt"
	"os"
	"path/filepath"
	"strings"

	"github.com/castrojo/powerlevel/internal/data"
	"github.com/castrojo/powerlevel/internal/renderer"
)

const W = 152 // 1440p sweet spot

func dataPath() string {
	home, _ := os.UserHomeDir()
	return filepath.Join(home, "src", "powerlevel", "data", "powerlevel-data.json")
}

func main() {
	showAll := false
	showWidget := false
	showJSON := false
	showLink := false
	for _, arg := range os.Args[1:] {
		switch arg {
		case "--all":
			showAll = true
		case "--widget":
			showWidget = true
		case "--json":
			showJSON = true
		case "--link":
			showLink = true
		}
	}

	if showLink {
		d, err := data.Load(dataPath())
		if err != nil {
			fmt.Fprintf(os.Stderr, "pl: %v\n", err)
			os.Exit(1)
		}
		pl := data.ComputePL(d.Weapons)
		rank := data.GetRank(pl)
		fmt.Printf("🔆 ◆ %d %s — https://castrojo.github.io/powerlevel/\n", pl, rank)
		os.Exit(0)
	}

	d, err := data.Load(dataPath())
	if err != nil {
		fmt.Fprintf(os.Stderr, "pl: %v\n", err)
		os.Exit(1)
	}

	pl := data.ComputePL(d.Weapons)
	rank := data.GetRank(pl)
	plC := renderer.PLColor(pl)
	plStr := fmt.Sprintf("%s◆ %d%s", plC, pl, renderer.E)

	if showWidget {
		fmt.Printf("🔆 %s◆ %d%s · %s · %s", plC, pl, renderer.E, rank, d.Season.Name)
		return
	}

	if showJSON {
		// minimal JSON output for scripts
		fmt.Printf(`{"pl":%d,"rank":%q,"season":%q}`, pl, rank, d.Season.Name)
		return
	}

	// Detect active subclasses (highest avg level, top 2)
	active := detectActive(d.Weapons)

	// Build element avg strip
	avgs := make([]string, len(renderer.Elements))
	for i, spec := range renderer.Elements {
		avg := data.SubclassAvg(spec.Element, d.Weapons)
		avgs[i] = fmt.Sprintf("%s %d", spec.Icon, avg)
	}

	// Header
	sep := strings.Repeat("━", W)
	fmt.Println(sep)
	fmt.Printf("  %s@castrojo%s  %s · Titan   🔆 %s   Active: %s   %s\n",
		renderer.Bold, renderer.E,
		rank, plStr,
		formatActive(active),
		d.Season.Name,
	)
	fmt.Println(sep)
	fmt.Println()

	if showAll {
		elems := renderer.Elements
		for i := 0; i < len(elems); i += 2 {
			if i+1 < len(elems) {
				for _, row := range renderer.SideBySide(elems[i], elems[i+1], d.Weapons, W/2-3) {
					fmt.Println(row)
				}
			} else {
				for _, row := range renderer.RenderCol(elems[i], d.Weapons, W) {
					fmt.Println(row)
				}
			}
			fmt.Println()
		}
	} else {
		// Show 2 active subclasses
		left := renderer.Elements[active[0]]
		right := renderer.Elements[active[1]]
		for _, row := range renderer.SideBySide(left, right, d.Weapons, W/2-3) {
			fmt.Println(row)
		}
		fmt.Println()
	}

	// Footer
	thin := strings.Repeat("─", W)
	fmt.Println(thin)
	fmt.Printf("  %s   New Light ◆ 1  Veteran ◆ 50  Mastercrafted ◆ 100\n", strings.Join(avgs, "  "))
	fmt.Printf("  🔆 POWERLEVEL %s◆ %d%s   (%s)   --all for full view\n", plC, pl, renderer.E, rank)
	fmt.Println(thin)
}

// detectActive returns indices into renderer.Elements for the top 2 most-leveled subclasses.
func detectActive(weapons map[string]data.Weapon) [2]int {
	type score struct{ idx, avg int }
	scores := make([]score, len(renderer.Elements))
	for i, spec := range renderer.Elements {
		scores[i] = score{i, data.SubclassAvg(spec.Element, weapons)}
	}
	// sort descending
	for i := 0; i < len(scores)-1; i++ {
		for j := i + 1; j < len(scores); j++ {
			if scores[j].avg > scores[i].avg {
				scores[i], scores[j] = scores[j], scores[i]
			}
		}
	}
	if scores[0].idx == scores[1].idx || scores[0].avg == 0 {
		return [2]int{3, 0} // strand + arc as defaults
	}
	return [2]int{scores[0].idx, scores[1].idx}
}

func formatActive(active [2]int) string {
	l := renderer.Elements[active[0]]
	r := renderer.Elements[active[1]]
	return fmt.Sprintf("%s %s + %s %s", l.Icon, l.Name, r.Icon, r.Name)
}
