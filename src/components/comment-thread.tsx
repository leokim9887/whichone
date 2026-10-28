"use client";

import { MessageCircle, Pencil, ThumbsUp, Trash2 } from "lucide-react";
import { useRef, useState } from "react";

import { ProfileAvatar } from "@/components/profile-avatar";
import { useProfile } from "@/components/profile-provider";
import { ReportForm } from "@/components/report-form";
import { addReplyLive, deleteCommentLive, editCommentLive, toggleLikeLive } from "@/lib/comment-live";
import {
  adoptServerComments,
  insertReply,
  removeOwnPost,
  removeReply,
  replaceCommentBody,
  toggleLocalLike,
} from "@/lib/comment-updates";
import {
  addDemoReply,
  deleteDemoPost,
  editDemoPost,
  toggleDemoLike,
  type DemoState,
} from "@/lib/demo-state";
import { formatDateTime } from "@/lib/format";
import { LIMITS } from "@/lib/limits";
import { messageForCode } from "@/lib/messages";
import { readDemoProfile } from "@/lib/profile-storage";
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
  onOwnRootDeleted,
}: {
  mode: DataMode;
  questionId: string;
  comments: PublicComment[];
  myOptionId: string | null;
  optionText: Map<string, string>;
  demo: DemoState;
  onDemoState: (state: DemoState) => void;
  onComments: (update: PublicComment[] | ((current: PublicComment[]) => PublicComment[])) => void;
  onOwnRootDeleted?: () => void;
}) {
  const [openReplyId, setOpenReplyId] = useState<string | null>(null);
  const [replyBody, setReplyBody] = useState("");
  const [replyError, setReplyError] = useState<string | null>(null);
  const [likeError, setLikeError] = useState<{ id: string; message: string } | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editBody, setEditBody] = useState("");
  const [editError, setEditError] = useState<string | null>(null);
  const [actionError, setActionError] = useState<{ id: string; message: string } | null>(null);
  const { ensureProfile, openSetup, profile } = useProfile();
  const likesInFlight = useRef(new Set<string>());
  const replyLock = useRef(false);
  const editLock = useRef(false);
  const deleteLock = useRef(false);

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
    const ready = await ensureProfile();
    if (!ready) {
      setReplyError(messageForCode("profile_required"));
      return;
    }
    replyLock.current = true;
    setReplyError(null);

    if (mode === "demo") {
      const demoProfile = profile ?? readDemoProfile();
      if (!demoProfile) {
        replyLock.current = false;
        setReplyError(messageForCode("profile_required"));
        return;
      }
      const result = addDemoReply(demo, questionId, parentId, validated.value.body, demoProfile);
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
        nickname: profile?.nickname ?? "나",
        avatarUrl: profile?.avatarUrl ?? null,
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
      if (result.code === "profile_required") {
        openSetup();
      }
      setReplyError(result.message);
      return;
    }
    if (result.comments) {
      onComments((current) => adoptServerComments(current, result.comments ?? []));
    }
  }

  function beginEdit(item: PublicReply) {
    setEditingId(item.id);
    setEditBody(item.body);
    setEditError(null);
    setActionError(null);
    setOpenReplyId(null);
  }

  async function saveEdit(commentId: string) {
    const validated = validateComment(editBody);
    if (!validated.ok) {
      setEditError(validated.message);
      return;
    }
    if (editLock.current) {
      return;
    }
    editLock.current = true;
    setEditError(null);
    const previous = comments.flatMap((comment) => [comment, ...comment.replies]).find((item) => item.id === commentId);
    const nextBody = validated.value.body;

    if (mode === "demo") {
      const result = editDemoPost(demo, questionId, commentId, nextBody);
      editLock.current = false;
      if (!result.ok) {
        setEditError(messageForCode(result.code));
        return;
      }
      onDemoState(result.state);
      setEditingId(null);
      return;
    }

    onComments((current) => replaceCommentBody(current, commentId, nextBody));
    setEditingId(null);
    const result = await editCommentLive(questionId, commentId, nextBody);
    editLock.current = false;
    if (!result.ok) {
      if (previous) {
        onComments((current) => replaceCommentBody(current, commentId, previous.body));
      }
      setEditingId(commentId);
      setEditBody(nextBody);
      setEditError(result.message);
    }
  }

  async function removePost(item: PublicReply, isRoot: boolean) {
    if (deleteLock.current || item.id.startsWith("pending-")) {
      return;
    }
    const confirmed = window.confirm(isRoot ? "이 의견과 아래 답글을 삭제할까요?" : "이 답글을 삭제할까요?");
    if (!confirmed) {
      return;
    }

    deleteLock.current = true;
    setActionError(null);
    setEditingId(null);
    if (openReplyId === item.id) {
      setOpenReplyId(null);
    }

    if (mode === "demo") {
      const result = deleteDemoPost(demo, questionId, item.id);
      deleteLock.current = false;
      if (!result.ok) {
        setActionError({ id: item.id, message: messageForCode(result.code) });
        return;
      }
      onDemoState(result.state);
      if (isRoot) {
        onOwnRootDeleted?.();
      }
      return;
    }

    const snapshot = comments;
    onComments((current) => removeOwnPost(current, item.id));
    if (isRoot) {
      onOwnRootDeleted?.();
    }
    const result = await deleteCommentLive(questionId, item.id);
    deleteLock.current = false;
    if (!result.ok) {
      onComments(snapshot);
      setActionError({ id: item.id, message: result.message });
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
          {editingId === comment.id ? (
            <EditForm
              id={`edit-${comment.id}`}
              body={editBody}
              error={editError}
              onBodyChange={setEditBody}
              onCancel={() => {
                setEditingId(null);
                setEditError(null);
              }}
              onSave={() => void saveEdit(comment.id)}
            />
          ) : (
            <CommentBodyView item={comment} optionText={optionText} badge={comment.mine ? "내 의견" : null} />
          )}
          <CommentActions
            item={comment}
            canReply
            mode={mode}
            demo={demo}
            onDemoState={onDemoState}
            likeError={likeError?.id === comment.id ? likeError.message : null}
            actionError={actionError?.id === comment.id ? actionError.message : null}
            replyOpen={openReplyId === comment.id}
            editing={editingId === comment.id}
            onLike={() => void like(comment.id)}
            onToggleReply={() => {
              setReplyError(null);
              setReplyBody("");
              setEditingId(null);
              setOpenReplyId((current) => (current === comment.id ? null : comment.id));
            }}
            onEdit={() => beginEdit(comment)}
            onDelete={() => void removePost(comment, true)}
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
              <p className="text-xs leading-5 text-muted">닉네임이 함께 표시됩니다. 같은 의견에 답글을 여러 번 남길 수 있습니다.</p>
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
                  {editingId === reply.id ? (
                    <EditForm
                      id={`edit-${reply.id}`}
                      body={editBody}
                      error={editError}
                      onBodyChange={setEditBody}
                      onCancel={() => {
                        setEditingId(null);
                        setEditError(null);
                      }}
                      onSave={() => void saveEdit(reply.id)}
                    />
                  ) : (
                    <CommentBodyView item={reply} optionText={optionText} badge={reply.mine ? "내 답글" : "답글"} />
                  )}
                  <CommentActions
                    item={reply}
                    canReply={false}
                    mode={mode}
                    demo={demo}
                    onDemoState={onDemoState}
                    likeError={likeError?.id === reply.id ? likeError.message : null}
                    actionError={actionError?.id === reply.id ? actionError.message : null}
                    replyOpen={false}
                    editing={editingId === reply.id}
                    onLike={() => void like(reply.id)}
                    onToggleReply={() => undefined}
                    onEdit={() => beginEdit(reply)}
                    onDelete={() => void removePost(reply, false)}
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

function EditForm({
  id,
  body,
  error,
  onBodyChange,
  onCancel,
  onSave,
}: {
  id: string;
  body: string;
  error: string | null;
  onBodyChange: (value: string) => void;
  onCancel: () => void;
  onSave: () => void;
}) {
  return (
    <form
      className="space-y-2"
      onSubmit={(event) => {
        event.preventDefault();
        onSave();
      }}
    >
      <label className="block text-sm font-semibold" htmlFor={id}>
        내용 수정
        <textarea
          id={id}
          value={body}
          onChange={(event) => onBodyChange(event.target.value)}
          maxLength={LIMITS.comment}
          rows={3}
          className="mt-2 w-full rounded-2xl border border-line bg-background px-3 py-3 font-normal"
        />
      </label>
      <p className="text-right text-xs text-muted">
        {body.length}/{LIMITS.comment}
      </p>
      {error ? (
        <p className="text-sm text-danger" role="alert">
          {error}
        </p>
      ) : null}
      <div className="flex justify-end gap-2">
        <button type="button" onClick={onCancel} className="inline-flex min-h-11 items-center rounded-full px-3 text-sm font-semibold text-muted">
          취소
        </button>
        <button type="submit" className="inline-flex min-h-11 items-center rounded-full bg-foreground px-4 text-sm font-semibold text-card">
          저장
        </button>
      </div>
    </form>
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
    <div className="flex gap-3">
      <ProfileAvatar profile={{ nickname: item.nickname, avatarUrl: item.avatarUrl }} size="sm" />
      <div className="min-w-0 flex-1">
        <p className="text-xs font-semibold text-muted">
          <span className="text-foreground">{item.nickname}</span>
          <span className="mx-1.5 text-line">·</span>
          {badge ? <span className="mr-2 text-accent">{badge}</span> : null}
          {optionText.get(item.optionId) ?? "선택"}
        </p>
        <p className="mt-1.5 leading-7">{item.body}</p>
      </div>
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
  actionError,
  replyOpen,
  editing,
  onLike,
  onToggleReply,
  onEdit,
  onDelete,
}: {
  item: PublicReply;
  canReply: boolean;
  mode: DataMode;
  demo: DemoState;
  onDemoState: (state: DemoState) => void;
  likeError: string | null;
  actionError: string | null;
  replyOpen: boolean;
  editing: boolean;
  onLike: () => void;
  onToggleReply: () => void;
  onEdit: () => void;
  onDelete: () => void;
}) {
  const likeLabel = item.likeCount > 0 ? `추천 ${item.likeCount}` : "추천";
  const pending = item.id.startsWith("pending-");
  const actionClass =
    "inline-flex min-h-8 items-center gap-1 rounded-full px-2 text-xs font-semibold disabled:opacity-50";
  return (
    <div className="mt-2">
      <div className="flex flex-wrap items-center gap-0.5">
        <time className="mr-auto text-[11px] text-muted" dateTime={item.createdAt}>
          {formatDateTime(item.createdAt)}
        </time>
        <button
          type="button"
          onClick={onLike}
          disabled={pending}
          aria-pressed={item.likedByMe}
          aria-label={item.likedByMe ? `추천 취소, ${item.likeCount}` : likeLabel}
          className={`${actionClass} ${item.likedByMe ? "bg-accent-soft text-accent-strong" : "text-muted"}`}
        >
          <ThumbsUp className={`h-3.5 w-3.5 ${item.likedByMe ? "fill-current" : ""}`} aria-hidden="true" />
          {likeLabel}
        </button>
        {canReply ? (
          <button
            type="button"
            onClick={onToggleReply}
            aria-expanded={replyOpen}
            className={`${actionClass} ${replyOpen ? "bg-foreground text-card" : "text-muted"}`}
          >
            <MessageCircle className="h-3.5 w-3.5" aria-hidden="true" />
            답글
          </button>
        ) : null}
        {item.mine && !pending ? (
          <>
            <button
              type="button"
              onClick={onEdit}
              aria-pressed={editing}
              className={`${actionClass} ${editing ? "bg-foreground text-card" : "text-muted"}`}
            >
              <Pencil className="h-3.5 w-3.5" aria-hidden="true" />
              수정
            </button>
            <button type="button" onClick={onDelete} className={`${actionClass} text-danger`}>
              <Trash2 className="h-3.5 w-3.5" aria-hidden="true" />
              삭제
            </button>
          </>
        ) : null}
        {pending ? null : (
          <ReportForm
            mode={mode}
            targetType="comment"
            targetId={item.id}
            demoState={demo}
            onDemoState={onDemoState}
            compact
          />
        )}
      </div>
      {likeError ? (
        <p className="mt-1 text-sm text-danger" role="alert">
          {likeError}
        </p>
      ) : null}
      {actionError ? (
        <p className="mt-1 text-sm text-danger" role="alert">
          {actionError}
        </p>
      ) : null}
    </div>
  );
}
