/**
 * Local API client — replaces the proprietary base44 SDK.
 * All calls go to the FastAPI backend on localhost:6942.
 * Falls back to stubs if the server is unreachable.
 */

const API_BASE = 'http://localhost:6942';

async function request(method, path, body = null) {
  const opts = {
    method,
    headers: { 'Content-Type': 'application/json' },
  };
  if (body !== null) {
    opts.body = JSON.stringify(body);
  }
  const res = await fetch(`${API_BASE}${path}`, opts);
  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: res.statusText }));
    throw { status: res.status, message: err.detail || res.statusText, data: err };
  }
  return res.json();
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

// ── Entity helper factory ──────────────────────────────────────────────
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
      // bulkUpdate expects [{ id, ...fields }]
      // We'll handle this by updating one by one for now
      const results = [];
      for (const item of updates) {
        const { id, ...fields } = item;
        results.push(await request('PATCH', `${basePath}/${id}`, fields));
      }
      return results;
    },
    subscribe: () => {
      // Stub — real-time not supported in local mode
      console.log('[base44Client] subscribe() is stubbed (no real-time in local mode)');
      return () => {};
    },
  };
}

// ── Auth client ────────────────────────────────────────────────────────
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
  logout: async (redirectUrl) => {
    try {
      await request('POST', '/auth/logout');
    } catch { /* ignore */ }
    localStorage.removeItem('currentUser');
    if (redirectUrl) {
      window.location.href = '/';
    }
  },
  redirectToLogin: (redirectUrl) => {
    window.location.href = '/login';
  },
  login: async (email, fullName = '') => {
    const user = await request('POST', '/auth/login', { email, full_name: fullName });
    localStorage.setItem('currentUser', JSON.stringify(user));
    return user;
  },
};

// ── Integrations (stubs) ───────────────────────────────────────────────
const integrationsClient = {
  Core: {
    UploadFile: async ({ file }) => {
      const formData = new FormData();
      formData.append('file', file);
      const res = await fetch(`${API_BASE}/api/upload`, { method: 'POST', body: formData });
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

// ── Exported db object matching base44's API surface ───────────────────
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

// Also export as base44 for compatibility
export const base44 = db;
export default db;