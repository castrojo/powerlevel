package data

// MilestoneTier returns the milestone tier label for a weapon level >= 100.
// Returns empty string for levels below 100.
func MilestoneTier(level int) string {
	switch {
	case level >= 250:
		return "Transcendent"
	case level >= 200:
		return "Pinnacle"
	case level >= 150:
		return "Adept"
	case level >= 100:
		return "Mastercrafted"
	default:
		return ""
	}
}
