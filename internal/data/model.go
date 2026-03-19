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

// PowerlevelData is the root of powerlevel-data.json.
type PowerlevelData struct {
	Season  Season            `json:"season"`
	Weapons map[string]Weapon `json:"weapons"`
}

// Subclass groups weapons and their supers.
type Subclass struct {
	Icon    string
	Name    string
	Element string
	Domain  string
	Lore    string
	Supers  []Super
	Skills  []string // skill IDs belonging to this subclass
}

// Super maps a D2 super name to an agent.
type Super struct {
	Name  string
	Agent string
	Lore  string
}

// Stat is one of the six memory metrics auto-computed from session history.
type Stat struct {
	Name     string `json:"name"`
	Raw      int    `json:"raw"`
	Score    int    `json:"score"` // 0-100 log-scaled
	Label    string `json:"label"`
	SoftCap  int    `json:"soft_cap"`
	Pinnacle int    `json:"pinnacle"`
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

// ExportedData is the sanitized JSON written to src/data/powerlevel.json.
type ExportedData struct {
	Season       Season            `json:"season"`
	Weapons      map[string]Weapon `json:"weapons"`
	Stats        Stats             `json:"stats"`
	PowerLevel   int               `json:"power_level"`
	Rank         string            `json:"rank"`
	ActiveSupers []string          `json:"active_supers"` // top 2 elements by activity
	ExportedAt   string            `json:"exported_at"`
}
