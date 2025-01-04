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

interface ValueHolder<V> {
  value: V;
  expirationTimestamp: number;
}

/**
 * FIFOCache
 * 
 * The `FIFOCache` class provides a First-In-First-Out (FIFO) caching mechanism 
 * with a fixed Time-To-Live (TTL), ensuring automatic removal of outdated records.
 * 
 * ## Eviction Policy
 * Cache records are evicted under the following conditions:
 * - The cache reaches its maximum capacity:
 *   The oldest key (based on insertion time) is removed.
 * - A key's value becomes outdated (its TTL has expired).
 *
 * ## Event-Driven Eviction 
 * The eviction policy of this class is event-driven, avoiding periodic callbacks for
 * removing outdated records. Instead, outdated keys are removed under the following circumstances:
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
export class FIFOCache<K,V> {
  private readonly _cache = new Map<K,ValueHolder<V>>();

  /**
   * Constructor.
   * 
   * @param _capacity The maximum number of key-value pairs allowed in the cache.
   * @param _ttlMs The maximum duration (in milliseconds) after which an inserted
   *               key is considered outdated and removed from the cache.
   */
  constructor(
    private readonly _capacity: number,
    private readonly _ttlMs: number
  ) {
    if (!isNaturalNumber(this._capacity)) {
      throw new Error(
        `Failed to instantiate FIFOCache: _capacity must ` +
        `be a natural number, but received ${this._capacity}`
      );
    }

    if (!isNaturalNumber(this._ttlMs)) {
      throw new Error(
        `Failed to instantiate FIFOCache: _ttlMs must ` +
        `be a natural number, but received ${this._ttlMs}`
      );
    }
  }

  /**
   * size
   * 
   * @returns The number of items currently stored in this instance.
   */	
  public get size(): number {
    return this._cache.size;
  }

  /**
   * isEmpty
   * 
   * @returns True if and only if the cache does not contain any record.
   */	
  public get isEmpty(): boolean {
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
   * @param key The unique identifier for the cached record.
   * @param value The value to associate with the specified key.
   */
  public set(key: K, value: V): void {
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
   * @param key The unique identifier for the cached record.
   * @returns The value associated with the key if it exists and is valid;
   *          otherwise, `undefined`.
   */
  public get(key: K): V | undefined {
    const valueHolder =  this._cache.get(key);
    if (!valueHolder) {
      return undefined;
    }

    const { value, expirationTimestamp } = valueHolder;
    const isOutdated = Date.now() >= expirationTimestamp;
    if (isOutdated) {
      this._cache.delete(key);
      return undefined;
    }

    return value;
  }

  /**
   * delete
   * 
   * Removes the cached record associated with the specified key, if such a record
   * exists in the cache.
   * 
   * ## Return Value Clarification
   * Due to the event-driven eviction mechanism (see class documentation for details),
   * the `delete` method may return `true` for an outdated key that remains in the cache.
   * This occurs because a key's expiration is validated only during `get` or `set` operations,
   * not when calling `delete`.
   * 
   * @param key The unique identifier for the cached record.
   * @returns `true` if the key existed in the cache (whether up-to-date or outdated); 
   *          `false` otherwise.
   */
  public delete(key: K): boolean {
    return this._cache.delete(key);
  }

  /**
   * clear
   * 
   * Removes all records from the cache, leaving it empty.
   */
  public clear(): void {
    this._cache.clear();
  }
}

function isNaturalNumber(num: number): boolean {
  const floored = Math.floor(num);
  return floored >= 1 && floored === num;
}
