import OpenAI from 'openai';
import { BadRequestException, ServiceUnavailableException } from '@nestjs/common';
import { readFile } from 'node:fs/promises';
import { basename, extname, join } from 'node:path';
import { RECEIPT_URL_PATTERN, RECEIPTS_DIR } from '../uploads/receipt-files.js';

const DEFAULT_MODEL = 'gpt-5.4-mini';
const NO_CATEGORY = 'none';

const MEDIA_TYPES: Record<string, string> = {
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.webp': 'image/webp',
  '.pdf': 'application/pdf',
};

export interface ReceiptCategory {
  id: string;
  name: string;
}

export interface ReceiptLine {
  title: string;
  amount: number;
}

export interface ReadReceipt {
  categoryId: string | null;
  total: number | null;
  title: string;
  date: string | null;
  items: ReceiptLine[];
}

export interface ReadCategoryLine {
  name: string;
  budget: number | null;
}

let client: OpenAI | null = null;

const money = (n: number | null) => (n !== null && n > 0 ? Math.round(n * 100) / 100 : null);

/** Sends an uploaded image or PDF to OpenAI and returns its JSON answer, shaped by `schema`. */
async function askAboutUpload<T>(uploadUrl: string, name: string, schema: Record<string, unknown>, prompt: string): Promise<T> {
  if (!RECEIPT_URL_PATTERN.test(uploadUrl)) throw new BadRequestException('receiptUrl must be an uploaded receipt');
  if (!process.env.OPENAI_API_KEY) {
    throw new ServiceUnavailableException('Reading images needs OPENAI_API_KEY in the backend .env');
  }
  client ??= new OpenAI();

  const file = basename(uploadUrl);
  const ext = extname(file).toLowerCase();
  const dataUrl = `data:${MEDIA_TYPES[ext]};base64,${(await readFile(join(RECEIPTS_DIR, file))).toString('base64')}`;
  const source: OpenAI.Chat.ChatCompletionContentPart =
    ext === '.pdf'
      ? { type: 'file', file: { filename: file, file_data: dataUrl } }
      : { type: 'image_url', image_url: { url: dataUrl } };

  let completion: OpenAI.Chat.ChatCompletion;
  try {
    completion = await client.chat.completions.create({
      model: process.env.OPENAI_MODEL || DEFAULT_MODEL,
      max_completion_tokens: 8000,
      response_format: { type: 'json_schema', json_schema: { name, strict: true, schema } },
      messages: [{ role: 'user', content: [source, { type: 'text', text: prompt }] }],
    });
  } catch (err) {
    if (err instanceof OpenAI.AuthenticationError) throw new ServiceUnavailableException('OPENAI_API_KEY is invalid');
    if (err instanceof OpenAI.RateLimitError) {
      throw new ServiceUnavailableException('OpenAI rate limit or quota reached — check billing and try again');
    }
    throw err;
  }

  const message = completion.choices[0]?.message;
  if (!message?.content || message.refusal) throw new BadRequestException('The image could not be read');
  return JSON.parse(message.content) as T;
}

/** Reads the lines written on an uploaded receipt image or PDF. */
export async function readReceipt(receiptUrl: string, categories: ReceiptCategory[], today: string): Promise<ReadReceipt> {
  const categoryList = categories.map((c) => `- ${c.id}: ${c.name}`).join('\n');
  const out = await askAboutUpload<ReadReceipt>(
    receiptUrl,
    'receipt',
    {
      type: 'object',
      additionalProperties: false,
      required: ['categoryId', 'total', 'title', 'date', 'items'],
      properties: {
        categoryId: { type: 'string', enum: [...categories.map((c) => c.id), NO_CATEGORY] },
        total: { type: ['number', 'null'] },
        title: { type: 'string' },
        date: { type: ['string', 'null'] },
        items: {
          type: 'array',
          items: {
            type: 'object',
            additionalProperties: false,
            required: ['title', 'amount'],
            properties: { title: { type: 'string' }, amount: { type: 'number' } },
          },
        },
      },
    },
    `This image is a receipt, bill or handwritten list of expenses. Today is ${today}. Amounts are in PKR.

Categories the user can record expenses in:
${categoryList}

Return:
- items: every line that has its own amount, in the order written, with a short title and the amount as a number. Skip subtotal, tax and total lines.
- total: the grand total paid as a number, or null if none is written.
- title: a short description of the whole receipt, under 80 characters, e.g. "Grocery at Imtiaz".
- categoryId: the id of the category that best fits, or "${NO_CATEGORY}" if none fits.
- date: the date on the receipt as YYYY-MM-DD, or null if there is none.`,
  );

  const items = out.items
    .map((line) => ({ title: line.title.trim().slice(0, 200), amount: money(line.amount) }))
    .filter((line): line is ReceiptLine => !!line.title && line.amount !== null);
  return {
    categoryId: categories.some((c) => c.id === out.categoryId) ? out.categoryId : null,
    total: money(out.total) ?? money(items.reduce((sum, line) => sum + line.amount, 0)),
    title: out.title.trim().slice(0, 200) || 'Receipt',
    date: out.date && /^\d{4}-\d{2}-\d{2}$/.test(out.date) && out.date <= today ? out.date : null,
    items,
  };
}

/** Reads a written or printed list of expense categories, each with an optional monthly budget. */
export async function readCategoryList(uploadUrl: string): Promise<ReadCategoryLine[]> {
  const out = await askAboutUpload<{ categories: ReadCategoryLine[] }>(
    uploadUrl,
    'category_list',
    {
      type: 'object',
      additionalProperties: false,
      required: ['categories'],
      properties: {
        categories: {
          type: 'array',
          items: {
            type: 'object',
            additionalProperties: false,
            required: ['name', 'budget'],
            properties: { name: { type: 'string' }, budget: { type: ['number', 'null'] } },
          },
        },
      },
    },
    `This image is a handwritten or printed list of expense categories to create, e.g. "Food 20000, Travel 5000". Amounts are monthly budgets in PKR.

Return categories: one entry per line, in the order written, with
- name: the category name in Title Case, under 40 characters, e.g. "Office Supplies".
- budget: the budget as a number, or null if the line has no amount.`,
  );

  return out.categories
    .map((line) => ({ name: line.name.trim().slice(0, 100), budget: money(line.budget) }))
    .filter((line) => !!line.name);
}
