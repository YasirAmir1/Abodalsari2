/**
 * High-speed in-memory TTL cache (with optional localStorage persistence)
 * for frequently accessed, rarely changing configuration & tenant metadata
 * (agents, products, pricing, device codes, users, and recent remote snapshots).
 */

interface CacheEntry<T> {
  value: T;
  expiresAt: number;
  createdAt: number;
}

const DEFAULT_TTL_MS = 5 * 60 * 1000; // 5 minutes for config/metadata
const PERSIST_PREFIX = 'alsari_cache_v1_';

class MemoryCacheService {
  private store = new Map<string, CacheEntry<unknown>>();

  get<T>(key: string): T | null {
    const entry = this.store.get(key);
    if (entry) {
      if (Date.now() <= entry.expiresAt) {
        return entry.value as T;
      }
      this.store.delete(key);
    }

    // Attempt warm read from localStorage if marked persistent
    if (typeof window !== 'undefined') {
      try {
        const raw = localStorage.getItem(PERSIST_PREFIX + key);
        if (raw) {
          const parsed = JSON.parse(raw) as CacheEntry<T>;
          if (parsed && Date.now() <= parsed.expiresAt) {
            this.store.set(key, parsed);
            return parsed.value;
          }
          localStorage.removeItem(PERSIST_PREFIX + key);
        }
      } catch {}
    }

    return null;
  }

  set<T>(key: string, value: T, ttlMs: number = DEFAULT_TTL_MS, persist = false): void {
    const entry: CacheEntry<T> = {
      value,
      createdAt: Date.now(),
      expiresAt: Date.now() + ttlMs
    };
    this.store.set(key, entry);

    if (persist && typeof window !== 'undefined') {
      try {
        localStorage.setItem(PERSIST_PREFIX + key, JSON.stringify(entry));
      } catch {}
    }
  }

  invalidate(keyOrPrefix: string): void {
    for (const key of Array.from(this.store.keys())) {
      if (key === keyOrPrefix || key.startsWith(keyOrPrefix)) {
        this.store.delete(key);
        if (typeof window !== 'undefined') {
          try {
            localStorage.removeItem(PERSIST_PREFIX + key);
          } catch {}
        }
      }
    }
  }

  clear(): void {
    this.store.clear();
  }
}

export const cacheService = new MemoryCacheService();
