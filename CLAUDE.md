# DSTC Matching — Team formation platform for DSTC 2026

Matching Teammate is a web platform for Data Science Talent Competition participants to find and form teams. Think Tinder for team-building: swipe to discover peers, match, chat, and assemble a team.

## Features
- **Discover** — Tinder-like swiping (like/pass) to find compatible teammates
- **Profiles** — Skills, experience, goals, achievements
- **Matches** — Mutual likes create a match
- **Messaging** — 1-on-1 chat between matched users
- **Teams** — Create/join teams, send invites
- **Guide** — Onboarding page for new participants
- **Admin** — Match management dashboard

## Architecture

```
Cloudflare Pages                    Bare metal server (nginx)
matching.cteftu.id.vn               matching-api.cteftu.id.vn
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

## Tech stack

| Layer | Technology |
|-------|-----------|
| Frontend | React 18, Vite, Tailwind CSS, React Router, TanStack Query, Framer Motion |
| UI components | shadcn/ui (Radix primitives) in `src/components/ui/` |
| Backend | Python 3.14, FastAPI, uvicorn, asyncpg |
| Auth | Supabase GoTrue (self-hosted), JWT (HS256), Google Identity Services |
| Database | PostgreSQL 15 (Supabase Postgres image) |
| API gateway | Kong (declarative mode) |
| Dashboard | Supabase Studio |
| Deployment | Cloudflare Pages (frontend), bare metal + nginx (backend), podman Quadlet (Supabase) |
| CI/CD | GitHub Actions → Wrangler → Cloudflare Pages |

## Directory structure

```
├── src/                        # React frontend
│   ├── api/apiClient.js        # API client (fetch wrapper, token management)
│   ├── lib/
│   │   ├── AuthContext.jsx     # Auth state provider (login, signup, logout)
│   │   ├── supabase.js         # Thin GoTrue REST wrapper (used by AuthContext)
│   │   └── PageNotFound.jsx
│   ├── components/
│   │   ├── ui/                 # shadcn/ui primitives
│   │   └── layout/             # AppLayout with sidebar
│   └── pages/                  # Route pages (Dashboard, Discover, Matches, etc.)
├── server/                     # FastAPI backend
│   ├── main.py                 # App entry point, CORS, router registration
│   ├── database.py             # asyncpg pool, fetch/fetch_one/execute helpers
│   ├── auth/
│   │   ├── config.py           # Env vars (DATABASE_URL, JWT_SECRET, GOTRUE_URL)
│   │   ├── jwt.py              # JWT verification (python-jose)
│   │   ├── dependencies.py     # get_current_user / get_current_user_id
│   │   └── gotrue.py           # GoTrue REST client (signup, login, refresh, idtoken)
│   ├── routes/                 # API route modules
│   │   ├── auth.py             # /auth/signup, /login, /google, /me, /refresh, /logout
│   │   ├── profiles.py         # /api/contestant-profiles CRUD
│   │   ├── matches.py          # /api/matches CRUD
│   │   ├── messages.py         # /api/messages CRUD + bulk-update
│   │   ├── swipes.py           # /api/swipe-actions CRUD
│   │   ├── teams.py            # /api/teams CRUD
│   │   ├── invites.py          # /api/team-invites CRUD
│   │   └── integrations.py     # /api/upload, /api/send-email (stub)
│   └── uploads/                # User-uploaded files (gitignored)
├── supabase/                   # Self-hosted Supabase infrastructure
│   ├── podman-compose.yml      # Service definitions
│   ├── .env                    # Secrets (gitignored)
│   ├── volumes/db/init/        # PostgreSQL init scripts
│   └── volumes/api/            # Kong config + entrypoint
├── nginx/                      # Reference nginx configs
└── .github/workflows/deploy.yml  # CI: build → Cloudflare Pages
```

## Auth flow

The frontend and backend are on **different origins** (Cloudflare Pages vs bare metal). Auth uses **Bearer tokens** stored in localStorage.

```
Email/password signup:
  Frontend → POST /auth/signup → FastAPI → GoTrue /signup (via Kong) → JWT returned

Email/password login:
  Frontend → POST /auth/login → FastAPI → GoTrue /token (via Kong) → JWT returned

Google sign-in:
  Frontend (Google Identity Services popup) → ID token
  → POST /auth/google → FastAPI → GoTrue /idtoken (via Kong) → JWT returned

Authenticated requests:
  Frontend → Authorization: Bearer <token> → FastAPI → verify JWT → extract user_id

Token refresh:
  Frontend (on 401) → POST /auth/refresh → GoTrue → new JWT pair
