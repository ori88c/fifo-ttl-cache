"use strict";
/**
 * Copyright 2024 Ori Cohen https://github.com/ori88c
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.FIFOCache = void 0;
/**
 * FIFOCache
 *
 * The `FIFOCache` class provides a First-In-First-Out (FIFO) caching mechanism
 * with a fixed Time-To-Live (TTL), ensuring automatic removal of outdated entries.
 *
 * ## Eviction Policy
 * Cache entries are evicted under the following conditions:
 * - The cache reaches its maximum capacity:
 *   The oldest key (based on insertion time) is removed.
 * - A key's value becomes outdated (its TTL has expired).
 *
 * ## Event-Driven Eviction
 * The eviction policy of this class is event-driven, avoiding periodic callbacks for
 * removing outdated entries. Instead, outdated keys are removed under the following circumstances:
 * - During a `set` operation: If adding a new entry exhausts the maximum allowed capacity, the
 *   oldest key (based on insertion time) is evicted.
 * - During a `get` operation: Outdated keys are validated and removed to prevent returning stale
 *   cached values.
 *
 * ## Use Cases
 * Unlike the widely used LRU Cache, a FIFO Cache does not prioritize keeping popular
 * keys cached for extended durations. This simplicity reduces implementation overhead
 * and generally offers faster response times.
 * FIFO caches are particularly suitable when **freshness** (up-to-date values)
 * is critical, such as in security-sensitive scenarios, or when key popularity
 * is uniform and predictable.
 *
 * ## Relying on JavaScript's Map Guarantees
 * JavaScript's `Map` maintains the insertion order of keys, offering a reliable and
 * often overlooked guarantee for iteration. This guarantee is leveraged in `FIFOCache`
 * to eliminate the need for manually managing insertion order for eviction purposes.
 * For details, refer to the [MDN documentation](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Map):
 * "The Map object holds key-value pairs and remembers the original insertion order of the keys".
 */
class FIFOCache {
    /**
     * Constructor.
     *
     * @param _capacity The maximum number of key-value pairs allowed in the cache.
     * @param _ttlMs The maximum duration (in milliseconds) after which an inserted
     *               key is considered outdated and removed from the cache.
     */
    constructor(_capacity, _ttlMs) {
        this._capacity = _capacity;
        this._ttlMs = _ttlMs;
        this._cache = new Map();
        if (!isNaturalNumber(this._capacity)) {
            throw new Error(`Failed to instantiate FIFOCache: _capacity must ` +
                `be a natural number, but received ${this._capacity}`);
        }
        if (!isNaturalNumber(this._ttlMs)) {
            throw new Error(`Failed to instantiate FIFOCache: _ttlMs must ` +
                `be a natural number, but received ${this._ttlMs}`);
        }
    }
    /**
     * size
     *
     * @returns The number of items currently stored in this instance.
     */
    get size() {
        return this._cache.size;
    }
    /**
     * isEmpty
     *
     * @returns True if and only if the cache does not contain any entry.
     */
    get isEmpty() {
        return this._cache.size === 0;
    }
    /**
     * set
     *
     * Adds or updates a key-value pair in the cache.
     *
     * ## Potential Side Effects
     * - If the specified key already exists in the cache, its value will be updated
     *   with the provided value.
     * - If the cache is full and the given key does not already exist, the oldest
     *   key-value pair will be evicted to make room for the new entry.
     *
     * @param key The unique identifier for the cached entry.
     * @param value The value to associate with the specified key.
     */
    set(key, value) {
        const expirationTimestamp = Date.now() + this._ttlMs;
        this._cache.delete(key);
        this._cache.set(key, { value, expirationTimestamp });
        if (this._cache.size > this._capacity) {
            // The following guarantee is provided by the JavaScript standard and validated
            // through this component's unit tests:
            // "The Map object holds key-value pairs and remembers the original insertion order of the keys".
            const oldestKey = this._cache.keys().next().value;
            this._cache.delete(oldestKey);
        }
    }
    /**
     * get
     *
     * Retrieves the value associated with the specified key, provided the key
     * exists in the cache and its TTL has not expired.
     *
     * @param key The unique identifier for the cached entry.
     * @returns The value associated with the key if it exists and is valid;
     *          otherwise, `undefined`.
     *
     * @remarks
     * This method ensures that expired entries are treated as non-existent,
     * helping to maintain cache integrity by verifying both the presence and
     * validity of the entry before returning the result.
     */
    get(key) {
        return this._getExpiringEntry(key)?.value;
    }
    /**
     * has
     *
     * Determines whether the cache contains a valid, non-expired entry for the
     * specified key.
     *
     * ## Use Cases
     * This method is particularly useful when the cache is employed as a Set-like
     * structure, where the presence of a key is significant but the associated
     * value is secondary or unnecessary.
     *
     * ### Example
     * In an authentication system, this method can be used to determine whether
     * a user's session token is still active without needing to retrieve the
     * token's associated metadata or details.
     *
     * @param key - The unique identifier for the cached entry.
     * @returns `true` if the cache contains a non-expired entry for the key;
     *          otherwise, `false`.
     *
     * @remarks
     * This method ensures that expired entries are treated as non-existent,
     * helping to maintain cache integrity by verifying both the presence and
     * validity of the entry before returning the result.
     */
    has(key) {
        return !!this._getExpiringEntry(key);
    }
    /**
     * delete
     *
     * Removes the cached entry associated with the specified key, if such a entry
     * exists in the cache.
     *
     * ## Return Value Clarification
     * Due to the event-driven eviction mechanism (see class documentation for details),
     * the `delete` method may return `true` for an outdated key that remains in the cache.
     * This occurs because a key's expiration is validated only during `get`, `has` or `set`
     * operations, not when calling `delete`.
     *
     * @param key The unique identifier for the cached entry.
     * @returns `true` if the key existed in the cache (whether up-to-date or outdated);
     *          `false` otherwise.
     */
    delete(key) {
        return this._cache.delete(key);
    }
    /**
     * clear
     *
     * Removes all entries from the cache, leaving it empty.
     */
    clear() {
        this._cache.clear();
    }
    /**
     * Retrieves an expiring entry from the cache if it is still valid (not expired).
     * If the entry's TTL has expired, it deletes the entry from the cache and returns `undefined`.
     *
     * @param key - The unique identifier for the cached entry.
     * @returns The corresponding `ExpiringEntry<V>` if its TTL has not expired; otherwise, `undefined`.
     *
     * @remarks
     * This method ensures that expired entries are proactively removed from the cache
     * during access attempts, maintaining cache integrity and optimizing memory usage.
     */
    _getExpiringEntry(key) {
        const entry = this._cache.get(key);
        if (!entry) {
            return undefined;
        }
        const { expirationTimestamp } = entry;
        const isOutdated = Date.now() >= expirationTimestamp;
        if (isOutdated) {
            this._cache.delete(key);
            return undefined;
        }
        return entry;
    }
}
exports.FIFOCache = FIFOCache;
function isNaturalNumber(num) {
    const floored = Math.floor(num);
    return floored >= 1 && floored === num;
}
//# sourceMappingURL=fifo-ttl-cache.js.map