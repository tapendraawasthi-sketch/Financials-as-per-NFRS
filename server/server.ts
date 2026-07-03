// server/server.ts
import 'dotenv/config';
import express, { Request, Response, NextFunction } from 'express';
import path from 'path';
import { fileURLToPath } from 'url';
import http from 'http';

// ── Route imports ─────────────────────────────────────────────────────────
import companyRouter      from './routes/company.js';
import trialBalanceRouter from './routes/trialBalance.js';
import adjustmentsRouter  from './routes/adjustments.js';
import financialsRouter   from './routes/financials.js';
import outputRouter       from './routes/output.js';

// ── Middleware imports ────────────────────────────────────────────────────
import { errorMiddleware }                     from './middleware/errorHandler.js';
import { securityHeaders, createRateLimiter, requestLogger } from './middleware/security.js';
import { sessionStore }                        from './store/sessionStore.js';

// ── ESM __dirname shim ────────────────────────────────────────────────────
const __filename = fileURLToPath(import.meta.url);
const __dirname  = path.dirname(__filename);

// ── Configuration ─────────────────────────────────────────────────────────
const PORT   = parseInt(process.env.PORT ?? '3000', 10);
const isDev  = process.env.NODE_ENV !== 'production';
const DIST   = path.join(__dirname, '..', 'dist');

// ── Express app ───────────────────────────────────────────────────────────
const app = express();

// ══════════════════════════════════════════════════════════════════════════
// GLOBAL MIDDLEWARE
// ══════════════════════════════════════════════════════════════════════════

// Security headers (nosniff, X-Frame-Options, XSS protection)
app.use(securityHeaders);

// Request logger
app.use(requestLogger);

// CORS (development only — Vite runs on :5173)
if (isDev) {
  app.use((req: Request, res: Response, next: NextFunction) => {
    res.header('Access-Control-Allow-Origin',  'http://localhost:5173');
    res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, PATCH, OPTIONS');
    res.header('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-API-Key');
    res.header('Access-Control-Max-Age',       '86400');
    if (req.method === 'OPTIONS') { res.sendStatus(200); return; }
    next();
  });
  console.log('[CORS] Dev CORS enabled for http://localhost:5173');
}

// Body parsers
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Raw body for multipart (multer handles this per-route, but allow raw for streaming)
app.use(
  '/api/trial-balance',
  express.raw({ type: 'application/octet-stream', limit: '50mb' })
);

// ══════════════════════════════════════════════════════════════════════════
// RATE LIMITERS
// ══════════════════════════════════════════════════════════════════════════
const standardLimiter = createRateLimiter(60_000, 120);
const uploadLimiter   = createRateLimiter(60_000, 20);
const outputLimiter   = createRateLimiter(60_000, 10);
const aiLimiter       = createRateLimiter(60_000, 5);

app.use('/api',                        standardLimiter);
app.use('/api/trial-balance',          uploadLimiter);
app.use('/api/output',                 outputLimiter);
app.use('/api/trial-balance/ai-match', aiLimiter);

// ══════════════════════════════════════════════════════════════════════════
// HEALTH CHECK
// ══════════════════════════════════════════════════════════════════════════
app.get('/api/health', (_req: Request, res: Response) => {
  const mem = process.memoryUsage();
  res.json({
    status:  'ok',
    service: 'NFRS Financial Reporter',
    version: '2.0.0',
    env:     process.env.NODE_ENV ?? 'development',
    uptime:  `${Math.floor(process.uptime())}s`,
    memory: {
      rss:       `${(mem.rss       / 1024 / 1024).toFixed(1)} MB`,
      heapUsed:  `${(mem.heapUsed  / 1024 / 1024).toFixed(1)} MB`,
      heapTotal: `${(mem.heapTotal / 1024 / 1024).toFixed(1)} MB`,
    },
    timestamp: new Date().toISOString(),
  });
});

// ══════════════════════════════════════════════════════════════════════════
// API ROUTES
// ══════════════════════════════════════════════════════════════════════════
app.use('/api/company',       companyRouter);
app.use('/api/trial-balance', trialBalanceRouter);
app.use('/api/adjustments',   adjustmentsRouter);
app.use('/api/financials',    financialsRouter);
app.use('/api/output',        outputRouter);

