<h1 align="center" id="title">Meraki / Agent Orchestration System</h1>

<p align="center"><img src="https://socialify.git.ci/yz174/meraki/image?custom_description=Orchestrate+Agents+your+way&description=1&forks=1&issues=1&name=1&pattern=Circuit+Board&pulls=1&stargazers=1&theme=Dark"></p>

<p id="description">A production-grade self-hosted AI agent orchestration platform. Run autonomous LLM agents with tool execution human-in-the-loop approvals vector memory and a full audit trail all on your own infrastructure.</p>

  
  
## Architecture

```
┌─────────────────────────────────────────────────────┐
│                     apps/web (Next.js 15)            │  ← Dashboard & HITL UI
└───────────────────────┬─────────────────────────────┘
                        │ REST / SSE
┌───────────────────────▼─────────────────────────────┐
│               apps/gateway (Fastify v5)              │  ← Auth, RBAC, BullMQ queue
└──┬─────────────┬──────────────────┬──────────────────┘
   │ Postgres     │ Redis             │ Qdrant
   │ (drizzle)    │ (BullMQ)         │ (vector memory)
┌──▼─────────────▼──────────────────▼──────────────────┐
│           packages/orchestration (workers)            │  ← inference / rag / browser / shell
└───────────────────────┬──────────────────────────────┘
                        │ HMAC-signed HTTP
┌───────────────────────▼──────────────────────────────┐
│               packages/runner (Fastify)               │  ← Tool executor + sandbox manager
│                     ┌────────────┐                    │
│                     │  Docker    │                    │  ← Ephemeral containers per tool call
│                     │  Sandbox   │                    │
│                     └────────────┘                    │
└───────────────────────────────────────────────────────┘
```

## Feature Overview

| Feature | Description |
|---|---|
| **LLM Orchestration** | Mastra-based planner agents; Anthropic, OpenAI, or Ollama |
| **Tool Execution** | Shell, Python, browser (Playwright) — each in an ephemeral Docker sandbox |
| **Vector Memory** | Qdrant-backed RAG with nomic-embed-text-v1.5 (384-dim) |
| **HITL Approvals** | Configurable tool-call approval gates; SSE push to web UI |
| **RBAC** | Four roles: `admin`, `developer`, `operator`, `readonly` |
| **Audit Log** | Immutable append-only audit table with actor, IP-hash, trace-id |
| **Connector Stubs** | Telegram, Discord, WhatsApp (feature-flagged) |
| **CLI** | `agentflow agent|logs|memory|config|docker` commands |
| **Security** | HMAC runner auth, Zod env validation, seccomp sandbox profile, Trivy CI scan |

## Repository Layout

```
meraki/
├── apps/
│   ├── gateway/          # Fastify API server — REST + SSE + BullMQ producer
│   ├── web/              # Next.js 15 dashboard (Tailwind v4)
│   └── cli/              # Ink v5 + yargs CLI
├── packages/
│   ├── shared/           # Types, Zod schemas, crypto, PII redaction, secret provider
│   ├── db/               # Drizzle ORM schema + migrations (SQLite / Postgres)
│   ├── core/             # Mastra agent factory, planner, memory utils
│   ├── rag/              # Qdrant ingest + query pipeline
│   ├── orchestration/    # BullMQ workers (inference, rag, browser, shell) + cron
│   ├── runner/           # Sandboxed tool executor (Docker-in-Docker)
│   └── connectors/       # External integration stubs
├── docker/
│   ├── Dockerfile.gateway
│   ├── Dockerfile.runner
│   ├── Dockerfile.sandbox
│   ├── docker-compose.yml       # Production
│   ├── docker-compose.dev.yml   # Dev overrides
│   └── seccomp-sandbox.json     # Sandbox syscall allowlist
├── scripts/              # Backup, restore, secret-rotation helpers
└── .github/
    ├── workflows/ci.yml
    └── trivy-exceptions.yaml
```

## Quick Start (Local Dev)

### Prerequisites

- Node.js 22 LTS
- pnpm 10.13.1 — `corepack enable && corepack prepare pnpm@10.13.1 --activate`
- Docker Desktop (for sandbox tools)

### 1. Install and build

```bash
pnpm install
pnpm turbo run build
```

### 2. Configure environment

```bash
cp .env.example .env
# Edit .env — at minimum set JWT_SECRET and RUNNER_INTERNAL_SECRET
# Generate: openssl rand -hex 32
```

