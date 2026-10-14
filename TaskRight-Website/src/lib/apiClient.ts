// Shared web API client for authenticated business data — mirrors
// TaskRight/src/api/client.js (the RN app's client). Calls go through the
// Next.js BFF proxy at /api/businesses/*, which attaches the session's JWT
// server-side; the browser never handles the token or talks to the backend
// directly. See WEB_PORTAL.md §2.

export type ApiError = Error & { code?: string; status?: number; details?: unknown };

async function request(path: string, options: RequestInit = {}) {
  const res = await fetch(`/api/businesses${path}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...options.headers,
    },
  });

  const data = await res.json().catch(() => ({}));

  if (!res.ok) {
    const error: ApiError = new Error(data.error || 'Request failed');
    error.code = data.code;
    error.status = res.status;
    error.details = data;
    throw error;
  }

  return data;
}

export const get = (path: string) => request(path);
export const post = (path: string, body?: unknown) =>
  request(path, { method: 'POST', body: JSON.stringify(body) });
export const put = (path: string, body?: unknown) =>
  request(path, { method: 'PUT', body: JSON.stringify(body) });
export const patch = (path: string, body?: unknown) =>
  request(path, { method: 'PATCH', body: JSON.stringify(body) });
export const del = (path: string) => request(path, { method: 'DELETE' });