// ══════════════════════════════════════════════════════════════════════════
// STATIC FILES (production build) / DEV PROXY NOTE
// ══════════════════════════════════════════════════════════════════════════
if (!isDev) {
  // Serve Vite production build
  app.use(express.static(DIST, {
    maxAge:  '1d',
    etag:    true,
    index:   'index.html',
  }));

  // SPA catch-all — must be AFTER API routes
  app.get('*', (_req: Request, res: Response) => {
    res.sendFile(path.join(DIST, 'index.html'));
  });
} else {
  // In dev, Vite handles the frontend; show a helpful message for root
  app.get('/', (_req: Request, res: Response) => {
    res.json({
      message: 'NFRS API Server (dev mode). Frontend served by Vite at http://localhost:5173',
      api:     'http://localhost:3000/api',
      health:  'http://localhost:3000/api/health',
    });
  });
}

// ══════════════════════════════════════════════════════════════════════════
// 404 HANDLER (API routes only)
// ══════════════════════════════════════════════════════════════════════════
app.use('/api/*', (req: Request, res: Response) => {
  res.status(404).json({
    success: false,
    error:   `Route not found: ${req.method} ${req.originalUrl}`,
  });
});

// ══════════════════════════════════════════════════════════════════════════
// GLOBAL ERROR HANDLER (must be last)
// ══════════════════════════════════════════════════════════════════════════
app.use(errorMiddleware);

// ══════════════════════════════════════════════════════════════════════════
// SERVER START
// ══════════════════════════════════════════════════════════════════════════
const server = http.createServer(app);

server.listen(PORT, () => {
  console.log('\n' + '═'.repeat(50));
  console.log(`  🇳🇵 NFRS Financial Reporter`);
  console.log('═'.repeat(50));
  console.log(`  🌐 Mode:       ${isDev ? 'Development' : 'Production'}`);
  console.log(`  🔌 API:        http://localhost:${PORT}/api`);
  console.log(`  ❤️  Health:     http://localhost:${PORT}/api/health`);
  if (!isDev) {
    console.log(`  📁 Frontend:   http://localhost:${PORT}`);
  } else {
    console.log(`  📁 Frontend:   http://localhost:5173 (Vite)`);
  }

  // Memory usage on startup
  const mem = process.memoryUsage();
  console.log(`  💾 Memory:     RSS ${(mem.rss / 1024 / 1024).toFixed(1)}MB, Heap ${(mem.heapUsed / 1024 / 1024).toFixed(1)}/${(mem.heapTotal / 1024 / 1024).toFixed(1)}MB`);
  console.log('═'.repeat(50) + '\n');
});

// ══════════════════════════════════════════════════════════════════════════
// SESSION CLEANUP JOB — every 6 hours
// ══════════════════════════════════════════════════════════════════════════
const SESSION_CLEANUP_INTERVAL_MS = 6 * 60 * 60 * 1000; // 6 hours
const SESSION_MAX_AGE_HOURS       = 4;

setInterval(() => {
  const removed = sessionStore.cleanup(SESSION_MAX_AGE_HOURS);
  console.log(`[Session Cleanup] Removed ${removed} expired session(s) (older than ${SESSION_MAX_AGE_HOURS}h)`);
}, SESSION_CLEANUP_INTERVAL_MS);

// Run once at startup to clear any stale sessions from previous runs
setTimeout(() => {
  const removed = sessionStore.cleanup(SESSION_MAX_AGE_HOURS);
  if (removed > 0) console.log(`[Session Cleanup] Startup: removed ${removed} stale session(s)`);
}, 5_000);

// ══════════════════════════════════════════════════════════════════════════
// GRACEFUL SHUTDOWN
// ══════════════════════════════════════════════════════════════════════════
function shutdown(signal: string) {
  console.log(`\n[Server] ${signal} received. Shutting down gracefully...`);
  server.close((err) => {
    if (err) {
      console.error('[Server] Error during shutdown:', err.message);
      process.exit(1);
    }
    console.log('[Server] All connections closed. Goodbye!');
    process.exit(0);
  });

  // Force-kill after 10s if connections don't close
  setTimeout(() => {
    console.error('[Server] Force shutdown after timeout.');
    process.exit(1);
  }, 10_000).unref();
}

process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT',  () => shutdown('SIGINT'));

process.on('uncaughtException', (err) => {
  console.error('[Uncaught Exception]', err);
  shutdown('uncaughtException');
});

process.on('unhandledRejection', (reason) => {
  console.error('[Unhandled Rejection]', reason);
  // Log but don't crash — unhandled promise rejections are usually recoverable
});

export default app;
