"use client";

import { MessageCircle, ThumbsUp } from "lucide-react";
import { useRef, useState } from "react";

import { ReportForm } from "@/components/report-form";
import { addReplyLive, toggleLikeLive } from "@/lib/comment-live";
import { adoptServerComments, insertReply, removeReply, toggleLocalLike } from "@/lib/comment-updates";
import { addDemoReply, toggleDemoLike, type DemoState } from "@/lib/demo-state";
import { formatDateTime } from "@/lib/format";
import { LIMITS } from "@/lib/limits";
import { messageForCode } from "@/lib/messages";
import type { DataMode, PublicComment, PublicReply } from "@/lib/types";
import { validateComment } from "@/lib/validation";

export function CommentThread({
  mode,
  questionId,
  comments,
  myOptionId,
  optionText,
  demo,
  onDemoState,
  onComments,
}: {
  mode: DataMode;
  questionId: string;
  comments: PublicComment[];
  myOptionId: string | null;
  optionText: Map<string, string>;
  demo: DemoState;
  onDemoState: (state: DemoState) => void;
  onComments: (update: PublicComment[] | ((current: PublicComment[]) => PublicComment[])) => void;
}) {
  const [openReplyId, setOpenReplyId] = useState<string | null>(null);
  const [replyBody, setReplyBody] = useState("");
  const [replyError, setReplyError] = useState<string | null>(null);
  const [likeError, setLikeError] = useState<{ id: string; message: string } | null>(null);
  const likesInFlight = useRef(new Set<string>());
  const replyLock = useRef(false);

  async function like(commentId: string) {
    if (likesInFlight.current.has(commentId)) {
      return;
    }
    setLikeError(null);

    if (mode === "demo") {
      const result = toggleDemoLike(demo, questionId, commentId);
      if (!result.ok) {
        setLikeError({ id: commentId, message: messageForCode(result.code) });
        return;
      }
      onDemoState(result.state);
      return;
    }

    likesInFlight.current.add(commentId);
    onComments((current) => toggleLocalLike(current, commentId));
    const result = await toggleLikeLive(questionId, commentId);
    likesInFlight.current.delete(commentId);
    if (!result.ok) {
      onComments((current) => toggleLocalLike(current, commentId));
      setLikeError({ id: commentId, message: result.message });
    }
  }

  async function saveReply(parentId: string) {
    const validated = validateComment(replyBody);
    if (!validated.ok) {
      setReplyError(validated.message);
      return;
    }
    if (replyLock.current) {
      return;
    }
    replyLock.current = true;
    setReplyError(null);

    if (mode === "demo") {
      const result = addDemoReply(demo, questionId, parentId, validated.value.body);
      replyLock.current = false;
      if (!result.ok) {
        setReplyError(messageForCode(result.code));
        return;
      }
      onDemoState(result.state);
      setReplyBody("");
      setOpenReplyId(null);
      return;
    }

    const pendingId = `pending-${crypto.randomUUID()}`;
    const body = validated.value.body;
    onComments((current) =>
      insertReply(current, parentId, {
        id: pendingId,
        optionId: myOptionId || current.find((comment) => comment.id === parentId)?.optionId || "",
        body,
        createdAt: new Date().toISOString(),
        likeCount: 0,
        likedByMe: false,
        mine: true,
      }),
    );
    setReplyBody("");
    setOpenReplyId(null);

    const result = await addReplyLive(questionId, parentId, body);
    replyLock.current = false;
    if (!result.ok) {
      onComments((current) => removeReply(current, pendingId));
      setReplyBody(body);
      setOpenReplyId(parentId);
      setReplyError(result.message);
      return;
    }
    if (result.comments) {
      onComments((current) => adoptServerComments(current, result.comments ?? []));
    }
  }

  return (
    <ul className="mt-4 space-y-3">
      {comments.map((comment) => (
        <li key={comment.id} className="rounded-2xl border border-line px-4 py-3">
          <CommentBodyView item={comment} optionText={optionText} badge={comment.mine ? "내 의견" : null} />
          <CommentActions
            item={comment}
            canReply
            mode={mode}
            demo={demo}
            onDemoState={onDemoState}
            likeError={likeError?.id === comment.id ? likeError.message : null}
            replyOpen={openReplyId === comment.id}
            onLike={() => void like(comment.id)}
            onToggleReply={() => {
              setReplyError(null);
              setReplyBody("");
              setOpenReplyId((current) => (current === comment.id ? null : comment.id));
            }}
          />
          {openReplyId === comment.id ? (
            <form
              className="mt-3 space-y-2 rounded-2xl bg-background px-3 py-3"
              onSubmit={(event) => {
                event.preventDefault();
                void saveReply(comment.id);
              }}
            >
              <label className="block text-sm font-semibold" htmlFor={`reply-${comment.id}`}>
                답글
                <textarea
                  id={`reply-${comment.id}`}
                  value={replyBody}
                  onChange={(event) => setReplyBody(event.target.value)}
                  maxLength={LIMITS.comment}
                  rows={3}
                  placeholder="이 의견에 짧게 답해 주세요."
                  className="mt-2 w-full rounded-2xl border border-line bg-card px-3 py-3 font-normal"
                />
              </label>
              <p className="text-right text-xs text-muted">
                {replyBody.length}/{LIMITS.comment}
              </p>
              <p className="text-xs leading-5 text-muted">이름은 표시되지 않습니다. 같은 의견에 답글을 여러 번 남길 수 있습니다.</p>
              {replyError ? (
                <p className="text-sm text-danger" role="alert">
                  {replyError}
                </p>
              ) : null}
              <div className="flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => {
                    setOpenReplyId(null);
                    setReplyBody("");
                    setReplyError(null);
                  }}
                  className="inline-flex min-h-11 items-center rounded-full px-3 text-sm font-semibold text-muted"
                >
                  닫기
                </button>
                <button
                  type="submit"
                  className="inline-flex min-h-11 items-center rounded-full bg-foreground px-4 text-sm font-semibold text-card"
                >
                  답글 남기기
                </button>
              </div>
            </form>
          ) : null}
          {comment.replies.length > 0 ? (
            <ul className="mt-3 space-y-3 border-l border-line pl-3">
              {comment.replies.map((reply) => (
                <li key={reply.id} className="rounded-2xl bg-background px-3 py-3">
                  <CommentBodyView item={reply} optionText={optionText} badge={reply.mine ? "내 답글" : "답글"} />
                  <CommentActions
                    item={reply}
                    canReply={false}
                    mode={mode}
                    demo={demo}
                    onDemoState={onDemoState}
                    likeError={likeError?.id === reply.id ? likeError.message : null}
                    replyOpen={false}
                    onLike={() => void like(reply.id)}
                    onToggleReply={() => undefined}
                  />
                </li>
              ))}
            </ul>
          ) : null}
        </li>
      ))}
    </ul>
  );
}