### 3. Start infrastructure

```bash
docker compose -f docker/docker-compose.yml -f docker/docker-compose.dev.yml up -d postgres redis qdrant
```

### 4. Run database migrations

```bash
pnpm --filter "@agentflow/db" db:migrate
```

### 5. Start the gateway

```bash
pnpm --filter "@agentflow/gateway" dev
```

### 6. Start the web UI

```bash
pnpm --filter "@agentflow/web" dev
# Opens http://localhost:3001
```

### 7. Use the CLI

```bash
# Install globally (optional)
npm install -g .

agentflow config set gatewayUrl http://localhost:3000
agentflow config set token <your-jwt>

agentflow agent list
agentflow logs --level debug
agentflow memory search "agent planning"
```

## Production Deployment (Docker Compose)

```bash
# Create a .env with all required secrets
cp .env.example .env
# Set: POSTGRES_PASSWORD, REDIS_PASSWORD, JWT_SECRET, RUNNER_INTERNAL_SECRET

# Build images
docker compose -f docker/docker-compose.yml build

# Start stack
docker compose -f docker/docker-compose.yml up -d

# View logs
docker compose -f docker/docker-compose.yml logs -f gateway
```

Required environment variables (validated at startup via Zod):

| Variable | Required | Description |
|---|---|---|
| `JWT_SECRET` | ✅ | Min 32 chars. `openssl rand -hex 32` |
| `RUNNER_INTERNAL_SECRET` | ✅ | Min 32 chars. Rotated weekly |
| `POSTGRES_PASSWORD` | ✅ (Docker) | Postgres password |
| `REDIS_PASSWORD` | ✅ (Docker) | Redis password |
| `ANTHROPIC_API_KEY` | If using Anthropic | LLM provider key |
| `OPENAI_API_KEY` | If using OpenAI | LLM provider key |
| `QDRANT_API_KEY` | Recommended | Qdrant auth key |

See [.env.example](.env.example) for the full reference.

## Development

### Build a single package

```bash
pnpm --filter "@agentflow/gateway" build
```

### Run tests

```bash
pnpm vitest run --reporter=verbose
```

### Lint + format

```bash
pnpm biome check .
pnpm biome format --write .
```

### Full gate check

```bash
pnpm turbo run build
```

## Security

### Sandbox isolation

Every tool call (shell, Python, browser) runs in an ephemeral Docker container with:

- Read-only root filesystem (`--read-only`)
- All capabilities dropped (`--cap-drop ALL`)
- Custom seccomp profile (`docker/seccomp-sandbox.json`) blocking `ptrace`, `mount`, `bpf`, and 400+ other syscalls
- Network egress limited to `RUNNER_EGRESS_ALLOWLIST`
- 30-second timeout (configurable via `SHELL_TIMEOUT`)

### Secret rotation

Runner `HMAC` key and JWT secret should be rotated weekly:

```bash
bash scripts/rotate-secrets.sh
```

### CVE scanning

Trivy scans run on every push to `main`/`develop` (sandbox image) and weekly (full filesystem). Results upload to GitHub Security as SARIF.

To document an accepted exception:

```yaml
# .github/trivy-exceptions.yaml
CVE-2024-99999:
  # Justification: no upstream fix; mitigated by read-only FS
  # Issue: https://github.com/org/agentflow/issues/123
  # Expires: 2026-06-01
```

### HMAC request signing

All gateway → runner requests are signed with `RUNNER_INTERNAL_SECRET`:

- Header `x-runner-signature`: `hmac-sha256-hex(canonical-string, secret)`
- Header `x-runner-timestamp`: Unix epoch seconds
- Timestamp drift tolerance: ±30 seconds
- Canonical string: `METHOD\nPATH\nBODY_SHA256\nTIMESTAMP`

## CI/CD

```
push / PR → lint → test → security-injection → build → scan-containers
schedule  → weekly-scan + backup-restore-test
```

All jobs use pnpm 10.13.1 and Node 22. The `security-injection` gate runs prompt-injection fixture tests and must pass at 100% before any merge.

## Contributing

1. Fork and create a feature branch from `develop`
2. `pnpm install && pnpm turbo run build` — all packages must compile
3. Write tests for new behaviour
4. `pnpm biome check .` — zero lint errors
5. Open a PR against `develop`

## License

MIT