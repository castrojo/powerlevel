package renderer

import (
	"strings"
	"testing"
)

func TestVisLen(t *testing.T) {
	if got := VisLen("\033[92mhello\033[0m"); got != 5 {
		t.Errorf("VisLen with ANSI: got %d, want 5", got)
	}
	if got := VisLen("plain"); got != 5 {
		t.Errorf("VisLen plain: got %d, want 5", got)
	}
}

func TestPad_Short(t *testing.T) {
	got := Pad("hi", 5)
	if len(got) != 5 {
		t.Errorf("Pad: got len %d, want 5", len(got))
	}
}

func TestPad_WithANSI(t *testing.T) {
	s := "\033[92mhello\033[0m" // 5 visible chars
	got := Pad(s, 10)
	if VisLen(got) != 10 {
		t.Errorf("Pad ANSI: visible len %d, want 10", VisLen(got))
	}
}

func TestBar_Zero(t *testing.T) {
	b := Bar(0, 10)
	if strings.Contains(b, "▰") {
		t.Error("Bar(0): should have no filled blocks")
	}
	if !strings.Contains(b, "▱") {
		t.Error("Bar(0): should have empty blocks")
	}
}

func TestBar_Full(t *testing.T) {
	b := Bar(100, 10)
	if !strings.Contains(b, "▰") {
		t.Error("Bar(100): should have filled blocks")
	}
	if strings.Contains(b, "▱") {
		t.Error("Bar(100): should have no empty blocks")
	}
	if !strings.Contains(b, Gold) {
		t.Error("Bar(100): should use gold color")
	}
}

func TestBar_Mid(t *testing.T) {
	b := Bar(50, 10)
	filled := strings.Count(ansiRE.ReplaceAllString(b, ""), "▰")
	empty := strings.Count(ansiRE.ReplaceAllString(b, ""), "▱")
	if filled != 5 || empty != 5 {
		t.Errorf("Bar(50, 10): filled=%d empty=%d, want 5/5", filled, empty)
	}
}

func TestLevelStr_Normal(t *testing.T) {
	got := LevelStr(42)
	if got != " 42" {
		t.Errorf("LevelStr(42) = %q, want \" 42\"", got)
	}
}

func TestLevelStr_Masterwork(t *testing.T) {
	got := LevelStr(100)
	if !strings.Contains(got, "100★") {
		t.Errorf("LevelStr(100) = %q, should contain 100★", got)
	}
}

func TestPLColor(t *testing.T) {
	if PLColor(1) != R {
		t.Error("PLColor(1) should be red (new light range)")
	}
	if PLColor(50) != Y {
		t.Error("PLColor(50) should be yellow (veteran range)")
	}
	if PLColor(80) != G {
		t.Error("PLColor(80) should be green (ascendant range)")
	}
	if PLColor(100) != Gold {
		t.Error("PLColor(100) should be gold (mastercrafted)")
	}
}
