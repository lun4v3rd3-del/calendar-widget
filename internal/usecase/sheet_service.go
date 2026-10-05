package usecase

import (
	"context"
	"fmt"
	"log"
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
	log.Printf("[INIT] Инициализация SheetService для SpreadsheetID: %s", spreadsheetID)
	srv, err := sheets.NewService(
		ctx,
		option.WithAPIKey(gsheetAPIKey),
	)
	if err != nil {
		log.Printf("[INIT_ERROR] Ошибка создания sheets.Service: %v", err)
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
	log.Println("[GET_SHEET] Старт вызова GetSheet")
	groups, err := s.parseGroups(ctx)
	if err != nil {
		log.Printf("[GET_SHEET_ERROR] Ошибка в parseGroups: %v", err)
		return nil, err
	}

	log.Printf("[GET_SHEET_SUCCESS] parseGroups успешно завершен, найдено групп: %d", len(groups))
	return &entity.Sheet{
		Groups: groups,
	}, nil
}

func (s *SheetService) getCellDataGrid(ctx context.Context) ([][]*sheets.CellData, []*sheets.GridRange, error) {
	spreadsheet, err := s.gSheetSrv.
		Spreadsheets.
		Get(s.spreadsheetID).
		Fields("sheets(properties(title),merges)").
		Context(ctx).
		Do()

	if err != nil {
		return nil, nil, fmt.Errorf("не удалось получить структуру таблицы: %w", err)
	}

	if spreadsheet == nil || len(spreadsheet.Sheets) == 0 {
		return nil, nil, fmt.Errorf("в таблице отсутствуют листы")
	}

	firstSheet := spreadsheet.Sheets[0]
	sheetTitle := firstSheet.Properties.Title

	readRange := fmt.Sprintf(
		"'%s'!B2:BO45",
		strings.ReplaceAll(sheetTitle, "'", "''"),
	)

	dataSpreadsheet, err := s.gSheetSrv.
		Spreadsheets.
		Get(s.spreadsheetID).
		Ranges(readRange).
		Fields("sheets(data(rowData(values(formattedValue,textFormatRuns(format(link(uri)))))))").
		Context(ctx).
		Do()

	if err != nil {
		return nil, nil, fmt.Errorf("не удалось получить данные ячеек: %w", err)
	}

	if len(dataSpreadsheet.Sheets) == 0 || len(dataSpreadsheet.Sheets[0].Data) == 0 {
		return nil, nil, fmt.Errorf("получен пустой массив данных")
	}

	rowData := dataSpreadsheet.Sheets[0].Data[0].RowData
	grid := make([][]*sheets.CellData, len(rowData))
	for i, r := range rowData {
		grid[i] = r.Values
	}

	return grid, firstSheet.Merges, nil
}

func (s *SheetService) parseGroups(ctx context.Context) (map[string]entity.Group, error) {
	grid, merges, err := s.getCellDataGrid(ctx)
	if err != nil {
		return nil, err
	}

	if len(grid) == 0 {
		return make(map[string]entity.Group), nil
	}

	s.fillMergedCellData(merges, grid)

	groups := make(map[string]entity.Group)
	headerRow := grid[0]
	rows := grid[1:]

	for colIndex, groupCell := range headerRow[1:] {
		if groupCell == nil {
			continue
		}

		groupName := strings.TrimSpace(groupCell.FormattedValue)
		if groupName == "" {
			continue
		}

		days := make([]entity.Day, len(WeekDays))
		for i, dayName := range WeekDays {
			days[i] = entity.Day{
				Name:    dayName,
				Lessons: make([]entity.Lesson, 0, 7),
			}
		}

		var actualRowIndex = 0

		for _, row := range rows {
			print(row)

			dayNum := actualRowIndex / 7
			timeIndex := actualRowIndex % 7

			if dayNum >= len(WeekDays) {
				break
			}

			realColIndex := colIndex + 1
			if realColIndex >= len(row) || row[realColIndex] == nil {
				actualRowIndex++
				continue
			}

			cell := row[realColIndex]
			cellVal := strings.TrimSpace(cell.FormattedValue)

			if cellVal != "" {
				days[dayNum].Lessons = append(
					days[dayNum].Lessons,
					entity.Lesson{
						Name:  cellVal,
						Time:  LessonTimes[timeIndex],
						Links: extractLinks(cell),
					},
				)
			}

			actualRowIndex++
		}

		groups[groupName] = entity.Group{Days: days}
	}

	return groups, nil
}

func (s *SheetService) fillMergedCellData(merges []*sheets.GridRange, grid [][]*sheets.CellData) {
	if len(merges) == 0 || len(grid) == 0 {
		return
	}

	for _, merge := range merges {
		if merge == nil {
			continue
		}

		mainRow := int(merge.StartRowIndex) - s.startRow
		mainCol := int(merge.StartColumnIndex) - s.startCol

		if mainRow < 0 || mainCol < 0 || mainRow >= len(grid) {
			continue
		}

		if mainCol >= len(grid[mainRow]) || grid[mainRow][mainCol] == nil {
			continue
		}

		mainValue := grid[mainRow][mainCol]

		endRow := int(merge.EndRowIndex) - s.startRow
		endCol := int(merge.EndColumnIndex) - s.startCol

		if endRow > len(grid) {
			endRow = len(grid)
		}

		for localRow := mainRow; localRow < endRow; localRow++ {
			if localRow < 0 {
				continue
			}

			if len(grid[localRow]) <= endCol {
				extended := make([]*sheets.CellData, endCol)
				copy(extended, grid[localRow])
				grid[localRow] = extended
			}

			for localCol := mainCol; localCol < endCol; localCol++ {
				if localCol < 0 {
					continue
				}

				if grid[localRow][localCol] == nil || grid[localRow][localCol].FormattedValue == "" {
					grid[localRow][localCol] = mainValue
				}
			}
		}
	}
}

func extractLinks(cell *sheets.CellData) []entity.LinkInfo {
	if cell == nil {
		return nil
	}

	var links []entity.LinkInfo
	seen := make(map[string]bool)

	runes := []rune(cell.FormattedValue)
	textLen := len(runes)

	if len(cell.TextFormatRuns) > 0 {
		for i, run := range cell.TextFormatRuns {
			if run.Format != nil && run.Format.Link != nil && run.Format.Link.Uri != "" {
				url := run.Format.Link.Uri
				if !seen[url] {
					seen[url] = true

					start := int(run.StartIndex)
					var end int

					if i+1 < len(cell.TextFormatRuns) {
						end = int(cell.TextFormatRuns[i+1].StartIndex)
					} else {
						end = textLen
					}

					links = append(links, entity.LinkInfo{
						URI:   url,
						Start: start,
						End:   end,
					})
				}
			}
		}
	}

	if len(links) == 0 && cell.Hyperlink != "" {
		links = append(links, entity.LinkInfo{
			URI:   cell.Hyperlink,
			Start: 0,
			End:   textLen,
		})
	}

	return links
}
