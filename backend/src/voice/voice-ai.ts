import OpenAI from 'openai';

const DEFAULT_MODEL = 'gpt-5.4-mini';
const NONE = 'none';

export const VOICE_INTENTS = [
  'add-expense',
  'update-expense',
  'delete-expense',
  'create-category',
  'navigate',
  'open-category',
  'total',
  'access',
  'category-status',
  'user-status',
  'budget',
  'delete-category',
  'delete-user',
  'theme',
  'back',
  'logout',
  'help',
  'unknown',
] as const;

const PAGES = ['overview', 'categories', 'expenses', 'users', 'settings', 'voice'] as const;
const THEMES = ['light', 'dark', 'system'] as const;
const TARGETS = ['none', 'previous', 'search'] as const;
const PERIODS = ['all', 'this-month'] as const;

export interface VoiceIntent {
  intent: (typeof VOICE_INTENTS)[number];
  categoryId: string | null;
  userIds: string[];
  /** Admins only: who paid for a new expense. */
  paidById: string | null;
  amount: number | null;
  title: string;
  name: string;
  date: string | null;
  q: string;
  /** Which expense an update or delete is about: the one from the previous turn, or one found by `q`. */
  target: (typeof TARGETS)[number];
  updates: { amount: number | null; title: string; date: string | null };
  period: (typeof PERIODS)[number];
  page: (typeof PAGES)[number];
  theme: (typeof THEMES)[number];
  grant: boolean;
  active: boolean;
  /** A question to ask instead of acting, when the sentence is ambiguous or misses something required. */
  clarification: string;
}

export interface VoiceTurn {
  said: string;
  reply: string;
}

export interface VoiceIntentContext {
  categories: { id: string; name: string }[];
  users: { id: string; name: string }[];
  isAdmin: boolean;
  today: string;
  /** The Voice Entry tab the user is on, if any. */
  mode?: 'expense' | 'category';
  /** Set when the caller already knows what the sentence is for. */
  force?: 'add-expense' | 'create-category';
  /** Earlier sentences of this conversation, oldest first. */
  history?: VoiceTurn[];
  /** The expense the conversation was last about, so "change its amount" can refer to it. */
  lastExpense?: { title: string; category: string; amount: number; date: string } | null;
}

let client: OpenAI | null = null;

const SCHEMA = {
  type: 'object',
  additionalProperties: false,
  required: [
    'intent', 'categoryId', 'userIds', 'paidById', 'amount', 'title', 'name', 'date', 'q', 'target', 'updates',
    'period', 'page', 'theme', 'grant', 'active', 'clarification',
  ],
  properties: {
    intent: { type: 'string', enum: VOICE_INTENTS },
    categoryId: { type: 'string' },
    userIds: { type: 'array', items: { type: 'string' } },
    paidById: { type: 'string' },
    amount: { type: ['number', 'null'] },
    title: { type: 'string' },
    name: { type: 'string' },
    date: { type: ['string', 'null'] },
    q: { type: 'string' },
    target: { type: 'string', enum: TARGETS },
    updates: {
      type: 'object',
      additionalProperties: false,
      required: ['amount', 'title', 'date'],
      properties: { amount: { type: ['number', 'null'] }, title: { type: 'string' }, date: { type: ['string', 'null'] } },
    },
    period: { type: 'string', enum: PERIODS },
    page: { type: 'string', enum: PAGES },
    theme: { type: 'string', enum: THEMES },
    grant: { type: 'boolean' },
    active: { type: 'boolean' },
    clarification: { type: 'string' },
  },
};

const list = (rows: { id: string; name: string }[]) => (rows.length ? rows.map((r) => `- ${r.id}: ${r.name}`).join('\n') : '(none)');

