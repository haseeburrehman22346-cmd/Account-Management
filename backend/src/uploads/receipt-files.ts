import type { Model } from 'mongoose';
import type { Expense } from '../expenses/expense.schema.js';
import { unlink } from 'node:fs/promises';
import { basename, join } from 'node:path';

export const UPLOADS_ROOT = join(process.cwd(), 'uploads');
export const RECEIPTS_DIR = join(UPLOADS_ROOT, 'receipts');
export const RECEIPT_URL_PREFIX = '/uploads/receipts/';
export const RECEIPT_URL_PATTERN = /^\/uploads\/receipts\/[a-f0-9-]{36}\.(png|jpe?g|webp|pdf)$/;

/** Best-effort removal; a missing file is not an error. */
export async function deleteReceiptFiles(urls: (string | null | undefined)[]) {
  await Promise.all(
    urls
      .filter((url): url is string => !!url && RECEIPT_URL_PATTERN.test(url))
      .map((url) => unlink(join(RECEIPTS_DIR, basename(url))).catch(() => undefined)),
  );
}

/** One receipt can back several expenses (e.g. each line of a bill), so only delete files no expense still uses. */
export async function deleteUnusedReceiptFiles(
  expenses: Model<Expense>,
  urls: (string | null | undefined)[],
) {
  const candidates = urls.filter((url): url is string => !!url);
  if (!candidates.length) return;
  const stillUsed = new Set(await expenses.find({ receiptUrl: { $in: candidates } }).distinct<'receiptUrl', string>('receiptUrl'));
  await deleteReceiptFiles(candidates.filter((url) => !stillUsed.has(url)));
}
