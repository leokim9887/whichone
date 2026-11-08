"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";

import { PageHeader } from "@/components/page-header";
import { deleteDemoPost, demoMyComments } from "@/lib/demo-state";
import { useDemoState, writeDemoState } from "@/lib/demo-storage";
import { formatDateTime } from "@/lib/format";
import { messageForCode } from "@/lib/messages";
import { listMyCommentsLive } from "@/lib/my-content-live";
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
  const [itemsSource, setItemsSource] = useState(initialItems);
  const [pendingId, setPendingId] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  if (initialItems !== itemsSource) {
    setItemsSource(initialItems);
    setItems(initialItems);
  }
  const titles = useMemo(
    () => new Map(getSeedQuestions().map((question) => [question.id, question.title])),
    [],
  );
  const visible = mode === "demo" ? demoMyComments(demo, titles) : items;

  useEffect(() => {
    if (mode !== "live") {
      return;
    }
    let cancelled = false;
    void listMyCommentsLive().then((fresh) => {
      if (!cancelled && fresh) {
        setItems(fresh);
      }
    });
    return () => {
      cancelled = true;
    };
  }, [mode]);

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
      <PageHeader
        eyebrow="마이페이지"
        title="내가 쓴 댓글"
        description="남긴 댓글과 답글이에요. 항목을 누르면 해당 질문으로 이동하고, 필요하면 여기서 삭제할 수 있어요."
      />
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
      <p className="rounded-[1.75rem] border border-dashed border-line bg-card/70 px-4 py-8 text-sm leading-6 text-muted">
        아직 남긴 댓글이나 답글이 없습니다.
      </p>
    );
  }

  return (
    <ul className="space-y-3">
      {items.map((item, index) => {
        const busy = pendingId === item.id;
        return (
          <li
            key={item.id}
            className="hover-lift rise-in rounded-[1.5rem] border border-line bg-card p-5"
            style={{ animationDelay: `${Math.min(index, 8) * 45}ms` }}
          >
            <Link
              href={`/questions/${item.questionId}?comment=${encodeURIComponent(item.id)}`}
              className="block transition hover:opacity-90"
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
                className="pressable inline-flex min-h-11 w-full items-center justify-center rounded-2xl border border-danger/30 px-4 text-sm font-semibold text-danger disabled:opacity-50 sm:w-auto"
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
