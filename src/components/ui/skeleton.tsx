import { cn } from "cn";

function Skeleton({ className, ...props }: React.ComponentProps<"div">) {
  return <div data-slot="skeleton" className={cn("animate-pulse rounded-md bg-muted", className)} {...props} />;
}

// Suspense fallback for list pages: a few placeholder rows, with the label for screen readers.
function ListSkeleton({ label, rows = 3 }: { label: string; rows?: number }) {
  return (
    <div role="status" className="grid gap-3">
      <span className="sr-only">{label}</span>
      {Array.from({ length: rows }, (_, i) => (
        <div key={i} className="grid gap-2 rounded-xl p-4 ring-1 ring-foreground/10">
          <Skeleton className="h-4 w-1/3" />
          <Skeleton className="h-3 w-2/3" />
        </div>
      ))}
    </div>
  );
}

export { ListSkeleton, Skeleton };
