# Dev Makefile And Local DB Config Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a root `Makefile` and `.env.local`-based local DB workflow so a fresh clone can start the full Docker stack with `make up`, bootstrap env config, run migrations, and print DBeaver connection info.

**Architecture:** Keep Docker Compose as the runtime source of truth and add a thin developer-entrypoint layer on top. The implementation centers on a small root `Makefile`, local env bootstrap using `.env.example -> .env.local`, and light documentation updates so the repo keeps its current service topology and environment variable names.

**Tech Stack:** GNU Make, Docker Compose, existing `.env.example`, existing `docker-compose.yml`, PostgreSQL, README docs

**Spec:** `docs/superpowers/specs/2026-04-08-dev-makefile-local-db-design.md`

---

## File Map

### New Files

| File | Purpose |
|------|---------|
| `Makefile` | Developer command entrypoint for env bootstrap, Docker stack control, migration, and DB info |

### Modified Files

| File | Change |
|------|--------|
| `.gitignore` | Ignore `.env.local` so machine-specific config stays out of git |
| `.env.example` | Clarify `.env.local` bootstrap flow and keep default local DB values visible |
| `README.md` | Add short local-dev workflow using `make env`, `make up`, and `make db-info` |

---

## Task 1: Ignore `.env.local` and document the local env bootstrap source

**Files:**
- Modify: `.gitignore`
- Modify: `.env.example`

- [ ] **Step 1: Add the failing `.env.local` ignore rule**

Update `.gitignore` near the existing env section:

```gitignore
.env
.env.local
```

- [ ] **Step 2: Verify the repo still tracks `.env.example` but ignores `.env.local`**

Run:

```bash
cd /home/phan-duong-quoc-nhat/workspace/InsForge
git check-ignore -v .env.local
git check-ignore -v .env.example || true
```

Expected:
- `.env.local` is reported as ignored
- `.env.example` is not ignored

- [ ] **Step 3: Update `.env.example` header comments for the new local flow**

Replace the top bootstrap comment block in `.env.example` with:

```dotenv
# =============================================================================
# InsForge Environment Configuration
# =============================================================================
# Local development flow:
#   cp .env.example .env.local
#   make up
#
# Security Notes:
# - Never commit .env or .env.local to version control
# - Use strong, unique secrets in production
# - Rotate secrets regularly
# =============================================================================
```

Keep the existing default local DB values unchanged:

```dotenv
POSTGRES_USER=postgres
POSTGRES_PASSWORD=postgres
POSTGRES_DB=insforge
POSTGRES_PORT=5432
```

- [ ] **Step 4: Verify the `.env.example` update is present and the DB defaults remain intact**

Run:

```bash
cd /home/phan-duong-quoc-nhat/workspace/InsForge
rg -n "cp \\.env.example \\.env.local|POSTGRES_USER=postgres|POSTGRES_PASSWORD=postgres|POSTGRES_DB=insforge|POSTGRES_PORT=5432" .env.example
```

Expected: all five lines are found

- [ ] **Step 5: Commit**

```bash
cd /home/phan-duong-quoc-nhat/workspace/InsForge
git add .gitignore .env.example
git commit -m "chore(dev): add local env bootstrap conventions"
```

---

## Task 2: Add the root `Makefile` with env bootstrap and full-stack Docker targets

**Files:**
- Create: `Makefile`

- [ ] **Step 1: Write the initial Makefile skeleton**

Create `Makefile` with the shared variables and `.PHONY` block:

```make
ENV_FILE ?= .env.local
COMPOSE ?= docker compose --env-file $(ENV_FILE)

.PHONY: env up down restart logs ps migrate db-info ensure-env
```

- [ ] **Step 2: Add the env bootstrap and guard targets**

Append these targets to `Makefile`:

```make
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
```

- [ ] **Step 3: Add the full-stack runtime targets**

Append these targets to `Makefile`:

```make
up: ensure-env
	$(COMPOSE) up -d --build

down: ensure-env
	$(COMPOSE) down

restart: down up

logs: ensure-env
	$(COMPOSE) logs -f

ps: ensure-env
	$(COMPOSE) ps
```

- [ ] **Step 4: Add the migration and DB info targets**

Append these targets to `Makefile`:

```make
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
```

- [ ] **Step 5: Verify the Makefile targets are discoverable**

Run:

```bash
cd /home/phan-duong-quoc-nhat/workspace/InsForge
make env
make db-info
make -pn | rg "^(env|ensure-env|up|down|restart|logs|ps|migrate|db-info):"
```

Expected:
- `make env` creates `.env.local` or reports it already exists
- `make db-info` prints local PostgreSQL values
- `make -pn` lists all target names

- [ ] **Step 6: Commit**

```bash
cd /home/phan-duong-quoc-nhat/workspace/InsForge
git add Makefile
git commit -m "feat(dev): add Makefile for local stack workflow"
```

---

## Task 3: Ensure `make up` and `make migrate` match the existing Docker stack

**Files:**
- Modify: `Makefile`
- Modify: `docker-compose.yml`

- [ ] **Step 1: Verify whether `docker-compose.yml` already works with `--env-file .env.local`**

Run:

```bash
cd /home/phan-duong-quoc-nhat/workspace/InsForge
docker compose --env-file .env.local config > /tmp/insforge-compose-config.yaml
sed -n '1,120p' /tmp/insforge-compose-config.yaml
```

Expected: Compose resolves successfully and shows the existing services without interpolation errors

