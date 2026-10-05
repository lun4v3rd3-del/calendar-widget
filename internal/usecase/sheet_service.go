package usecase

import (
	"context"
	"fmt"
	"strings"

	"awesomeProject10/internal/entity"

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

var WeekDays = [...]string{
	"monday",
	"tuesday",
	"wednesday",
	"thursday",
	"friday",
	"saturday",
}

type SheetService struct {
	spreadsheetID string
	apiKey        string
	gSheetSrv     *sheets.Service

	startRow int
	startCol int
}

func NewSheetService(ctx context.Context, spreadsheetID, gsheetAPIKey string) (*SheetService, error) {
	srv, err := sheets.NewService(
		ctx,
		option.WithAPIKey(gsheetAPIKey),
	)
	if err != nil {
		return nil, fmt.Errorf("unable to retrieve Sheets client: %w", err)
	}

	return &SheetService{
		spreadsheetID: spreadsheetID,
		apiKey:        gsheetAPIKey,
		gSheetSrv:     srv,
		startCol:      1,
		startRow:      1,
	}, nil
}

func (s *SheetService) GetSheet(ctx context.Context) (*entity.Sheet, error) {
	groups, err := s.parseGroups(ctx)
	if err != nil {
		return nil, err
	}

	return &entity.Sheet{
		Groups: groups,
	}, nil
}

func (s *SheetService) getValueRange(ctx context.Context) (*sheets.ValueRange, error) {
	spreadsheet, err := s.gSheetSrv.
		Spreadsheets.
		Get(s.spreadsheetID).
		Fields("sheets(properties(title),merges)").
		Context(ctx).
		Do()

	if err != nil {
		return nil, fmt.Errorf("не удалось получить структуру таблицы: %w", err)
	}

	if spreadsheet == nil || len(spreadsheet.Sheets) == 0 {
		return nil, fmt.Errorf("в таблице отсутствуют листы")
	}

	firstSheet := spreadsheet.Sheets[0]
	sheetTitle := firstSheet.Properties.Title

	readRange := fmt.Sprintf(
		"'%s'!B2:BO45",
		strings.ReplaceAll(sheetTitle, "'", "''"),
	)

	valueRange, err := s.gSheetSrv.
		Spreadsheets.
		Values.
		Get(s.spreadsheetID, readRange).
		Context(ctx).
		Do()

	if err != nil {
		return nil, fmt.Errorf("не удалось получить данные: %w", err)
	}

	if valueRange == nil || len(valueRange.Values) == 0 {
		return nil, fmt.Errorf("получен пустой массив данных")
	}

	s.fillMergedCells(firstSheet.Merges, valueRange)

	return valueRange, nil
}

func (s *SheetService) parseGroups(ctx context.Context) (map[string]entity.Group, error) {
	valueRange, err := s.getValueRange(ctx)
	if err != nil {
		return nil, err
	}

	groups := make(map[string]entity.Group)
	if len(valueRange.Values) == 0 {
		return groups, nil
	}

	headerRow := valueRange.Values[0]
	rows := valueRange.Values[1:]

	for colIndex, groupObj := range headerRow[1:] {
		groupName, ok := groupObj.(string)
		if !ok {
			continue
		}

		groupName = strings.TrimSpace(groupName)
		if groupName == "" {
			continue
		}

		days := make([]entity.Day, len(WeekDays))
		for i, dayName := range WeekDays {
			days[i] = entity.Day{
				Name:    dayName,
				Lessons: make([]entity.Lesson, 0, len(LessonTimes)),
			}
		}

		var c = 0
		for rowIndex, row := range rows {
			println(row[0].(string))
			if row[0] == "" {
				c++
				continue
			}

			rowIndex -= c

			dayNum := rowIndex / len(LessonTimes)
			if dayNum >= len(WeekDays) {
				break
			}

			if colIndex >= len(row) {
				continue
			}

			cellVal := strings.TrimSpace(getStringValue(row[colIndex]))
			if cellVal == "" {
				continue
			}

			timeIndex := rowIndex % len(LessonTimes)

			days[dayNum].Lessons = append(
				days[dayNum].Lessons,
				entity.Lesson{
					Name: cellVal,
					Time: LessonTimes[timeIndex],
				},
			)
		}

		groups[groupName] = entity.Group{Days: days}
	}

	return groups, nil
}

func (s *SheetService) fillMergedCells(merges []*sheets.GridRange, valueRange *sheets.ValueRange) {
	if len(merges) == 0 || valueRange == nil {
		return
	}

	for _, merge := range merges {
		if merge == nil {
			continue
		}

		mainRow := int(merge.StartRowIndex) - s.startRow
		mainCol := int(merge.StartColumnIndex) - s.startCol

		if mainRow < 0 || mainCol < 0 || mainRow >= len(valueRange.Values) {
			continue
		}

		if mainCol >= len(valueRange.Values[mainRow]) {
			continue
		}

		mainValue := valueRange.Values[mainRow][mainCol]

		endRow := int(merge.EndRowIndex) - s.startRow
		endCol := int(merge.EndColumnIndex) - s.startCol

		if endRow > len(valueRange.Values) {
			endRow = len(valueRange.Values)
		}

		for localRow := mainRow; localRow < endRow; localRow++ {
			if localRow < 0 {
				continue
			}

			if len(valueRange.Values[localRow]) <= endCol {
				extended := make([]interface{}, endCol)
				copy(extended, valueRange.Values[localRow])
				valueRange.Values[localRow] = extended
			}

			for localCol := mainCol; localCol < endCol; localCol++ {
				if localCol < 0 {
					continue
				}

				if isEmptyCell(valueRange.Values[localRow][localCol]) {
					valueRange.Values[localRow][localCol] = mainValue
				}
			}
		}
	}
}

func getStringValue(value interface{}) string {
	if value == nil {
		return ""
	}
	switch v := value.(type) {
	case string:
		return v
	case fmt.Stringer:
		return v.String()
	default:
		return fmt.Sprintf("%v", v)
	}
}

func isEmptyCell(value interface{}) bool {
	if value == nil {
		return true
	}
	if str, ok := value.(string); ok {
		return strings.TrimSpace(str) == ""
	}
	return false
}
