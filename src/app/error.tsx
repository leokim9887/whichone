"use client";

export default function Error({
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <div className="rounded-3xl border border-line bg-card px-5 py-8" role="alert">
      <h1 className="text-2xl font-bold">화면을 표시하지 못했습니다</h1>
      <p className="mt-2 text-sm leading-6 text-muted">잠시 후 다시 시도해 주세요.</p>
      <button
        type="button"
        onClick={() => reset()}
        className="mt-4 inline-flex min-h-11 items-center rounded-2xl bg-accent px-4 text-sm font-semibold text-white"
      >
        다시 시도
      </button>
    </div>
  );
}
