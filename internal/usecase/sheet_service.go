package usecase

import (
	"awesomeProject10/internal/entity"
	"context"
	"fmt"
	"log"
	"strings"
	"sync"

	"google.golang.org/api/option"
	"google.golang.org/api/sheets/v4"
)

var LessonTimes = [...]string{
	"08.30-10.00",
	"10.10-11.40",
	"12.10-13.40",
	"13.50-15.20",
	"15.50-17.20",
	"17.30-19.00",
	"19.10-20.40",
}

var WeekDays = [...]string{"monday", "tuesday", "wednesday", "thursday", "friday", "saturday"}

type SheetService struct {
	spreadsheetId string
	apiKey        string
	gSheetSrv     *sheets.Service
	startRow      int
	startCol      int
	mu            sync.Mutex
}

func NewSheetService(spreadsheetId, gsheetApiKey string) *SheetService {
	srv, err := sheets.NewService(context.Background(), option.WithAPIKey(gsheetApiKey))
	if err != nil {
		log.Fatalf("Unable to retrieve Sheets client: %v", err)
		return nil
	}

	return &SheetService{
		spreadsheetId: spreadsheetId,
		apiKey:        gsheetApiKey,
		gSheetSrv:     srv,
		startCol:      2,
		startRow:      1,
	}
}

func (s *SheetService) GetSheet(ctx context.Context) (*entity.Sheet, error) {
	sheet := entity.Sheet{}
	groups, err := s.parseGroups(ctx)

	if err != nil {
		return nil, err
	}
	
	sheet.Groups = groups

	return &sheet, nil
}

func (s *SheetService) getValueRange(ctx context.Context) (*sheets.ValueRange, error) {
	spreadsheet, err := s.gSheetSrv.Spreadsheets.Get(s.spreadsheetId).Context(ctx).Do()
	if err != nil {
		return nil, fmt.Errorf("не удалось получить структуру таблицы: %w", err)
	}

	readRange := fmt.Sprintf("'%s'!C2:BO45", spreadsheet.Sheets[0].Properties.Title)

	valueRange, err := s.gSheetSrv.Spreadsheets.Values.Get(s.spreadsheetId, readRange).Context(ctx).Do()
	if err != nil {
		return nil, fmt.Errorf("не удалось получить данные: %w", err)
	}

	if err := s.fillMergedCells(ctx, valueRange); err != nil {
		return nil, fmt.Errorf("не удалось заполнить мержи: %w", err)
	}

	if len(valueRange.Values) == 0 {
		return nil, fmt.Errorf("получен пустой массив данных")
	}

	return valueRange, nil
}

func (s *SheetService) parseGroups(context context.Context) (map[string]entity.Group, error) {
	valueRange, err := s.getValueRange(context)

	if err != nil {
		println("s.getValueRange(context) error: " + err.Error())
		return nil, err
	}

	groups := make(map[string]entity.Group)

	headerRow := valueRange.Values[0]

	for colIndex, groupObj := range headerRow {
		var group entity.Group

		groupName, ok := groupObj.(string)
		if !ok || groupName == "" {
			continue
		}

		for rowIndex, row := range valueRange.Values[1:] {
			if colIndex >= len(row) {
				continue
			}

			cellVal, ok := row[colIndex].(string)
			if !ok {
				continue
			}
			cellVal = strings.TrimSpace(cellVal)

			dayNum := rowIndex / 7
			if dayNum >= len(WeekDays) {
				break
			}

			if rowIndex%7 == 0 || len(group.Days) == 0 || group.Days[len(group.Days)-1].Name != WeekDays[dayNum] {
				group.Days = append(group.Days, entity.Day{
					Name:    WeekDays[dayNum],
					Lessons: make([]entity.Lesson, 0),
				})
			}

			if cellVal == "" {
				continue
			}

			lastDayIdx := len(group.Days) - 1
			group.Days[lastDayIdx].Lessons = append(group.Days[lastDayIdx].Lessons, entity.Lesson{
				Name: cellVal,
				Time: LessonTimes[rowIndex%7],
			})
		}

		groups[groupName] = group
	}

	return groups, nil
}

func (s *SheetService) fillMergedCells(ctx context.Context, valueRange *sheets.ValueRange) error {
	meta, err := s.gSheetSrv.Spreadsheets.Get(s.spreadsheetId).Fields("sheets(properties,merges)").Context(ctx).Do()
	if err != nil {
		return err
	}

	for _, cell := range meta.Sheets[0].Merges {
		mainRowIdx := int(cell.StartRowIndex) - s.startRow
		mainColIdx := int(cell.StartColumnIndex) - s.startCol

		if mainRowIdx < 0 || mainRowIdx >= len(valueRange.Values) || mainColIdx < 0 || mainColIdx >= len(valueRange.Values[mainRowIdx]) {
			continue
		}

		mainValue := valueRange.Values[mainRowIdx][mainColIdx]

		for i := int(cell.StartRowIndex); i < int(cell.EndRowIndex); i++ {
			for j := int(cell.StartColumnIndex); j < int(cell.EndColumnIndex); j++ {
				localRow := i - s.startRow
				localCol := j - s.startCol

				if localRow >= 0 && localRow < len(valueRange.Values) {
					for len(valueRange.Values[localRow]) <= localCol {
						valueRange.Values[localRow] = append(valueRange.Values[localRow], "")
					}
					if valueRange.Values[localRow][localCol] == "" || valueRange.Values[localRow][localCol] == nil {
						valueRange.Values[localRow][localCol] = mainValue
					}
				}
			}
		}
	}
	return nil
}
