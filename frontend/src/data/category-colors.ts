export interface CategoryColorOption {
  key: string;
  label: string;
  /** CSS variable defined in globals.css, with separate light and dark steps. */
  value: string;
}

/**
 * Categorical palette in its validated order (colorblind-safe adjacent pairs in light and dark).
 * Charts place slices in this order; "slate" is a neutral for catch-all categories.
 */
export const CATEGORY_COLORS: CategoryColorOption[] = [
  { key: "blue", label: "Blue", value: "var(--cat-blue)" },
  { key: "orange", label: "Orange", value: "var(--cat-orange)" },
  { key: "aqua", label: "Aqua", value: "var(--cat-aqua)" },
  { key: "yellow", label: "Yellow", value: "var(--cat-yellow)" },
  { key: "magenta", label: "Magenta", value: "var(--cat-magenta)" },
  { key: "green", label: "Green", value: "var(--cat-green)" },
  { key: "violet", label: "Violet", value: "var(--cat-violet)" },
  { key: "red", label: "Red", value: "var(--cat-red)" },
  { key: "slate", label: "Slate", value: "var(--cat-slate)" },
];

export const DEFAULT_CATEGORY_COLOR = "green";

const byKey = new Map(CATEGORY_COLORS.map((c, index) => [c.key, { ...c, index }]));

export const getCategoryColor = (key: string | null | undefined) =>
  (byKey.get(key ?? "") ?? byKey.get(DEFAULT_CATEGORY_COLOR)!).value;

/** Palette position, used to order chart slices so neighbours stay distinguishable. */
export const categoryColorIndex = (key: string | null | undefined) =>
  byKey.get(key ?? "")?.index ?? byKey.get(DEFAULT_CATEGORY_COLOR)!.index;
