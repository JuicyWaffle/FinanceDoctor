/**
 * cache.js
 * Simple in-memory TTL cache.
 * Avoids redundant API calls for the same company/person within a session.
 * In production, swap this for Redis.
 */

const TTL_MS = parseInt(process.env.CACHE_TTL_SECONDS || "3600") * 1000;

const store = new Map();

function set(key, value) {
  store.set(key, { value, expiresAt: Date.now() + TTL_MS });
}

function get(key) {
  const entry = store.get(key);
  if (!entry) return null;
  if (Date.now() > entry.expiresAt) {
    store.delete(key);
    return null;
  }
  return entry.value;
}

function del(key) {
  store.delete(key);
}

function clear() {
  store.clear();
}

function stats() {
  return { size: store.size, ttlSeconds: TTL_MS / 1000 };
}

/**
 * Wrap an async function with caching.
 * Usage: const data = await cached("key", () => expensiveFetch());
 */
async function cached(key, fn) {
  const hit = get(key);
  if (hit !== null) {
    return hit;
  }
  const result = await fn();
  set(key, result);
  return result;
}

module.exports = { set, get, del, clear, stats, cached };
