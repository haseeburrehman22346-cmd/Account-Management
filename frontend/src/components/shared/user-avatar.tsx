import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { CATEGORY_COLORS } from "@/data";
import { initials } from "@/lib/format";
import { cn } from "@/lib/utils";

/** Stable per-name tint so the same person always gets the same avatar color. */
function tintFor(name: string) {
  let hash = 0;
  for (const ch of name) hash = (hash * 31 + ch.charCodeAt(0)) | 0;
  return CATEGORY_COLORS[Math.abs(hash) % CATEGORY_COLORS.length].value;
}

export function UserAvatar({
  name,
  size = "default",
  className,
}: {
  name: string;
  size?: "sm" | "default" | "lg";
  className?: string;
}) {
  return (
    <Avatar size={size} className={className}>
      <AvatarFallback className="font-medium text-white" style={{ backgroundColor: tintFor(name) }}>
        {initials(name)}
      </AvatarFallback>
    </Avatar>
  );
}

export function UserAvatarWithName({
  name,
  subtitle,
  isYou,
  className,
}: {
  name: string;
  subtitle?: string;
  isYou?: boolean;
  className?: string;
}) {
  return (
    <div className={cn("flex min-w-0 items-center gap-2.5", className)}>
      <UserAvatar name={name} size="sm" />
      <div className="min-w-0">
        <p className="truncate font-medium">
          {name}
          {isYou && <span className="ml-1 font-normal text-muted-foreground">(you)</span>}
        </p>
        {subtitle && <p className="truncate text-xs text-muted-foreground">{subtitle}</p>}
      </div>
    </div>
  );
}
