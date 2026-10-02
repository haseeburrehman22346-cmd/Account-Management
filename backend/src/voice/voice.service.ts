import { Injectable } from '@nestjs/common';
import type { AuthUser } from '../auth/auth.types.js';
import { CategoriesService } from '../categories/categories.service.js';
import { ExpensesService } from '../expenses/expenses.service.js';
import { UsersService } from '../users/users.service.js';
import { deleteReceiptFiles } from '../uploads/receipt-files.js';
import type { CategoryInput } from '../categories/categories.dto.js';
import { parseVoiceCategory, pickCategoryIcon } from './voice-category-parser.js';
import { parseVoiceCommand, type VoiceCommand, type VoicePage, type VoiceTheme } from './voice-command-parser.js';
import { parseVoiceExpense } from './voice-parser.js';
import { readCategoryList, readReceipt } from './receipt-reader.js';

/** Same order as the frontend palette, so new categories get distinguishable colors. */
const PALETTE = ['blue', 'orange', 'aqua', 'yellow', 'magenta', 'green', 'violet', 'red', 'slate'];

type CategoryDto = Awaited<ReturnType<CategoriesService['list']>>[number];

/** What the frontend should do after a voice command; deletes are confirmed there before anything is removed. */
export type VoiceAction =
  | { type: 'none' }
  | { type: 'navigate'; page: VoicePage | 'category'; categoryId?: string; q?: string }
  | { type: 'confirm-delete'; target: 'category' | 'expense' | 'user'; id: string; title: string; description: string }
  | { type: 'theme'; theme: VoiceTheme }
  | { type: 'back' }
  | { type: 'logout' }
  | { type: 'help' };

export interface VoiceCommandResult {
  transcript: string;
  ok: boolean;
  message: string;
  action: VoiceAction;
  /** True when data was changed, so open pages should refetch. */
  changed: boolean;
  /** Set for add-expense and create-category sentences, so the Voice Entry page can show its review card. */
  entry: VoiceEntryResult | null;
}

type VoiceEntryResult =
  | ({ kind: 'expense' } & Awaited<ReturnType<VoiceService['createExpense']>>)
  | ({ kind: 'category' } & Awaited<ReturnType<VoiceService['createCategory']>>);

const ADMIN_COMMANDS = new Set<VoiceCommand['type']>([
  'access',
  'category-status',
  'user-status',
  'budget',
  'delete-category',
  'delete-user',
  'create-category',
]);

const PAGE_LABELS: Record<VoicePage, string> = {
  overview: 'the dashboard',
  categories: 'categories',
  expenses: 'expenses',
  users: 'users',
  settings: 'settings',
  voice: 'voice entry',
};

