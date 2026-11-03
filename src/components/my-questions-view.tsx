"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";

import { deleteDemoSuggestion, demoMyQuestions } from "@/lib/demo-state";
import { useDemoState, writeDemoState } from "@/lib/demo-storage";
import { formatDateTime, formatQuestionStats } from "@/lib/format";
import { messageForCode } from "@/lib/messages";
import { categoryTopicLabel } from "@/lib/topics";
import type { DataMode, MyQuestionItem } from "@/lib/types";
import { deleteMyQuestionAction } from "@/server/actions";

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

export function MyQuestionsView({
  mode,
  initialItems,
  error,
}: {
  mode: DataMode;
  initialItems: MyQuestionItem[];
  error: string | null;
}) {
  const router = useRouter();
  const demo = useDemoState();
  const [items, setItems] = useState(initialItems);
  const [pendingId, setPendingId] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const visible = mode === "demo" ? demoMyQuestions(demo) : items;

  async function removeItem(item: MyQuestionItem) {
    const confirmed = window.confirm(`「${item.title}」 질문을 삭제할까요? 삭제하면 되돌릴 수 없습니다.`);
    if (!confirmed) {
      return;
    }
    setActionError(null);
    setPendingId(item.id);

    if (mode === "demo") {
      const result = deleteDemoSuggestion(demo, item.id);
      setPendingId(null);
      if (!result.ok) {
        setActionError(messageForCode(result.code));
        return;
      }
      writeDemoState(result.state);
      return;
    }

    const result = await deleteMyQuestionAction(item.id, item.source);
    setPendingId(null);
    if (!result.ok) {
      setActionError(result.message || messageForCode(result.code));
      return;
    }
    setItems((current) => current.filter((row) => !(row.id === item.id && row.source === item.source)));
    router.refresh();
  }

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <header>
        <h1 className="text-2xl font-bold sm:text-3xl">내 질문</h1>
        <p className="mt-3 leading-7 text-muted">내가 작성해 공개한 질문을 모았습니다. 필요하면 여기서 삭제할 수 있습니다.</p>
      </header>
      {mode === "demo" ? (
        <p className="rounded-2xl bg-[#fff7ed] px-4 py-3 text-sm leading-6 text-warn" role="status">
          데모 모드에서는 이 브라우저에 저장한 작성 내용만 보입니다.
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
      <QuestionRows items={visible} pendingId={pendingId} onDelete={(item) => void removeItem(item)} />
    </div>
  );
}

function QuestionRows({
  items,
  pendingId,
  onDelete,
}: {
  items: MyQuestionItem[];
  pendingId: string | null;
  onDelete: (item: MyQuestionItem) => void;
}) {
  if (items.length === 0) {
    return (
      <p className="rounded-3xl border border-dashed border-line px-4 py-8 text-sm leading-6 text-muted">
        아직 만든 질문이 없습니다. 질문을 작성하면 여기에 나타납니다.
      </p>
    );
  }

  return (
    <ul className="space-y-3">
      {items.map((item) => {
        const canOpen = item.source === "question" && item.status === "published";
        const busy = pendingId === item.id;
        return (
          <li key={`${item.source}-${item.id}`} className="rounded-3xl border border-line bg-card p-5">
            {canOpen ? (
              <Link href={`/questions/${item.id}`} className="block hover:opacity-90">
                <QuestionBody item={item} canOpen={canOpen} />
              </Link>
            ) : (
              <QuestionBody item={item} canOpen={canOpen} />
            )}
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

function QuestionBody({ item, canOpen }: { item: MyQuestionItem; canOpen: boolean }) {
  return (
    <>
      <div className="flex flex-wrap items-center gap-2 text-xs font-semibold">
        <span className="text-accent">{categoryTopicLabel(item.category, item.topic)}</span>
        <span className="rounded-full bg-background px-2 py-0.5 text-muted">{statusLabel(item)}</span>
      </div>
      <h2 className="mt-2 text-lg font-bold leading-7">{item.title}</h2>
      <p className="mt-2 text-sm text-muted">
        {canOpen ? formatQuestionStats(item.participantCount, item.commentCount) : `작성일 ${formatDateTime(item.createdAt)}`}
      </p>
    </>
  );
}
