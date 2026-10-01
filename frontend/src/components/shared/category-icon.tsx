import { createElement } from "react";
import { getCategoryIcon } from "@/data";

/** Renders the lucide icon registered for a category icon key. */
export function CategoryIcon({ icon, className }: { icon: string | null | undefined; className?: string }) {
  return createElement(getCategoryIcon(icon), { className, "aria-hidden": true });
}