export function buildVoicePrompt(transcript: string, ctx: VoiceIntentContext) {
  const situation = ctx.force
    ? `The sentence is known to be a "${ctx.force}" request; use that intent.`
    : ctx.mode
      ? `The user is on the "${ctx.mode === 'expense' ? 'add expense' : 'create category'}" tab of the voice page, so prefer that reading when the sentence is ambiguous, but follow the sentence when it clearly asks for something else.`
      : 'The user spoke from somewhere in the app.';
  const history = ctx.history?.length
    ? ctx.history.map((t) => `User: "${t.said}"\nApp: "${t.reply}"`).join('\n')
    : '(none)';
  const last = ctx.lastExpense
    ? `"${ctx.lastExpense.title}" in ${ctx.lastExpense.category}, PKR ${ctx.lastExpense.amount}, dated ${ctx.lastExpense.date}`
    : '(none)';

  return `You interpret voice commands for an expense tracker. You only read the sentence and fill in JSON; the app checks permissions and carries it out.

The sentence comes from speech recognition. It may be English, Urdu, Roman Urdu or a mix, informal, and names are often misspelled ("Wi-Fi" for "Wifi", "Hasib" for "Haseeb"). Understand it by meaning, not by keywords, and match names to the closest existing category or user by sound and meaning.

What the app stores:
- Categories (e.g. Laptop, Wifi), each with a monthly budget and the users allowed to use it.
- Expenses inside a category: a title (what was bought), an amount in PKR, a date, and who paid.
- Users, who can be active or inactive and be given access to categories.

Sentence: "${transcript}"
Today: ${ctx.today}.
The user is ${ctx.isAdmin ? 'an admin' : 'a regular user (only admins manage categories and users)'}. ${situation}

Existing categories (id: name):
${list(ctx.categories)}

Users (id: name):
${list(ctx.users)}

Conversation so far, oldest first:
${history}
Expense the conversation is about: ${last}

Pick one intent:
- add-expense: record money spent, e.g. "wifi category mein 1000 ka expense add kar do", "food 500 lunch". Mentioning an existing category while adding an expense is add-expense, never create-category. Adding anyone or anything to a category together with an amount is always add-expense: "Laptop category mein Haseeb naam ka user add karo, amount 1000" and "Haseeb ko laptop mein daal do, uski amount 1000" are an expense of 1000 in Laptop paid by Haseeb (paidById), not access.
- update-expense: an explicit instruction to change an existing expense, e.g. "Dell battery ka amount 1500 kar do", "ab iski amount 2000 kar do". A question or statement about a value ("Dell battery ki amount 1000 hai na?") is not a change: use open-category or navigate with q to show it.
- delete-expense: remove an expense.
- create-category: make a new category, e.g. "travel naam ki category banao budget 5000".
- navigate: go to a page (page), optionally searching it (q).
- open-category: open, list or show one existing category's expenses, or find something inside it (q), e.g. "Show me all expenses in Laptop", "Laptop mein Dell battery dhoondo".
- total: only when asked how much was spent ("kitna", "how much", "total"), overall or in one category, e.g. "laptop mein is mahine kitna kharcha hua".
- access: give or take away a user's access to a category (grant true/false), with no amount, e.g. "Haseeb ko laptop category mein daal do".
- category-status / user-status: activate or deactivate a category or a user (active true/false).
- budget: set the monthly budget of an existing category (amount). Users call the budget the category's "amount" or "limit". When the amount is given to the category itself and the sentence names nothing bought, no "expense"/"kharcha" and no payer, it is budget, not add-expense, whatever tab the user is on: "I want to add 2 lakh amount in Haseeb category", "Laptop category ki amount 50000 kar do", "wifi category mein 10 hazar amount add karo".
- delete-category / delete-user: remove a category or a user.
- theme: switch theme. back: go back. logout: sign out. help: asks what can be said.
- unknown: none of the above.

People correct themselves while speaking. When the sentence gives the same field more than once ("expense name is a seat ... expense name is Haseeb amount 1000"), the last value is the one they mean; the earlier one was usually misheard. A name given as "expense name is X" is the title, not a user.

When the app's last reply was a question and the sentence answers it, read the user's previous sentence and this answer together as one request. E.g. after User: "expense add karo 500" / App: "Kis category mein add karoon?", the sentence "Laptop" means add-expense of 500 in Laptop.

Fill the fields (use "${NONE}", "", null or [] for anything that does not apply):
- categoryId: id of the existing category the sentence refers to, or "${NONE}". For update-expense and delete-expense, only a category the sentence names.
- userIds: ids of listed users the sentence names, including users a new category is given to ("... aur Haseeb ko de do").
- paidById: for add-expense, id of the listed user who paid, or "${NONE}".
- amount: the amount for add-expense or the budget for create-category and budget, as a number. Convert spoken numbers: "ek hazaar" = 1000, "5 hazar" = 5000, "dhai hazar" = 2500, "2 lakh" = 200000, "fifteen hundred" = 1500. A number that is part of a name ("iPhone 15") is not an amount.
- title: for add-expense, the thing bought or paid for in Title Case under 60 characters, e.g. "Dell Battery", leaving out the category, amount, date, payer and words like "add", "expense", "naam", "kar do".
- name: for create-category, the new category's name in Title Case under 40 characters.
- date: for add-expense, the day it was spent as YYYY-MM-DD when the sentence says one ("kal" = yesterday, "parson" = two days ago), else null.
- q: for navigate, open-category, update-expense and delete-expense, the words that identify the expense or search, e.g. "Dell Battery". Never the page's or category's own name.
- target: for update-expense and delete-expense, "previous" when the sentence points back at the expense the conversation is about ("iska", "his", "it", "wohi wala"), "search" when it names the expense in q.
- updates: for update-expense, only the values the user asks to change: the new amount, the new title, the new date. A value the sentence only describes is not a change.
- period: for total, "this-month" when the sentence asks about this month, else "all".
- page, theme, grant, active: the value the intent needs.
- clarification: when the sentence is ambiguous or misses something you cannot carry out without, a short question in the user's language, e.g. "Kis category mein add karoon?". Ask instead of guessing: never invent a category, amount, name or record. A missing amount or category for add-expense also deserves a question, and so does a name that fits more than one listed user or category equally well ("Ali" when there are "Ali Khan" and "Ali Raza"). Empty string otherwise.`;
}

