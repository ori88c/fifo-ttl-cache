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

import { NonReplacementRandomSampler } from 'non-replacement-random-item-sampler';
import { FIFOCache } from './fifo-ttl-cache';

const MOCK_CAPACITY = 144;
const MOCK_TTL_MS = 60 * 1000;

/**
 * createPopulatedTestCache
 *
 * @returns A cache populated with records up to its maximum capacity. Each record's 
 *          value equals its corresponding key. The keys are all integers within the
 *          range [1, MOCK_CAPACITY].
 */
const createPopulatedTestCache = () => {
  const cache = new FIFOCache<number, number>(MOCK_CAPACITY, MOCK_TTL_MS);

  // Populate the cache to its maximum capacity.
  for (let key = 1; key <= MOCK_CAPACITY; ++key) {
    const value = key; // Assign the key as the value for simplicity.
    cache.set(key, value);

    const numberOfInsertedItems = key;
    expect(cache.size).toBe(numberOfInsertedItems);
  }

  return cache;
}

const createAllKeys = () => new Array<number>(MOCK_CAPACITY).fill(0).map((_, index) => index+1);

describe('FIFOCache tests', () => {
  beforeEach(() => {
    jest.useFakeTimers();
  });
  
  afterEach(() => {
    jest.restoreAllMocks();
    jest.useRealTimers();
  });

  describe('Happy path tests', () => {
    test('a new instance should be empty', () => {
      const cache = new FIFOCache<number, number>(MOCK_CAPACITY, MOCK_TTL_MS);
      expect(cache.size).toBe(0);
      expect(cache.isEmpty).toBe(true);

      // Verify that all `get` attempts return `undefined`, as no keys exist in the cache.
      const sampleAttemptsCount = 193;
      const maxRandomKey = 834;
      const sampleRandomKey = () => Math.ceil(Math.random() * maxRandomKey);
      for (let attempt = 1; attempt <= sampleAttemptsCount; ++attempt) {
        const nonPresentKey = sampleRandomKey();
        expect(cache.get(nonPresentKey)).toBeUndefined();
      }
    });

    test('when the cache is full, the oldest key (by insertion time) should be evicted', () => {
      // Create a test cache populated to its maximum capacity.
      const cache = createPopulatedTestCache();

      // Verify that all inserted keys are present in the cache.
      for (let key = 1; key <= MOCK_CAPACITY; ++key) {
        const expectedValue = key;
        expect(cache.get(key)).toBe(expectedValue);
      }

      // Inserting new keys should trigger eviction of the oldest keys in sequence.
      // Given the sequential insertion order, adding key K results in the eviction
      // of key K - MOCK_CAPACITY.
      const minEvictionTriggeringKey = MOCK_CAPACITY + 1;
      const maxEvictionTriggeringKey = 9 * MOCK_CAPACITY + 35;
      for (let key = minEvictionTriggeringKey; key <= maxEvictionTriggeringKey; ++key) {
        // Validate that the oldest key is still accessible before insertion.
        const oldestKeyBeforeInsertion = key - MOCK_CAPACITY;
        expect(cache.get(oldestKeyBeforeInsertion)).toBe(oldestKeyBeforeInsertion);

        // Insert the new key into the cache.
        const value = key; // Assign the key as the value for simplicity.
        cache.set(key, value);

        // Verify that the oldest key has been evicted post-insertion.
        expect(cache.get(oldestKeyBeforeInsertion)).toBeUndefined();
      }

      cache.clear();
      expect(cache.size).toBe(0);
      expect(cache.isEmpty).toBe(true);
    });

    test('keys should be evicted after exceeding TTL', () => {
      // Create a test cache populated to its maximum capacity.
      const cache = createPopulatedTestCache();
      const nearExpirationIncrementMs = Math.floor(0.999 * MOCK_TTL_MS);
      const expirationRemainderMs = MOCK_TTL_MS - nearExpirationIncrementMs;

      // Advance the timer close to, but not exceeding, the TTL.
      // All items are expected to remain in the cache.
      jest.advanceTimersByTime(nearExpirationIncrementMs);
      for (let key = 1; key <= MOCK_CAPACITY; ++key) {
        const expectedValue = key;
        expect(cache.get(key)).toBe(expectedValue);
      }

      // Advance the timer to exceed the TTL.
      // All keys are expected to be evicted.
      let remainingItemsCount = MOCK_CAPACITY;
      jest.advanceTimersByTime(expirationRemainderMs);
      for (let key = 1; key <= MOCK_CAPACITY; ++key) {
        expect(cache.get(key)).toBeUndefined(); // Item should be evicted.
        --remainingItemsCount;
        expect(cache.size).toBe(remainingItemsCount); // Cache size should decrement.
      }

      // Verify the cache is empty.
      expect(cache.isEmpty).toBe(true);
    });

    test('values should be updated successfully', () => {
      // Create a test cache populated to its maximum capacity.
      const cache = createPopulatedTestCache();

      // Generate all possible keys for sampling.
      const allKeys = createAllKeys();

      // Initialize a random sampler that ensures each key is sampled once per cycle.
      const uniqueKeySampler = new NonReplacementRandomSampler(allKeys);

      // Iterate over the first `keyUpdateCycles` sampling cycles, ensuring each key is
      // sampled once per cycle.
      const keyUpdateCycles = 3;
      while (uniqueKeySampler.currentCycle <= keyUpdateCycles) {
        // Backup the current cycle number *before* sampling, as the cycle automatically
        // increments upon exhaustion (i.e., when all items have been sampled).
        const currentCycle = uniqueKeySampler.currentCycle;

        // Sample a random key that is guaranteed to exist in this cycle.
        const sampledKey = uniqueKeySampler.sample();

        // Verify the initial value before updating.
        const oldValue = sampledKey * currentCycle;
        expect(cache.get(sampledKey)).toBe(oldValue);

        // Update the value for the current key.
        const updatedValue = sampledKey * (currentCycle + 1);
        cache.set(sampledKey, updatedValue);

        // Verify the updated value and ensure the cache size remains constant.
        expect(cache.get(sampledKey)).toBe(updatedValue);
        expect(cache.size).toBe(MOCK_CAPACITY);
      }
    });

    test('cache should handle deletions correctly', () => {
      // Create a test cache populated to its maximum capacity.
      const cache = createPopulatedTestCache();

      // Generate all possible keys for sampling.
      const allKeys = createAllKeys();

      // Initialize a random sampler that ensures each key is sampled once per cycle.
      const uniqueKeySampler = new NonReplacementRandomSampler(allKeys);

      let remainingItemsCount = MOCK_CAPACITY;

      // Iterate over the first sampling cycle, where each key is guaranteed to be
      // sampled once.
      while (uniqueKeySampler.currentCycle === 1) {
        // Sample a random key that is guaranteed to exist in this cycle.
        const sampledKey = uniqueKeySampler.sample();

        // Ensure the key exists and retrieve its value before deletion.
        const expectedValue = sampledKey;
        expect(cache.get(sampledKey)).toBe(expectedValue);

        // Delete the sampled key from the cache.
        expect(cache.delete(sampledKey)).toBe(true);
        --remainingItemsCount;

        // A return value of 'false' indicates an attempt to delete a non-existent key.
        expect(cache.delete(sampledKey)).toBe(false);

        // Confirm the key has been successfully deleted and the cache size
        // decreases as expected.
        expect(cache.get(sampledKey)).toBeUndefined();
        expect(cache.size).toBe(remainingItemsCount);
      }
    });
  });

  describe('Negative path tests', () => {
    test('constructor should throw an error if the _capacity is not a natural number', () => {
      const nonNaturalNumbers = [-74, -65, -5.67, -0.00001, 0, 0.1, 0.08974, 9.543, 1898.5, 4000.0000001];
      for (const invalidCapacity of nonNaturalNumbers) {
        expect(() => new FIFOCache<number, number>(invalidCapacity, MOCK_TTL_MS)).toThrow();
      }
    });

    test('constructor should throw an error if the _ttlMs is not a natural number', () => {
      const nonNaturalNumbers = [-74, -65, -5.67, -0.00001, 0, 0.1, 0.08974, 9.543, 1898.5, 4000.0000001];
      for (const invalidTTL of nonNaturalNumbers) {
        expect(() => new FIFOCache<number, number>(MOCK_CAPACITY, invalidTTL)).toThrow();
      }
    });
  });
});
