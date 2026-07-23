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
Cloudflare Pages                    Bare metal server (rootful Podman)
matching.cteftu.id.vn               matching-api.cteftu.id.vn
┌──────────────────┐                ┌──────────────────────────┐
│  React SPA (Vite)│── API calls ──▶│  FastAPI (uvicorn :8000) │
│  Static build    │                │    ├─ /auth/* → GoTrue   │
└──────────────────┘                │    ├─ /api/*  → routes   │
                                    │    └─ /uploads → static  │
Supabase CLI (rootful Podman)       └──────────────────────────┘
supabase.cteftu.id.vn (API)               │
studio.cteftu.id.vn (dashboard)           ▼
┌─────────────────────────────┐    ┌──────────────┐
│  Kong :54321 (API gateway)  │    │  PostgreSQL  │
│    ├─ /auth/v1 → GoTrue     │───▶│  :54322      │
│    ├─ /rest/v1 → PostgREST  │    └──────────────┘
│    └─ /      → Studio       │
└─────────────────────────────┘
All on supabase_network_supabase-app bridge network
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
| Deployment | Cloudflare Pages (frontend), bare metal + nginx (backend), Supabase CLI + rootful Podman (Supabase) |
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
- `supabase/migrations/00001_app_tables.sql` — Application tables (applied by `supabase db reset`)

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

**Supabase CLI** (root `.env`, referenced by `supabase/config.toml` via `env()`):
- `GOTRUE_EXTERNAL_GOOGLE_CLIENT_ID`, `GOTRUE_EXTERNAL_GOOGLE_SECRET` — Google OAuth
- `GOTRUE_SMTP_*` — SMTP config (host, port, user, pass, admin_email, sender_name)

## Development

### 1. Supabase (PostgreSQL + GoTrue + Kong)

Both local dev and production use the **Supabase CLI** with Podman. The config lives at `supabase/config.toml`. Secrets are referenced via `env()` from the root `.env` file.

```bash
# Start all Supabase services (DB, Auth, Kong, PostgREST, Studio)
bunx supabase start

# Stop (preserves data)
bunx supabase stop

# Reset DB — re-applies migrations from supabase/migrations/ + seeds
bunx supabase db reset
```

Key ports on localhost:
- **API/Kong** — `:54321` (API gateway, routes `/auth/v1`, `/rest/v1`, etc.)
- **DB** — `:54322` (PostgreSQL, user `postgres`, password `postgres`)
- **Studio** — `:54323` (Supabase dashboard)

### 2. Backend (FastAPI)

```bash
cd server
pip install -r requirements.txt

# Create .env (see "Environment variables" above)
# DATABASE_URL, GOTRUE_URL, GOTRUE_SERVICE_KEY, JWT_SECRET, CORS_ORIGINS

uvicorn main:app --reload --port 8000
```

The backend connects to PostgreSQL at `localhost:54322` and calls GoTrue via Kong at `localhost:54321/auth/v1` (or `supabase.cteftu.id.vn/auth/v1/` in production).

### 3. Frontend (Vite)

```bash
bun install
bun run dev    # port 5173
```

Vite proxies `/api`, `/auth`, `/uploads` to `localhost:8000` in dev mode.

### Production

Production runs all services as **rootful Podman** containers on the bare metal server (`mainframe.cteftu.id.vn`).

**Supabase stack** — managed by Supabase CLI:
```bash
# SSH as root
ssh root@mainframe.cteftu.id.vn

export DOCKER_HOST=unix:///run/podman/podman.sock
export PATH="/home/chimse/.bun/bin:$PATH"
cd /home/chimse/cte/supabase-app

# Start/stop
bunx supabase start --ignore-health-check
bunx supabase stop
```

Config: `/home/chimse/cte/supabase-app/supabase/config.toml`
Env: `/home/chimse/cte/supabase-app/.env` (SMTP_PASS, GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET)
Migrations: `/home/chimse/cte/supabase-app/supabase/migrations/`
Network: `supabase_network_supabase-app` (bridge, created by Supabase CLI)

**matching-api** — Quadlet at `/etc/containers/systemd/matching-api.container`, joins `supabase_network_supabase-app` network. Env file at `/home/chimse/cte/matching-api/.env`.

**nginx** — Quadlet at `/etc/containers/systemd/nginx.container`, joins `supabase_network_supabase-app` network. Config at `/home/chimse/cte/nginx/conf/`.

**Important:** After `supabase stop` + `supabase start`, restart matching-api and nginx since the network is recreated:
```bash
systemctl restart matching-api.service
systemctl restart nginx.service
```

**Rootful Quadlet files** live at `/etc/containers/systemd/`. Run `systemctl daemon-reload` after editing them. These auto-start on boot via `WantedBy=multi-user.target`.

## Claude Code Rules

- NEVER rewrite an entire file to change a few lines. Use Edit with specific old_string/new_string.
- Keep terminal-error explanations under two sentences.
- When running automated test-debug loops, halt and prompt the user after 3 failed attempts.
- The `supabase/.env` and `server/.env` are gitignored and contain live secrets — never print their contents.
- Frontend env vars are prefixed `VITE_` and embedded at build time. Server env vars are loaded via python-dotenv.
- All route handlers are `async def`. All DB calls use `await fetch()` / `await fetch_one()` / `await execute()`.
- Auth-protected endpoints use `user: dict = Depends(get_current_user)`. The user dict comes from `public.users`, not GoTrue directly.
- **For infrastructure/ops tasks:** Read `/home/chimse/cte/CLAUDE.md` on the production server (`ssh root@mainframe.cteftu.id.vn`) for container layout, Quadlet files, and operational procedures.
