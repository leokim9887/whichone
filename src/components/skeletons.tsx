export function HomeSkeleton() {
  return (
    <div className="space-y-4" aria-hidden="true">
      <div className="h-28 rounded-3xl bg-card" />
      <div className="h-44 rounded-3xl bg-card" />
      <div className="grid gap-3 sm:grid-cols-2">
        <div className="h-36 rounded-3xl bg-card" />
        <div className="h-36 rounded-3xl bg-card" />
      </div>
    </div>
  );
}

export function QuestionSkeleton() {
  return (
    <div className="space-y-4" aria-hidden="true">
      <div className="h-8 w-24 rounded-full bg-card" />
      <div className="h-16 rounded-3xl bg-card" />
      <div className="h-28 rounded-3xl bg-card" />
      <div className="h-28 rounded-3xl bg-card" />
    </div>
  );
}
