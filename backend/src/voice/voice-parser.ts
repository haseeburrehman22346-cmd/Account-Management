export interface ParserCategory {
  id: string;
  name: string;
}

export interface ParsedVoiceExpense {
  transcript: string;
  categoryId: string | null;
  alternativeCategoryIds: string[];
  amount: number | null;
  title: string;
  date: string;
  missing: ('category' | 'amount')[];
}

const URDU_DIGITS = /[۰-۹٠-٩]/g;
const toLatinDigit = (d: string) => String('۰۱۲۳۴۵۶۷۸۹'.indexOf(d) >= 0 ? '۰۱۲۳۴۵۶۷۸۹'.indexOf(d) : '٠١٢٣٤٥٦٧٨٩'.indexOf(d));

const CURRENCY = ['rupees', 'rupee', 'rupay', 'rupaye', 'rupaiye', 'rs', 'pkr', 'روپے', 'روپیہ'];

const MULTIPLIERS: Record<string, number> = {
  k: 1_000,
  thousand: 1_000,
  hazar: 1_000,
  hazaar: 1_000,
  hazār: 1_000,
  ہزار: 1_000,
  lakh: 100_000,
  lac: 100_000,
  لاکھ: 100_000,
};

const UNITS: Record<string, number> = {
  zero: 0, one: 1, two: 2, three: 3, four: 4, five: 5, six: 6, seven: 7, eight: 8, nine: 9, ten: 10,
  eleven: 11, twelve: 12, thirteen: 13, fourteen: 14, fifteen: 15, sixteen: 16, seventeen: 17, eighteen: 18,
  nineteen: 19, twenty: 20, thirty: 30, forty: 40, fifty: 50, sixty: 60, seventy: 70, eighty: 80, ninety: 90,
};

const DATE_WORDS: Record<string, number> = {
  today: 0,
  aaj: 0,
  yesterday: -1,
  kal: -1,
  parson: -2,
  parso: -2,
};

const FILLER = new Set([
  'add', 'added', 'adding', 'spent', 'spend', 'spending', 'paid', 'pay', 'bought', 'buy', 'for', 'on', 'in', 'to', 'of',
  'the', 'a', 'an', 'and', 'expense', 'expenses', 'category', 'my', 'i', 'new', 'amount', 'at', 'with', 'from', 'was', 'is',
  'mein', 'me', 'main', 'ka', 'ki', 'ke', 'par', 'pe', 'se', 'ko', 'kharcha', 'kharch', 'kharche', 'kiya', 'kiye', 'kia',
  'hai', 'hain', 'tha', 'the', 'daal', 'dalo', 'likho', 'day', 'before',
  'karna', 'karni', 'karne', 'kar', 'karo', 'kardo', 'do', 'dein', 'den', 'de', 'dijiye', 'chahta', 'chahti', 'chahte',
  'hoon', 'hun', 'hu', 'aap', 'ap', 'mujhe', 'mera', 'meri', 'mere', 'please', 'plz', 'ye', 'yeh', 'wo', 'woh',
]);

const JOINERS = new Set(['with', 'for', 'and']);

const normalize = (text: string) =>
  text
    .replace(URDU_DIGITS, toLatinDigit)
    .toLowerCase()
    .replace(/(\d),(\d)/g, '$1$2')
    .replace(/[^\p{L}\p{N}.\s-]/gu, ' ')
    .replace(/\s+/g, ' ')
    .trim();

const singular = (word: string) => word.replace(/(ies)$/, 'y').replace(/(es|s)$/, '');

function levenshtein(a: string, b: string) {
  const dp = Array.from({ length: b.length + 1 }, (_, i) => i);
  for (let i = 1; i <= a.length; i++) {
    let prev = dp[0];
    dp[0] = i;
    for (let j = 1; j <= b.length; j++) {
      const tmp = dp[j];
      dp[j] = Math.min(dp[j] + 1, dp[j - 1] + 1, prev + (a[i - 1] === b[j - 1] ? 0 : 1));
      prev = tmp;
    }
  }
  return dp[b.length];
}

const wordsMatch = (spoken: string, target: string) => {
  if (spoken === target || singular(spoken) === singular(target)) return true;
  // Speech engines often slip one letter on longer words ("utilitys", "entertainmant").
  return target.length >= 5 && levenshtein(singular(spoken), singular(target)) <= 1;
};

function findCategory(tokens: string[], category: ParserCategory) {
  const nameTokens = normalize(category.name).split(' ').filter(Boolean);
  if (!nameTokens.length) return null;
  for (let i = 0; i + nameTokens.length <= tokens.length; i++) {
    if (nameTokens.every((t, j) => wordsMatch(tokens[i + j], t))) return { start: i, length: nameTokens.length };
  }
  return null;
}

function readNumberWords(tokens: string[], start: number) {
  let total = 0;
  let current = 0;
  let i = start;
  let used = false;
  for (; i < tokens.length; i++) {
    const t = tokens[i];
    if (t in UNITS) current += UNITS[t];
    else if (t === 'hundred') current = (current || 1) * 100;
    else if (t in MULTIPLIERS && t !== 'k') {
      total += (current || 1) * MULTIPLIERS[t];
      current = 0;
    } else if (t === 'and' && used) continue;
    else break;
    used = true;
  }
  return used ? { value: total + current, end: i } : null;
}

