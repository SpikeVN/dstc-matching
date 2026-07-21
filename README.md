# DSTC Matching

Team formation platform for Data Science Talent Competition 2026 participants. Swipe to discover peers, match, chat, and form teams.

## Quick start

### Prerequisites

- [Bun](https://bun.sh) (frontend)
- Python 3.12+ (backend)
- [Podman](https://podman.io) + podman-compose (Supabase / PostgreSQL)

### 1. Clone & install

```bash
git clone <repo-url> && cd dstc-matching

# Frontend
bun install

# Backend
cd server && pip install -r requirements.txt && cd ..
```

### 2. Set up environment variables

Create two `.env` files (both are gitignored):

**`supabase/.env`** — Supabase infrastructure secrets:

```bash
# PostgreSQL
POSTGRES_PASSWORD=<generate-with: openssl rand -base64 32>

# GoTrue DB connection (URL-encode the password)
GOTRUE_DB_DATABASE_URL=postgresql://supabase_auth_admin:<url-encoded-password>@supabase-db:5432/postgres
GOTRUE_JWT_SECRET=<generate-with: openssl rand -base64 32>

# PostgREST
PGRST_DB_URI=postgres://authenticator:<url-encoded-password>@supabase-db:5432/postgres
PGRST_JWT_SECRET=<same-as-GOTRUE_JWT_SECRET>

# Google OAuth (optional — from Google Cloud Console)
GOTRUE_EXTERNAL_GOOGLE_CLIENT_ID=<your-google-client-id>
GOTRUE_EXTERNAL_GOOGLE_SECRET=<your-google-client-secret>

# Studio & pg-meta
AUTH_JWT_SECRET=<same-as-GOTRUE_JWT_SECRET>
POSTGRES_URL=postgresql://supabase_admin:<url-encoded-password>@supabase-db:5432/postgres
PG_META_DB_PASSWORD=<same-as-POSTGRES_PASSWORD>
DASHBOARD_USERNAME=supabase
DASHBOARD_PASSWORD=<pick-a-password>

# Kong / API keys (generate JWTs with the role claims — see Supabase docs)
ANON_KEY=<supabase-anon-jwt>
SERVICE_ROLE_KEY=<supabase-service-role-jwt>
SUPABASE_ANON_KEY=<same-as-ANON_KEY>
SUPABASE_SERVICE_ROLE_KEY=<same-as-SERVICE_ROLE_KEY>
```

**`server/.env`** — FastAPI backend secrets:

```bash
DATABASE_URL=postgresql://postgres:<url-encoded-password>@localhost:5432/postgres
GOTRUE_URL=http://localhost:8001/auth/v1
GOTRUE_SERVICE_KEY=<same-as-SERVICE_ROLE_KEY>
JWT_SECRET=<same-as-GOTRUE_JWT_SECRET>
CORS_ORIGINS=http://localhost:5173
```

### 3. Start Supabase

```bash
cd supabase
podman-compose up -d
```

This boots PostgreSQL (`:5432`), GoTrue (`:9999`), PostgREST, Kong (`:8001`), and Studio (`:3000`).

On first boot, the init scripts in `volumes/db/init/` automatically:
- Create Supabase roles and schemas (`00-init-auth-schema.sh`)
- Create application tables (`01-app-tables.sql`)

### 4. Start the backend

```bash
cd server
uvicorn main:app --reload --port 8000
```

### 5. Start the frontend

```bash
bun run dev    # http://localhost:5173
```

Vite proxies `/api`, `/auth`, `/uploads` to `localhost:8000` in dev mode, so no CORS issues locally.

## Architecture

```
Cloudflare Pages                    Bare metal server (nginx)
matching.cteftu.id.vn               supabase.cteftu.id.vn
┌──────────────────┐                ┌──────────────────────────┐
│  React SPA (Vite)│── API calls ──▶│  FastAPI (uvicorn :8000) │
│  Static build    │                │    ├─ /auth/* → GoTrue   │
└──────────────────┘                │    ├─ /api/*  → routes   │
                                    │    └─ /uploads → static  │
Supabase (self-hosted, podman)      └──────────────────────────┘
supabase.cteftu.id.vn (API)               │
studio.cteftu.id.vn (dashboard)           ▼
┌─────────────────────────────┐    ┌──────────────┐
│  Kong :8000 (API gateway)   │    │  PostgreSQL  │
│    ├─ /auth/v1 → GoTrue     │───▶│  :5432       │
│    ├─ /rest/v1 → PostgREST  │    └──────────────┘
│    └─ /        → Studio     │
└─────────────────────────────┘
```

| Layer | Technology |
|-------|-----------|
| Frontend | React 18, Vite, Tailwind CSS, React Router, TanStack Query, Framer Motion |
| UI components | shadcn/ui (Radix primitives) |
| Backend | Python 3.14, FastAPI, uvicorn, asyncpg |
| Auth | Supabase GoTrue (self-hosted), JWT (HS256), Google Identity Services |
| Database | PostgreSQL 15 (Supabase Postgres image) |
| Deployment | Cloudflare Pages (frontend), bare metal + nginx + podman (backend + Supabase) |
| CI/CD | GitHub Actions → Wrangler → Cloudflare Pages |

## Project structure

```
├── src/                        # React frontend
│   ├── api/apiClient.js        # API client (fetch wrapper, token management)
│   ├── lib/
│   │   ├── AuthContext.jsx     # Auth state provider (login, signup, logout)
│   │   └── supabase.js         # Thin GoTrue REST wrapper
│   ├── components/
│   │   ├── ui/                 # shadcn/ui primitives
│   │   └── layout/             # AppLayout with sidebar
│   └── pages/                  # Route pages
├── server/                     # FastAPI backend
│   ├── main.py                 # App entry point, CORS, router registration
│   ├── database.py             # asyncpg pool, query helpers
│   ├── auth/                   # Auth module (JWT, GoTrue client, dependencies)
│   └── routes/                 # API route modules
├── supabase/                   # Self-hosted Supabase
│   ├── podman-compose.yml      # Local dev service definitions
│   ├── *.container             # Production Quadlet unit files
│   ├── .env                    # Secrets (gitignored)
│   └── volumes/                # DB init scripts + Kong config
├── nginx/                      # Reference nginx configs
└── .github/workflows/deploy.yml  # CI/CD pipeline
```

## Deployment

### Frontend (Cloudflare Pages)

Push to `main` triggers GitHub Actions → `vite build` → Wrangler deploy. Set these GitHub Secrets:
- `VITE_API_BASE` — Backend URL
- `VITE_GOOGLE_CLIENT_ID` — Google OAuth client ID
- `CLOUDFLARE_API_TOKEN` — Wrangler API token
- `CLOUDFLARE_ACCOUNT_ID` — Cloudflare account ID

### Backend + Supabase (bare metal)

Managed via podman Quadlet `.container` files on the production server. See `supabase/*.container` for service definitions. Secrets loaded from `EnvironmentFile=/home/chimse/cte/supabase/.env`.

## License

Private — DSTC 2026 organizers only.
