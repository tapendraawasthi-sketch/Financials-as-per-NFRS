// ===== server.ts =====
import express from 'express';
import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = parseInt(process.env.PORT ?? '3000', 10);
const isDev = process.env.NODE_ENV !== 'production';

app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

// ---------------------------------------------------------------------------
// API Routes
// ---------------------------------------------------------------------------
import companyRouter     from './server/routes/company.js';
import trialBalanceRouter from './server/routes/trialBalance.js';
import adjustmentsRouter  from './server/routes/adjustments.js';
import financialsRouter   from './server/routes/financials.js';
import outputRouter       from './server/routes/output.js';
import { errorHandler }   from './server/middleware/errorHandler.js';
import { securityHeaders, requestLogger, createRateLimiter } from './server/middleware/security.js';

app.use(securityHeaders);
app.use(requestLogger);

// Rate limiters for expensive operations:
const excelRateLimiter = createRateLimiter(
  60 * 1000,  // 1-minute window
  10,         // max 10 Excel generations per minute per IP
  'Excel generation rate limit exceeded. Please wait 1 minute before trying again.'
);

const uploadRateLimiter = createRateLimiter(
  60 * 1000,  // 1-minute window
  20,         // max 20 uploads per minute per IP
  'Upload rate limit exceeded. Please wait before uploading again.'
);

app.use('/api/output', excelRateLimiter);
app.use('/api/trial-balance', uploadRateLimiter);

app.use('/api/company',       companyRouter);
app.use('/api/trial-balance', trialBalanceRouter);
app.use('/api/adjustments',   adjustmentsRouter);
app.use('/api/financials',    financialsRouter);
app.use('/api/output',        outputRouter);

app.get('/api/health', (_req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString(), version: '1.0.0' });
});

// ---------------------------------------------------------------------------
// Frontend Serving
// ---------------------------------------------------------------------------
async function startServer(): Promise<void> {
  if (isDev) {
    const { createServer } = await import('vite');
    const vite = await createServer({ server: { middlewareMode: true }, appType: 'spa' });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(__dirname, 'dist');
    app.use(express.static(distPath));
    app.get(/^(?!\/api).*/, (_req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.use(errorHandler);

  app.listen(PORT, () => {
    console.log(`\n🇳🇵 NFRS Financial Reporter`);
    console.log(`📊 Server running at http://localhost:${PORT}`);
    console.log(`🔧 Mode: ${isDev ? 'Development' : 'Production'}`);
    if (process.env.ANTHROPIC_API_KEY) {
      console.log(`🤖 AI Account Matching: ENABLED`);
    } else {
      console.log(`⚠️  AI Account Matching: DISABLED (set ANTHROPIC_API_KEY to enable)`);
    }
    console.log(`\nReady to generate NFRS-compliant financial statements.\n`);
  });
}

startServer().catch((err) => { console.error('Server startup failed:', err); process.exit(1); });
