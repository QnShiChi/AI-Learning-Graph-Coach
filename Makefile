ENV_FILE ?= .env.local
COMPOSE ?= docker compose --env-file $(ENV_FILE)

.PHONY: env up down restart logs ps migrate db-info ensure-env

env:
	@if [ -f "$(ENV_FILE)" ]; then \
		echo "$(ENV_FILE) already exists"; \
	else \
		cp .env.example $(ENV_FILE); \
		echo "Created $(ENV_FILE) from .env.example"; \
	fi

ensure-env:
	@if [ ! -f "$(ENV_FILE)" ]; then \
		echo "Missing $(ENV_FILE). Run 'make env' first."; \
		exit 1; \
	fi

up: ensure-env
	$(COMPOSE) up -d --build

down: ensure-env
	$(COMPOSE) down

restart: down up

logs: ensure-env
	$(COMPOSE) logs -f

ps: ensure-env
	$(COMPOSE) ps

migrate: ensure-env
	$(COMPOSE) exec insforge sh -lc "cd backend && npm run migrate:up"

db-info: ensure-env
	@set -a; . ./$(ENV_FILE); set +a; \
	echo "PostgreSQL local connection"; \
	echo "Host: $${POSTGRES_HOST:-localhost}"; \
	echo "Port: $${POSTGRES_PORT:-5432}"; \
	echo "Database: $${POSTGRES_DB:-insforge}"; \
	echo "Username: $${POSTGRES_USER:-postgres}"; \
	echo "Password: $${POSTGRES_PASSWORD:-postgres}"
