/**
 * Thin auth API wrapper — talks to the FastAPI backend which proxies GoTrue.
 * No @supabase/supabase-js needed; FastAPI is the single API surface.
 */

const API_BASE = import.meta.env.VITE_API_BASE ?? 'http://localhost:6942';

async function authRequest(method, path, body = null) {
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
    throw { status: res.status, message: err.detail || res.statusText };
  }
  return res.json();
}

export const auth = {
  signup: (email, password, fullName) =>
    authRequest('POST', '/auth/signup', { email, password, full_name: fullName }),

  login: (email, password) =>
    authRequest('POST', '/auth/login', { email, password }),

  googleLogin: (credential) =>
    authRequest('POST', '/auth/google', { credential }),

  me: async (token) => {
    try {
      const res = await fetch(`${API_BASE}/auth/me`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) return null;
      return res.json();
    } catch {
      return null;
    }
  },

  refresh: (refreshToken) =>
    authRequest('POST', '/auth/refresh', { refresh_token: refreshToken }),
};
