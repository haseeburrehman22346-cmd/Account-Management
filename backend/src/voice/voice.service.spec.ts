import { vi } from 'vitest';
import type { AuthUser } from '../auth/auth.types.js';
import { readVoiceIntent, validateVoiceIntent, type VoiceIntent, type VoiceIntentContext } from './voice-ai.js';
import { VoiceService } from './voice.service.js';

// The real services load Mongoose schemas, which need decorator metadata the test transform doesn't emit.
vi.mock('../categories/categories.service.js', () => ({ CategoriesService: class {} }));
vi.mock('../expenses/expenses.service.js', () => ({ ExpensesService: class {} }));
vi.mock('../users/users.service.js', () => ({ UsersService: class {} }));
vi.mock('./voice-ai.js', async (importOriginal) => ({
  ...(await importOriginal<typeof import('./voice-ai.js')>()),
  readVoiceIntent: vi.fn(),
}));

const admin = { id: 'admin', role: 'admin' } as AuthUser;
const member = { id: 'sara', role: 'user' } as AuthUser;

const category = (id: string, name: string, totalSpent: number, thisMonthSpent: number) => ({
  id,
  name,
  icon: 'folder',
  color: 'blue',
  canAddExpense: true,
  totalSpent,
  thisMonthSpent,
  expenseCount: 2,
  thisMonthCount: 1,
  assignedUsers: [],
});
const CATEGORIES = [category('laptop', 'Laptop', 3000, 1000), category('wifi', 'Wifi', 500, 500)];
const USERS = [{ id: 'haseeb', name: 'Haseeb', active: true }];

const expense = (over: Record<string, unknown> = {}) => ({
  id: 'e1',
  categoryId: 'laptop',
  category: { id: 'laptop', name: 'Laptop' },
  title: 'Dell Battery',
  amount: 1000,
  date: '2026-10-02',
  note: 'Voice: "..."',
  receiptUrl: null,
  paidBy: { id: 'haseeb', name: 'Haseeb' },
  canEdit: true,
  ...over,
});

const intent = (over: Partial<VoiceIntent>): VoiceIntent => ({
  intent: 'unknown',
  categoryId: null,
  userIds: [],
  paidById: null,
  amount: null,
  title: '',
  name: '',
  icon: 'folder',
  date: null,
  q: '',
  target: 'none',
  updates: { amount: null, title: '', date: null },
  period: 'all',
  page: 'overview',
  theme: 'system',
  grant: true,
  active: true,
  clarification: '',
  ...over,
});

function setup() {
  const expenses = {
    create: vi.fn(async (categoryId: string, input: { title: string; amount: number; date: string }) =>
      expense({ categoryId, title: input.title, amount: input.amount, date: input.date }),
    ),
    update: vi.fn(async (_id: string, input: { title: string; amount: number; date: string }) =>
      expense({ title: input.title, amount: input.amount, date: input.date }),
    ),
    findVisible: vi.fn(async () => expense()),
    search: vi.fn(async () => ({ items: [expense()], total: 1 })),
  };
  const categories = { list: vi.fn(async () => CATEGORIES), update: vi.fn(), create: vi.fn() };
  const users = { list: vi.fn(async () => USERS), update: vi.fn() };
  const service = new VoiceService(categories as never, expenses as never, users as never);
  const ai = vi.mocked(readVoiceIntent);
  ai.mockReset();
  return { service, expenses, categories, ai };
}

