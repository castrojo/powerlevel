package db

import (
	"context"
	"fmt"

	"github.com/jackc/pgx/v5/pgxpool"
)

func Migrate(ctx context.Context, pool *pgxpool.Pool, schema string) error {
	_, err := pool.Exec(ctx, schema)
	if err != nil {
		return fmt.Errorf("migrate: %w", err)
	}
	return nil
}
