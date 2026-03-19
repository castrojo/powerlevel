package renderer

import (
	"fmt"
	"regexp"
	"strings"

	"github.com/castrojo/powerlevel/internal/data"
)

const (
	G    = "\033[92m"
	Y    = "\033[93m"
	R    = "\033[91m"
	Gold = "\033[33m"
	Dim  = "\033[2m"
	Bold = "\033[1m"
	E    = "\033[0m"
)

var ansiRE = regexp.MustCompile(`\033\[[0-9;]*m`)

// VisLen returns the visible (non-ANSI) length of s.
func VisLen(s string) int {
	return len(ansiRE.ReplaceAllString(s, ""))
}

// Pad pads s to visible width w.
func Pad(s string, w int) string {
	gap := w - VisLen(s)
	if gap <= 0 {
		return s
	}
	return s + strings.Repeat(" ", gap)
}

// Bar renders a level 0-100 as a filled/empty block bar.
func Bar(level, width int) string {
	level = max(0, min(100, level))
	filled := int(float64(level) / 100 * float64(width))
	empty := width - filled

	var color string
	switch {
	case level == 100:
		color = Gold
	case level >= 67:
		color = G
	case level >= 34:
		color = Y
	default:
		color = R
	}

	b := ""
	if filled > 0 {
		b += color + strings.Repeat("▰", filled) + E
	}
	if empty > 0 {
		b += Dim + strings.Repeat("▱", empty) + E
	}
	return b
}

// StatBar renders a stat score 0-100 as a bar.
func StatBar(score, width int) string {
	return Bar(score, width)
}

// PLColor returns the ANSI color for a PL value (1-100 scale).
func PLColor(pl int) string {
	switch {
	case pl >= 100:
		return Gold
	case pl >= 80:
		return G
	case pl >= 50:
		return Y
	default:
		return R
	}
}

// LevelStr returns a colored level string.
func LevelStr(level int) string {
	if level == 100 {
		return fmt.Sprintf("%s100★%s", Gold, E)
	}
	return fmt.Sprintf("%3d", level)
}

// Subclasses defines the canonical display order and grouping.
// Each entry: element, display name, icon, aspects (name → skill IDs).
type SubclassSpec struct {
	Element string
	Name    string
	Icon    string
	Aspects []AspectSpec
}

type AspectSpec struct {
	Name   string
	Skills []string
}

// Alias maps long skill IDs to short display names.
var Alias = map[string]string{
	"principal-software-engineer":  "principal-se",
	"github-actions-expert":        "gha-expert",
	"se-security-reviewer":         "se-security",
	"dakota-buildstream":           "dakota-bst",
	"flatpak-appstream":            "flatpak",
	"bluefin-packages":             "bluefin-pkg",
	"bluefin-variants":             "bluefin-var",
	"bluefin-release":              "bluefin-rel",
	"bluefin-security":             "bluefin-sec",
	"bluefin-renovate":             "bluefin-ren",
	"second-opinion":               "2nd-opinion",
	"cncf-community":               "cncf-comm",
	"cicd-learning":                "cicd-learn",
	"homebrew-taps":                "brew-taps",
	"homebrew-tap-casks":           "brew-casks",
	"homebrew-tap-formulas":        "brew-forms",
	"homebrew-packaging":           "brew-pkg",
	"homebrew-stats":               "brew-stats",
	"blueprint-mode":               "blueprint",
	"find-skills":                  "find-skills",
	"oci-images":                   "oci-images",
	"linux-desktop":                "linux-dsk",
	"skill-improver":               "skill-impr",
	"dakota-add-package":           "dk-add-pkg",
	"dakota-bst-overrides":         "dk-bst-ovr",
	"dakota-ci":                    "dakota-ci",
	"dakota-debugging":             "dakota-dbg",
	"dakota-local-ota":             "dk-loc-ota",
	"dakota-oci-layers":            "dk-oci-lyr",
	"dakota-overview":              "dk-overview",
	"dakota-package-binaries":      "dk-pkg-bin",
	"dakota-package-gnome-extensions": "dk-pkg-gno",
	"dakota-package-go":            "dk-pkg-go",
	"dakota-package-rust":          "dk-pkg-rs",
	"dakota-package-zig":           "dk-pkg-zig",
	"dakota-patch-junctions":       "dk-patch-jx",
	"dakota-remove-package":        "dk-rm-pkg",
	"dakota-update-refs":           "dk-upd-ref",
	"cncf-gobackend":               "cncf-gobe",
	"trilogy-dev":                  "trilogy",
}

