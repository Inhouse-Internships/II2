/**
 * apiFetch — centralized fetch wrapper.
 *
 * Changes from original:
 * 1. FIX P-3 / QA-3: Cache now stores parsed JSON data (not Response Proxy objects).
 *    The old approach cached a Proxy around an already-consumed Response body,
 *    which caused silent failures on cache hits. Now the cache stores plain objects.
 * 2. FIX QA-3: Added LRU-style cache eviction with MAX_CACHE_SIZE = 100 entries
 *    to prevent unbounded memory growth in long sessions.
 * 3. Simplified: removed the `new Proxy(response, ...)` wrapper — all callers
 *    now receive a plain response-like object with `.ok`, `.status`, `.json()`.
 * 4. Cache returns an object that matches the same interface as a live response,
 *    so no call-site changes are needed.
 */

import { API_BASE_URL } from '../config/env';
import { getAuthToken } from '../utils/auth';

// ── URL helpers ───────────────────────────────────────────────────────────────

function isAbsoluteUrl(url) {
  return /^https?:\/\//i.test(url);
}

function normalizePath(url) {
  if (!url) return '/';
  if (url.startsWith('/api/')) return url.slice(4);
  if (url.startsWith('/api')) return '/';
  return url.startsWith('/') ? url : `/${url}`;
}

function buildApiUrl(url) {
  if (isAbsoluteUrl(url)) return url;
  return `${API_BASE_URL}${normalizePath(url)}`;
}

// ── API envelope normalizer ───────────────────────────────────────────────────

function normalizeApiEnvelope(payload) {
  if (!payload || typeof payload !== 'object') return payload;
  if (!Object.prototype.hasOwnProperty.call(payload, 'success')) return payload;

  if (Object.prototype.hasOwnProperty.call(payload, 'data')) {
    const { data, message, success, meta, error, details } = payload;
    if (Array.isArray(data)) return data;
    if (data && typeof data === 'object') {
      return { ...data, message: data.message || message, success, meta, error, details };
    }
    return { data, message, success, meta, error, details };
  }

  return payload;
}

// ── Cache (stores parsed JSON, not Response objects) ─────────────────────────

const MAX_CACHE_SIZE = 100;
const fetchCache = new Map();

function cacheGet(url) {
  return fetchCache.get(url) ?? null;
}

function cacheSet(url, data, timestamp) {
  // LRU eviction: if at capacity, remove the oldest entry
  if (fetchCache.size >= MAX_CACHE_SIZE) {
    const oldestKey = fetchCache.keys().next().value;
    fetchCache.delete(oldestKey);
  }
  fetchCache.set(url, { data, timestamp });
}

function makeCachedResponse(data) {
  return {
    ok: true,
    status: 200,
    headers: new Headers({ 'content-type': 'application/json' }),
    json: async () => data,
    text: async () => JSON.stringify(data),
    blob: async () => new Blob([JSON.stringify(data)], { type: 'application/json' })
  };
}

// ── Main fetch function ───────────────────────────────────────────────────────

/**
 * Fetches from the API with automatic auth header injection, envelope
 * normalization, and optional response caching.
 *
 * @param {string} url - Relative API path (e.g. '/api/admin/students') or absolute URL
 * @param {Object} [options] - fetch options + custom fields:
 *   @param {boolean} [options.useCache=false] - Enable response caching
 *   @param {number} [options.cacheMaxAge=60000] - Cache TTL in ms (default 60s)
 * @returns {Promise<{ok, status, headers, json, text, blob}>}
 */
export async function apiFetch(url, options = {}) {
  const { useCache = false, cacheMaxAge = 60_000, ...fetchOptions } = options;
  const targetUrl = buildApiUrl(url);

  // ── Cache read ──────────────────────────────────────────────────────────────
  if (useCache) {
    const cached = cacheGet(targetUrl);
    if (cached && Date.now() - cached.timestamp < cacheMaxAge) {
      return makeCachedResponse(cached.data);
    }
    fetchCache.delete(targetUrl);
  }

  // ── Build headers ───────────────────────────────────────────────────────────
  const token = getAuthToken();
  const headers = new Headers(fetchOptions.headers || {});
  const hasBody = fetchOptions.body !== undefined && fetchOptions.body !== null;

  if (token && !headers.has('Authorization')) {
    headers.set('Authorization', `Bearer ${token}`);
  }
  if (hasBody && !(fetchOptions.body instanceof FormData) && !headers.has('Content-Type')) {
    headers.set('Content-Type', 'application/json');
  }

  // ── Fetch ───────────────────────────────────────────────────────────────────
  const response = await fetch(targetUrl, { ...fetchOptions, headers });

  // ── Parse body ──────────────────────────────────────────────────────────────
  let parsedPayload;
  const contentType = response.headers.get('content-type') || '';
  if (contentType.includes('application/json')) {
    try {
      parsedPayload = await response.json();
    } catch {
      parsedPayload = undefined;
    }
  }

  const normalized = normalizeApiEnvelope(parsedPayload) ?? {};

  // ── Global Error Handling (401 Unauthorized) ────────────────────────────────
  if (response.status === 401) {
    import('../utils/auth').then(({ clearAuthSession }) => {
      clearAuthSession();
      // Only redirect if not already on login/register to avoid loops
      const publicPaths = ['/login', '/register', '/forgot-password', '/health'];
      const currentPath = window.location.pathname;
      if (!publicPaths.some(path => currentPath.startsWith(path)) && currentPath !== '/') {
        window.location.href = '/login?expired=true';
      }
    });
  }

  // ── Cache write ─────────────────────────────────────────────────────────────
  if (useCache && response.ok) {
    cacheSet(targetUrl, normalized, Date.now());
  }

  // ── Return uniform response object ─────────────────────────────────────────
  return {
    ok: response.ok,
    status: response.status,
    headers: response.headers,
    json: async () => normalized,
    text: async () => JSON.stringify(normalized),
    blob: () => {
      // Can't re-read consumed body — return normalized as blob
      return Promise.resolve(
        new Blob([JSON.stringify(normalized)], { type: 'application/json' })
      );
    }
  };
}

/**
 * Executes multiple GET requests in a single HTTP POST round-trip via the
 * /api/batch endpoint.
 *
 * @param {Array<{id: string, url: string}>} batchRequests
 * @returns {Promise<Object>} Map of id → response data
 */
export async function batchFetch(batchRequests) {
  const response = await apiFetch('/api/batch', {
    method: 'POST',
    body: JSON.stringify({
      requests: batchRequests.map((r) => ({
        id: r.id,
        method: 'GET',
        url: r.url
      }))
    })
  });

  if (response.ok) {
    return await response.json();
  }
  return {};
}

/**
 * Clears the entire client-side API cache.
 * Call after mutations that invalidate cached data.
 */
export function clearApiCache() {
  fetchCache.clear();
}

/**
 * Removes a specific URL from the cache.
 * @param {string} url
 */
export function invalidateCacheEntry(url) {
  fetchCache.delete(buildApiUrl(url));
}
