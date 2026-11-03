"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";

import { deleteDemoPost, demoMyComments } from "@/lib/demo-state";
import { useDemoState, writeDemoState } from "@/lib/demo-storage";
import { formatDateTime } from "@/lib/format";
import { messageForCode } from "@/lib/messages";
import { getSeedQuestions } from "@/lib/seed-questions";
import type { DataMode, MyCommentItem } from "@/lib/types";
import { deleteMyCommentAction } from "@/server/actions";

export function MyCommentsView({
  mode,
  initialItems,
  error,
}: {
  mode: DataMode;
  initialItems: MyCommentItem[];
  error: string | null;
}) {
  const router = useRouter();
  const demo = useDemoState();
  const [items, setItems] = useState(initialItems);
  const [pendingId, setPendingId] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const titles = useMemo(
    () => new Map(getSeedQuestions().map((question) => [question.id, question.title])),
    [],
  );
  const visible = mode === "demo" ? demoMyComments(demo, titles) : items;

  async function removeItem(item: MyCommentItem) {
    const label = item.isReply ? "답글" : "댓글";
    const confirmed = window.confirm(`이 ${label}을 삭제할까요? 삭제하면 되돌릴 수 없습니다.`);
    if (!confirmed) {
      return;
    }
    setActionError(null);
    setPendingId(item.id);

    if (mode === "demo") {
      const result = deleteDemoPost(demo, item.questionId, item.id);
      setPendingId(null);
      if (!result.ok) {
        setActionError(messageForCode(result.code));
        return;
      }
      writeDemoState(result.state);
      return;
    }

    const result = await deleteMyCommentAction(item.questionId, item.id);
    setPendingId(null);
    if (!result.ok) {
      setActionError(result.message || messageForCode(result.code));
      return;
    }
    setItems((current) => current.filter((row) => row.id !== item.id));
    router.refresh();
  }

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <header>
        <h1 className="text-2xl font-bold sm:text-3xl">내가 쓴 댓글</h1>
        <p className="mt-3 leading-7 text-muted">
          내가 남긴 댓글과 답글입니다. 항목을 누르면 해당 질문으로 이동하고, 필요하면 여기서 삭제할 수 있습니다.
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
      {actionError ? (
        <p className="rounded-2xl border border-danger/20 px-4 py-3 text-sm text-danger" role="alert">
          {actionError}
        </p>
      ) : null}
      <CommentRows items={visible} pendingId={pendingId} onDelete={(item) => void removeItem(item)} />
    </div>
  );
}

function CommentRows({
  items,
  pendingId,
  onDelete,
}: {
  items: MyCommentItem[];
  pendingId: string | null;
  onDelete: (item: MyCommentItem) => void;
}) {
  if (items.length === 0) {
    return (
      <p className="rounded-3xl border border-dashed border-line px-4 py-8 text-sm leading-6 text-muted">
        아직 남긴 댓글이나 답글이 없습니다.
      </p>
    );
  }

  return (
    <ul className="space-y-3">
      {items.map((item) => {
        const busy = pendingId === item.id;
        return (
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
            <div className="mt-4 flex justify-end">
              <button
                type="button"
                disabled={busy}
                onClick={() => onDelete(item)}
                className="inline-flex min-h-11 w-full items-center justify-center rounded-2xl border border-danger/30 px-4 text-sm font-semibold text-danger disabled:opacity-50 sm:w-auto"
              >
                {busy ? "삭제 중" : "삭제"}
              </button>
            </div>
          </li>
        );
      })}
    </ul>
  );
}
