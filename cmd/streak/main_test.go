package main

import (
	"testing"
)

func TestComputeStreak_Empty(t *testing.T) {
	r := computeStreak(nil)
	if r.CurrentStreak != 0 {
		t.Errorf("empty: CurrentStreak = %d, want 0", r.CurrentStreak)
	}
	if r.LongestStreak != 0 {
		t.Errorf("empty: LongestStreak = %d, want 0", r.LongestStreak)
	}
	if r.TotalActiveDays != 0 {
		t.Errorf("empty: TotalActiveDays = %d, want 0", r.TotalActiveDays)
	}
}

func TestComputeStreak_SingleDay(t *testing.T) {
	// A single active day in the past — streak is broken (not today/yesterday).
	dates := []string{"2020-01-01"}
	r := computeStreak(dates)
	if r.LongestStreak != 1 {
		t.Errorf("single day: LongestStreak = %d, want 1", r.LongestStreak)
	}
	if r.TotalActiveDays != 1 {
		t.Errorf("single day: TotalActiveDays = %d, want 1", r.TotalActiveDays)
	}
	if r.LastSessionDate != "2020-01-01" {
		t.Errorf("single day: LastSessionDate = %q, want 2020-01-01", r.LastSessionDate)
	}
	// Old date: current streak should be 0
	if r.CurrentStreak != 0 {
		t.Errorf("single old day: CurrentStreak = %d, want 0", r.CurrentStreak)
	}
}

func TestComputeStreak_LongestStreak(t *testing.T) {
	// Three consecutive days, then a gap, then two more.
	dates := []string{
		"2025-01-01",
		"2025-01-02",
		"2025-01-03",
		"2025-01-10",
		"2025-01-11",
	}
	r := computeStreak(dates)
	if r.LongestStreak != 3 {
		t.Errorf("LongestStreak = %d, want 3", r.LongestStreak)
	}
	if r.TotalActiveDays != 5 {
		t.Errorf("TotalActiveDays = %d, want 5", r.TotalActiveDays)
	}
}

func TestComputeStreak_AllConsecutive(t *testing.T) {
	dates := []string{
		"2025-06-01",
		"2025-06-02",
		"2025-06-03",
		"2025-06-04",
		"2025-06-05",
	}
	r := computeStreak(dates)
	if r.LongestStreak != 5 {
		t.Errorf("all consecutive: LongestStreak = %d, want 5", r.LongestStreak)
	}
}

func TestComputeStreak_GapInMiddle(t *testing.T) {
	// 2-day run, gap, 4-day run, gap, 1 day.
	dates := []string{
		"2025-01-01",
		"2025-01-02",
		"2025-01-05",
		"2025-01-06",
		"2025-01-07",
		"2025-01-08",
		"2025-01-20",
	}
	r := computeStreak(dates)
	if r.LongestStreak != 4 {
		t.Errorf("gap in middle: LongestStreak = %d, want 4", r.LongestStreak)
	}
}

func TestComputeStreak_CurrentStreakBroken(t *testing.T) {
	// Last date is more than one day ago → current streak 0.
	dates := []string{"2020-03-01", "2020-03-02", "2020-03-03"}
	r := computeStreak(dates)
	if r.CurrentStreak != 0 {
		t.Errorf("broken streak: CurrentStreak = %d, want 0", r.CurrentStreak)
	}
}

func TestConsecutiveDays(t *testing.T) {
	cases := []struct {
		a, b string
		want bool
	}{
		{"2025-01-01", "2025-01-02", true},
		{"2025-01-31", "2025-02-01", true},
		{"2024-12-31", "2025-01-01", true},
		{"2025-01-01", "2025-01-03", false}, // gap of 2 days
		{"2025-01-02", "2025-01-01", false}, // backwards
		{"2025-01-01", "2025-01-01", false}, // same day
	}
	for _, c := range cases {
		got := consecutiveDays(c.a, c.b)
		if got != c.want {
			t.Errorf("consecutiveDays(%q, %q) = %v, want %v", c.a, c.b, got, c.want)
		}
	}
}

func TestParseDate(t *testing.T) {
	cases := []struct {
		ts      string
		wantOK  bool
		wantDay string
	}{
		{"2026-03-22T03:16:29.646Z", true, "2026-03-22"},
		{"2026-03-22T03:16:29Z", true, "2026-03-22"},
		{"2026-03-22T03:16:29+00:00", true, "2026-03-22"},
		{"2026-03-22T23:59:59.999Z", true, "2026-03-22"},
		{"not-a-date", false, ""},
		{"", false, ""},
	}
	for _, c := range cases {
		got, ok := parseDate(c.ts)
		if ok != c.wantOK {
			t.Errorf("parseDate(%q): ok=%v, want %v", c.ts, ok, c.wantOK)
			continue
		}
		if ok && got != c.wantDay {
			t.Errorf("parseDate(%q): date=%q, want %q", c.ts, got, c.wantDay)
		}
	}
}
