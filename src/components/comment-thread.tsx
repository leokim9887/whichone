"use client";

import { LoaderCircle, MessageCircle, ThumbsUp } from "lucide-react";
import { useState } from "react";

import { ReportForm } from "@/components/report-form";
import { addDemoReply, toggleDemoLike, type DemoState } from "@/lib/demo-state";
import { formatDateTime } from "@/lib/format";
import { LIMITS } from "@/lib/limits";
import { messageForCode } from "@/lib/messages";
import type { DataMode, PublicComment, PublicReply } from "@/lib/types";
import { validateComment } from "@/lib/validation";
import { addReplyAction, toggleCommentLikeAction } from "@/server/actions";

export function CommentThread({
  mode,
  questionId,
  comments,
  optionText,
  demo,
  onDemoState,
  onComments,
}: {
  mode: DataMode;
  questionId: string;
  comments: PublicComment[];
  optionText: Map<string, string>;
  demo: DemoState;
  onDemoState: (state: DemoState) => void;
  onComments: (comments: PublicComment[]) => void;
}) {
  const [openReplyId, setOpenReplyId] = useState<string | null>(null);
  const [replyBody, setReplyBody] = useState("");
  const [replyError, setReplyError] = useState<string | null>(null);
  const [replySaving, setReplySaving] = useState(false);
  const [likeSavingId, setLikeSavingId] = useState<string | null>(null);
  const [likeError, setLikeError] = useState<{ id: string; message: string } | null>(null);

  async function like(commentId: string) {
    if (likeSavingId) {
      return;
    }
    setLikeSavingId(commentId);
    setLikeError(null);

    if (mode === "demo") {
      const result = toggleDemoLike(demo, questionId, commentId);
      setLikeSavingId(null);
      if (!result.ok) {
        setLikeError({ id: commentId, message: messageForCode(result.code) });
      }
      return;
    }

    const result = await toggleCommentLikeAction(questionId, commentId);
    setLikeSavingId(null);
    if (!result.ok) {
      setLikeError({ id: commentId, message: result.message });
      return;
    }
    onComments(result.comments);
  }

  async function saveReply(parentId: string) {
    const validated = validateComment(replyBody);
    if (!validated.ok) {
      setReplyError(validated.message);
      return;
    }
    setReplySaving(true);
    setReplyError(null);

    if (mode === "demo") {
      const result = addDemoReply(demo, questionId, parentId, validated.value.body);
      setReplySaving(false);
      if (!result.ok) {
        setReplyError(messageForCode(result.code));
        return;
      }
      onDemoState(result.state);
      setReplyBody("");
      setOpenReplyId(null);
      return;
    }

    const result = await addReplyAction(questionId, parentId, validated.value.body);
    setReplySaving(false);
    if (!result.ok) {
      setReplyError(result.message);
      return;
    }
    onComments(result.comments);
    setReplyBody("");
    setOpenReplyId(null);
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
            likeSaving={likeSavingId === comment.id}
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
              <p className="text-xs leading-5 text-muted">이름은 표시되지 않으며, 한 의견에 답글은 한 번만 남길 수 있습니다.</p>
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
                  disabled={replySaving}
                  className="inline-flex min-h-11 items-center gap-2 rounded-full bg-foreground px-4 text-sm font-semibold text-card disabled:opacity-60"
                >
                  {replySaving ? <LoaderCircle className="h-4 w-4 animate-spin" aria-hidden="true" /> : null}
                  {replySaving ? "저장 중" : "답글 남기기"}
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
                    likeSaving={likeSavingId === reply.id}
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
  likeSaving,
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
  likeSaving: boolean;
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
          disabled={item.mine || likeSaving}
          aria-pressed={item.likedByMe}
          aria-label={item.mine ? "내 글은 추천할 수 없습니다" : item.likedByMe ? `추천 취소, ${item.likeCount}` : likeLabel}
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
        <ReportForm mode={mode} targetType="comment" targetId={item.id} demoState={demo} onDemoState={onDemoState} />
      </div>
      {likeError ? (
        <p className="mt-1 text-sm text-danger" role="alert">
          {likeError}
        </p>
      ) : null}
    </div>
  );
}
