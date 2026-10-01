import { Injectable } from '@nestjs/common';
import type { AuthUser } from '../auth/auth.types.js';
import { CategoriesService } from '../categories/categories.service.js';
import { ExpensesService } from '../expenses/expenses.service.js';
import { UsersService } from '../users/users.service.js';
import { deleteReceiptFiles } from '../uploads/receipt-files.js';
import { parseVoiceCategory, pickCategoryIcon } from './voice-category-parser.js';
import { parseVoiceExpense } from './voice-parser.js';
import { readCategoryList, readReceipt } from './receipt-reader.js';

/** Same order as the frontend palette, so new categories get distinguishable colors. */
const PALETTE = ['blue', 'orange', 'aqua', 'yellow', 'magenta', 'green', 'violet', 'red', 'slate'];

@Injectable()
export class VoiceService {
  constructor(
    private readonly categories: CategoriesService,
    private readonly expenses: ExpensesService,
    private readonly users: UsersService,
  ) {}

  /** Matches only against categories this user may add expenses to. */
  async parse(transcript: string, user: AuthUser) {
    const categories = (await this.categories.list(user)).filter((c) => c.canAddExpense);
    const parsed = parseVoiceExpense(transcript, categories);
    const ref = (id: string | null) => {
      const c = categories.find((x) => x.id === id);
      return c ? { id: c.id, name: c.name, icon: c.icon, color: c.color } : null;
    };

    return {
      transcript: parsed.transcript,
      category: ref(parsed.categoryId),
      alternatives: parsed.alternativeCategoryIds.map(ref).filter((c) => c !== null),
      amount: parsed.amount,
      title: parsed.title,
      date: parsed.date,
      missing: parsed.missing,
    };
  }

  /** Creates the expense when the sentence names a category and an amount; otherwise returns the parse for review. */
  async createExpense(transcript: string, user: AuthUser, receiptUrl: string | null = null) {
    const parsed = await this.parse(transcript, user);
    if (!parsed.category || parsed.amount === null) return { parsed, expense: null };

    const expense = await this.expenses.create(
      parsed.category.id,
      {
        title: parsed.title,
        amount: parsed.amount,
        date: parsed.date,
        note: `Voice: "${parsed.transcript}"`.slice(0, 1000),
        receiptUrl,
      },
      user,
    );
    return { parsed, expense };
  }

  /** Reads the lines of an uploaded receipt for the user to review; nothing is saved. */
  async readReceipt(receiptUrl: string, user: AuthUser) {
    const categories = (await this.categories.list(user)).filter((c) => c.canAddExpense);
    const today = new Date();
    const todayIso = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;
    const read = await readReceipt(receiptUrl, categories, todayIso);
    const category = categories.find((c) => c.id === read.categoryId);
    return {
      receiptUrl,
      title: read.title,
      date: read.date ?? todayIso,
      total: read.total,
      category: category ? { id: category.id, name: category.name, icon: category.icon, color: category.color } : null,
      items: read.items,
    };
  }

  /** Admin only: reads a list of categories from an uploaded image for review; nothing is created. */
  async readCategoryImage(uploadUrl: string, admin: AuthUser) {
    try {
      const [lines, existing] = await Promise.all([readCategoryList(uploadUrl), this.categories.list(admin)]);
      const used = new Set(existing.map((c) => c.color));
      const free = PALETTE.filter((c) => !used.has(c));
      return {
        categories: lines.map((line, i) => ({
          name: line.name,
          budget: line.budget,
          icon: pickCategoryIcon(line.name),
          color: free[i] ?? PALETTE[(existing.length + i) % PALETTE.length],
          duplicate: existing.find((c) => c.name.toLowerCase() === line.name.toLowerCase()) ?? null,
        })),
      };
    } finally {
      await deleteReceiptFiles([uploadUrl]);
    }
  }

  /** Admin only: creates a category from e.g. "category food budget 20000 for Ali". */
  async createCategory(transcript: string, admin: AuthUser) {
    const [users, existing] = await Promise.all([this.users.list(), this.categories.list(admin)]);
    const parsed = parseVoiceCategory(
      transcript,
      users.filter((u) => u.active),
      existing,
    );
    const used = new Set(existing.map((c) => c.color));
    const color = PALETTE.find((c) => !used.has(c)) ?? PALETTE[existing.length % PALETTE.length];

    const result = {
      transcript: parsed.transcript,
      name: parsed.name,
      budget: parsed.budget,
      icon: parsed.icon,
      color,
      users: users.filter((u) => parsed.userIds.includes(u.id)).map((u) => ({ id: u.id, name: u.name })),
      duplicate: existing.find((c) => c.id === parsed.duplicateOf) ?? null,
      missing: parsed.missing,
    };
    if (parsed.missing.length || parsed.duplicateOf) return { parsed: result, category: null };

    const category = await this.categories.create(
      {
        name: parsed.name,
        description: '',
        icon: parsed.icon,
        color,
        budgetLimit: parsed.budget,
        status: 'active',
        assignedUserIds: parsed.userIds,
      },
      admin,
    );
    return { parsed: result, category };
  }
}
