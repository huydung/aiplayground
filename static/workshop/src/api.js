// Thin fetch wrapper + JWT storage for /api/workshop.
const TOKEN_KEY = 'workshop_token';
const USER_KEY = 'workshop_user';

export function getToken() { return localStorage.getItem(TOKEN_KEY); }
export function getUser() { return localStorage.getItem(USER_KEY); }
export function setAuth(token, user) {
  localStorage.setItem(TOKEN_KEY, token);
  localStorage.setItem(USER_KEY, user);
}
export function clearAuth() {
  localStorage.removeItem(TOKEN_KEY);
  localStorage.removeItem(USER_KEY);
}

export function userId() {
  const t = getToken();
  if (!t) return '0';
  try { return String(JSON.parse(atob(t.split('.')[1])).id); } catch { return '0'; }
}

// Returns parsed JSON. Throws Error with .status and .body on non-2xx (except callers that
// opt into rawStatus, e.g. the 409-aware blob PUT, which reads res directly instead).
export async function api(method, path, body, opts = {}) {
  const headers = {};
  const token = getToken();
  if (token) headers.Authorization = `Bearer ${token}`;
  const init = { method, headers };
  if (opts.keepalive) init.keepalive = true;
  if (body !== undefined) {
    headers['Content-Type'] = 'application/json';
    init.body = JSON.stringify(body);
  }
  const res = await fetch(`/api/workshop${path}`, init);
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    const err = new Error(data.error || res.statusText || 'Request failed');
    err.status = res.status;
    err.body = data;
    throw err;
  }
  return data;
}