// Elements is the canonical order for display.
var Elements = []SubclassSpec{
	{
		Element: "arc", Name: "VELOCITY", Icon: "⚡",
		Aspects: []AspectSpec{
			{"THUNDERCRASH · Planning", []string{"workflow", "cicd-learning"}},
			{"FISTS OF HAVOC · TDD", []string{"github", "autoresearch"}},
		},
	},
	{
		Element: "solar", Name: "COMMUNITY", Icon: "🔥",
		Aspects: []AspectSpec{
			{"HAMMER OF SOL · Knowledge", []string{"knowledge", "find-skills", "cncf-community", "second-opinion", "firehose"}},
			{"BURNING MAUL · Sites", []string{"cncf-dev", "people-website", "endusers-website", "cncf-heroes", "cncf-layout", "cncf-data", "cncf-gobackend", "trilogy-dev", "bluefin-docs"}},
		},
	},
	{
		Element: "void", Name: "MASTERY", Icon: "🟣",
		Aspects: []AspectSpec{
			{"SENTINEL SHIELD · Quality", []string{"skill-improver", "find-skills", "bluefin-security", "cncf-gaps", "cncf-testing", "bluefin-ci"}},
		},
	},
	{
		Element: "strand", Name: "DISTRIBUTION", Icon: "🟢",
		Aspects: []AspectSpec{
			{"BLADEFURY · Packaging", []string{"homebrew-taps", "homebrew-tap-casks", "homebrew-tap-formulas", "homebrew-packaging", "homebrew-stats", "flatpak-appstream", "bluefin-packages", "bluefin-renovate", "oci-images", "linux-desktop", "podman"}},
		},
	},
	{
		Element: "stasis", Name: "STABILITY", Icon: "🔵",
		Aspects: []AspectSpec{
			{"GLACIAL QUAKE · Build", []string{"bluefin-build", "bluefin-lts", "bluefin-variants", "bluefin-release", "bluefin-iso"}},
			{"GLACIAL QUAKE · Dakota", []string{"dakota-buildstream", "dakota-ci", "dakota-debugging", "dakota-local-ota", "dakota-oci-layers", "dakota-overview", "dakota-package-binaries", "dakota-package-gnome-extensions", "dakota-package-go", "dakota-package-rust", "dakota-package-zig", "dakota-patch-junctions", "dakota-remove-package", "dakota-update-refs", "dakota-add-package", "dakota-bst-overrides"}},
		},
	},
}

// RenderCol renders one subclass column as a slice of padded strings.
func RenderCol(spec SubclassSpec, weapons map[string]data.Weapon, colW int) []string {
	avg := subclassAvgLocal(spec.Element, weapons)
	hdr := fmt.Sprintf("%s %s %s avg %3d", spec.Icon, spec.Name, strings.Repeat("─", 26), avg)
	rows := []string{Pad(hdr, colW)}

	for _, asp := range spec.Aspects {
		rows = append(rows, Pad(fmt.Sprintf("  ▸ %s", asp.Name), colW))
		for _, sid := range asp.Skills {
			w := weapons[sid]
			dname := Alias[sid]
			if dname == "" {
				if len(sid) > 14 {
					dname = sid[:14]
				} else {
					dname = sid
				}
			}
			wname := w.Weapon
			if len(wname) > 16 {
				wname = wname[:16]
			}
			lv := LevelStr(w.Level)
			var mark string
			if w.Primary {
				mark = "★"
			}
			row := fmt.Sprintf("  %-14s (%-16s)  %s  %s%s", dname, wname, Bar(w.Level, 22), lv, mark)
			rows = append(rows, Pad(row, colW))
		}
	}
	return rows
}

// SideBySide renders two subclass columns side by side.
func SideBySide(left, right SubclassSpec, weapons map[string]data.Weapon, colW int) []string {
	ll := RenderCol(left, weapons, colW)
	rl := RenderCol(right, weapons, colW)
	mx := max(len(ll), len(rl))
	blank := strings.Repeat(" ", colW)
	for len(ll) < mx {
		ll = append(ll, blank)
	}
	for len(rl) < mx {
		rl = append(rl, blank)
	}
	out := make([]string, mx)
	for i := range out {
		out[i] = Pad(ll[i], colW) + "  ║  " + rl[i]
	}
	return out
}

func subclassAvgLocal(element string, weapons map[string]data.Weapon) int {
	sum, count := 0, 0
	for _, w := range weapons {
		if w.Element == element {
			sum += w.Level
			count++
		}
	}
	if count == 0 {
		return 0
	}
	return sum / count
}

func max(a, b int) int {
	if a > b {
		return a
	}
	return b
}

func min(a, b int) int {
	if a < b {
		return a
	}
	return b
}
