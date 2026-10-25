import Link from "next/link";

import { VoteHint } from "@/components/vote-hint";
import { categoryLabel } from "@/lib/categories";
import { formatParticipantCount } from "@/lib/format";
import type { DataMode, Question } from "@/lib/types";

export function QuestionCard({
  question,
  mode,
  voted,
}: {
  question: Question;
  mode: DataMode;
  voted: boolean;
}) {
  return (
    <article className="flex h-full flex-col rounded-3xl border border-line bg-card p-5 shadow-[0_1px_0_rgba(28,25,23,0.03)]">
      <p className="text-xs font-semibold tracking-wide text-accent">{categoryLabel(question.category)}</p>
      <h3 className="mt-2 text-lg font-bold leading-7 text-foreground">{question.title}</h3>
      <div className="mt-5 flex items-center justify-between gap-3">
        <p className="text-sm text-muted">
          {mode === "demo" ? "데모 · 공유 집계 전" : formatParticipantCount(question.participantCount)}
        </p>
        <Link
          href={`/questions/${question.id}`}
          className="inline-flex min-h-11 items-center rounded-2xl px-2 text-sm font-semibold text-accent"
        >
          <VoteHint mode={mode} questionId={question.id} voted={voted} />
        </Link>
      </div>
    </article>
  );
}
