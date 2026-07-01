// ===== server/middleware/errorHandler.ts =====
import type { Request, Response, NextFunction } from 'express';

/**
 * Standard Express 4-argument error handler.
 * Must be registered AFTER all routes in the Express app.
 */
export function errorHandler(
  err: unknown,
  _req: Request,
  res: Response,
  next: NextFunction,
): void {
  // If headers were already sent, delegate to the default Express handler
  if (res.headersSent) {
    next(err);
    return;
  }

  const error = err as Record<string, unknown>;
  const message =
    typeof error?.message === 'string'
      ? error.message
      : 'Internal Server Error';
  const code =
    typeof error?.code === 'string' ? error.code : 'INTERNAL_ERROR';
  const status =
    typeof error?.status === 'number'
      ? error.status
      : typeof error?.statusCode === 'number'
      ? error.statusCode
      : 500;

  console.error('[Server Error]', message, status !== 500 ? '' : err);

  res.status(status).json({ error: message, code });
}

/**
 * Wraps an async Express route handler so that any rejected promise is
 * automatically forwarded to `next` (and therefore to the errorHandler).
 *
 * @example
 * router.get('/route', asyncHandler(async (req, res) => { ... }))
 */
export function asyncHandler(
  fn: (req: Request, res: Response, next: NextFunction) => Promise<unknown>,
) {
  return (req: Request, res: Response, next: NextFunction): void => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
}
