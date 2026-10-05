package interfaces

import (
	"awesomeProject10/internal/entity"
	"context"
)

type SheetService interface {
	GetSheet(ctx context.Context) (*entity.Sheet, error)
}
