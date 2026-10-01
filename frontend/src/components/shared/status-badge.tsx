import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

/** Active/inactive pill with a dot, so state isn't conveyed by color alone. */
export function StatusBadge({ active, className }: { active: boolean; className?: string }) {
  return (
    <Badge
      variant="outline"
      className={cn(
        "gap-1.5 border-transparent",
        active ? "bg-accent text-accent-foreground" : "bg-muted text-muted-foreground",
        className,
      )}
    >
      <span className={cn("size-1.5 rounded-full", active ? "bg-primary" : "bg-muted-foreground/60")} />
      {active ? "Active" : "Inactive"}
    </Badge>
  );
}
