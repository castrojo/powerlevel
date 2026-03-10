package db

import (
	"context"
	"fmt"
	"os"

	"github.com/jackc/pgx/v5/pgxpool"
)

func NewPool(ctx context.Context) (*pgxpool.Pool, error) {
	host := getenv("PGHOST", "localhost")
	port := getenv("PGPORT", "5432")
	dbname := getenv("PGDATABASE", "workflow_state")
	user := getenv("PGUSER", "workflow")
	password := getenv("PGPASSWORD", "workflow_local_only")

	dsn := fmt.Sprintf(
		"host=%s port=%s dbname=%s user=%s password=%s sslmode=disable pool_max_conns=2",
		host, port, dbname, user, password,
	)
	pool, err := pgxpool.New(ctx, dsn)
	if err != nil {
		return nil, fmt.Errorf("pool: %w", err)
	}
	if err := pool.Ping(ctx); err != nil {
		return nil, fmt.Errorf("pool ping: %w", err)
	}
	return pool, nil
}

func getenv(key, fallback string) string {
	if v := os.Getenv(key); v != "" {
		return v
	}
	return fallback
}
