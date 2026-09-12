const crypto = require('crypto');

class MemoryCache {
  constructor(maxEntries = 1000) {
    this.store = new Map();
    this.maxEntries = maxEntries;
    this.hits = 0;
    this.misses = 0;

    // Periodically sweep expired entries every 2 minutes
    this.cleanupInterval = setInterval(() => this.prune(), 2 * 60 * 1000);
    if (this.cleanupInterval.unref) {
      this.cleanupInterval.unref(); // Allow node process to exit naturally
    }
  }

  set(key, value, ttlSeconds = 300) {
    // Evict oldest entry if capacity reached
    if (this.store.size >= this.maxEntries) {
      const firstKey = this.store.keys().next().value;
      this.store.delete(firstKey);
    }

    const expiresAt = Date.now() + (ttlSeconds * 1000);
    this.store.set(key, { value, expiresAt });
  }

  get(key) {
    const entry = this.store.get(key);
    if (!entry) {
      this.misses++;
      return null;
    }

    if (Date.now() > entry.expiresAt) {
      this.store.delete(key);
      this.misses++;
      return null;
    }

    this.hits++;
    return entry.value;
  }

  del(key) {
    return this.store.delete(key);
  }

  delPrefix(prefix) {
    let count = 0;
    for (const key of this.store.keys()) {
      if (key.startsWith(prefix)) {
        this.store.delete(key);
        count++;
      }
    }
    return count;
  }

  clear() {
    this.store.clear();
  }

  prune() {
    const now = Date.now();
    for (const [key, entry] of this.store.entries()) {
      if (now > entry.expiresAt) {
        this.store.delete(key);
      }
    }
  }

  getStats() {
    return {
      size: this.store.size,
      maxEntries: this.maxEntries,
      hits: this.hits,
      misses: this.misses,
      hitRatio: this.hits + this.misses > 0 ? (this.hits / (this.hits + this.misses)).toFixed(2) : '0.00'
    };
  }
}

const cache = new MemoryCache(1500);

/**
 * Express middleware for caching public/semi-static GET endpoints
 * Supports ETag and 304 Not Modified validation
 */
function cacheMiddleware(options = {}) {
  const { 
    ttl = 300, 
    prefix = 'api', 
    staleWhileRevalidate = 600,
    isPublic = true 
  } = options;

  return (req, res, next) => {
    // Only cache safe GET requests
    if (req.method !== 'GET') {
      return next();
    }

    // Skip cache if Authorization header is present and route is marked private
    if (!isPublic && req.headers.authorization) {
      return next();
    }

    const cacheKey = `${prefix}:${req.originalUrl || req.url}`;
    const cached = cache.get(cacheKey);

    if (cached) {
      const etag = crypto.createHash('md5').update(cached.rawString).digest('hex');
      
      // Check client If-None-Match header
      if (req.headers['if-none-match'] === `"${etag}"` || req.headers['if-none-match'] === etag) {
        res.setHeader('ETag', `"${etag}"`);
        res.setHeader('Cache-Control', `public, max-age=${ttl}, stale-while-revalidate=${staleWhileRevalidate}`);
        return res.status(304).end();
      }

      res.setHeader('X-Cache', 'HIT');
      res.setHeader('ETag', `"${etag}"`);
      res.setHeader('Cache-Control', `public, max-age=${ttl}, stale-while-revalidate=${staleWhileRevalidate}`);
      return res.json(cached.data);
    }

    // Intercept res.json to capture and cache response
    const originalJson = res.json.bind(res);
    res.json = (data) => {
      if (res.statusCode === 200 && data) {
        const rawString = JSON.stringify(data);
        const etag = crypto.createHash('md5').update(rawString).digest('hex');
        
        cache.set(cacheKey, { data, rawString }, ttl);
        
        res.setHeader('X-Cache', 'MISS');
        res.setHeader('ETag', `"${etag}"`);
        res.setHeader('Cache-Control', `public, max-age=${ttl}, stale-while-revalidate=${staleWhileRevalidate}`);
      }
      return originalJson(data);
    };

    next();
  };
}

module.exports = {
  cache,
  cacheMiddleware
};
