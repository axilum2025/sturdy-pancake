// ============================================================
// GiLo AI – Redis Service Unit Tests
// Tests the in-memory fallback behavior (no Redis in test env)
// ============================================================

import { describe, it, expect, beforeEach } from 'vitest';
import {
  cacheGet,
  cacheSet,
  cacheDel,
  isRedisAvailable,
  slidingWindowRateLimit,
} from './redisService';

describe('redisService — in-memory fallback', () => {
  // Without REDIS_URL, Redis is not available → all operations
  // should gracefully fall back to the in-memory implementation.

  it('isRedisAvailable() returns false without connection', () => {
    expect(isRedisAvailable()).toBe(false);
  });

  it('slidingWindowRateLimit returns allowed:true as fallback', async () => {
    const result = await slidingWindowRateLimit('test:key', 10, 60000);
    expect(result.allowed).toBe(true);
    expect(result.remaining).toBe(10);
  });

  describe('cache operations (in-memory)', () => {
    const key = 'test:cache:unit';

    beforeEach(async () => {
      await cacheDel(key);
    });

    it('cacheGet returns null for missing key', async () => {
      const val = await cacheGet(key);
      expect(val).toBeNull();
    });

    it('cacheSet + cacheGet roundtrips data', async () => {
      await cacheSet(key, { hello: 'world', n: 42 }, 60);
      const val = await cacheGet<{ hello: string; n: number }>(key);
      expect(val).toEqual({ hello: 'world', n: 42 });
    });

    it('cacheDel removes the entry', async () => {
      await cacheSet(key, 'value', 60);
      await cacheDel(key);
      const val = await cacheGet(key);
      expect(val).toBeNull();
    });

    it('expired entries return null', async () => {
      // Set with 0 TTL (immediate expiry)
      await cacheSet(key, 'expired', 0);
      // small delay to ensure time-based expiry
      await new Promise((r) => setTimeout(r, 10));
      const val = await cacheGet(key);
      expect(val).toBeNull();
    });
  });
});
