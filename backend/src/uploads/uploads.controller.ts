import { BadRequestException, Controller, Post, UploadedFile, UseInterceptors } from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { mkdirSync } from 'node:fs';
import { randomUUID } from 'node:crypto';
import { diskStorage } from 'multer';
import { RECEIPT_URL_PREFIX, RECEIPTS_DIR } from './receipt-files.js';
import { UPLOADS_ROUTES } from '../routes/index.js';

const EXTENSIONS: Record<string, string> = {
  'image/png': '.png',
  'image/jpeg': '.jpg',
  'image/webp': '.webp',
  'application/pdf': '.pdf',
};

mkdirSync(RECEIPTS_DIR, { recursive: true });

@Controller(UPLOADS_ROUTES.BASE)
export class UploadsController {
  /** Stores a receipt and returns its URL, to be sent as `receiptUrl` when saving an expense. */
  @Post(UPLOADS_ROUTES.RECEIPTS)
  @UseInterceptors(
    FileInterceptor('file', {
      limits: { fileSize: 5 * 1024 * 1024 },
      fileFilter: (_req, file, cb) =>
        EXTENSIONS[file.mimetype]
          ? cb(null, true)
          : cb(new BadRequestException('Receipt must be a PNG, JPEG, WebP or PDF file'), false),
      storage: diskStorage({
        destination: RECEIPTS_DIR,
        filename: (_req, file, cb) => cb(null, `${randomUUID()}${EXTENSIONS[file.mimetype]}`),
      }),
    }),
  )
  uploadReceipt(@UploadedFile() file?: Express.Multer.File) {
    if (!file) throw new BadRequestException('No file uploaded');
    return { url: `${RECEIPT_URL_PREFIX}${file.filename}` };
  }
}