- [ ] **Step 2: Only if needed, normalize compose references so `.env.local` works cleanly**

If the compose config step fails due to missing defaults or env assumptions, make the smallest necessary edit in `docker-compose.yml`. Keep service names and env variable names unchanged. The expected style is:

```yaml
ports:
  - "${POSTGRES_PORT:-5432}:5432"
environment:
  - POSTGRES_DB=${POSTGRES_DB:-insforge}
  - POSTGRES_USER=${POSTGRES_USER:-postgres}
  - POSTGRES_PASSWORD=${POSTGRES_PASSWORD:-postgres}
```

Do not redesign the stack. Only patch interpolation issues that block `make up`.

- [ ] **Step 3: Verify `make up` and `make ps` work together**

Run:

```bash
cd /home/phan-duong-quoc-nhat/workspace/InsForge
make up
make ps
```

Expected:
- `make up` starts the full stack
- `make ps` shows `postgres`, `postgrest`, `insforge`, `deno`, and `vector`

- [ ] **Step 4: Verify `make migrate` uses the running app container context**

Run:

```bash
cd /home/phan-duong-quoc-nhat/workspace/InsForge
make migrate
```

Expected: backend migration command runs inside the `insforge` container without requiring manual shell access

- [ ] **Step 5: Commit**

```bash
cd /home/phan-duong-quoc-nhat/workspace/InsForge
git add Makefile docker-compose.yml
git commit -m "fix(dev): align Makefile workflow with Docker Compose stack"
```

---

## Task 4: Add concise README instructions for local startup and DBeaver

**Files:**
- Modify: `README.md`

- [ ] **Step 1: Insert a short “Local Dev Quick Start” section near the existing local setup instructions**

Add this block to `README.md` near the local Docker usage section:

```md
## Local Dev Quick Start

```bash
make env
make up
make db-info
```

- `make env` creates `.env.local` from `.env.example` if needed
- `make up` starts the full Docker stack
- `make db-info` prints the PostgreSQL settings for local tools like DBeaver
```

- [ ] **Step 2: Add the DBeaver connection values explicitly**

Immediately after that section, add:

```md
### DBeaver PostgreSQL Settings

Use these local defaults unless you changed them in `.env.local`:

- Host: `localhost`
- Port: `5432`
- Database: `insforge`
- Username: `postgres`
- Password: `postgres`
```

- [ ] **Step 3: Verify the README content is present**

Run:

```bash
cd /home/phan-duong-quoc-nhat/workspace/InsForge
rg -n "Local Dev Quick Start|make env|make up|make db-info|DBeaver PostgreSQL Settings|Database: `insforge`" README.md
```

Expected: all inserted headings and commands are found

- [ ] **Step 4: Commit**

```bash
cd /home/phan-duong-quoc-nhat/workspace/InsForge
git add README.md
git commit -m "docs(dev): add local Makefile and DBeaver workflow"
```

---

## Task 5: Final verification of the local-dev workflow

**Files:**
- Modify: `Makefile`
- Modify: `.env.example`
- Modify: `.gitignore`
- Modify: `README.md`
- Modify: `docker-compose.yml` (only if Task 3 required it)

- [ ] **Step 1: Verify the complete happy path from a clean local config**

Run:

```bash
cd /home/phan-duong-quoc-nhat/workspace/InsForge
rm -f .env.local
make env
make db-info
docker compose --env-file .env.local config >/tmp/insforge-compose-config.yaml
```

Expected:
- `.env.local` is recreated successfully
- `make db-info` prints connection info without errors
- compose config resolves successfully against `.env.local`

- [ ] **Step 2: Verify the full stack control targets**

Run:

```bash
cd /home/phan-duong-quoc-nhat/workspace/InsForge
make up
make ps
make down
```

Expected:
- `make up` brings up the stack
- `make ps` shows container state
- `make down` shuts the stack down cleanly

- [ ] **Step 3: Verify there are no formatting or obvious Makefile issues**

Run:

```bash
cd /home/phan-duong-quoc-nhat/workspace/InsForge
git diff --check
make -n restart
```

Expected:
- `git diff --check` reports no whitespace or merge-marker issues
- `make -n restart` expands to `down` then `up`

- [ ] **Step 4: Commit**

```bash
cd /home/phan-duong-quoc-nhat/workspace/InsForge
git add Makefile .gitignore .env.example README.md docker-compose.yml
git commit -m "chore(dev): verify local Makefile workflow"
```

---

## Spec Coverage Check

- Root `Makefile`: covered by Tasks 2 and 5
- `.env.local` bootstrap from `.env.example`: covered by Tasks 1, 2, and 5
- `make up` starts the full stack: covered by Tasks 2, 3, and 5
- Helper commands `down`, `restart`, `logs`, `ps`, `migrate`, `db-info`: covered by Task 2 and verified in Tasks 3 and 5
- DBeaver connection details: covered by Task 2 `db-info` and Task 4 README docs
- Preserve existing Docker structure and env names: covered by Task 3

## Placeholder Scan

- No `TODO`, `TBD`, or “implement later” markers remain
- Every code-changing step includes exact file paths and concrete snippets
- Every verification step includes an exact command and expected result

## Type And Command Consistency Check

- `.env.local` is the only machine-specific env file used throughout the plan
- `make up` consistently refers to `docker compose --env-file .env.local up -d --build`
- DB defaults stay `localhost / 5432 / insforge / postgres / postgres`
- `make migrate` consistently runs the backend migration inside the `insforge` container context

