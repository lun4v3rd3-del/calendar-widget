package entity

type Sheet struct {
	Groups map[string]Group `json:"groups"`
}

type Group struct {
	Days []Day `json:"days"`
}

type Day struct {
	Name    string   `json:"name"`
	Lessons []Lesson `json:"lessons"`
}

type Lesson struct {
	Time  string   `json:"time"`
	Name  string   `json:"name"`
	Links []string `json:"links"`
}
