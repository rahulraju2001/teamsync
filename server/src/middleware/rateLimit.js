/**
 * Small in-memory limiter for this single-instance learning project.
 * For a multi-instance deployment, use a shared store such as Redis.
 */
export function createRateLimiter({ windowMs, maxRequests, message }) {
  const attempts = new Map();

  return (req, res, next) => {
    const now = Date.now();
    const key = req.ip || req.socket?.remoteAddress || "unknown";
    let entry = attempts.get(key);

    if (!entry || entry.resetAt <= now) {
      entry = { count: 0, resetAt: now + windowMs };
      attempts.set(key, entry);
    }

    // Opportunistically remove expired entries so the map does not grow forever.
    if (attempts.size > 5000) {
      for (const [ip, value] of attempts) {
        if (value.resetAt <= now) attempts.delete(ip);
      }
    }

    if (entry.count >= maxRequests) {
      const retryAfterSeconds = Math.max(1, Math.ceil((entry.resetAt - now) / 1000));
      res.set("Retry-After", String(retryAfterSeconds));
      return res.status(429).json({ message });
    }

    entry.count += 1;
    return next();
  };
}
