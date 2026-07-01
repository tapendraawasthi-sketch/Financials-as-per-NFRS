import { Request, Response, NextFunction } from 'express';

// ── In-memory rate limiter ─────────────────────────────────────────────────────

interface ClientRecord {
  count: number;
  resetAt: number;
}

/**
 * Creates a simple in-memory rate limiter.
 * windowMs: time window in milliseconds
 * maxRequests: maximum allowed requests per window per IP
 */
export function createRateLimiter(
  windowMs: number,
  maxRequests: number,
  message?: string,
) {
  const clients = new Map<string, ClientRecord>();

  // Clean up expired entries periodically to prevent memory leaks
  const cleanup = setInterval(() => {
    const now = Date.now();
    for (const [ip, record] of clients.entries()) {
      if (now > record.resetAt) {
        clients.delete(ip);
      }
    }
  }, windowMs * 2);

  // Prevent the interval from keeping the process alive
  if (cleanup.unref) cleanup.unref();

  return (req: Request, res: Response, next: NextFunction): void => {
    const clientIp =
      (req.headers['x-forwarded-for'] as string)?.split(',')[0]?.trim() ||
      req.ip ||
      req.socket.remoteAddress ||
      'unknown';

    const now = Date.now();
    const existing = clients.get(clientIp);

    if (!existing || now > existing.resetAt) {
      // New window
      clients.set(clientIp, { count: 1, resetAt: now + windowMs });
      // Set rate limit headers
      res.setHeader('X-RateLimit-Limit', String(maxRequests));
      res.setHeader('X-RateLimit-Remaining', String(maxRequests - 1));
      res.setHeader('X-RateLimit-Reset', String(Math.ceil((now + windowMs) / 1000)));
      next();
    } else if (existing.count < maxRequests) {
      existing.count++;
      res.setHeader('X-RateLimit-Limit', String(maxRequests));
      res.setHeader('X-RateLimit-Remaining', String(maxRequests - existing.count));
      res.setHeader('X-RateLimit-Reset', String(Math.ceil(existing.resetAt / 1000)));
      next();
    } else {
      // Rate limit exceeded
      const retryAfterSecs = Math.ceil((existing.resetAt - now) / 1000);
      res.setHeader('Retry-After', String(retryAfterSecs));
      res.setHeader('X-RateLimit-Limit', String(maxRequests));
      res.setHeader('X-RateLimit-Remaining', '0');
      res.setHeader('X-RateLimit-Reset', String(Math.ceil(existing.resetAt / 1000)));
      res.status(429).json({
        error: message ?? 'Too many requests. Please wait and try again.',
        code: 'RATE_LIMIT_EXCEEDED',
        retryAfter: retryAfterSecs,
      });
    }
  };
}

// ── Security headers middleware ───────────────────────────────────────────────

export function securityHeaders(req: Request, res: Response, next: NextFunction): void {
  // Prevent MIME type sniffing
  res.setHeader('X-Content-Type-Options', 'nosniff');

  // Prevent clickjacking
  res.setHeader('X-Frame-Options', 'DENY');

  // Enable XSS filter in older browsers
  res.setHeader('X-XSS-Protection', '1; mode=block');

  // Restrict referrer information
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');

  // Prevent DNS prefetching
  res.setHeader('X-DNS-Prefetch-Control', 'off');

  // Basic CSP — allow inline styles for Tailwind, self-hosted scripts only
  // Adjust as needed for your deployment
  if (process.env.NODE_ENV === 'production') {
    res.setHeader(
      'Content-Security-Policy',
      [
        "default-src 'self'",
        "script-src 'self' 'unsafe-inline'",    // Vite inline scripts
        "style-src 'self' 'unsafe-inline'",     // Tailwind inline styles
        "img-src 'self' data: blob:",
        "font-src 'self'",
        "connect-src 'self'",
        "frame-ancestors 'none'",
      ].join('; ')
    );
  }

  next();
}

// ── Request logging middleware ────────────────────────────────────────────────

export function requestLogger(req: Request, res: Response, next: NextFunction): void {
  if (!req.path.startsWith('/api')) {
    next();
    return;
  }

  const start = Date.now();
  const clientIp =
    (req.headers['x-forwarded-for'] as string)?.split(',')[0]?.trim() ||
    req.ip ||
    'unknown';

  res.on('finish', () => {
    const duration = Date.now() - start;
    const statusColor =
      res.statusCode >= 500 ? '\x1b[31m' :  // red
      res.statusCode >= 400 ? '\x1b[33m' :  // yellow
      res.statusCode >= 300 ? '\x1b[36m' :  // cyan
      '\x1b[32m';                            // green
    const reset = '\x1b[0m';

    console.log(
      `[${new Date().toISOString()}] ${req.method} ${req.path} ` +
      `${statusColor}${res.statusCode}${reset} ` +
      `${duration}ms — ${clientIp}`
    );
  });

  next();
}

// ── API key validation (for future use) ──────────────────────────────────────

export function requireApiKey(req: Request, res: Response, next: NextFunction): void {
  const apiKey = req.headers['x-api-key'] || req.query.apiKey;
  const expected = process.env.INTERNAL_API_KEY;

  if (!expected) {
    // No key configured — allow all (development mode)
    next();
    return;
  }

  if (!apiKey || apiKey !== expected) {
    res.status(401).json({ error: 'Invalid or missing API key', code: 'UNAUTHORIZED' });
    return;
  }

  next();
}
