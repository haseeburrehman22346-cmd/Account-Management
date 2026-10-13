import { Injectable, ServiceUnavailableException } from '@nestjs/common';
import type { AuthUser } from '../auth/auth.types.js';
import { CategoriesService } from '../categories/categories.service.js';
import { ExpensesService } from '../expenses/expenses.service.js';
import { UsersService } from '../users/users.service.js';
import { deleteReceiptFiles } from '../uploads/receipt-files.js';
import type { CategoryInput } from '../categories/categories.dto.js';
import { readCategoryList, readReceipt } from './receipt-reader.js';
import { readVoiceIntent, type VoiceIntent } from './voice-ai.js';

type VoicePage = VoiceIntent['page'];
type VoiceTheme = VoiceIntent['theme'];

/** Same order as the frontend palette, so new categories get distinguishable colors. */
const PALETTE = ['blue', 'orange', 'aqua', 'yellow', 'magenta', 'green', 'violet', 'red', 'slate'];

type CategoryDto = Awaited<ReturnType<CategoriesService['list']>>[number];
type ExpenseDto = Awaited<ReturnType<ExpensesService['findVisible']>>;

/** What the frontend should do after a voice command; deletes are confirmed there before anything is removed. */
export type VoiceAction =
  | { type: 'none' }
  | { type: 'navigate'; page: VoicePage | 'category'; categoryId?: string; q?: string }
  | { type: 'confirm-delete'; target: 'category' | 'expense' | 'user'; id: string; title: string; description: string }
  | { type: 'edit-category'; category: CategoryDto }
  | { type: 'edit-expense'; expense: ExpenseDto }
  | { type: 'new-category' }
  | { type: 'new-expense'; categoryId: string; categories: CategoryDto[] }
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

