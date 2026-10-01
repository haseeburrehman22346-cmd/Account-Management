import { getCategoryColor } from "@/data";
import { cn } from "@/lib/utils";
import { CategoryIcon } from "./category-icon";

const SIZES = {
  sm: "size-8 rounded-md [&_svg]:size-4",
  md: "size-10 rounded-lg [&_svg]:size-5",
  lg: "size-14 rounded-xl [&_svg]:size-7",
};

/** Category icon on a tile of the category's color. */
export function CategoryAvatar({
  icon,
  color,
  size = "md",
  shape = "square",
  className,
}: {
  icon: string | null;
  color: string | null;
  size?: keyof typeof SIZES;
  shape?: "square" | "circle";
  className?: string;
}) {
  return (
    <span
      className={cn(
        "flex shrink-0 items-center justify-center text-white",
        SIZES[size],
        shape === "circle" && "rounded-full",
        className,
      )}
      style={{ backgroundColor: getCategoryColor(color) }}
      aria-hidden
    >
      <CategoryIcon icon={icon} />
    </span>
  );
}
