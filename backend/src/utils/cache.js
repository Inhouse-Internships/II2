/**
 * Lightweight in-memory TTL cache.
 * Use for short-lived server-side caching (e.g., analytics, settings reads).
 *
 * NOT suitable for multi-instance deployments — use Redis in that case.
 * For this project's single-server deployment this is perfectly adequate.
 */

const cacheStore = new Map();

/**
 * Retrieves a cached value. Returns null if missing or expired.
 * @param {string} key
 * @returns {*} The cached value, or null
 */
function cacheGet(key) {
  const entry = cacheStore.get(key);
  if (!entry) return null;
  if (Date.now() > entry.expiresAt) {
    cacheStore.delete(key);
    return null;
  }
  return entry.value;
}

/**
 * Stores a value in the cache with a TTL.
 * @param {string} key
 * @param {*} value
 * @param {number} ttlMs - Time-to-live in milliseconds (default: 2 minutes)
 */
function cacheSet(key, value, ttlMs = 2 * 60 * 1000) {
  cacheStore.set(key, { value, expiresAt: Date.now() + ttlMs });
}

/**
 * Deletes a specific cache entry.
 * @param {string} key
 */
function cacheDelete(key) {
  cacheStore.delete(key);
}

/**
 * Deletes all cache entries whose keys start with the given prefix.
 * Useful for invalidating a group of related entries (e.g., 'analytics:').
 * @param {string} prefix
 */
function cacheDeleteByPrefix(prefix) {
  for (const key of cacheStore.keys()) {
    if (key.startsWith(prefix)) {
      cacheStore.delete(key);
    }
  }
}

/**
 * Clears the entire cache.
 */
function cacheClear() {
  cacheStore.clear();
}

// Periodic cleanup of expired entries every 5 minutes to prevent memory accumulation
setInterval(() => {
  const now = Date.now();
  for (const [key, entry] of cacheStore.entries()) {
    if (now > entry.expiresAt) {
      cacheStore.delete(key);
    }
  }
}, 5 * 60 * 1000).unref();

module.exports = { cacheGet, cacheSet, cacheDelete, cacheDeleteByPrefix, cacheClear };
