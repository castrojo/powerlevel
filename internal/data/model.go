package data

// Season represents the current active project/season.
type Season struct {
	Name    string `json:"name"`
	Project string `json:"project"`
	Quarter string `json:"quarter"`
	Lore    string `json:"lore"`
}

// Weapon represents a single skill mapped to a D2 weapon.
type Weapon struct {
	Weapon      string `json:"weapon"`
	WeaponType  string `json:"weapon_type"`
	Element     string `json:"element"`
	Subclass    string `json:"subclass"`
	Super       string `json:"super"`
	Level       int    `json:"level"`
	IconPath    string `json:"icon_path"`
	Primary     bool   `json:"primary,omitempty"`
	Lore        string `json:"lore,omitempty"`
}

// Stat is one of the six memory metrics auto-computed from session history.
type Stat struct {
	Name     string `json:"name"`
	Raw      int    `json:"raw"`
	Score    int    `json:"score"` // 0-100 log-scaled
	Label    string `json:"label"`
	SoftCap  int    `json:"softCap"`
	Pinnacle int    `json:"pinnacle"`
	Unit     string `json:"unit"`
}

// Stats holds all six character stats.
type Stats struct {
	Endurance Stat `json:"endurance"`
	Synthesis Stat `json:"synthesis"`
	Breadth   Stat `json:"breadth"`
	Foresight Stat `json:"foresight"`
	Output    Stat `json:"output"`
	Recall    Stat `json:"recall"`
}

// PowerlevelData is the root of powerlevel-data.json.
type PowerlevelData struct {
	Season        Season            `json:"season"`
	GhostMessages []string          `json:"ghost_messages"`
	Weapons       map[string]Weapon `json:"weapons"`
	Stats         Stats             `json:"stats"`
}
