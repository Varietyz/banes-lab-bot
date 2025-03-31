// cache.js
/**
 * Centralized cache module using node-cache.
 * Provides a simple API for caching: get, set, del, clear, and update.
 * This abstracts the underlying node-cache library so that all parts of your bot
 * use a consistent caching mechanism.
 */

const NodeCache = require('node-cache');

// Create a cache instance with a default TTL (in seconds) and a check period
const cache = new NodeCache({ stdTTL: 3600, checkperiod: 120 });

/**
 * Retrieve a value from the cache.
 * @param {string} key - The key to retrieve.
 * @returns {any} The cached value, or undefined if the key does not exist.
 */
function get(key) {
  return cache.get(key);
}

/**
 * Store a value in the cache.
 * @param {string} key - The key under which the value will be stored.
 * @param {any} value - The value to cache.
 * @param {number} [ttl] - Optional TTL (in seconds) for this cache entry.
 */
function set(key, value, ttl) {
  cache.set(key, value, ttl);
}

/**
 * Delete a value from the cache.
 * @param {string} key - The key to delete.
 */
function del(key) {
  cache.del(key);
}

/**
 * Clear all entries from the cache.
 */
function clear() {
  cache.flushAll();
}

/**
 * Update the cached value by applying a synchronous updater function.
 * The updater receives the current value and returns the new value.
 * @param {string} key - The key to update.
 * @param {Function} updater - A synchronous function that returns a new value.
 * @param {number} [ttl] - Optional TTL (in seconds) for the key.
 * @returns {any} The new value.
 */
function update(key, updater, ttl) {
  const currentValue = cache.get(key);
  const newValue = updater(currentValue);
  cache.set(key, newValue, ttl);
  return newValue;
}

module.exports = {
  get,
  set,
  del,
  clear,
  update
};