const money = (amount: number) => `PKR ${amount.toLocaleString('en-US')}`;

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

  /** Runs a spoken command such as "show all categories" or "give Ali access to Food" with the caller's permissions. */
  async command(transcript: string, user: AuthUser, mode?: 'expense' | 'category'): Promise<VoiceCommandResult> {
    const isAdmin = user.role === 'admin';
    const [categories, users] = await Promise.all([this.categories.list(user), isAdmin ? this.users.list() : []]);
    let command = parseVoiceCommand(transcript, categories, users);
    // On the Voice Entry page a sentence that isn't a command is an entry for the open tab.
    if (mode === 'category' && isAdmin && (command.type === 'unknown' || command.type === 'add-expense')) {
      command = { type: 'create-category' };
    } else if (mode === 'expense' && command.type === 'unknown') {
      command = { type: 'add-expense' };
    }

    const done = (message: string, action: VoiceAction = { type: 'none' }, changed = false): VoiceCommandResult => ({
      transcript: transcript.trim(),
      ok: true,
      message,
      action,
      changed,
      entry: null,
    });
    const fail = (message: string) => ({ ...done(message), ok: false });
    const category = (id: string) => categories.find((c) => c.id === id)!;

    if (!isAdmin && ADMIN_COMMANDS.has(command.type)) return fail('Only admins can do that');

    switch (command.type) {
      case 'navigate': {
        const { page, q } = command;
        if (page === 'users' && !isAdmin) return fail('Only admins can manage users');
        if (page === 'categories' && q) {
          return done(`No category called "${q}" — showing all categories`, { type: 'navigate', page });
        }
        if (page === 'expenses' && !isAdmin) {
          if (!q) return done('Open a category to see its expenses', { type: 'navigate', page: 'categories' });
          const hit = (await this.expenses.search(user, { q, page: 1, limit: 1 })).items[0];
          if (!hit) return fail(`No expense matching "${q}"`);
          return done(`Showing "${q}" in ${hit.category.name}`, { type: 'navigate', page: 'category', categoryId: hit.categoryId, q });
        }
        return done(q ? `Searching ${PAGE_LABELS[page]} for "${q}"` : `Opening ${PAGE_LABELS[page]}`, { type: 'navigate', page, q });
      }

      case 'open-category': {
        const c = category(command.categoryId);
        return done(command.q ? `Showing "${command.q}" in ${c.name}` : `Opening ${c.name}`, {
          type: 'navigate',
          page: 'category',
          categoryId: c.id,
          q: command.q,
        });
      }

      case 'access': {
        if (!command.categoryId) return fail('Which category? Say for example "give Ali access to Food"');
        const people = users.filter((u) => command.userIds.includes(u.id));
        if (!people.length) return fail("I couldn't match a user — say the name as it appears on the Users page");

        const c = category(command.categoryId);
        const current = c.assignedUsers.map((u) => u.id);
        const next = command.grant
          ? [...new Set([...current, ...command.userIds])]
          : current.filter((id) => !command.userIds.includes(id));
        const who = people.map((u) => u.name).join(' and ');
        if (next.length === current.length) {
          return done(command.grant ? `${who} already can access ${c.name}` : `${who} had no access to ${c.name}`);
        }
        await this.updateCategory(c, { assignedUserIds: next }, user);
        return done(command.grant ? `${who} can now access ${c.name}` : `${who} can no longer access ${c.name}`, undefined, true);
      }

      case 'category-status': {
        const c = category(command.categoryId);
        const status = command.active ? 'active' : 'inactive';
        if (c.status === status) return done(`${c.name} is already ${status}`);
        await this.updateCategory(c, { status }, user);
        return done(`${c.name} is now ${status}`, undefined, true);
      }

      case 'budget': {
        const c = category(command.categoryId);
        await this.updateCategory(c, { budgetLimit: command.budget }, user);
        return done(`${c.name} budget set to ${money(command.budget)}`, undefined, true);
      }

      case 'user-status': {
        const target = users.find((u) => u.id === command.userId)!;
        const status = command.active ? 'active' : 'inactive';
        if (target.active === command.active) return done(`${target.name} is already ${status}`);
        await this.users.update(
          target.id,
          { name: target.name, email: target.email, role: target.role, active: command.active },
          user.id,
        );
        return done(`${target.name} is now ${status}`, undefined, true);
      }

      case 'delete-category': {
        const c = category(command.categoryId);
        return done(`Delete ${c.name}?`, {
          type: 'confirm-delete',
          target: 'category',
          id: c.id,
          title: `Delete "${c.name}"?`,
          description: `This also deletes its ${c.expenseCount} expense(s) and their receipts. This can't be undone.`,
        });
      }

      case 'delete-user': {
        const target = users.find((u) => u.id === command.userId)!;
        if (target.id === user.id) return fail('You cannot delete your own account');
        return done(`Delete ${target.name}?`, {
          type: 'confirm-delete',
          target: 'user',
          id: target.id,
          title: `Delete ${target.name}?`,
          description: "Users who have recorded expenses can't be deleted — deactivate them instead to keep the history.",
        });
      }

      case 'delete-expense': {
        const { q, categoryId } = command;
        if (!q) return fail('Which expense? Say for example "delete expense lunch"');
        const found = await this.expenses.search(user, { q, categoryId: categoryId ?? undefined, page: 1, limit: 2 });
        const hit = found.items[0];
        if (!hit) return fail(`No expense matching "${q}"`);
        if (found.total > 1) {
          return done(
            `${found.total} expenses match "${q}" — delete the one you mean from the list`,
            isAdmin && !categoryId
              ? { type: 'navigate', page: 'expenses', q }
              : { type: 'navigate', page: 'category', categoryId: categoryId ?? hit.categoryId, q },
          );
        }
        if (!hit.canEdit) return fail('You can only delete expenses you added');
        return done(`Delete ${hit.title}?`, {
          type: 'confirm-delete',
          target: 'expense',
          id: hit.id,
          title: `Delete "${hit.title}"?`,
          description: `${money(hit.amount)} in ${hit.category.name} on ${hit.date}. This can't be undone.`,
        });
      }

      case 'create-category': {
        const result = await this.createCategory(transcript, user);
        const { parsed, category: created } = result;
        const entry = { kind: 'category' as const, ...result };
        if (created) return { ...done(`Category "${created.name}" created`, undefined, true), entry };
        if (parsed.duplicate) return { ...fail(`A category called ${parsed.duplicate.name} already exists`), entry };
        return {
          ...fail('What should the category be called? Say for example "create category travel budget 5000"'),
          entry,
        };
      }

      case 'add-expense': {
        const result = await this.createExpense(transcript, user);
        const { parsed, expense } = result;
        const entry = { kind: 'expense' as const, ...result };
        if (expense) return { ...done(`${money(expense.amount)} added to ${expense.category.name}`, undefined, true), entry };
        return {
          ...fail(
            parsed.missing.includes('category')
              ? 'Which category? Say for example "food 500 lunch"'
              : 'How much was it? Say for example "food 500 lunch"',
          ),
          entry,
        };
      }

      case 'theme':
        return done(`Switched to ${command.theme} theme`, { type: 'theme', theme: command.theme });
      case 'back':
        return done('Going back', { type: 'back' });
      case 'logout':
        return done('Logging out', { type: 'logout' });
      case 'help':
        return done('Here is what you can say', { type: 'help' });
      default:
        return fail(`Sorry, I didn't understand "${transcript.trim()}". Say "help" to see what works.`);
    }
  }

  private updateCategory(c: CategoryDto, patch: Partial<CategoryInput>, admin: AuthUser) {
    return this.categories.update(
      c.id,
      {
        name: c.name,
        description: c.description,
        icon: c.icon,
        color: c.color,
        budgetLimit: c.budgetLimit,
        status: c.status,
        assignedUserIds: c.assignedUsers.map((u) => u.id),
        ...patch,
      },
      admin,
    );
  }
}
