export function HomeSkeleton() {
  return (
    <div className="space-y-4" aria-hidden="true">
      <div className="h-36 animate-pulse rounded-[1.75rem] bg-card/90" />
      <div className="h-48 animate-pulse rounded-[1.75rem] bg-card/90" />
      <div className="grid gap-3 sm:grid-cols-2">
        <div className="h-40 animate-pulse rounded-[1.5rem] bg-card/90" />
        <div className="h-40 animate-pulse rounded-[1.5rem] bg-card/90" />
      </div>
    </div>
  );
}

export function QuestionSkeleton() {
  return (
    <div className="space-y-4" aria-hidden="true">
      <div className="h-8 w-24 animate-pulse rounded-full bg-card/90" />
      <div className="h-28 animate-pulse rounded-[1.75rem] bg-card/90" />
      <div className="h-16 animate-pulse rounded-[1.5rem] bg-card/90" />
      <div className="h-16 animate-pulse rounded-[1.5rem] bg-card/90" />
    </div>
  );
}
