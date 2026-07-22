/**
 * API client for the DSTC Matching backend.
 * All calls go to the FastAPI server.
 * Uses Bearer token auth (stored in localStorage).
 */

const API_BASE = import.meta.env.VITE_API_BASE ?? '';

// ── Token management ────────────────────────────────────────────────
let accessToken = localStorage.getItem('access_token') || null;
let refreshToken = localStorage.getItem('refresh_token') || null;

function setTokens(access, refresh) {
  accessToken = access;
  refreshToken = refresh;
  if (access) {
    localStorage.setItem('access_token', access);
  } else {
    localStorage.removeItem('access_token');
  }
  if (refresh) {
    localStorage.setItem('refresh_token', refresh);
  } else {
    localStorage.removeItem('refresh_token');
  }
}

function clearTokens() {
  accessToken = null;
  refreshToken = null;
  localStorage.removeItem('access_token');
  localStorage.removeItem('refresh_token');
}

// ── Capture tokens from URL hash (GoTrue redirect flow) ───────────
// GoTrue's GET /verify redirects to redirect_to with tokens in the hash:
//   http://localhost:5173/#access_token=...&refresh_token=...
// This runs at module load, before React mounts, so AuthContext finds
// the tokens in localStorage on its first check.
(() => {
  const hash = window.location.hash;
  if (!hash) return;

  const params = new URLSearchParams(hash.substring(1));

  // Success case: tokens in hash from GoTrue redirect
  if (params.has('access_token')) {
    const at = params.get('access_token');
    const rt = params.get('refresh_token');
    if (at && rt) {
      setTokens(at, rt);
      window.history.replaceState(null, '', window.location.pathname + window.location.search);
    }
    return;
  }

  // Error case: GoTrue redirect with error (e.g. expired token)
  if (params.has('error')) {
    const errorDescription = params.get('error_description') || 'Đã xảy ra lỗi';
    // Clear the hash and redirect to login with the error message
    window.history.replaceState(null, '', window.location.pathname);
    window.location.href = `/login?error=${encodeURIComponent(errorDescription)}`;
  }
})();

function getAccessToken() {
  return accessToken;
}

// Callback for global 401 handling (set by AuthContext)
let onAuthFailure = null;
export function setAuthFailureCallback(fn) {
  onAuthFailure = fn;
}

// ── Request helper ──────────────────────────────────────────────────
async function request(method, path, body = null) {
  const headers = { 'Content-Type': 'application/json' };
  if (accessToken) {
    headers['Authorization'] = `Bearer ${accessToken}`;
  }

  const opts = { method, headers };
  if (body !== null) {
    opts.body = JSON.stringify(body);
  }

  const res = await fetch(`${API_BASE}${path}`, opts);

  // If 401 and we have a refresh token, try to refresh
  if (res.status === 401 && refreshToken) {
    const refreshed = await tryRefresh();
    if (refreshed) {
      // Retry the original request with new token
      headers['Authorization'] = `Bearer ${accessToken}`;
      const retryRes = await fetch(`${API_BASE}${path}`, { method, headers, body: opts.body });
      if (!retryRes.ok) {
        const err = await retryRes.json().catch(() => ({ detail: retryRes.statusText }));
        throw { status: retryRes.status, message: err.detail || retryRes.statusText, data: err };
      }
      return retryRes.json();
    }
    // Refresh failed — clear tokens and notify
    clearTokens();
    if (onAuthFailure) onAuthFailure();
  }

  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: res.statusText }));
    throw { status: res.status, message: err.detail || res.statusText, data: err };
  }
  return res.json();
}

async function tryRefresh() {
  try {
    const res = await fetch(`${API_BASE}/auth/refresh`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ refresh_token: refreshToken }),
    });
    if (!res.ok) return false;
    const data = await res.json();
    setTokens(data.access_token, data.refresh_token);
    return true;
  } catch {
    return false;
  }
}

function buildFilterUrl(basePath, filters, sortField) {
  const params = new URLSearchParams();
  if (filters) {
    for (const [key, value] of Object.entries(filters)) {
      if (value !== undefined && value !== null && value !== '') {
        params.set(key, String(value));
      }
    }
  }
  const qs = params.toString();
  return qs ? `${basePath}?${qs}` : basePath;
}

