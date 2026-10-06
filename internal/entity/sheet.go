package entity

type Sheet struct {
	Groups map[string]Group `json:"groups"`
}

type Group struct {
	Days []Day `json:"days"`
}

type Day struct {
	Id      int      `json:"id"`
	Lessons []Lesson `json:"lessons"`
}

type Lesson struct {
	Time  string     `json:"time"`
	Name  string     `json:"name"`
	Links []LinkInfo `json:"links"`
}

type LinkInfo struct {
	URI   string `json:"uri"`
	Start int    `json:"start"`
	End   int    `json:"end"`
}
