# DSTC Matching — Migration Plan

## Agent Identity
This is an AI agent (Cline) performing a migration from proprietary base44 infrastructure to a local SQLite-backed FastAPI server.

## Architecture Overview

```
┌─────────────────────┐     HTTP (fetch)     ┌──────────────────────┐
│  Vite React Frontend │ ◄──────────────────► │  FastAPI Server      │
│  (port 5173)         │                      │  (localhost:6942)    │
│                      │                      │                      │
│  src/api/base44Client│                      │  SQLite database     │
│  → calls local API   │                      │  (server/data.db)    │
└─────────────────────┘                      └──────────────────────┘
```

## What Has Been Done (Completed ✓)

### Backend (server/)
- [x] `server/main.py` — FastAPI app with CORS, static file mount, router registration
- [x] `server/database.py` — SQLite init with 7 tables (users, contestant_profiles, matches, messages, swipe_actions, teams, team_invites), JSON serialization helpers
- [x] `server/routes/auth.py` — GET /auth/me, POST /auth/login, POST /auth/logout, GET /auth/login-url
- [x] `server/routes/profiles.py` — Full CRUD for contestant profiles with filter support
- [x] `server/routes/matches.py` — Full CRUD for matches with filter support
- [x] `server/routes/messages.py` — Full CRUD + POST /api/messages/bulk-update
- [x] `server/routes/swipes.py` — Full CRUD for swipe actions
- [x] `server/routes/teams.py` — Full CRUD for teams
- [x] `server/routes/invites.py` — Full CRUD for team invites
- [x] `server/routes/integrations.py` — POST /api/upload (file upload), POST /api/send-email (stub → logs to console)
- [x] `server/requirements.txt` — fastapi, uvicorn, python-multipart
- [x] Python venv created via `uv venv`, deps installed via `uv add`

### Frontend — Core Changes
- [x] `src/api/base44Client.js` — Rewritten: fetch-based client calling localhost:6942, matching base44's API surface (db.auth.*, db.entities.X.*, db.integrations.Core.*)
- [x] `vite.config.js` — Removed @base44/vite-plugin, added proxy for /api, /auth, /uploads → localhost:6942
- [x] `package.json` — Removed @base44/sdk and @base44/vite-plugin dependencies
- [x] `bun install` — Ran successfully, lockfile updated

## What Remains To Do (Pending ❌)

### 1. Replace inline `globalThis.__B44_DB__` fallbacks in all 22 files
- [x] `src/components/dashboard/TopSuggestions.jsx`
- [x] `src/components/layout/AppLayout.jsx`
- [x] `src/components/layout/NotificationBell.jsx`
- [x] `src/components/layout/Sidebar.jsx`
- [x] `src/components/messages/TeamConfirmBar.jsx`
- [x] `src/components/profile/InlineProfileEditor.jsx`
- [x] `src/components/profile/ProfileForm.jsx`
- [x] `src/hooks/useRealtimeNotifications.js`
- [x] `src/lib/AuthContext.jsx`
- [x] `src/lib/PageNotFound.jsx`
- [x] `src/pages/AdminMatches.jsx`
- [x] `src/pages/Dashboard.jsx`
- [x] `src/pages/Discover.jsx`
- [x] `src/pages/Guide.jsx`
- [x] `src/pages/Home.jsx`
- [x] `src/pages/Landing.jsx`
- [x] `src/pages/Matches.jsx`
- [x] `src/pages/Messages.jsx`
- [x] `src/pages/Profile.jsx`
- [x] `src/pages/ProfileDetail.jsx`
- [x] `src/pages/Settings.jsx`
- [x] `src/pages/TeamPage.jsx`

### 2. Update `src/lib/AuthContext.jsx`
- [x] Remove the `const db = globalThis.__B44_DB__ || ...` line (replace with import)
- [x] Remove the `createAxiosClient` / app public settings logic (base44-specific)
- [x] Simplify to use `db.auth.me()` and `db.auth.login()` from the local client
- [x] The `checkAppState` function needs to be rewritten to not depend on base44's `/api/apps/public` endpoint

### 3. Update `src/lib/app-params.js`
- [x] Remove base44-specific URL param handling (app_id, access_token, functions_version, app_base_url)
- [x] Simplify to just return local config or empty object

### 4. Update `src/hooks/useRealtimeNotifications.js`
- [x] The `subscribe()` calls are stubbed in the client (returns no-op)
- [x] The email sending is already stubbed via `db.integrations.Core.SendEmail` → logs to console
- [x] Just needs the import fix from step 1

### 5. Create `CHANGES.md`
- [x] Document all changes in an agent-friendly format
- [x] Structured as "what changed, where, why" so another AI can replicate on base44 platform

### 6. Test the app runs locally
- Start backend: `.venv/bin/uvicorn server.main:app --port 6942`
- Start frontend: `bun run dev`
- Verify pages load and API calls work

## Database Schema (7 tables)
Defined in `SCHEMA.md` and implemented in `server/database.py`:
- **users**: id, email, role, full_name, created_date, updated_date
- **contestant_profiles**: id, created_by, display_name, username, bio, birth_year, gender, city, school, major, profile_image, technical_skills (JSON array), soft_skills (JSON array), experience, goals (JSON array), role, achievements, achievements_other, has_team, team_id, profile_complete
- **matches**: id, user1_id, user2_id, status, user1_confirmed, user2_confirmed
- **messages**: id, match_id, sender_id, receiver_id, content, is_read
- **swipe_actions**: id, swiper_id, swiped_id, action, is_match
- **teams**: id, name, leader_id, member_ids (JSON array), max_members, status
- **team_invites**: id, team_id, inviter_id, invitee_id, status

## Stubs (base44 features not migrated)
- **Email sending** → logs to server console, returns success
- **File upload** → saves to `server/uploads/`, returns local URL
- **Real-time subscriptions** → no-op (returns empty unsubscribe function)
- **Auth** → simplified: first user in DB is "current user", login creates user if not exists
- **App public settings** → removed (was base44-specific)