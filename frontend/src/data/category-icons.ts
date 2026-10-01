import {
  BriefcaseIcon,
  CarIcon,
  EllipsisIcon,
  FilmIcon,
  FolderIcon,
  GamepadIcon,
  GiftIcon,
  GraduationCapIcon,
  HeartPulseIcon,
  HouseIcon,
  PlaneIcon,
  ShirtIcon,
  ShoppingCartIcon,
  UtensilsIcon,
  WifiIcon,
  ZapIcon,
  type LucideIcon,
} from "lucide-react";

export interface CategoryIconOption {
  key: string;
  label: string;
  icon: LucideIcon;
}

export const CATEGORY_ICONS: CategoryIconOption[] = [
  { key: "utensils", label: "Food", icon: UtensilsIcon },
  { key: "shopping-cart", label: "Shopping", icon: ShoppingCartIcon },
  { key: "car", label: "Transport", icon: CarIcon },
  { key: "plane", label: "Travel", icon: PlaneIcon },
  { key: "briefcase", label: "Office", icon: BriefcaseIcon },
  { key: "zap", label: "Utilities", icon: ZapIcon },
  { key: "wifi", label: "Internet", icon: WifiIcon },
  { key: "house", label: "Home", icon: HouseIcon },
  { key: "film", label: "Entertainment", icon: FilmIcon },
  { key: "gamepad", label: "Games", icon: GamepadIcon },
  { key: "heart-pulse", label: "Health", icon: HeartPulseIcon },
  { key: "graduation-cap", label: "Education", icon: GraduationCapIcon },
  { key: "shirt", label: "Clothing", icon: ShirtIcon },
  { key: "gift", label: "Gifts", icon: GiftIcon },
  { key: "ellipsis", label: "Other", icon: EllipsisIcon },
  { key: "folder", label: "General", icon: FolderIcon },
];

export const DEFAULT_CATEGORY_ICON = "folder";

const byKey = new Map(CATEGORY_ICONS.map((i) => [i.key, i.icon]));

/** Unknown keys (e.g. emoji icons from older data) fall back to a folder. */
export const getCategoryIcon = (key: string | null | undefined): LucideIcon => byKey.get(key ?? "") ?? FolderIcon;