describe('VoiceService.command with the AI reading', () => {
  it('adds an expense paid by the named user', async () => {
    const { service, expenses, ai } = setup();
    ai.mockResolvedValue(
      intent({ intent: 'add-expense', categoryId: 'laptop', paidById: 'haseeb', amount: 1000, title: 'Dell Battery' }),
    );

    const result = await service.command('Laptop category mein Haseeb ka Dell battery 1000 add karo', admin);

    expect(expenses.create).toHaveBeenCalledWith(
      'laptop',
      expect.objectContaining({ title: 'Dell Battery', amount: 1000, paidById: 'haseeb' }),
      admin,
    );
    expect(result).toMatchObject({ ok: true, changed: true });
    expect(result.message).toContain('paid by Haseeb');
  });

  it('resolves a follow-up to the expense from the previous turn and keeps its other fields', async () => {
    const { service, expenses, ai } = setup();
    ai.mockResolvedValueOnce(intent({ intent: 'add-expense', categoryId: 'laptop', amount: 1000, title: 'Dell Battery' }));
    await service.command('laptop mein dell battery 1000', admin);

    ai.mockResolvedValueOnce(
      intent({ intent: 'update-expense', target: 'previous', updates: { amount: 2000, title: '', date: null } }),
    );
    const result = await service.command('ab iski amount 2000 kar do', admin);

    expect(ai.mock.calls[1][1].lastExpense).toMatchObject({ title: 'Dell Battery', amount: 1000 });
    expect(ai.mock.calls[1][1].history).toEqual([
      { said: 'laptop mein dell battery 1000', reply: expect.stringContaining('PKR 1,000') },
    ]);
    expect(expenses.findVisible).toHaveBeenCalledWith('e1', admin);
    expect(expenses.update).toHaveBeenCalledWith(
      'e1',
      { title: 'Dell Battery', amount: 2000, date: '2026-10-02', note: 'Voice: "..."', receiptUrl: null },
      admin,
    );
    expect(result.message).toBe('Dell Battery updated: amount PKR 1,000 → PKR 2,000');
  });

  it('asks instead of acting when the AI needs clarification', async () => {
    const { service, expenses, ai } = setup();
    ai.mockResolvedValue(
      intent({ intent: 'update-expense', target: 'previous', updates: { amount: 2000, title: '', date: null }, clarification: 'Kis expense ki amount?' }),
    );

    const result = await service.command('uski amount 2000 kar do', admin);

    expect(result).toMatchObject({ ok: false, message: 'Kis expense ki amount?', changed: false });
    expect(expenses.update).not.toHaveBeenCalled();
  });

  it('asks which expense when "previous" has nothing to point at', async () => {
    const { service, expenses, ai } = setup();
    ai.mockResolvedValue(intent({ intent: 'update-expense', target: 'previous', updates: { amount: 2000, title: '', date: null } }));

    const result = await service.command('iski amount 2000 kar do', admin);

    expect(result.ok).toBe(false);
    expect(expenses.update).not.toHaveBeenCalled();
  });

  it('does not update or delete when several expenses match', async () => {
    const { service, expenses, ai } = setup();
    expenses.search.mockResolvedValue({ items: [expense(), expense({ id: 'e2' })], total: 2 });
    ai.mockResolvedValue(intent({ intent: 'update-expense', target: 'search', q: 'battery', updates: { amount: 1500, title: '', date: null } }));

    const result = await service.command('battery ka amount 1500 kar do', admin);

    expect(result.action).toMatchObject({ type: 'navigate', q: 'battery' });
    expect(expenses.update).not.toHaveBeenCalled();
  });

  it('only asks for confirmation before deleting', async () => {
    const { service, ai } = setup();
    ai.mockResolvedValue(intent({ intent: 'delete-expense', target: 'search', q: 'Dell Battery' }));

    const result = await service.command('dell battery wala expense delete kar do', admin);

    expect(result.action).toMatchObject({ type: 'confirm-delete', target: 'expense', id: 'e1' });
    expect(result.changed).toBe(false);
  });

  it('answers totals from the category summaries', async () => {
    const { service, ai } = setup();
    ai.mockResolvedValueOnce(intent({ intent: 'total', categoryId: 'laptop', period: 'this-month' }));
    expect((await service.command('laptop mein is mahine kitna kharcha hua', admin)).message).toBe(
      'Laptop: PKR 1,000 this month (1 expense)',
    );
    ai.mockResolvedValueOnce(intent({ intent: 'total' }));
    expect((await service.command('total kitna kharcha hua', admin)).message).toBe('All categories: PKR 3,500 in total (4 expenses)');
  });

  it('searches expenses when a question names no category', async () => {
    const { service, expenses, ai } = setup();
    ai.mockResolvedValue(intent({ intent: 'open-category', q: 'Dell Battery' }));

    const result = await service.command('Dell battery ki amount 1000 hai na?', admin);

    expect(result.action).toEqual({ type: 'navigate', page: 'expenses', q: 'Dell Battery' });
    expect(expenses.update).not.toHaveBeenCalled();
  });

  it('follows the AI on whether an amount is a budget or an expense, whatever tab is open', async () => {
    const { service, expenses, categories, ai } = setup();
    ai.mockResolvedValueOnce(intent({ intent: 'budget', categoryId: 'laptop', amount: 200000 }));
    const result = await service.command('I want to add 2 lakh amount in Laptop category', admin, 'expense');

    expect(result.message).toBe('Laptop budget set to PKR 200,000');
    expect(categories.update).toHaveBeenCalledWith('laptop', expect.objectContaining({ budgetLimit: 200000 }), admin);
    expect(expenses.create).not.toHaveBeenCalled();

    ai.mockResolvedValueOnce(intent({ intent: 'add-expense', categoryId: 'laptop', amount: 1000 }));
    await service.command('I want to add 1000 amount in Laptop category', admin, 'expense');
    expect(expenses.create).toHaveBeenCalledTimes(1);
    expect(categories.update).toHaveBeenCalledTimes(1);
  });

  it('shows the AI question when a new expense misses something', async () => {
    const { service, expenses, ai } = setup();
    ai.mockResolvedValue(intent({ intent: 'add-expense', categoryId: 'laptop', clarification: 'Kitni amount?' }));

    const result = await service.command('laptop mein dell battery add karo', admin);

    expect(result).toMatchObject({ ok: false, message: 'Kitni amount?' });
    expect(result.entry).toMatchObject({ kind: 'expense', expense: null });
    expect(expenses.create).not.toHaveBeenCalled();
  });

  it('creates a category with the name, budget, icon and users the AI read', async () => {
    const { service, categories, ai } = setup();
    categories.create.mockResolvedValue({ id: 'travel', name: 'Travel' });
    ai.mockResolvedValue(
      intent({ intent: 'create-category', name: 'Travel', amount: 5000, icon: 'plane', userIds: ['haseeb'] }),
    );

    const result = await service.command('travel naam ki category banao budget 5000 aur Haseeb ko de do', admin);

    expect(categories.create).toHaveBeenCalledWith(
      expect.objectContaining({ name: 'Travel', budgetLimit: 5000, icon: 'plane', assignedUserIds: ['haseeb'] }),
      admin,
    );
    expect(result).toMatchObject({ ok: true, changed: true });
  });

  it('renames an existing category instead of creating one, even on the create-category tab', async () => {
    const { service, categories, ai } = setup();
    ai.mockResolvedValue(intent({ intent: 'rename-category', categoryId: 'wifi', name: 'Internet' }));

    const result = await service.command('wifi category ka naam internet kar do', admin, 'category');

    expect(categories.update).toHaveBeenCalledWith('wifi', expect.objectContaining({ name: 'Internet' }), admin);
    expect(categories.create).not.toHaveBeenCalled();
    expect(result).toMatchObject({ ok: true, changed: true, message: 'Wifi renamed to Internet', entry: null });
  });

  it('opens the edit form when the user wants to edit a category without saying what to change', async () => {
    const { service, categories, ai } = setup();
    ai.mockResolvedValue(intent({ intent: 'edit-category', categoryId: 'wifi' }));

    const result = await service.command('I want to edit wifi category', admin, 'category');

    expect(result).toMatchObject({ ok: true, changed: false, entry: null });
    expect(result.action).toMatchObject({ type: 'edit-category', category: { id: 'wifi' } });
    expect(categories.create).not.toHaveBeenCalled();
    expect(categories.update).not.toHaveBeenCalled();
  });

  it('opens the empty category form instead of the categories page', async () => {
    const { service, categories, ai } = setup();
    ai.mockResolvedValue(intent({ intent: 'new-category-form' }));

    const result = await service.command('give me add category form', admin, 'expense');

    expect(result).toMatchObject({ ok: true, changed: false, entry: null, action: { type: 'new-category' } });
    expect(categories.create).not.toHaveBeenCalled();
    expect((await service.command('give me add category form', member)).ok).toBe(false);
  });

  it('opens the empty expense form on the category the sentence names', async () => {
    const { service, expenses, ai } = setup();
    ai.mockResolvedValue(intent({ intent: 'new-expense-form', categoryId: 'wifi' }));

    const result = await service.command('open the expense form for wifi', member);

    expect(result.action).toMatchObject({ type: 'new-expense', categoryId: 'wifi' });
    expect(expenses.create).not.toHaveBeenCalled();
  });

  it('creates nothing from a sentence the AI did not understand', async () => {
    const { service, expenses, categories, ai } = setup();
    ai.mockResolvedValue(intent({ intent: 'unknown' }));

    const result = await service.command('hello hello testing', admin, 'category');

    expect(result).toMatchObject({ ok: false, entry: null });
    expect(categories.create).not.toHaveBeenCalled();
    expect(expenses.create).not.toHaveBeenCalled();
  });

  it('does not create a category that already exists', async () => {
    const { service, categories, ai } = setup();
    ai.mockResolvedValue(intent({ intent: 'create-category', name: 'laptop' }));

    const result = await service.command('laptop category banao', admin);

    expect(result).toMatchObject({ ok: false, message: 'A category called Laptop already exists' });
    expect(categories.create).not.toHaveBeenCalled();
  });

  it('keeps admin-only commands for admins', async () => {
    const { service, categories, ai } = setup();
    ai.mockResolvedValue(intent({ intent: 'budget', categoryId: 'laptop', amount: 5000 }));

    const result = await service.command('laptop ka budget 5000 kar do', member);

    expect(result).toMatchObject({ ok: false, message: 'Only admins can do that' });
    expect(categories.update).not.toHaveBeenCalled();
  });

  it('does nothing when the AI is unavailable', async () => {
    const { service, expenses, categories, ai } = setup();
    ai.mockResolvedValue(null);

    const result = await service.command('laptop mein dell battery 1000', admin, 'expense');

    expect(result).toMatchObject({ ok: false, changed: false, action: { type: 'none' }, entry: null });
    expect(result.message).toContain('OpenAI');
    expect(expenses.create).not.toHaveBeenCalled();
    expect(categories.update).not.toHaveBeenCalled();
  });
});

