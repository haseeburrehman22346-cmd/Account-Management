import OpenAI from 'openai';
import { BadRequestException, ServiceUnavailableException } from '@nestjs/common';
import { readFile } from 'node:fs/promises';
import { basename, extname, join } from 'node:path';
import { RECEIPT_URL_PATTERN, RECEIPTS_DIR } from '../uploads/receipt-files.js';
import { CATEGORY_ICONS } from './voice-ai.js';

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
  categoryId: string | null;
}

export interface ReadReceipt {
  categoryId: string | null;
  writtenCategory: string;
  /** Icon for `writtenCategory`, in case it gets created. */
  icon: CategoryIcon;
  total: number | null;
  title: string;
  date: string | null;
  items: ReceiptLine[];
}

export interface ReadCategoryLine {
  name: string;
  budget: number | null;
  icon: CategoryIcon;
}

type CategoryIcon = (typeof CATEGORY_ICONS)[number];

let client: OpenAI | null = null;

const ICON_SCHEMA = { type: 'string', enum: CATEGORY_ICONS };
const knownIcon = (icon: string): CategoryIcon => (CATEGORY_ICONS.includes(icon as CategoryIcon) ? (icon as CategoryIcon) : 'folder');

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
      : { type: 'image_url', image_url: { url: dataUrl, detail: 'high' } };

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
  const categoryEnum = { type: 'string', enum: [...categories.map((c) => c.id), NO_CATEGORY] };
  const out = await askAboutUpload<ReadReceipt>(
    receiptUrl,
    'receipt',
    {
      type: 'object',
      additionalProperties: false,
      required: ['writtenCategory', 'icon', 'categoryId', 'total', 'title', 'date', 'items'],
      properties: {
        writtenCategory: { type: 'string' },
        icon: ICON_SCHEMA,
        categoryId: categoryEnum,
        total: { type: ['number', 'null'] },
        title: { type: 'string' },
        date: { type: ['string', 'null'] },
        items: {
          type: 'array',
          items: {
            type: 'object',
            additionalProperties: false,
            required: ['title', 'amount', 'categoryId'],
            properties: { title: { type: 'string' }, amount: { type: 'number' }, categoryId: categoryEnum },
          },
        },
      },
    },
    `This image is a receipt, bill or handwritten list of expenses. Today is ${today}. Amounts are in PKR. Handwriting can be unclear, so read words by their most likely meaning.

Categories the user can record expenses in (id: name):
${categoryList}

Return:
- writtenCategory: the category name written on the image, in Title Case; empty string if none is written. When there is a "Category" or "Categories" heading or column, this is the word written under or next to it, never the heading word itself.
- icon: the icon that best fits writtenCategory; "folder" when none fits or nothing is written.
- categoryId: when a category is written, the id of the existing category with that name, allowing for unclear handwriting and spelling; "${NO_CATEGORY}" when the written category is not in the list, never a different category instead. When nothing is written, the category that best fits the items, or "${NO_CATEGORY}".
- items: every line that has its own amount, in the order written, with a short title, the amount as a number, and categoryId: the category written next to that line if the list gives one per line, otherwise the same as the overall categoryId. Skip subtotal, tax and total lines and the header row.
- total: the grand total paid as a number, or null if none is written.
- title: a short description of the whole receipt, under 80 characters.
- date: the date on the receipt as YYYY-MM-DD, or null if there is none.`,
  );

  const known = (id: string | null | undefined) => (categories.some((c) => c.id === id) ? id! : null);
  const writtenCategory = out.writtenCategory.trim().slice(0, 100);
  const categoryId = known(out.categoryId);
  const items = out.items
    .map((line) => ({
      title: line.title.trim().slice(0, 200),
      amount: money(line.amount),
      categoryId: known(line.categoryId) ?? categoryId,
    }))
    .filter((line): line is ReceiptLine => !!line.title && line.amount !== null);
  return {
    categoryId,
    writtenCategory,
    icon: knownIcon(out.icon),
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
            required: ['name', 'budget', 'icon'],
            properties: { name: { type: 'string' }, budget: { type: ['number', 'null'] }, icon: ICON_SCHEMA },
          },
        },
      },
    },
    `This image is a handwritten or printed list of expense categories to create. Amounts are monthly budgets in PKR.

Return categories: one entry per line, in the order written, with
- name: the category name in Title Case, under 40 characters.
- budget: the budget as a number, or null if the line has no amount.
- icon: the icon that best fits the category; "folder" when none fits.`,
  );

  return out.categories
    .map((line) => ({ name: line.name.trim().slice(0, 100), budget: money(line.budget), icon: knownIcon(line.icon) }))
    .filter((line) => !!line.name);
}