const ADMIN_COMMANDS = new Set<string>([
  'access',
  'category-status',
  'user-status',
  'budget',
  'delete-category',
  'delete-user',
  'create-category',
  'rename-category',
  'edit-category',
  'new-category-form',
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

const todayIso = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};

type Command =
  | { type: 'navigate'; page: VoicePage; q: string }
  | { type: 'open-category'; categoryId: string; q: string }
  | { type: 'access'; grant: boolean; categoryId: string | null; userIds: string[] }
  | { type: 'category-status'; categoryId: string; active: boolean }
  | { type: 'user-status'; userId: string; active: boolean }
  | { type: 'budget'; categoryId: string; budget: number }
  | { type: 'rename-category'; categoryId: string; name: string }
  | { type: 'edit-category'; categoryId: string }
  | { type: 'edit-expense'; categoryId: string | null; q: string; previous: boolean }
  | { type: 'delete-category'; categoryId: string }
  | { type: 'delete-user'; userId: string }
  | { type: 'update-expense'; categoryId: string | null; q: string; previous: boolean; updates: VoiceIntent['updates'] }
  | { type: 'delete-expense'; categoryId: string | null; q: string; previous: boolean }
  | { type: 'total'; categoryId: string | null; period: VoiceIntent['period'] }
  | { type: 'theme'; theme: VoiceTheme }
  | { type: 'new-expense-form'; categoryId: string | null }
  | { type: 'create-category' | 'add-expense' | 'new-category-form' | 'back' | 'logout' | 'help' | 'unknown' };

interface RememberedExpense {
  id: string;
  title: string;
  category: string;
  amount: number;
  date: string;
}

interface Conversation {
  turns: { said: string; reply: string }[];
  lastExpense: RememberedExpense | null;
  at: number;
}

const AI_UNAVAILABLE = "Voice needs OpenAI and it couldn't be reached — check OPENAI_API_KEY in the backend .env and try again";
const CONVERSATION_TTL_MS = 10 * 60 * 1000;
const CONVERSATION_TURNS = 4;

const remember = (e: { id: string; title: string; amount: number; date: string; category: { name: string } }) => ({
  id: e.id,
  title: e.title,
  category: e.category.name,
  amount: e.amount,
  date: e.date,
});

const sameName = (a: string, b: string) => a.trim().toLowerCase() === b.trim().toLowerCase();

/** Turns the AI's reading into a command; null when it lacks what the command needs. */
export function toCommand(ai: VoiceIntent): Command | null {
  const { categoryId, userIds, q } = ai;
  switch (ai.intent) {
    case 'update-expense':
      return { type: 'update-expense', categoryId, q, previous: ai.target === 'previous' || !q, updates: ai.updates };
    case 'total':
      return { type: 'total', categoryId, period: ai.period };
    case 'navigate':
      return { type: 'navigate', page: ai.page, q };
    case 'open-category':
      if (categoryId) return { type: 'open-category', categoryId, q };
      return q ? { type: 'navigate', page: 'expenses', q } : { type: 'navigate', page: 'categories', q: '' };
    case 'access':
      return { type: 'access', grant: ai.grant, categoryId, userIds };
    case 'category-status':
      return categoryId ? { type: 'category-status', categoryId, active: ai.active } : null;
    case 'user-status':
      return userIds.length === 1 ? { type: 'user-status', userId: userIds[0], active: ai.active } : null;
    case 'budget':
      return categoryId && ai.amount !== null ? { type: 'budget', categoryId, budget: ai.amount } : null;
    case 'rename-category':
      return categoryId && ai.name ? { type: 'rename-category', categoryId, name: ai.name } : null;
    case 'edit-category':
      return categoryId ? { type: 'edit-category', categoryId } : null;
    case 'edit-expense':
      return { type: 'edit-expense', categoryId, q, previous: ai.target === 'previous' || !q };
    case 'delete-category':
      return categoryId ? { type: 'delete-category', categoryId } : null;
    case 'delete-user':
      return userIds.length === 1 ? { type: 'delete-user', userId: userIds[0] } : null;
    case 'delete-expense':
      return { type: 'delete-expense', categoryId, q, previous: ai.target === 'previous' || !q };
    case 'theme':
      return { type: 'theme', theme: ai.theme };
    case 'new-expense-form':
      return { type: 'new-expense-form', categoryId };
    default:
      return { type: ai.intent };
  }
}

@Injectable()
export class VoiceService {
  /** Recent turns per user, so follow-ups like "ab iski amount 2000 kar do" make sense. Kept in memory only. */
  private readonly conversations = new Map<string, Conversation>();

  constructor(
    private readonly categories: CategoriesService,
    private readonly expenses: ExpensesService,
    private readonly users: UsersService,
  ) {}

  /** Matches only against categories this user may add expenses to. */
  async parse(transcript: string, user: AuthUser, ai?: VoiceIntent) {
    const categories = (await this.categories.list(user)).filter((c) => c.canAddExpense);
    const today = todayIso();
    ai ??= (await readVoiceIntent(transcript, { categories, users: [], isAdmin: false, today, force: 'add-expense' })) ?? undefined;
    if (!ai) throw new ServiceUnavailableException(AI_UNAVAILABLE);

    const found = categories.find((c) => c.id === ai.categoryId);
    const category = found ? { id: found.id, name: found.name, icon: found.icon, color: found.color } : null;
    const missing: ('category' | 'amount')[] = [];
    if (!category) missing.push('category');
    if (ai.amount === null) missing.push('amount');

    return {
      transcript: transcript.trim(),
      category,
      amount: ai.amount,
      title: ai.title || category?.name || '',
      date: ai.date ?? today,
      missing,
    };
  }

  /** Creates the expense when the sentence names a category and an amount; otherwise returns the parse for review. */
  async createExpense(transcript: string, user: AuthUser, receiptUrl: string | null = null, ai?: VoiceIntent) {
    const parsed = await this.parse(transcript, user, ai);
    if (!parsed.category || parsed.amount === null) return { parsed, expense: null };

    const expense = await this.expenses.create(
      parsed.category.id,
      {
        title: parsed.title,
        amount: parsed.amount,
        date: parsed.date,
        receiptUrl,
        ...(ai?.paidById && { paidById: ai.paidById }),
      },
      user,
    );
    return { parsed, expense };
  }

  /** Reads the lines of an uploaded receipt for the user to review; nothing is saved. */
  async readReceipt(receiptUrl: string, user: AuthUser) {
    const all = await this.categories.list(user);
    const categories = all.filter((c) => c.canAddExpense);
    const read = await readReceipt(receiptUrl, categories, todayIso());
    const category = categories.find((c) => c.id === read.categoryId);
    const used = new Set(all.map((c) => c.color));
    return {
      receiptUrl,
      title: read.title,
      date: read.date ?? todayIso(),
      total: read.total,
      category: category ? { id: category.id, name: category.name, icon: category.icon, color: category.color } : null,
      writtenCategory: read.writtenCategory,
      // A category written on the image that doesn't exist yet, ready for an admin to create.
      newCategory:
        read.writtenCategory && !category && user.role === 'admin'
          ? {
              name: read.writtenCategory,
              icon: read.icon,
              color: PALETTE.find((c) => !used.has(c)) ?? PALETTE[all.length % PALETTE.length],
            }
          : null,
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
          icon: line.icon,
          color: free[i] ?? PALETTE[(existing.length + i) % PALETTE.length],
          duplicate: existing.find((c) => sameName(c.name, line.name)) ?? null,
        })),
      };
    } finally {
      await deleteReceiptFiles([uploadUrl]);
    }
  }

  /** Admin only: creates a category from e.g. "category food budget 20000 for Ali". */
  async createCategory(transcript: string, admin: AuthUser, ai?: VoiceIntent) {
    const [users, existing] = await Promise.all([this.users.list(), this.categories.list(admin)]);
    const activeUsers = users.filter((u) => u.active);
    ai ??=
      (await readVoiceIntent(transcript, {
        categories: existing,
        users: activeUsers,
        isAdmin: true,
        today: todayIso(),
        force: 'create-category',
      })) ?? undefined;
    if (!ai) throw new ServiceUnavailableException(AI_UNAVAILABLE);

    const { name, icon, amount: budget } = ai;
    const assigned = activeUsers.filter((u) => ai.userIds.includes(u.id));
    const duplicate = (name && existing.find((c) => sameName(c.name, name))) || null;
    const missing: 'name'[] = name ? [] : ['name'];
    const used = new Set(existing.map((c) => c.color));
    const color = PALETTE.find((c) => !used.has(c)) ?? PALETTE[existing.length % PALETTE.length];

    const result = {
      transcript: transcript.trim(),
      name,
      budget,
      icon,
      color,
      users: assigned.map((u) => ({ id: u.id, name: u.name })),
      duplicate,
      missing,
    };
    if (missing.length || duplicate) return { parsed: result, category: null };

    const category = await this.categories.create(
      {
        name,
        description: '',
        icon,
        color,
        budgetLimit: budget,
        status: 'active',
        assignedUserIds: assigned.map((u) => u.id),
      },
      admin,
    );
    return { parsed: result, category };
  }

  /** Runs a spoken command such as "show all categories" or "give Ali access to Food" with the caller's permissions. */
  async command(transcript: string, user: AuthUser, mode?: 'expense' | 'category'): Promise<VoiceCommandResult> {
    const now = Date.now();
    for (const [id, c] of this.conversations) if (now - c.at > CONVERSATION_TTL_MS) this.conversations.delete(id);
    const conversation = this.conversations.get(user.id) ?? { turns: [], lastExpense: null, at: now };

    const result = await this.run(transcript, user, mode, conversation);
    conversation.turns = [...conversation.turns, { said: transcript.trim(), reply: result.message }].slice(-CONVERSATION_TURNS);
    conversation.at = Date.now();
    this.conversations.set(user.id, conversation);
    return result;
  }

  private async run(
    transcript: string,
    user: AuthUser,
    mode: 'expense' | 'category' | undefined,
    conversation: Conversation,
  ): Promise<VoiceCommandResult> {
    const isAdmin = user.role === 'admin';
    const [categories, users] = await Promise.all([this.categories.list(user), isAdmin ? this.users.list() : []]);
    const ai = await readVoiceIntent(transcript, {
      categories,
      users,
      isAdmin,
      today: todayIso(),
      mode,
      history: conversation.turns,
      lastExpense: conversation.lastExpense,
    });
    if (!ai) {
      return { transcript: transcript.trim(), ok: false, message: AI_UNAVAILABLE, action: { type: 'none' }, changed: false, entry: null };
    }
    const command: Command = toCommand(ai) ?? { type: 'unknown' };

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
    // The AI asks rather than guesses; new entries keep their review card and use its question as the message.
    const question = ai.clarification;
    if (question && command.type !== 'add-expense' && command.type !== 'create-category') return fail(question);

    /** The expense a sentence points at: the one from the previous turn, or the single one matching its words. */
    const findExpense = async (c: { categoryId: string | null; q: string; previous?: boolean }) => {
      const last = conversation.lastExpense;
      if (c.previous && last) {
        try {
          return await this.expenses.findVisible(last.id, user);
        } catch {
          conversation.lastExpense = null;
          return fail(`"${last.title}" no longer exists`);
        }
      }
      if (!c.q) return fail('Which expense? Say its name, for example "Dell battery ka amount 1500 kar do"');
      const found = await this.expenses.search(user, { q: c.q, categoryId: c.categoryId ?? undefined, page: 1, limit: 2 });
      const hit = found.items[0];
      if (!hit) return fail(`No expense matching "${c.q}"`);
      if (found.total > 1) {
        return done(
          `${found.total} expenses match "${c.q}" — say which one, or pick it from the list`,
          isAdmin && !c.categoryId
            ? { type: 'navigate', page: 'expenses', q: c.q }
            : { type: 'navigate', page: 'category', categoryId: c.categoryId ?? hit.categoryId, q: c.q },
        );
      }
      return hit;
    };
    const isReply = (r: Awaited<ReturnType<typeof findExpense>>): r is VoiceCommandResult => 'ok' in r;

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

      case 'rename-category': {
        const c = category(command.categoryId);
        const taken = categories.find((x) => x.id !== c.id && sameName(x.name, command.name));
        if (taken) return fail(`A category called ${taken.name} already exists`);
        if (c.name === command.name) return done(`The category is already called ${c.name}`);
        await this.updateCategory(c, { name: command.name }, user);
        return done(`${c.name} renamed to ${command.name}`, undefined, true);
      }

      case 'edit-category': {
        const c = category(command.categoryId);
        return done(`Editing ${c.name}`, { type: 'edit-category', category: c });
      }

      case 'edit-expense': {
        const hit = await findExpense(command);
        if (isReply(hit)) return hit;
        if (!hit.canEdit) return fail('You can only change expenses you added');
        conversation.lastExpense = remember(hit);
        return done(`Editing ${hit.title}`, { type: 'edit-expense', expense: hit });
      }

      case 'new-category-form':
        return done('Opening the add category form', { type: 'new-category' });

      case 'new-expense-form': {
        const usable = categories.filter((c) => c.canAddExpense);
        if (!usable.length) return fail('There is no category you can add expenses to yet');
        const chosen = usable.find((c) => c.id === command.categoryId) ?? usable[0];
        return done('Opening the add expense form', { type: 'new-expense', categoryId: chosen.id, categories: usable });
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

      case 'update-expense': {
        const { updates } = command;
        if (updates.amount === null && !updates.title && !updates.date) {
          return fail('What should I change? Say for example "iski amount 2000 kar do"');
        }
        const hit = await findExpense(command);
        if (isReply(hit)) return hit;
        if (!hit.canEdit) return fail('You can only change expenses you added');

        const updated = await this.expenses.update(
          hit.id,
          {
            title: updates.title || hit.title,
            amount: updates.amount ?? hit.amount,
            date: updates.date ?? hit.date,
            note: hit.note,
            receiptUrl: hit.receiptUrl,
          },
          user,
        );
        conversation.lastExpense = remember(updated);
        const changes = [
          updates.amount !== null && `amount ${money(hit.amount)} → ${money(updated.amount)}`,
          updates.title && `title "${hit.title}" → "${updated.title}"`,
          updates.date && `date ${hit.date} → ${updated.date}`,
        ].filter(Boolean);
        return done(`${updated.title} updated: ${changes.join(', ')}`, undefined, true);
      }

      case 'total': {
        const scope = command.categoryId ? categories.filter((c) => c.id === command.categoryId) : categories;
        const month = command.period === 'this-month';
        const spent = scope.reduce((sum, c) => sum + (month ? c.thisMonthSpent : c.totalSpent), 0);
        const count = scope.reduce((sum, c) => sum + (month ? c.thisMonthCount : c.expenseCount), 0);
        const where = command.categoryId ? scope[0].name : isAdmin ? 'All categories' : 'Your categories';
        return done(
          `${where}: ${money(Math.round(spent * 100) / 100)} ${month ? 'this month' : 'in total'} (${count} expense${count === 1 ? '' : 's'})`,
        );
      }

      case 'delete-expense': {
        if (!command.q && !command.previous) return fail('Which expense? Say for example "delete expense lunch"');
        const hit = await findExpense(command);
        if (isReply(hit)) return hit;
        if (!hit.canEdit) return fail('You can only delete expenses you added');
        conversation.lastExpense = remember(hit);
        return done(`Delete ${hit.title}?`, {
          type: 'confirm-delete',
          target: 'expense',
          id: hit.id,
          title: `Delete "${hit.title}"?`,
          description: `${money(hit.amount)} in ${hit.category.name} on ${hit.date}. This can't be undone.`,
        });
      }

      case 'create-category': {
        const result = await this.createCategory(transcript, user, ai);
        const { parsed, category: created } = result;
        const entry = { kind: 'category' as const, ...result };
        if (created) {
          return {
            ...done(`Category "${created.name}" created`, { type: 'navigate', page: 'categories' }, true),
            entry,
          };
        }
        if (parsed.duplicate) return { ...fail(`A category called ${parsed.duplicate.name} already exists`), entry };
        return {
          ...fail(question || 'What should the category be called? Say for example "create category travel budget 5000"'),
          entry,
        };
      }

      case 'add-expense': {
        const result = await this.createExpense(transcript, user, null, ai);
        const { parsed, expense } = result;
        const entry = { kind: 'expense' as const, ...result };
        if (expense) {
          conversation.lastExpense = remember(expense);
          const by = expense.paidBy.id !== user.id ? ` (paid by ${expense.paidBy.name})` : '';
          return {
            ...done(
              `${expense.title}: ${money(expense.amount)} added to ${expense.category.name}${by}`,
              isAdmin ? { type: 'navigate', page: 'expenses' } : { type: 'navigate', page: 'category', categoryId: expense.categoryId },
              true,
            ),
            entry,
          };
        }
        return {
          ...fail(
            question ||
              (parsed.missing.includes('category')
                ? 'Which category? Say for example "food 500 lunch"'
                : 'How much was it? Say for example "food 500 lunch"'),
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
        return done('Say what you want in your own words: add, show, change or delete a category or an expense', { type: 'help' });
      default:
        return fail(
          ai.intent === 'unknown'
            ? `Sorry, I didn't understand "${transcript.trim()}"`
            : "I couldn't tell which category or user you mean — say the name as it appears in the app",
        );
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