describe('validateVoiceIntent', () => {
  const ctx: VoiceIntentContext = {
    categories: [{ id: 'laptop', name: 'Laptop' }],
    users: [{ id: 'haseeb', name: 'Haseeb' }],
    isAdmin: true,
    today: '2026-10-03',
  };

  it('rejects output that is not a known intent', () => {
    expect(validateVoiceIntent(null, ctx)).toBeNull();
    expect(validateVoiceIntent('add-expense', ctx)).toBeNull();
    expect(validateVoiceIntent({ intent: 'drop-database' }, ctx)).toBeNull();
  });

  it('drops ids, amounts and dates the app cannot use', () => {
    const out = validateVoiceIntent(
      {
        intent: 'add-expense',
        categoryId: 'made-up',
        userIds: ['haseeb', 'ghost', 'haseeb'],
        paidById: 'ghost',
        amount: -5,
        title: 42,
        date: '2026-12-31',
        updates: { amount: '1000', title: ' New ', date: '2026-10-01' },
        target: 'somewhere',
      },
      ctx,
    );
    expect(out).toMatchObject({
      intent: 'add-expense',
      categoryId: null,
      userIds: ['haseeb'],
      paidById: null,
      amount: null,
      title: '',
      date: null,
      target: 'none',
      updates: { amount: null, title: 'New', date: '2026-10-01' },
    });
  });

  it('forces the intent when the caller knows it', () => {
    expect(validateVoiceIntent({ intent: 'navigate' }, { ...ctx, force: 'create-category' })?.intent).toBe('create-category');
  });
});
