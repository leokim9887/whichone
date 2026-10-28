"use client";

import Link from "next/link";

import { demoMyQuestions } from "@/lib/demo-state";
import { useDemoState } from "@/lib/demo-storage";
import { formatDateTime, formatQuestionStats } from "@/lib/format";
import { categoryTopicLabel } from "@/lib/topics";
import type { DataMode, MyQuestionItem } from "@/lib/types";

function statusLabel(item: MyQuestionItem): string {
  if (item.source === "suggestion" || item.status === "pending") {
    return "검토 중";
  }
  if (item.status === "published") {
    return "공개됨";
  }
  if (item.status === "hidden") {
    return "숨김";
  }
  if (item.status === "draft") {
    return "초안";
  }
  if (item.status === "rejected") {
    return "거절됨";
  }
  return item.status;
}

function QuestionRows({ items }: { items: MyQuestionItem[] }) {
  if (items.length === 0) {
    return (
      <p className="rounded-3xl border border-dashed border-line px-4 py-8 text-sm leading-6 text-muted">
        아직 만든 질문이 없습니다. 질문을 제안하면 여기에 나타납니다.
      </p>
    );
  }

  return (
    <ul className="space-y-3">
      {items.map((item) => {
        const canOpen = item.source === "question" && item.status === "published";
        const body = (
          <>
            <div className="flex flex-wrap items-center gap-2 text-xs font-semibold">
              <span className="text-accent">{categoryTopicLabel(item.category, item.topic)}</span>
              <span className="rounded-full bg-background px-2 py-0.5 text-muted">{statusLabel(item)}</span>
            </div>
            <h2 className="mt-2 text-lg font-bold leading-7">{item.title}</h2>
            <p className="mt-2 text-sm text-muted">
              {canOpen
                ? formatQuestionStats(item.participantCount, item.commentCount)
                : `제안일 ${formatDateTime(item.createdAt)}`}
            </p>
          </>
        );
        return (
          <li key={`${item.source}-${item.id}`} className="rounded-3xl border border-line bg-card p-5">
            {canOpen ? (
              <Link href={`/questions/${item.id}`} className="block hover:opacity-90">
                {body}
              </Link>
            ) : (
              body
            )}
          </li>
        );
      })}
    </ul>
  );
}

export function MyQuestionsView({
  mode,
  initialItems,
  error,
}: {
  mode: DataMode;
  initialItems: MyQuestionItem[];
  error: string | null;
}) {
  const demo = useDemoState();
  const items = mode === "demo" ? demoMyQuestions(demo) : initialItems;

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <header>
        <h1 className="text-3xl font-bold">내 질문</h1>
        <p className="mt-3 leading-7 text-muted">
          제안해 공개된 질문과 아직 검토 중인 제안을 모았습니다.
        </p>
      </header>
      {mode === "demo" ? (
        <p className="rounded-2xl bg-[#fff7ed] px-4 py-3 text-sm leading-6 text-warn" role="status">
          데모 모드에서는 이 브라우저에 저장한 제안만 보입니다.
        </p>
      ) : null}
      {error ? (
        <p className="rounded-2xl border border-danger/20 px-4 py-3 text-sm text-danger" role="alert">
          {error}
        </p>
      ) : null}
      <QuestionRows items={items} />
    </div>
  );
}
