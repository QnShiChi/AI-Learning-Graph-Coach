# Dev Makefile And Local DB Config Design

Date: 2026-04-08
Status: Approved for implementation planning

## Overview

This spec defines a lightweight developer workflow for running the repository locally with a single `Makefile` and a machine-specific local environment file.

The goal is to make a fresh clone easier to start by standardizing:

- how local environment variables are sourced
- how the full Docker stack is started and stopped
- how database connection details are surfaced for DBeaver or other local tools

## Goals

The solution must provide:

- a `Makefile` at repo root
- a local config source based on `.env.local`
- a simple way to bootstrap `.env.local` from `.env.example`
- a single `make up` command that starts the full stack
- helper commands for shutdown, restart, logs, status, migrations, and DB connection info
- local PostgreSQL connection details that match the running Docker setup

## Non-Goals

This change does not need to:

- support multiple execution modes such as hybrid or local-first
- add destructive reset workflows
- introduce complex shell scripts unless Makefile becomes insufficient
- redesign existing Docker services or rename environment variables already used by the repo

## Configuration Source

Local development config will use:

- `.env.example` as the template
- `.env.local` as the real machine-specific file

The Makefile will prefer `.env.local` when invoking Docker-related commands.

Recommended default local database values:

- `POSTGRES_HOST=localhost`
- `POSTGRES_PORT=5432`
- `POSTGRES_DB=insforge`
- `POSTGRES_USER=postgres`
- `POSTGRES_PASSWORD=postgres`

These values should match both Docker Compose defaults and local DBeaver setup unless the developer overrides them in `.env.local`.

## Makefile Targets

The root `Makefile` should define the following targets:

### `make env`

- Creates `.env.local` from `.env.example` if `.env.local` does not already exist
- Does not overwrite an existing `.env.local`

### `make up`

- Starts the full Docker stack
- Uses `docker compose up -d --build`
- Reads configuration from `.env.local`

### `make down`

- Stops the full Docker stack

### `make restart`

- Restarts the full Docker stack cleanly by running `down` then `up`

### `make logs`

- Streams Docker Compose logs for the running stack

### `make ps`

- Shows running service state with `docker compose ps`

### `make migrate`

- Runs backend database migrations using the existing project migration flow
- Should use the application/container context that already matches the Dockerized stack

### `make db-info`

- Prints the local database connection values needed for DBeaver:
  - host
  - port
  - database
  - username
  - password

## Docker Integration

The current `docker-compose.yml` already defines the full development stack:

- `postgres`
- `postgrest`
- `insforge`
- `deno`
- `vector`

This spec intentionally preserves that structure. The Makefile acts as a developer entrypoint and does not replace Docker Compose.

## Developer Experience

Expected workflow for a fresh repo:

1. `make env`
2. update `.env.local` if needed
3. `make up`
4. `make db-info`
5. connect DBeaver using the printed PostgreSQL settings

This workflow should be enough for a new local environment without requiring the developer to remember individual Docker commands.

## Implementation Notes

- Keep the Makefile simple and readable
- Avoid hardcoding duplicate values where environment variables can be reused
- Prefer surfacing repo defaults rather than introducing new config names
- If `.env.local` is missing, commands should fail clearly or guide the user to run `make env`

## Summary

This change adds a small, focused local-developer workflow layer:

- `.env.local` becomes the standard machine-specific config source
- `Makefile` becomes the standard command entrypoint
- `make up` starts the full project stack
- `make db-info` makes DB connection setup explicit and easy

The design is intentionally small and practical so it improves onboarding without adding unnecessary infrastructure.
