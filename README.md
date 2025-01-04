<h2 align="middle">fifo-ttl-cache</h2>

The `FIFOCache` class provides a First-In-First-Out (FIFO) caching mechanism with a fixed Time-To-Live (TTL), ensuring automatic removal of outdated records.

Unlike the widely used LRU Cache, a FIFO Cache does not prioritize keeping popular keys cached for extended durations. This simplicity reduces implementation overhead and generally offers **faster response times**. FIFO caches are particularly well-suited for scenarios where:
* __Short-term key popularity__: Useful for situations where certain keys experience brief periods of higher activity (e.g., a 15-minute spike). For instance, in a background service aggregating data from a customer’s IoT sensors, caching customer details during the aggregation process enhances performance without compromising data relevance.
* __Uniform key distribution__: Effective when key popularity is relatively consistent and predictable.
* __Freshness of values is critical__: Ideal for security-sensitive use cases or environments where up-to-date data is essential.

## Table of Contents :bookmark_tabs:

* [Key Features](#key-features)
* [API](#api)
* [Getter Methods](#getter-methods)
* [Eviction Policy](#eviction-policy)
* [Event-Driven Eviction](#event-driven-eviction)
* [JavaScript's Map](#js-map)
* [Use Case Example: Real-Time User Session Verification](#use-case-example)
* [License](#license)

## Key Features :sparkles:<a id="key-features"></a>

- __FIFO Cache__: Automatically evicts the oldest record (based on insertion time) when the cache reaches its capacity and a new record with a non-existing key is added, irrespective of the record’s popularity.
- __Fixed TTL__: Ensures all cached records share the same Time-to-Live (TTL) duration, allowing for automatic eviction of stale entries.
- __Efficiency :gear:__: JavaScript's `Map` maintains the insertion order of keys, offering a reliable and **often overlooked** guarantee for iteration. This guarantee is leveraged in `FIFOCache` to eliminate the need for manually managing insertion order for eviction purposes.
- __Comprehensive Documentation :books:__: The class is thoroughly documented, enabling IDEs to provide helpful tooltips that enhance the coding experience.
- __Tests :test_tube:__: **Fully covered** by comprehensive unit tests.
- **TypeScript** support.
- No external runtime dependencies: Only development dependencies are used.
- ES2020 Compatibility: The `tsconfig` target is set to ES2020, ensuring compatibility with ES2020 environments.

## API :globe_with_meridians:<a id="api"></a>

The `FIFOCache` class provides the following methods:

* __set__: Adds or updates a key-value pair in the cache.
* __get__: Retrieves the value associated with the specified key, provided the key exists in the cache and its TTL has not expired.
* __delete__: Removes the cached record associated with the specified key, if such a record exists in the cache.
* __clear__: Removes all records from the cache, leaving it empty.

If needed, refer to the code documentation for a more comprehensive description.

## Getter Methods :mag:<a id="getter-methods"></a>

The `FIFOCache` class provides the following getter methods to reflect the current state:

* __size__: The number of items currently stored in this instance.
* __isEmpty__: Indicates whether the cache does not contain any record.

To eliminate any ambiguity, all getter methods have **O(1)** time and space complexity.

## Eviction Policy :wastebasket:<a id="eviction-policy"></a>

Cache records are evicted under the following conditions:
* The cache reaches its maximum capacity: The oldest key (based on insertion time) is removed.
* A key's value becomes outdated (its TTL has expired).

## Event-Driven Eviction :dart:<a id="event-driven-eviction"></a>

The eviction policy of this class is event-driven, avoiding periodic callbacks for removing outdated records. Instead, outdated keys are removed under the following circumstances:
* During a `set` operation: If adding a new entry exhausts the maximum allowed capacity, the oldest key (based on insertion time) is evicted.
* During a `get` operation: Outdated keys are validated and removed to prevent returning stale cached values.

While some cache variants employ actively scheduled eviction for each record, this approach has notable drawbacks:
* __Time Complexity Impact__: Each `setTimeout` adds a task to Node.js's internal priority queue for scheduled events. When a large number of timers exist, managing this queue (e.g., inserting and removing timers) incurs additional overhead due to the logarithmic time complexity of queue operations.
* __Event Loop Latency__: A surge of timers firing simultaneously or in rapid succession can degrade event loop performance, delaying critical operations such as I/O processing and other asynchronous tasks.
* __Space Complexity Impact__: Each `setTimeout` occupies memory in the heap for its context and execution details. A cache with many entries can thus lead to significant memory consumption, which may not scale well in high-throughput or resource-constrained environments.
* __GC Pressure__: The existence of many timers increases garbage collection pressure because timers hold references to their associated data. These references can lead to delayed memory reclamation, particularly if the timers expire over a long period.

Periodic eviction of stale **batches** is another non-event-driven strategy often employed in FIFO caches, as insertion order simplifies batch identification. However, it is prone to retaining stale records longer than necessary and can cause **latency spikes** during batch processing, making it less suitable for time-sensitive or high-demand applications.

Overall, the event-driven strategy ensures true O(1) eviction while avoiding indirect overhead on Node.js's internal structures.

## JavaScript's Map :world_map:<a id="js-map"></a>

JavaScript's `Map` maintains the insertion order of keys, offering a reliable and often overlooked guarantee for iteration. This guarantee is leveraged in `FIFOCache` to eliminate the need for manually managing insertion order for eviction purposes.

For details, refer to the [MDN documentation](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Map):  
"The Map object holds key-value pairs and remembers the original insertion order of the keys".

## Use Case Example: Real-Time User Session Verification :key:<a id="use-case-example"></a>

In high-traffic environments, maintaining the validity of user sessions is crucial for ensuring security and responsiveness. A FIFO cache is ideal for this scenario as it keeps **only the freshest session data**, ensuring that outdated or expired sessions are automatically evicted without complex prioritization. This approach is particularly effective when session popularity spikes periodically, such as during login events or bursts of user activity.

Below is an example of a `UserSessionVerifier` class leveraging a FIFO cache for efficient session management:

```ts
import { FIFOCache } from 'fifo-ttl-cache';
import { SessionVerifierOptions, SessionMetadata } from './user-session-interfaces';

class UserSessionVerifier {
  // Maps session IDs to their associated metadata.
  private readonly _sessionCache: FIFOCache<string, SessionMetadata>;

  constructor(options: Readonly<SessionVerifierOptions>) {
    const { maxCapacity, ttlMs } = options;
    this._sessionCache = new FIFOCache<string, SessionMetadata>(maxCapacity, ttlMs);
  }

  public async getMetadata(sessionId: string): SessionMetadata {
    const cachedMetadata = this._sessionCache.get(sessionId);

    if (cachedMetadata) {
      return cachedMetadata;
    }

    try {
      // Fetch and validate metadata from an external source (e.g., database, API)
      const metadata = await this._fetchMetadata(sessionId);
      this._sessionCache.set(sessionId, metadata);
      return metadata;
    } catch (err) {
      throw new SessionValidationError(
        `Failed validating sessionId ${sessionId}. Reason: ${err.message}`
      );
    }
  }

  public clearCache(): void {
    this._sessionCache.clear();
  }

  private async _fetchMetadata(sessionId: string): Promise<SessionMetadata> {
    // Logic to validate and fetch metadata from an external source goes here.
  }
}
```

## License :scroll:<a id="license"></a>

[Apache 2.0](LICENSE)
