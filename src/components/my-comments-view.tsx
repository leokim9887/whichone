"use client";

import Link from "next/link";
import { useMemo } from "react";

import { demoMyComments } from "@/lib/demo-state";
import { useDemoState } from "@/lib/demo-storage";
import { formatDateTime } from "@/lib/format";
import { getSeedQuestions } from "@/lib/seed-questions";
import type { DataMode, MyCommentItem } from "@/lib/types";

function CommentRows({ items }: { items: MyCommentItem[] }) {
  if (items.length === 0) {
    return (
      <p className="rounded-3xl border border-dashed border-line px-4 py-8 text-sm leading-6 text-muted">
        아직 남긴 댓글이나 답글이 없습니다.
      </p>
    );
  }

  return (
    <ul className="space-y-3">
      {items.map((item) => (
        <li key={item.id} className="rounded-3xl border border-line bg-card p-5">
          <Link
            href={`/questions/${item.questionId}?comment=${encodeURIComponent(item.id)}`}
            className="block hover:opacity-90"
          >
            <div className="flex flex-wrap items-center gap-2 text-xs font-semibold text-muted">
              <span className="text-accent">{item.isReply ? "내 답글" : "내 댓글"}</span>
              <time dateTime={item.createdAt}>{formatDateTime(item.createdAt)}</time>
            </div>
            <p className="mt-2 text-sm font-semibold text-foreground">{item.questionTitle}</p>
            <p className="mt-2 line-clamp-3 leading-7 text-muted">{item.body}</p>
            <p className="mt-3 text-sm font-semibold text-accent">질문에서 보기</p>
          </Link>
        </li>
      ))}
    </ul>
  );
}

export function MyCommentsView({
  mode,
  initialItems,
  error,
}: {
  mode: DataMode;
  initialItems: MyCommentItem[];
  error: string | null;
}) {
  const demo = useDemoState();
  const titles = useMemo(
    () => new Map(getSeedQuestions().map((question) => [question.id, question.title])),
    [],
  );
  const items = mode === "demo" ? demoMyComments(demo, titles) : initialItems;

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <header>
        <h1 className="text-3xl font-bold">내가 쓴 댓글</h1>
        <p className="mt-3 leading-7 text-muted">
          내가 남긴 댓글과 답글입니다. 항목을 누르면 해당 질문으로 이동해 그 글로 이동합니다.
        </p>
      </header>
      {mode === "demo" ? (
        <p className="rounded-2xl bg-[#fff7ed] px-4 py-3 text-sm leading-6 text-warn" role="status">
          데모 모드에서는 이 브라우저에 저장한 댓글·답글만 보입니다.
        </p>
      ) : null}
      {error ? (
        <p className="rounded-2xl border border-danger/20 px-4 py-3 text-sm text-danger" role="alert">
          {error}
        </p>
      ) : null}
      <CommentRows items={items} />
    </div>
  );
}
