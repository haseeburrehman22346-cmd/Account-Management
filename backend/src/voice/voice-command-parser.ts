import { matchUsers, type ParserUser } from './voice-category-parser.js';
import { matchCategories, normalizeSpeech, parseAmountTokens, type ParserCategory } from './voice-parser.js';

export type VoicePage = 'overview' | 'categories' | 'expenses' | 'users' | 'settings' | 'voice';
export type VoiceTheme = 'light' | 'dark' | 'system';

export type VoiceCommand =
  | { type: 'navigate'; page: VoicePage; q: string }
  | { type: 'open-category'; categoryId: string; q: string }
  | { type: 'access'; grant: boolean; categoryId: string | null; userIds: string[] }
  | { type: 'category-status'; categoryId: string; active: boolean }
  | { type: 'user-status'; userId: string; active: boolean }
  | { type: 'budget'; categoryId: string; budget: number }
  | { type: 'delete-category'; categoryId: string }
  | { type: 'delete-user'; userId: string }
  | { type: 'delete-expense'; categoryId: string | null; q: string }
  | { type: 'create-category' }
  | { type: 'add-expense' }
  | { type: 'theme'; theme: VoiceTheme }
  | { type: 'back' }
  | { type: 'logout' }
  | { type: 'help' }
  | { type: 'unknown' };

const words = (list: string) => new Set(list.split(' '));

const VIEW = words('show open see view display search find dikhao dikha dikhaen dekho dekhna kholo khol dhoondo dhundo talash');
const REMOVE = words('delete remove erase revoke unassign hatao hata mitao nikalo nikal');
const ACCESS = words('access grant assign allow revoke unassign ijazat');
const SHARE = words('give add share include');
const CREATE = words('create new make banao banado bana banaye banaen naya nayi nai');
const SPEND = words('add spent spend paid pay bought expense kharcha kharch');
const DEACTIVATE = words('deactivate disable inactive suspend band');
const ACTIVATE = words('activate enable reactivate active chalu');
const BUDGET = words('budget limit');
const CATEGORY = words('category categories');
const EXPENSE = words('expense expenses kharcha kharche kharch transaction transactions');
const USER = words('user users member members people');

const PAGES: [VoicePage, Set<string>][] = [
  ['overview', words('dashboard overview home summary')],
  ['settings', words('settings setting profile account password')],
  ['voice', words('voice mic microphone')],
];

const THEMES: Record<string, VoiceTheme> = { dark: 'dark', night: 'dark', light: 'light', day: 'light', system: 'system' };

/** Words that never belong to a search phrase. */
const STOP = new Set([
  ...VIEW, ...REMOVE, ...ACCESS, ...SHARE, ...CREATE, ...DEACTIVATE, ...ACTIVATE, ...BUDGET, ...CATEGORY, ...EXPENSE, ...USER,
  ...words(
    'list go goto take navigate check set me my all the a an of for in to on from with and please plz i want wanna would like ' +
      'can could you is are that this those these called named name about by at into it up s page screen tab section detail ' +
      'details specific record records entry entries amount total rupees rupee rupay rupaye rs pkr mein ka ki ke ko se par ' +
      'mujhe sab sari saari sare saray tamam wala wali karo kar do de dein hai',
  ),
]);

/** Works out what a spoken sentence asks the app to do. Pass no users for non-admins. */
export function parseVoiceCommand(transcript: string, categories: ParserCategory[], users: ParserUser[]): VoiceCommand {
  const tokens = normalizeSpeech(transcript)
    .split(' ')
    .map((t) => t.replace(/^[.-]+|[.-]+$/g, ''))
    .filter(Boolean);
  if (!tokens.length) return { type: 'unknown' };

  const joined = tokens.join(' ');
  if (/^(help|commands)$|what can (i|you) (say|do)/.test(joined)) return { type: 'help' };
  if (/\b(log ?out|sign ?out)\b/.test(joined)) return { type: 'logout' };
  if (/^(go |take me )?(back|wapas)$/.test(joined)) return { type: 'back' };
  const theme = /\b(dark|night|light|day|system) (theme|mode)\b/.exec(joined);
  if (theme) return { type: 'theme', theme: THEMES[theme[1]] };

  const used = new Set<number>();
  const unused = () => tokens.map((t, i) => (used.has(i) ? '' : t));
  const userIds = matchUsers(tokens, users, used);
  const match = matchCategories(unused(), categories)[0];
  if (match) for (let i = 0; i < match.hit.length; i++) used.add(match.hit.start + i);
  const categoryId = match?.category.id ?? null;
  const amount = parseAmountTokens(unused());

  // What is left once names, verbs and filler are gone, kept in spoken order ("lunch with team").
  const text = unused();
  if (amount) {
    for (let i = amount.start; i < amount.end; i++) text[i] = '';
    text[amount.start] = String(amount.value);
  }
  const meaningful = text.map((t) => t !== '' && !STOP.has(t));
  const q = meaningful.includes(true)
    ? text.slice(meaningful.indexOf(true), meaningful.lastIndexOf(true) + 1).filter(Boolean).join(' ')
    : '';

  const has = (set: Set<string>) => tokens.some((t) => set.has(t));
  const viewing = has(VIEW);
  const removing = has(REMOVE);
  const deactivating = has(DEACTIVATE);
  const changingStatus = deactivating || has(ACTIVATE);

  if (userIds.length && categoryId && !amount && (has(ACCESS) || has(SHARE) || removing)) {
    return { type: 'access', grant: !removing, categoryId, userIds };
  }
  if (
    has(CATEGORY) && !viewing && !removing && !changingStatus &&
    (has(CREATE) || (!categoryId && (tokens.includes('add') || amount !== null)))
  ) {
    return { type: 'create-category' };
  }
  if (has(ACCESS) && !viewing) return { type: 'access', grant: !removing, categoryId, userIds };

  if (changingStatus && !viewing) {
    if (userIds.length === 1 && !categoryId) return { type: 'user-status', userId: userIds[0], active: !deactivating };
    if (categoryId) return { type: 'category-status', categoryId, active: !deactivating };
  }
  if (has(BUDGET) && categoryId && amount && !viewing) return { type: 'budget', categoryId, budget: amount.value };

  if (removing) {
    if (has(EXPENSE)) return { type: 'delete-expense', categoryId, q };
    if (has(CATEGORY) && !categoryId) return { type: 'navigate', page: 'categories', q };
    if (userIds.length === 1 && !categoryId) return { type: 'delete-user', userId: userIds[0] };
    if (categoryId && !q) return { type: 'delete-category', categoryId };
    return q ? { type: 'delete-expense', categoryId, q } : { type: 'unknown' };
  }

  if (!viewing && ((amount && (categoryId || has(SPEND))) || (tokens.includes('add') && has(EXPENSE)))) {
    return { type: 'add-expense' };
  }

  if (categoryId) return { type: 'open-category', categoryId, q };
  if (userIds.length) return { type: 'navigate', page: 'users', q: users.find((u) => u.id === userIds[0])?.name ?? '' };
  if (has(USER)) return { type: 'navigate', page: 'users', q };
  if (has(CATEGORY)) return { type: 'navigate', page: 'categories', q };
  if (has(EXPENSE)) return { type: 'navigate', page: 'expenses', q };
  const page = PAGES.find(([, keys]) => has(keys));
  if (page) return { type: 'navigate', page: page[0], q: '' };
  if (q && viewing) return { type: 'navigate', page: 'expenses', q };
  return { type: 'unknown' };
}
