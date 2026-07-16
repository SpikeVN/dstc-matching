# COMPAT-CHANGES.md

> Compatibility changes for base44 → local migration. Each change is reversible.
> Baseline commit: `33965b5 initial state`.

## Convention

Each change `C-XXX` has: File(s), Type, What changed, Why, Before (base44), After (local).

---

## C-001 — Remove base44 deps from package.json

**File:** `package.json` | **Type:** modified
**Why:** Proprietary base44 packages replaced by local client.

**Before:** Two deps in `dependencies`:
- `"@base44/sdk": "^0.8.39"`
- `"@base44/vite-plugin": "^1.0.30"`

**After:** Both lines removed.

---

## C-002 — Replace vite.config.js

**File:** `vite.config.js` | **Type:** full rewrite
**Why:** Removed base44 plugin (SDK injection, HMR, visual-edit, analytics). Added `@/` path alias and dev proxy to `localhost:6942`.

**Before (base44):**
```js
import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'
import base44 from "@base44/vite-plugin";
export default defineConfig({
  logLevel: 'error',
  plugins: [
    base44({ legacySDKImports: process.env.BASE44_LEGACY_SDK_IMPORTS === 'true', hmrNotifier: true, navigationNotifier: true, analyticsTracker: true, visualEditAgent: true }),
    react(),
  ]
});
```

**After (local):**
```js
import path from 'path'
import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'
export default defineConfig({
  logLevel: 'error',
  plugins: [react()],
  resolve: { alias: { "@": path.resolve(process.cwd(), "./src") } },
  server: {
    proxy: {
      '/api': { target: 'http://localhost:6942', changeOrigin: true },
      '/auth': { target: 'http://localhost:6942', changeOrigin: true },
      '/uploads': { target: 'http://localhost:6942', changeOrigin: true },
    },
  },
})
```

---

## C-003 — Replace favicon in index.html

**File:** `index.html` | **Type:** modified

**Before:** `<link rel="icon" type="image/svg+xml" href="https://db.com/logo_v2.svg" />`
**After:** `<link rel="icon" type="image/avif" href="/favicon.avif" />`

---

## C-004 — Rewrite src/api/base44Client.js

**File:** `src/api/base44Client.js` | **Type:** full rewrite
**Why:** Replaces proprietary base44 SDK with fetch-based client at `localhost:6942`.

**Before (base44):** Single-line stub:
```js
export const db = { auth: { isAuthenticated: async ()=>false, me: async ()=>null }, entities: new Proxy({}, { get:()=>({ filter:async()=>[], get:async()=>null, create:async()=>({}), update:async()=>({}), delete:async()=>({}) }) }), integrations:{ Core:{ UploadFile:async()=>({ file_url:'' }) } } }; export const base44=db; export default db;
```

**After (local):** 141-line fetch-based client with:
- `const API_BASE = 'http://localhost:6942'`
- `request(method, path, body)` — generic fetch wrapper
- `createEntityClient(entityName, basePath)` — returns `{list, filter, get, create, update, delete, updateMany, bulkUpdate, subscribe}`
- `authClient` — `{me, isAuthenticated, logout, redirectToLogin, login}`
- `integrationsClient.Core` — `{UploadFile, SendEmail}`
- `export const db = { auth, entities: {User, ContestantProfile, Match, Message, SwipeAction, Team, TeamInvite}, integrations }`

See `git diff src/api/base44Client.js` for full content.

---

## C-005 — Remove globalThis.__B44_DB__ stub → import (22 files)

**Files (all 22):**
- `src/components/dashboard/TopSuggestions.jsx`
- `src/components/layout/AppLayout.jsx`
- `src/components/layout/NotificationBell.jsx`
- `src/components/layout/Sidebar.jsx`
- `src/components/messages/TeamConfirmBar.jsx`
- `src/components/profile/InlineProfileEditor.jsx`
- `src/components/profile/ProfileForm.jsx`
- `src/hooks/useRealtimeNotifications.js`
- `src/lib/AuthContext.jsx`
- `src/lib/PageNotFound.jsx`
- `src/pages/AdminMatches.jsx`
- `src/pages/Dashboard.jsx`
- `src/pages/Discover.jsx`
- `src/pages/Guide.jsx`
- `src/pages/Home.jsx`
- `src/pages/Landing.jsx`
- `src/pages/Matches.jsx`
- `src/pages/Messages.jsx`
- `src/pages/Profile.jsx`
- `src/pages/ProfileDetail.jsx`
- `src/pages/Settings.jsx`
- `src/pages/TeamPage.jsx`

**Type:** modified (line 1 of each file)

**Before (base44) line 1:**
```js
const db = globalThis.__B44_DB__ || { auth:{ isAuthenticated: async()=>false, me: async()=>null }, entities:new Proxy({}, { get:()=>({ filter:async()=>[], get:async()=>null, create:async()=>({}), update:async()=>({}), delete:async()=>({}) }) }), integrations:{ Core:{ UploadFile:async()=>({ file_url:'' }) } } };
```

**After (local) line 1:**
```js
import { db } from '@/api/base44Client';
```

---

## C-006 — Simplify src/lib/app-params.js

**File:** `src/lib/app-params.js` | **Type:** full rewrite
**Why:** Removed base44 URL param parsing (`app_id`, `access_token`, `functions_version`, `app_base_url`, `clear_access_token`) and localStorage logic.

**Before (base44):** 53 lines with `getAppParamValue`, `toSnakeCase`, `getAppParams` functions parsing URL params and localStorage. See `git diff src/lib/app-params.js` for full content.