// ── Entity helper factory ──────────────────────────────────────────
function createEntityClient(entityName, basePath) {
  return {
    list: async (sortField) => {
      const path = sortField ? `${basePath}?sort=${sortField}` : basePath;
      return request('GET', path);
    },
    filter: async (filters, sortField) => {
      const path = buildFilterUrl(basePath, filters, sortField);
      return request('GET', path);
    },
    get: async (id) => request('GET', `${basePath}/${id}`),
    create: async (data) => request('POST', basePath, data),
    update: async (id, data) => request('PATCH', `${basePath}/${id}`, data),
    delete: async (id) => request('DELETE', `${basePath}/${id}`),
    updateMany: async (ids, updates) => request('POST', `${basePath}/bulk-update`, { ids, updates }),
    bulkUpdate: async (updates) => {
      const results = [];
      for (const item of updates) {
        const { id, ...fields } = item;
        results.push(await request('PATCH', `${basePath}/${id}`, fields));
      }
      return results;
    },
    subscribe: () => {
      // Real-time subscriptions not yet implemented
      return () => { };
    },
  };
}

// ── Auth client ────────────────────────────────────────────────────
const authClient = {
  me: async () => {
    try {
      return await request('GET', '/auth/me');
    } catch {
      return null;
    }
  },
  isAuthenticated: async () => {
    const user = await authClient.me();
    return user !== null;
  },
  login: async (emailOrUsername, password) => {
    const data = await request('POST', '/auth/login', { email_or_username: emailOrUsername, password });
    setTokens(data.access_token, data.refresh_token);
    return data.user;
  },
  signup: async (email, password, username) => {
    const data = await request('POST', '/auth/signup', { email, password, username });
    if (data.requires_email_confirmation) {
      return { requires_email_confirmation: true, user: data.user };
    }
    setTokens(data.access_token, data.refresh_token);
    return data.user;
  },
  verify: async (type, token, email) => {
    const data = await request('POST', '/auth/verify', { type, token, email });
    setTokens(data.access_token, data.refresh_token);
    return data.user;
  },
  googleLogin: async (credential) => {
    const data = await request('POST', '/auth/google', { credential });
    setTokens(data.access_token, data.refresh_token);
    return data.user;
  },
  logout: async (redirectUrl) => {
    try {
      await request('POST', '/auth/logout');
    } catch { /* ignore */ }
    clearTokens();
    if (redirectUrl) {
      window.location.href = '/';
    }
  },
  redirectToLogin: () => {
    window.location.href = '/login';
  },
};

// ── Integrations (stubs) ───────────────────────────────────────────
const integrationsClient = {
  Core: {
    UploadFile: async ({ file }) => {
      const formData = new FormData();
      formData.append('file', file);
      const headers = {};
      if (accessToken) {
        headers['Authorization'] = `Bearer ${accessToken}`;
      }
      const res = await fetch(`${API_BASE}/api/upload`, { method: 'POST', headers, body: formData });
      if (!res.ok) return { file_url: '' };
      return res.json();
    },
    SendEmail: async ({ from_name, to, subject, body }) => {
      try {
        return await request('POST', '/api/send-email', { from_name, to, subject, body });
      } catch {
        return { success: false };
      }
    },
  },
};

// ── Exported db object ─────────────────────────────────────────────
export const db = {
  auth: authClient,
  entities: {
    User: createEntityClient('User', '/api/contestant-profiles'),
    ContestantProfile: createEntityClient('ContestantProfile', '/api/contestant-profiles'),
    Match: createEntityClient('Match', '/api/matches'),
    Message: createEntityClient('Message', '/api/messages'),
    SwipeAction: createEntityClient('SwipeAction', '/api/swipe-actions'),
    Team: createEntityClient('Team', '/api/teams'),
    TeamInvite: createEntityClient('TeamInvite', '/api/team-invites'),
  },
  integrations: integrationsClient,
};

export default db;
