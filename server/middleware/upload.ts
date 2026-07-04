// ===== server/middleware/upload.ts =====
import multer from 'multer';
import type { Request, Response, NextFunction } from 'express';

/** Accepted MIME types for trial balance uploads. */
const ACCEPTED_MIME_TYPES = new Set([
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', // .xlsx
  'application/vnd.ms-excel',                                           // .xls
  'text/csv',
  'application/csv',
  'text/plain',  // some browsers send CSV with this type
  'application/pdf',
  'image/png',
  'image/jpeg',
  'image/jpg',
  'image/webp',
]);

/** Accepted file extensions (lower-case). */
const ACCEPTED_EXTENSIONS = new Set([
  '.xlsx', '.xls', '.csv', '.pdf', '.png', '.jpg', '.jpeg', '.webp',
]);

function fileFilter(
  _req: Request,
  file: Express.Multer.File,
  cb: multer.FileFilterCallback,
): void {
  const originalName = file.originalname?.toLowerCase() ?? '';
  const ext = originalName.slice(originalName.lastIndexOf('.'));
  const mimeOk = ACCEPTED_MIME_TYPES.has(file.mimetype);
  const extOk = ACCEPTED_EXTENSIONS.has(ext);

  if (mimeOk || extOk) {
    cb(null, true);
  } else {
    cb(
      new Error(
        'Only Excel (.xlsx, .xls), CSV (.csv), PDF (.pdf), or image (.png/.jpg/.webp) files are accepted. ' +
          `Received: "${file.originalname}" (${file.mimetype}).`,
      ),
    );
  }
}

/**
 * Shared multer instance using in-memory storage (no disk writes).
 * Max file size: 50 MB.
 */
export const uploadMiddleware = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 50 * 1024 * 1024 },
  fileFilter,
});

/**
 * Pre-configured single-file upload handler for the trial balance endpoint.
 * Expects the file to be posted under the form field name "trialbalance".
 */
export const tbUploadMiddleware = uploadMiddleware.single('trialbalance');
