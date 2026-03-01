# VALKYRIA ECM - Project Instructions

## Architecture

| Component | Port | Directory | Tech |
|-----------|------|-----------|------|
| API | **3100** | `/` | Rails 7.2, Puma, Mongoid 9 |
| Frontend | **5173** | `frontend/` | React 19, Vite |
| Database | 27017 | — | MongoDB |
| Queue | 6379 | — | Redis + Sidekiq 7 |

## Port Protocol

> See **~/.claude/PORT_REGISTRY.md** for the global port registry.
>
> **NEVER change ports without updating the registry.**
> **NEVER use port 3000** — that belongs to MONEY.

### Start Services

```bash
# Backend
bundle exec rails server -p 3100

# Frontend
cd frontend && npm run dev
```

### URLs

- Frontend: http://localhost:5173
- API: http://localhost:3100
- API Health: http://localhost:3100/api/v1/health
