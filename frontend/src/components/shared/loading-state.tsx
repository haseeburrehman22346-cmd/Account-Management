import { Loader2Icon } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";

/** Full-area spinner, used while the session is being resolved. */
export function FullPageLoader() {
  return (
    <div className="flex flex-1 items-center justify-center py-24">
      <Loader2Icon className="size-6 animate-spin text-muted-foreground" />
    </div>
  );
}

export function CardGridSkeleton({ count = 6 }: { count?: number }) {
  return (
    <div className="@container">
      <div className="grid gap-4 @2xl:grid-cols-2 @5xl:grid-cols-3 @7xl:grid-cols-4">
        {Array.from({ length: count }, (_, i) => (
          <Skeleton key={i} className="h-60 rounded-xl" />
        ))}
      </div>
    </div>
  );
}

export function TableSkeleton({ rows = 5 }: { rows?: number }) {
  return (
    <div className="space-y-2">
      {Array.from({ length: rows }, (_, i) => (
        <Skeleton key={i} className="h-12 rounded-lg" />
      ))}
    </div>
  );
}
