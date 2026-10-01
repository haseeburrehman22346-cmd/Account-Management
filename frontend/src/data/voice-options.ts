export const VOICE_LANGUAGES = [
  { value: "en-US", label: "English" },
  { value: "en-IN", label: "English (South Asia)" },
  { value: "ur-PK", label: "اردو Urdu" },
] as const;

export const DEFAULT_VOICE_LANGUAGE = "en-US";

export type VoiceMode = "expense" | "category";

export const VOICE_MODES: { value: VoiceMode; label: string }[] = [
  { value: "expense", label: "Add Expense" },
  { value: "category", label: "Create Category" },
];

export const VOICE_EXAMPLES: Record<VoiceMode, string[]> = {
  expense: [
    "Food 500 lunch with team",
    "Transport 1,200 rupees Uber ride yesterday",
    "Kal food mein 700 rupay ka khana",
    "Utilities 2.5k electricity bill",
  ],
  category: [
    "Category food amount 20000",
    "New category internet budget 5k for Ali",
    "Health ki category banao 10 hazar budget",
    "Create category office supplies for Sara and Hassan",
  ],
};