function CommentBodyView({
  item,
  optionText,
  badge,
}: {
  item: PublicReply;
  optionText: Map<string, string>;
  badge: string | null;
}) {
  return (
    <div>
      <p className="text-xs font-semibold text-muted">
        {badge ? <span className="mr-2 text-accent">{badge}</span> : null}
        {optionText.get(item.optionId) ?? "선택"}
      </p>
      <p className="mt-2 leading-7">{item.body}</p>
    </div>
  );
}

function CommentActions({
  item,
  canReply,
  mode,
  demo,
  onDemoState,
  likeError,
  replyOpen,
  onLike,
  onToggleReply,
}: {
  item: PublicReply;
  canReply: boolean;
  mode: DataMode;
  demo: DemoState;
  onDemoState: (state: DemoState) => void;
  likeError: string | null;
  replyOpen: boolean;
  onLike: () => void;
  onToggleReply: () => void;
}) {
  const likeLabel = item.likeCount > 0 ? `추천 ${item.likeCount}` : "추천";
  return (
    <div className="mt-3">
      <div className="flex flex-wrap items-center gap-1">
        <time className="mr-auto text-xs text-muted" dateTime={item.createdAt}>
          {formatDateTime(item.createdAt)}
        </time>
        <button
          type="button"
          onClick={onLike}
          disabled={item.id.startsWith("pending-")}
          aria-pressed={item.likedByMe}
          aria-label={item.likedByMe ? `추천 취소, ${item.likeCount}` : likeLabel}
          className={`inline-flex min-h-11 items-center gap-1.5 rounded-full px-3 text-sm font-semibold disabled:opacity-50 ${
            item.likedByMe ? "bg-accent-soft text-accent-strong" : "text-muted"
          }`}
        >
          <ThumbsUp className={`h-4 w-4 ${item.likedByMe ? "fill-current" : ""}`} aria-hidden="true" />
          {likeLabel}
        </button>
        {canReply ? (
          <button
            type="button"
            onClick={onToggleReply}
            aria-expanded={replyOpen}
            className={`inline-flex min-h-11 items-center gap-1.5 rounded-full px-3 text-sm font-semibold ${
              replyOpen ? "bg-foreground text-card" : "text-muted"
            }`}
          >
            <MessageCircle className="h-4 w-4" aria-hidden="true" />
            답글
          </button>
        ) : null}
        {item.id.startsWith("pending-") ? null : (
          <ReportForm mode={mode} targetType="comment" targetId={item.id} demoState={demo} onDemoState={onDemoState} />
        )}
      </div>
      {likeError ? (
        <p className="mt-1 text-sm text-danger" role="alert">
          {likeError}
        </p>
      ) : null}
    </div>
  );
}