```

The FastAPI server calls GoTrue through Kong (`supabase.cteftu.id.vn/auth/v1/`) using the `service_role` key as the `apikey` header.

## Database

PostgreSQL 15 via Supabase's postgres image. Tables use UUID primary keys, `TIMESTAMPTZ` for timestamps, `JSONB` for arrays (skills, goals, member_ids).

**Tables:** `users`, `contestant_profiles`, `matches`, `messages`, `swipe_actions`, `teams`, `team_invites`

**Schema files:**
- `supabase/volumes/db/init/00-init-auth-schema.sh` — Supabase roles, schemas, extensions (shell script, reads `POSTGRES_PASSWORD` from env)
- `supabase/volumes/db/init/01-app-tables.sql` — Application tables

**Query patterns:** All queries use asyncpg with `$1, $2, ...` placeholders (not `?`). JSON fields are serialized with `json.dumps()` on write and parsed in `database._record_to_dict()`.

## Environment variables

**Frontend** (build-time, set in Cloudflare Pages dashboard or GitHub Secrets):
- `VITE_API_BASE` — Backend URL (`https://matching-api.cteftu.id.vn`)
- `VITE_GOOGLE_CLIENT_ID` — Google OAuth client ID

**Server** (`server/.env`, gitignored):
- `DATABASE_URL` — PostgreSQL connection string (URL-encoded password)
- `GOTRUE_URL` — GoTrue endpoint (`https://supabase.cteftu.id.vn/auth/v1`)
- `GOTRUE_SERVICE_KEY` — Supabase service_role JWT (for Kong apikey)
- `JWT_SECRET` — Must match GoTrue's JWT secret
- `CORS_ORIGINS` — Comma-separated allowed origins

**Supabase** (`supabase/.env`, gitignored):
- `POSTGRES_PASSWORD`, `DASHBOARD_USERNAME`, `DASHBOARD_PASSWORD`
- `SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`
- `GOTRUE_JWT_SECRET`, `GOTRUE_EXTERNAL_GOOGLE_CLIENT_ID`, `GOTRUE_EXTERNAL_GOOGLE_SECRET`

## Development

### 1. Supabase (PostgreSQL + GoTrue + Kong)

Local dev uses `podman-compose` (not the Quadlet `.container` files, which are for production).

```bash
cd supabase

# Create .env if you don't have one (see "Environment variables" above)
# POSTGRES_PASSWORD, JWT_SECRET, GOTRUE_EXTERNAL_GOOGLE_CLIENT_ID, GOTRUE_EXTERNAL_GOOGLE_SECRET
# GOTRUE_DB_DATABASE_URL, PGRST_DB_URI, GOTRUE_JWT_SECRET, PGRST_JWT_SECRET
# SUPABASE_ANON_KEY, SUPABASE_SERVICE_ROLE_KEY, AUTH_JWT_SECRET
# POSTGRES_URL, PG_META_DB_PASSWORD, DASHBOARD_USERNAME, DASHBOARD_PASSWORD

podman-compose up -d
```

This starts:
- **supabase-db** — PostgreSQL 15 on `localhost:5432`
- **supabase-auth** — GoTrue on `localhost:9999`
- **rest** — PostgREST (internal only, used by Studio)
- **kong** — API gateway on `localhost:8001`
- **studio** — Dashboard on `localhost:3000`

Init scripts in `volumes/db/init/` run automatically on first boot:
- `00-init-auth-schema.sh` — creates Supabase roles (`supabase_auth_admin`, `authenticator`, `anon`, `authenticated`, `service_role`), schemas, extensions. Reads `POSTGRES_PASSWORD` from the container environment.
- `01-app-tables.sql` — creates application tables (`users`, `contestant_profiles`, `matches`, `messages`, `swipe_actions`, `teams`, `team_invites`).

### 2. Backend (FastAPI)

```bash
cd server
pip install -r requirements.txt

# Create .env (see "Environment variables" above)
# DATABASE_URL, GOTRUE_URL, GOTRUE_SERVICE_KEY, JWT_SECRET, CORS_ORIGINS

uvicorn main:app --reload --port 8000
```

The backend connects to PostgreSQL at `localhost:5432` and calls GoTrue via Kong at `localhost:8001` (or `supabase.cteftu.id.vn/auth/v1/` in production).

### 3. Frontend (Vite)

```bash
bun install
bun run dev    # port 5173
```

Vite proxies `/api`, `/auth`, `/uploads` to `localhost:8000` in dev mode.

### Production (Quadlet)

Production Supabase runs via podman Quadlet `.container` files in `supabase/` (`supabase-db.container`, `supabase-auth.container`, `supabase-rest.container`, `supabase-kong.container`, `supabase-studio.container`, `supabase-pg-meta.container`). These load secrets from `EnvironmentFile=/home/chimse/cte/supabase/.env` on the bare metal server. The compose file is for local dev only.

## Claude Code Rules

- NEVER rewrite an entire file to change a few lines. Use Edit with specific old_string/new_string.
- Keep terminal-error explanations under two sentences.
- When running automated test-debug loops, halt and prompt the user after 3 failed attempts.
- The `supabase/.env` and `server/.env` are gitignored and contain live secrets — never print their contents.
- Frontend env vars are prefixed `VITE_` and embedded at build time. Server env vars are loaded via python-dotenv.
- All route handlers are `async def`. All DB calls use `await fetch()` / `await fetch_one()` / `await execute()`.
- Auth-protected endpoints use `user: dict = Depends(get_current_user)`. The user dict comes from `public.users`, not GoTrue directly.
