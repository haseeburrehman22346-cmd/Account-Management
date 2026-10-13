import OpenAI from 'openai';

const DEFAULT_MODEL = 'gpt-5.4-mini';
const NONE = 'none';

export const VOICE_INTENTS = [
  'add-expense',
  'update-expense',
  'delete-expense',
  'create-category',
  'rename-category',
  'edit-category',
  'edit-expense',
  'new-category-form',
  'new-expense-form',
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

/** The chat answers in place, so it never gets the intents that take the user to another page. */
const PAGE_INTENTS: readonly string[] = ['navigate', 'open-category', 'back'];
const intentsFor = (ctx: VoiceIntentContext) =>
  ctx.mode === 'chat' ? VOICE_INTENTS.filter((i) => !PAGE_INTENTS.includes(i)) : VOICE_INTENTS;

const PAGES = ['overview', 'categories', 'expenses', 'users', 'settings', 'voice'] as const;
const THEMES = ['light', 'dark', 'system'] as const;
const TARGETS = ['none', 'previous', 'search'] as const;
const PERIODS = ['all', 'this-month'] as const;

/** Icon keys shared with the frontend's icon set. */
export const CATEGORY_ICONS = [
  'utensils', 'shopping-cart', 'car', 'plane', 'briefcase', 'zap', 'wifi', 'house', 'film', 'gamepad', 'heart-pulse',
  'graduation-cap', 'shirt', 'gift', 'ellipsis', 'folder',
] as const;

export interface VoiceIntent {
  intent: (typeof VOICE_INTENTS)[number];
  categoryId: string | null;
  userIds: string[];
  /** Admins only: who paid for a new expense. */
  paidById: string | null;
  amount: number | null;
  title: string;
  name: string;
  icon: (typeof CATEGORY_ICONS)[number];
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
  /** The assistant's own answer when the user is chatting or asking something rather than giving a command. */
  reply: string;
}

export interface VoiceTurn {
  said: string;
  reply: string;
}

export interface VoiceIntentContext {
  /** `summary` adds what the assistant may need to answer questions, e.g. the budget and spending. */
  categories: { id: string; name: string; summary?: string }[];
  users: { id: string; name: string }[];
  isAdmin: boolean;
  today: string;
  /** The Voice Entry tab the user is on, or the assistant chat. */
  mode?: 'expense' | 'category' | 'chat';
  /** Set when the caller already knows what the sentence is for. */
  force?: 'add-expense' | 'create-category';
  /** Earlier sentences of this conversation, oldest first. */
  history?: VoiceTurn[];
  /** The expense the conversation was last about, so "change its amount" can refer to it. */
  lastExpense?: { title: string; category: string; amount: number; date: string } | null;
  /** The newest expenses the user can see, one per line, so the assistant can answer questions about them. */
  recentExpenses?: string[];
}

let client: OpenAI | null = null;

const SCHEMA = {
  type: 'object',
  additionalProperties: false,
  required: [
    'intent', 'categoryId', 'userIds', 'paidById', 'amount', 'title', 'name', 'icon', 'date', 'q', 'target', 'updates',
    'period', 'page', 'theme', 'grant', 'active', 'clarification', 'reply',
  ],
  properties: {
    intent: { type: 'string', enum: VOICE_INTENTS },
    categoryId: { type: 'string' },
    userIds: { type: 'array', items: { type: 'string' } },
    paidById: { type: 'string' },
    amount: { type: ['number', 'null'] },
    title: { type: 'string' },
    name: { type: 'string' },
    icon: { type: 'string', enum: CATEGORY_ICONS },
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
    reply: { type: 'string' },
  },
};

const list = (rows: { id: string; name: string; summary?: string }[]) =>
  rows.length ? rows.map((r) => `- ${r.id}: ${r.name}${r.summary ? ` (${r.summary})` : ''}`).join('\n') : '(none)';

export function buildVoicePrompt(transcript: string, ctx: VoiceIntentContext) {
  const chat = ctx.mode === 'chat';
  const situation = ctx.force
    ? `The sentence is known to be a "${ctx.force}" request; use that intent.`
    : chat
      ? 'The user is talking to the assistant in a chat, by typing or by voice. They may give a command, ask a question or just talk. The chat stays on its own page and cannot open or switch pages, so whatever the user wants to see, list or look up is answered in the chat itself with the data, using reply.'
      : ctx.mode
        ? `The user is on the "${ctx.mode === 'expense' ? 'add expense' : 'create category'}" tab of the voice page. That is only a hint for a sentence that could be read either way; any command can be spoken from any tab, so follow what the sentence asks for.`
        : 'The user spoke from somewhere in the app.';
  const history = ctx.history?.length
    ? ctx.history.map((t) => `User: "${t.said}"\nApp: "${t.reply}"`).join('\n')
    : '(none)';
  const last = ctx.lastExpense
    ? `"${ctx.lastExpense.title}" in ${ctx.lastExpense.category}, PKR ${ctx.lastExpense.amount}, dated ${ctx.lastExpense.date}`
    : '(none)';

  const recent = ctx.recentExpenses
    ? `\nNewest expenses the user can see, newest first (date, category, title, amount, paid by):\n${ctx.recentExpenses.join('\n') || '(none)'}\n`
    : '';

  return `You are the assistant of an expense tracker. You read what the user said and fill in JSON; the app checks permissions and carries out the action you pick, and you never change data yourself.

The sentence comes from speech recognition. It may be English, Urdu, Roman Urdu or a mix, informal, and names are often misheard or misspelled. Understand it by meaning, not by keywords. A spoken name refers to an existing category or user only when it is that same name, allowing for mishearing, spelling and translation; a different word that is merely related in meaning is a different thing, and for a category it may be a new one the user wants to create.

What the app stores:
- Categories, each with a monthly budget and the users allowed to use it.
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
${recent}
Pick the one intent that matches what the user wants done:
- add-expense: record money that was spent. Naming an existing category while recording spending is still add-expense, not create-category. When a person is named together with an amount being put into a category, that person paid the expense (paidById); it is not an access change.
- update-expense: an explicit instruction to change an existing expense. A question or statement about an expense's current value is not a change; ${chat ? 'answer it in reply instead' : 'show it with open-category or navigate and q instead'}.
- delete-expense: remove an expense.
- create-category: make a category that does not exist yet. Only when the user asks for a new one; a request to change something about an existing category is never create-category.
- rename-category: change the name of an existing category (categoryId) to a new name (name).
- edit-category: the user wants to edit or change an existing category (categoryId) without saying what the new value is; the app opens its edit form. When the sentence does give the new value, use the intent for that change instead.
- edit-expense: the same for an existing expense (target and q): the user wants to edit it but gives no new value.
- new-category-form: the user asks for the empty form in which a new category is typed in, and gives no name or other details for it. When the sentence does give the details, use create-category.
- new-expense-form: the same for a new expense: the user asks for the empty form and gives no amount or item. categoryId when the sentence names the category it is for.
${
  chat
    ? ''
    : `- navigate: go to a page (page) to look at what is on it, optionally searching it (q). A request for a form to add or edit something is not navigation, even when it mentions the page's name.
- open-category: open, list or show one existing category's expenses, or find something inside it (q).
`
}- total: the user asks how much was spent, overall or in one category.
- access: give or take away a user's access to a category (grant true/false), with no amount involved.
- category-status / user-status: activate or deactivate a category or a user (active true/false).
- budget: set the monthly budget of an existing category (amount). Users may call the budget the category's amount or limit. When an amount is given to the category itself and the sentence names nothing bought, no spending and no payer, it is budget rather than add-expense, whatever tab the user is on.
- delete-category / delete-user: remove a category or a user.
- theme: switch theme. ${chat ? '' : 'back: go back. '}logout: sign out. help: the user asks what can be said.
- unknown: nothing has to be done in the app: the user is greeting, chatting${chat ? ', asking a question or asking to be shown something' : ' or asking a question'}. Answer it yourself in reply. Anything you can work out from the lists above is such a question: counting, listing, comparing, adding up, finding the biggest or the latest.

People correct themselves while speaking. When the sentence gives the same field more than once, the last value is the one they mean. A name the user gives as the expense's name is the title, not a user.

When the app's last reply was a question and the sentence answers it, read the user's previous sentence and this answer together as one request.

Fill the fields (use "${NONE}", "", null or [] for anything that does not apply):
- categoryId: id of the existing category the sentence refers to, or "${NONE}". For update-expense, edit-expense, delete-expense and new-expense-form, only a category the sentence names.
- userIds: ids of the listed users the sentence names, including users a new category is given to.
- paidById: for add-expense, id of the listed user who paid, or "${NONE}".
- amount: the amount for add-expense, or the budget for create-category and budget, as a plain number. Convert numbers spoken in words in any language, including South Asian units such as hazar, lakh and crore. A number that is part of a product name is not an amount.
- title: for add-expense, only the thing bought or paid for, in Title Case under 60 characters, without the category, amount, date, payer or instruction words.
- name: for create-category, the new category's name; for rename-category, the name the existing category should have from now on. Title Case, under 40 characters.
- icon: for create-category, the icon that best fits the new category; "folder" when none fits.
- date: for add-expense, the day it was spent as YYYY-MM-DD when the sentence says or implies one, else null.
- q: for navigate, open-category, update-expense, edit-expense and delete-expense, the words that identify the expense or search. Never the page's or category's own name.
- target: for update-expense, edit-expense and delete-expense, "previous" when the sentence points back at the expense the conversation is about, "search" when it names the expense in q.
- updates: for update-expense, only the values the user asks to change: the new amount, the new title, the new date.
- period: for total, "this-month" when the sentence asks about this month, else "all".
- page, theme, grant, active: the value the intent needs.
- clarification: when the sentence is ambiguous or misses something you cannot carry it out without, a short question in the user's language. Ask instead of guessing: never invent a category, amount, name or record. A missing amount or category for add-expense deserves a question, and so does a name that fits more than one listed user or category equally well. Empty string otherwise.
- reply: for unknown only, your answer to the user. Answer directly and completely, as a helpful assistant would: work the answer out from the categories, users, expenses and conversation above (count them, list them, add them up, compare them). You only help with this expense tracker: its categories, expenses, budgets, users, and how to use the app. When the sentence asks about anything else, whatever the topic, do not answer it from your own knowledge; say in one short sentence that you can only help with this app's expenses and categories. A greeting or small talk gets a short friendly answer. Do not talk about intents, actions or what you are able to do instead of answering, and do not ask the user to confirm a question whose meaning is clear despite typos. Only when the answer needs data that is not shown above, say what is missing. Write in the same language and script as the sentence itself, whatever language the earlier conversation or the data is in: an English sentence gets an English answer, a Roman Urdu sentence a Roman Urdu answer. Use plain text without markdown, as short as the answer allows. Never say that something was added, changed or deleted, because with this intent nothing is. Empty string for every other intent.`;
}

const isObject = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null && !Array.isArray(v);
const oneOf = <T extends string>(options: readonly T[], v: unknown, fallback: T): T =>
  options.includes(v as T) ? (v as T) : fallback;
const text = (v: unknown, max: number) => (typeof v === 'string' ? v.trim().slice(0, max) : '');
const positive = (v: unknown) => (typeof v === 'number' && Number.isFinite(v) && v > 0 ? Math.round(v * 100) / 100 : null);

/** Checks the model's JSON against the app's lists; null when it isn't usable at all. */
export function validateVoiceIntent(raw: unknown, ctx: VoiceIntentContext): VoiceIntent | null {
  if (!isObject(raw) || !intentsFor(ctx).includes(raw.intent as VoiceIntent['intent'])) return null;
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
    icon: oneOf(CATEGORY_ICONS, raw.icon, 'folder'),
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
    reply: text(raw.reply, 2000),
  };
}

/** Asks OpenAI what a spoken sentence means; null when it can't be reached or gives no usable answer. */
export async function readVoiceIntent(transcript: string, ctx: VoiceIntentContext): Promise<VoiceIntent | null> {
  if (!process.env.OPENAI_API_KEY) return null;
  client ??= new OpenAI();

  const schema = { ...SCHEMA, properties: { ...SCHEMA.properties, intent: { type: 'string', enum: intentsFor(ctx) } } };
  try {
    const completion = await client.chat.completions.create(
      {
        model: process.env.OPENAI_MODEL || DEFAULT_MODEL,
        max_completion_tokens: 4000,
        reasoning_effort: (process.env.OPENAI_VOICE_REASONING as OpenAI.ReasoningEffort) || 'low',
        response_format: { type: 'json_schema', json_schema: { name: 'voice_intent', strict: true, schema } },
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
