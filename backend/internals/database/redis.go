package database

import (
	"context"
	"fmt"

	"github.com/redis/go-redis/v9"
)

type RedisDB struct {
	Client *redis.Client
}

func NewRedisDB(connectionString string) (*RedisDB, error) {

	// 1. Use ParseURL to automatically handle "rediss://", password, and TLS
	opts, err := redis.ParseURL(connectionString)
	if err != nil {
		return nil, fmt.Errorf("invalid redis url: %w", err)
	}

	// 2. Create the client
	client := redis.NewClient(opts)

	// 3. Test the connection
	if err := client.Ping(context.Background()).Err(); err != nil {
		return nil, fmt.Errorf("failed to connect to redis: %w", err)
	}

	return &RedisDB{Client: client}, nil
}

func (r *RedisDB) Close() error {
	return r.Client.Close()
}
