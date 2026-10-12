import { parseAmountTokens, normalizeSpeech } from './voice-parser.js';

export interface ParserUser {
  id: string;
  name: string;
}

export interface ParsedVoiceCategory {
  transcript: string;
  name: string;
  budget: number | null;
  userIds: string[];
  icon: string;
  /** Set when a category with this name already exists. */
  duplicateOf: string | null;
  missing: 'name'[];
}

/** Command words around a category request (English + Roman Urdu); never part of the name. */
const COMMAND_WORDS = new Set([
  'create', 'add', 'new', 'make', 'category', 'categories', 'called', 'named', 'name', 'with', 'a', 'an', 'the', 'please', 'plz',
  'budget', 'amount', 'limit', 'monthly', 'month', 'per', 'of', 'for', 'to', 'and', 'assign', 'assigned', 'give', 'access',
  'users', 'user', 'banao', 'banado', 'bana', 'banaye', 'banaen', 'banani', 'banana', 'karo', 'kar', 'do', 'dein', 'de', 'ki', 'ka', 'ke',
  'naam', 'nam', 'mein', 'me', 'ko', 'aur', 'hai', 'chahta', 'chahti', 'hoon', 'hun', 'mujhe', 'ek', 'nayi', 'naya', 'nai', 'is',
]);

/** Icon keys shared with the frontend's icon set. */
const ICON_KEYWORDS: [string, string[]][] = [
  ['utensils', ['food', 'khana', 'lunch', 'dinner', 'breakfast', 'meal', 'meals', 'restaurant', 'dining', 'snacks', 'tea', 'chai']],
  ['shopping-cart', ['grocery', 'groceries', 'shopping', 'sauda', 'market']],
  ['plane', ['travel', 'trip', 'tour', 'flight', 'safar']],
  ['car', ['transport', 'fuel', 'petrol', 'car', 'taxi', 'uber', 'careem', 'rickshaw', 'bus', 'commute']],
  ['briefcase', ['office', 'work', 'business', 'stationery', 'supplies']],
  ['wifi', ['internet', 'wifi', 'broadband', 'mobile', 'phone']],
  ['zap', ['utility', 'utilities', 'electricity', 'bijli', 'gas', 'water', 'bill', 'bills']],
  ['house', ['rent', 'home', 'house', 'ghar', 'kiraya', 'maintenance']],
  ['film', ['entertainment', 'movie', 'movies', 'cinema', 'fun', 'events']],
  ['gamepad', ['game', 'games', 'gaming']],
  ['heart-pulse', ['health', 'medical', 'medicine', 'doctor', 'hospital', 'dawai', 'pharmacy']],
  ['graduation-cap', ['education', 'school', 'fees', 'fee', 'books', 'course', 'tuition']],
  ['shirt', ['clothes', 'clothing', 'kapray', 'kapre', 'fashion']],
  ['gift', ['gift', 'gifts', 'tohfa', 'charity', 'donation', 'sadqa']],
];

export const pickCategoryIcon = (name: string) => {
  const words = normalizeSpeech(name).split(' ');
  return ICON_KEYWORDS.find(([, keys]) => words.some((w) => keys.includes(w)))?.[0] ?? 'folder';
};

const titleCase = (words: string[]) => words.map((w) => (w ? w[0].toUpperCase() + w.slice(1) : w)).join(' ');

/** Users named in the tokens, by full name first, then by a unique first name ("Ali" -> Ali Khan). Marks their tokens as used. */
export function matchUsers(tokens: string[], users: ParserUser[], used: Set<number>) {
  const userIds = new Set<string>();
  for (const user of [...users].sort((a, b) => b.name.length - a.name.length)) {
    const parts = normalizeSpeech(user.name).split(' ').filter(Boolean);
    const firstNameIsUnique = users.filter((u) => normalizeSpeech(u.name).split(' ')[0] === parts[0]).length === 1;
    for (let i = 0; i < tokens.length; i++) {
      if (used.has(i)) continue;
      if (parts.every((p, j) => tokens[i + j] === p)) {
        userIds.add(user.id);
        for (let j = 0; j < parts.length; j++) used.add(i + j);
        break;
      }
      if (firstNameIsUnique && tokens[i] === parts[0] && parts[0].length > 2) {
        userIds.add(user.id);
        used.add(i);
        break;
      }
    }
  }
  return [...userIds];
}

export function parseVoiceCategory(
  transcript: string,
  users: ParserUser[],
  existingCategories: { id: string; name: string }[],
): ParsedVoiceCategory {
  const tokens = normalizeSpeech(transcript).split(' ').filter(Boolean);
  const used = new Set<number>();

  const amount = parseAmountTokens(tokens);
  if (amount) for (let i = amount.start; i < amount.end; i++) used.add(i);

  const userIds = matchUsers(tokens, users, used);

  const nameWords = tokens.filter((t, i) => !used.has(i) && !COMMAND_WORDS.has(t) && !/^(rs|pkr|rupees?|rupay|rupaye)$/.test(t));
  const name = titleCase(nameWords).slice(0, 100);
  const duplicate = name
    ? existingCategories.find((c) => normalizeSpeech(c.name) === normalizeSpeech(name))
    : undefined;

  return {
    transcript: transcript.trim(),
    name,
    budget: amount ? amount.value : null,
    userIds,
    icon: pickCategoryIcon(name),
    duplicateOf: duplicate?.id ?? null,
    missing: name ? [] : ['name'],
  };
}
