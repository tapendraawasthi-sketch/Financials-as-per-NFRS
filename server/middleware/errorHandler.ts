import { Request, Response, NextFunction } from 'express';

export const asyncHandler = (fn: Function) => (req: Request, res: Response, next: NextFunction) => {
  Promise.resolve(fn(req, res, next)).catch(next);
};

export interface AppError {
  message: string;
  status?: number;
  code?:   string;
}

export function errorMiddleware(
  err: AppError & Error,
  _req: Request,
  res: Response,
  _next: NextFunction
): void {
  const status  = err.status  ?? 500;
  const message = err.message ?? 'An unexpected server error occurred.';
  console.error(`[Server Error ${status}]`, err.message, err.stack?.split('\n')[1]);
  res.status(status).json({ success: false, error: message, code: err.code });
}