**After (local):**
```js
export const appParams = {
  appId: 'local-app',
  token: null,
  fromUrl: typeof window !== 'undefined' ? window.location.href : '',
  functionsVersion: '1.0.0',
  appBaseUrl: typeof window !== 'undefined' ? window.location.origin : 'http://localhost:6942',
}
```

---

## C-007 — Simplify src/lib/AuthContext.jsx

**File:** `src/lib/AuthContext.jsx` | **Type:** modified

**Changes:**
1. Line 1: `globalThis.__B44_DB__` stub → `import { db } from '@/api/base44Client'`
2. Removed: `import { appParams } from '@/lib/app-params'`
3. `isLoadingPublicSettings` initial state: `true` → `false` (stub)
4. `checkAppState` rewritten: removed `createAxiosClient` call to `/api/apps/public/prod/public-settings/by-id/{appId}` and `auth_required`/`user_not_registered` error handling. Now calls `db.auth.me()` directly.
5. `checkUserAuth`/`logout`: moved `setIsLoadingAuth(false)` to `finally` blocks.

**Why:** `/api/apps/public` endpoint does not exist locally. See `git diff src/lib/AuthContext.jsx` for full diff.

---

## C-008 — Replace remote image URLs with local AVIF assets

**Files:** 6 files, 23 references total
- `src/index.css` — background image
- `src/components/layout/Sidebar.jsx` — BND logo, FTU, Đoàn, CTE
- `src/pages/Landing.jsx` — FTU_LOGO, DOAN_LOGO, CTE_LOGO constants
- `src/pages/Home.jsx` — BND logo, FTU, Đoàn, CTE
- `src/pages/Guide.jsx` — FTU, Đoàn, CTE
- `src/pages/Settings.jsx` — CTE header, FTU/Đoàn/CTE × 2 footer sections

**URL mapping:**

| Original URL | Local path |
|---|---|
| `https://media.db.com/.../c074269d7_BND.png` | `/bnd-dstc.avif` |
| `https://media.db.com/.../940f88692_image.png` | `/ftu-logo.avif` |
| `https://media.db.com/.../18e8e0554_logodoan.jpg` | `/doan-logo.avif` |
| `https://media.db.com/.../0c4f9215b_LogoBlack.png` | `/cte-logo.avif` |
| `https://media.db.com/.../459fede46_background.png` | `/background.avif` |

(All share prefix `https://media.db.com/images/public/69fca508d8f252b1d9db32a3/`)

**Why:** `media.db.com` is base44 internal CDN (not publicly resolvable).

---

## C-009 — Remove injected stub from src/index.css

**File:** `src/index.css` | **Type:** modified

**Before (base44):**
```css
const db = globalThis.__B44_DB__ || { ... };

@import url('https://fonts.googleapis.com/...');
```

**After (local):** Stub line and blank line removed. File starts with `@import`.

---

## New files (local-only, not in baseline)

| File | Purpose |
|---|---|
| `server/main.py` | FastAPI app entry point |
| `server/database.py` | SQLite schema + helpers |
| `server/requirements.txt` | Python deps |
| `server/routes/__init__.py` | Empty init |
| `server/routes/auth.py` | Auth endpoints |
| `server/routes/profiles.py` | Profile CRUD |
| `server/routes/matches.py` | Matches CRUD |
| `server/routes/messages.py` | Messages CRUD |
| `server/routes/swipes.py` | Swipe actions CRUD |
| `server/routes/teams.py` | Teams CRUD |
| `server/routes/invites.py` | Team invites CRUD |
| `server/routes/integrations.py` | File upload + email stubs |
| `server/data.db` | SQLite database |
| `public/favicon.avif` | Favicon (32×32 BND logo) |
| `public/favicon.svg` | Favicon fallback |
| `public/bnd-dstc.avif` | DSTC logo (176 KB) |
| `public/ftu-logo.avif` | FTU logo (17 KB) |
| `public/doan-logo.avif` | Đoàn logo (47 KB) |
| `public/cte-logo.avif` | CTE FTU logo (1.3 KB) |
| `public/background.avif` | Page background (70 KB) |
| `PLAN.md` | Migration plan |
| `SCHEMA.md` | Database schema docs |
| `COMPAT-CHANGES.md` | This file |
| `pyproject.toml` | Python project config |
| `.python-version` | Python version pin |
| `uv.lock` | Python lockfile |
| `scraped.html` | Scraped site copy (reference) |
| `scraped_files/` | Scraped assets (reference) |

---

## Summary

| # | File(s) | Change | Reversible? |
|---|---|---|---|
| C-001 | `package.json` | Remove 2 deps | ✅ Add lines back |
| C-002 | `vite.config.js` | Full rewrite | ✅ Replace file |
| C-003 | `index.html` | Favicon URL | ✅ Replace href |
| C-004 | `src/api/base44Client.js` | Full rewrite | ✅ Replace file |
| C-005 | 22 `.jsx`/`.js` files | Line 1 stub → import | ✅ Replace line 1 |
| C-006 | `src/lib/app-params.js` | Full rewrite | ✅ Replace file |
| C-007 | `src/lib/AuthContext.jsx` | Auth simplification | ✅ Replace file |
| C-008 | 6 files (23 refs) | Image URLs → local | ✅ Find-replace URLs |
| C-009 | `src/index.css` | Remove injected stub | ✅ Prepend line |

**Total: 9 change groups across 30 files. All fully reversible.**