interface AmountHit {
  value: number;
  start: number;
  end: number;
  nearCurrency: boolean;
}

function findAmounts(tokens: string[]) {
  const hits: AmountHit[] = [];
  for (let i = 0; i < tokens.length; i++) {
    const t = tokens[i];
    const numeric = /^(\d+(?:\.\d+)?)(k)?$/.exec(t);
    let value: number | null = null;
    let end = i + 1;

    if (numeric) {
      value = Number(numeric[1]) * (numeric[2] ? 1_000 : 1);
      const next = tokens[i + 1];
      if (next && next in MULTIPLIERS) {
        value *= MULTIPLIERS[next];
        end = i + 2;
      } else if (next === 'hundred') {
        value *= 100;
        end = i + 2;
      }
    } else {
      const words = readNumberWords(tokens, i);
      if (words) {
        value = words.value;
        end = words.end;
      }
    }

    if (value !== null && value > 0) {
      const nearCurrency = CURRENCY.includes(tokens[end] ?? '') || CURRENCY.includes(tokens[i - 1] ?? '');
      hits.push({ value, start: i, end, nearCurrency });
      i = end - 1;
    }
  }
  return hits;
}

export const normalizeSpeech = normalize;

/** Categories named in the tokens: longest name first (so "Office Supplies" beats "Office"), then earliest mention. */
export function matchCategories<C extends ParserCategory>(tokens: string[], categories: C[]) {
  return categories
    .map((c) => ({ category: c, hit: findCategory(tokens, c) }))
    .filter((m): m is { category: C; hit: { start: number; length: number } } => m.hit !== null)
    .sort((a, b) => b.hit.length - a.hit.length || a.hit.start - b.hit.start);
}

/** The spoken amount (preferring one next to a currency word) and the token range it covers. */
export function parseAmountTokens(tokens: string[]) {
  const hits = findAmounts(tokens);
  const hit = hits.find((a) => a.nearCurrency) ?? hits[0];
  return hit ? { value: Math.round(hit.value * 100) / 100, start: hit.start, end: hit.end } : null;
}

const isoDate = (d: Date) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

export function parseVoiceExpense(transcript: string, categories: ParserCategory[], today = new Date()): ParsedVoiceExpense {
  const tokens = normalize(transcript).split(' ').filter(Boolean);
  const used = new Set<number>();
  const markUsed = (start: number, length: number) => {
    for (let i = start; i < start + length; i++) used.add(i);
  };

  const matches = matchCategories(tokens, categories);
  const best = matches[0];
  if (best) markUsed(best.hit.start, best.hit.length);

  const amounts = findAmounts(tokens).filter((a) => ![...Array(a.end - a.start).keys()].some((k) => used.has(a.start + k)));
  const amount = amounts.find((a) => a.nearCurrency) ?? amounts[0];
  if (amount) {
    markUsed(amount.start, amount.end - amount.start);
    if (CURRENCY.includes(tokens[amount.end] ?? '')) used.add(amount.end);
    if (CURRENCY.includes(tokens[amount.start - 1] ?? '')) used.add(amount.start - 1);
  }

  let dayOffset = 0;
  const joined = tokens.join(' ');
  const dbyIndex = joined.indexOf('day before yesterday');
  if (dbyIndex >= 0) {
    dayOffset = -2;
    const start = joined.slice(0, dbyIndex).split(' ').filter(Boolean).length;
    markUsed(start, 3);
  } else {
    tokens.forEach((t, i) => {
      if (t in DATE_WORDS && !used.has(i)) {
        dayOffset = DATE_WORDS[t];
        used.add(i);
      }
    });
  }
  const date = new Date(today.getFullYear(), today.getMonth(), today.getDate() + dayOffset);

  tokens.forEach((t, i) => {
    if (CURRENCY.includes(t)) used.add(i);
  });

  const remaining = tokens.filter((_, i) => !used.has(i));
  const titleWords = remaining.filter((t, i) => {
    if (!FILLER.has(t)) return true;
    // Keep joiners that sit between two meaningful words.
    return JOINERS.has(t) && i > 0 && i < remaining.length - 1 && !FILLER.has(remaining[i - 1]) && !FILLER.has(remaining[i + 1]);
  });
  const rawTitle = titleWords.join(' ').trim();
  const title = rawTitle ? rawTitle[0].toUpperCase() + rawTitle.slice(1) : best?.category.name ?? '';

  const missing: ParsedVoiceExpense['missing'] = [];
  if (!best) missing.push('category');
  if (!amount) missing.push('amount');

  return {
    transcript: transcript.trim(),
    categoryId: best?.category.id ?? null,
    alternativeCategoryIds: matches
      .slice(1)
      .map((m) => m.category.id)
      .filter((id) => id !== best?.category.id),
    amount: amount ? Math.round(amount.value * 100) / 100 : null,
    title: title.slice(0, 200),
    date: isoDate(date),
    missing,
  };
}
