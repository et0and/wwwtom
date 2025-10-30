interface CacheEntry<T> {
	data: T;
	expiresAt: number;
}

class MemoryCache {
	private cache = new Map<string, CacheEntry<any>>();
	private defaultTTL = 60 * 60 * 1000;

	set<T>(key: string, data: T, ttl?: number): void {
		const expiresAt = Date.now() + (ttl || this.defaultTTL);
		this.cache.set(key, { data, expiresAt });
	}

	get<T>(key: string): T | null {
		const entry = this.cache.get(key);
		if (!entry) return null;

		if (Date.now() > entry.expiresAt) {
			this.cache.delete(key);
			return null;
		}

		return entry.data as T;
	}

	invalidate(key: string): void {
		this.cache.delete(key);
	}

	invalidatePattern(pattern: string): void {
		const regex = new RegExp(pattern);
		for (const key of this.cache.keys()) {
			if (regex.test(key)) {
				this.cache.delete(key);
			}
		}
	}

	clear(): void {
		this.cache.clear();
	}

	// Cleanup expired entries
	cleanup(): void {
		const now = Date.now();
		for (const [key, entry] of this.cache.entries()) {
			if (now > entry.expiresAt) {
				this.cache.delete(key);
			}
		}
	}
}

// Global cache instance
export const cache = new MemoryCache();