const isObject = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null && !Array.isArray(v);
const oneOf = <T extends string>(options: readonly T[], v: unknown, fallback: T): T =>
  options.includes(v as T) ? (v as T) : fallback;
const text = (v: unknown, max: number) => (typeof v === 'string' ? v.trim().slice(0, max) : '');
const positive = (v: unknown) => (typeof v === 'number' && Number.isFinite(v) && v > 0 ? Math.round(v * 100) / 100 : null);

/** Checks the model's JSON against the app's lists; null when it isn't usable at all. */
export function validateVoiceIntent(raw: unknown, ctx: VoiceIntentContext): VoiceIntent | null {
  if (!isObject(raw) || !VOICE_INTENTS.includes(raw.intent as VoiceIntent['intent'])) return null;
  const pastDate = (v: unknown) => (typeof v === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(v) && v <= ctx.today ? v : null);
  const userId = (v: unknown) => (ctx.users.some((u) => u.id === v) ? (v as string) : null);
  const updates = isObject(raw.updates) ? raw.updates : {};

  return {
    intent: ctx.force ?? (raw.intent as VoiceIntent['intent']),
    categoryId: ctx.categories.some((c) => c.id === raw.categoryId) ? (raw.categoryId as string) : null,
    userIds: Array.isArray(raw.userIds) ? [...new Set(raw.userIds.map(userId).filter((id) => id !== null))] : [],
    paidById: userId(raw.paidById),
    amount: positive(raw.amount),
    title: text(raw.title, 200),
    name: text(raw.name, 100),
    date: pastDate(raw.date),
    q: text(raw.q, 100),
    target: oneOf(TARGETS, raw.target, 'none'),
    updates: { amount: positive(updates.amount), title: text(updates.title, 200), date: pastDate(updates.date) },
    period: oneOf(PERIODS, raw.period, 'all'),
    page: oneOf(PAGES, raw.page, 'overview'),
    theme: oneOf(THEMES, raw.theme, 'system'),
    grant: raw.grant !== false,
    active: raw.active !== false,
    clarification: text(raw.clarification, 300),
  };
}

/** Asks OpenAI what a spoken sentence means; null when it can't, so the caller falls back to its keyword parsers. */
export async function readVoiceIntent(transcript: string, ctx: VoiceIntentContext): Promise<VoiceIntent | null> {
  if (!process.env.OPENAI_API_KEY) return null;
  client ??= new OpenAI();

  try {
    const completion = await client.chat.completions.create(
      {
        model: process.env.OPENAI_MODEL || DEFAULT_MODEL,
        max_completion_tokens: 4000,
        reasoning_effort: (process.env.OPENAI_VOICE_REASONING as OpenAI.ReasoningEffort) || 'low',
        response_format: { type: 'json_schema', json_schema: { name: 'voice_intent', strict: true, schema: SCHEMA } },
        messages: [{ role: 'user', content: buildVoicePrompt(transcript, ctx) }],
      },
      { timeout: 10000 },
    );
    const message = completion.choices[0]?.message;
    if (!message?.content || message.refusal) return null;
    return validateVoiceIntent(JSON.parse(message.content), ctx);
  } catch {
    return null;
  }
}
