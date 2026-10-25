"use client";

import { Check, LoaderCircle } from "lucide-react";
import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";

import { ReportForm } from "@/components/report-form";
import { ResultBars } from "@/components/result-bars";
import { ShareActions } from "@/components/share-actions";
import { categoryTopicLabel } from "@/lib/topics";
import { addDemoComment, castDemoVote } from "@/lib/demo-state";
import { useDemoState, writeDemoState } from "@/lib/demo-storage";
import { formatDateTime, formatParticipantCount } from "@/lib/format";
import { LIMITS } from "@/lib/limits";
import { messageForCode } from "@/lib/messages";
import { buildSummary } from "@/lib/results";
import type { DataMode, Participation, PublicComment, Question } from "@/lib/types";
import { validateComment } from "@/lib/validation";
import { addCommentAction, castVoteAction } from "@/server/actions";

export function QuestionInteractive({
  mode,
  question,
  initialParticipation,
  initialComments,
  participationError,
}: {
  mode: DataMode;
  question: Question;
  initialParticipation: Participation;
  initialComments: PublicComment[];
  participationError: string | null;
}) {
  const router = useRouter();
  const demo = useDemoState();
  const [liveParticipation, setLiveParticipation] = useState(initialParticipation);
  const [liveComments, setLiveComments] = useState(initialComments);
  const [draftOption, setDraftOption] = useState<string | null>(
    mode === "demo" ? null : initialParticipation.optionId,
  );
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(participationError);
  const [commentBody, setCommentBody] = useState("");
  const [commentError, setCommentError] = useState<string | null>(null);
  const [commentSaving, setCommentSaving] = useState(false);
  const [filter, setFilter] = useState("all");

  const demoVote = mode === "demo" ? demo.votes[question.id] : undefined;
  const demoComment = mode === "demo" ? demo.comments[question.id] : undefined;
  const participation: Participation =
    mode === "demo"
      ? {
          participantCount: 0,
          voted: Boolean(demoVote),
          optionId: demoVote?.optionId ?? null,
          comment: demoComment ? { ...demoComment, status: "visible" } : null,
          counts: demoVote
            ? question.options.map((option) => ({
                optionId: option.id,
                voteCount: option.id === demoVote.optionId ? 1 : 0,
              }))
            : null,
        }
      : liveParticipation;
  const comments = mode === "demo" ? (demoComment ? [demoComment] : []) : liveComments;
  const selected = participation.voted ? participation.optionId : draftOption;

  const summary = useMemo(
    () => buildSummary(question.options, participation.voted ? participation.counts : null, participation.optionId),
    [participation.counts, participation.optionId, participation.voted, question.options],
  );

  const visibleComments = comments.filter((comment) => {
    if (participation.comment && comment.id === participation.comment.id) {
      return false;
    }
    return filter === "all" || comment.optionId === filter;
  });
  const optionText = new Map(question.options.map((option) => [option.id, option.text]));

  async function vote() {
    if (!selected || participation.voted || saving) {
      return;
    }
    setSaving(true);
    setMessage(null);

    if (mode === "demo") {
      const result = castDemoVote(
        demo,
        question.id,
        selected,
        question.options.map((option) => option.id),
      );
      setSaving(false);
      if (!result.ok) {
        setMessage(messageForCode(result.code));
        return;
      }
      writeDemoState(result.state);
      return;
    }

    const result = await castVoteAction(question.id, selected);
    setSaving(false);
    if (result.participation) {
      setLiveParticipation(result.participation);
      setDraftOption(result.participation.optionId ?? selected);
    }
    if (result.comments) {
      setLiveComments(result.comments);
    }
    if (!result.ok) {
      setMessage(result.message);
      return;
    }
    router.refresh();
  }

  async function saveComment() {
    const validated = validateComment(commentBody);
    if (!validated.ok) {
      setCommentError(validated.message);
      return;
    }
    setCommentSaving(true);
    setCommentError(null);

    if (mode === "demo") {
      const result = addDemoComment(demo, question.id, validated.value.body);
      setCommentSaving(false);
      if (!result.ok) {
        setCommentError(messageForCode(result.code));
        return;
      }
      writeDemoState(result.state);
      setCommentBody("");
      return;
    }

    const result = await addCommentAction(question.id, validated.value.body);
    setCommentSaving(false);
    if (!result.ok) {
      setCommentError(result.message);
      return;
    }
    setLiveParticipation(result.participation);
    setLiveComments(result.comments);
    setCommentBody("");
    router.refresh();
  }

  return (
    <div className="space-y-6">
      <header>
        <p className="text-sm font-semibold text-accent">{categoryTopicLabel(question.category, question.topic)}</p>
        <h1 className="mt-2 text-3xl font-bold leading-snug">{question.title}</h1>
        {question.description ? <p className="mt-3 leading-7 text-muted">{question.description}</p> : null}
        <p className="mt-3 text-sm text-muted">
          {mode === "demo" ? "공유 참여자 수는 집계하지 않습니다" : formatParticipantCount(question.participantCount)}
        </p>
      </header>

      {mode === "demo" ? (
        <p className="rounded-2xl bg-[#fff7ed] px-4 py-3 text-sm leading-6 text-warn" role="status">
          이 화면의 선택과 의견은 현재 브라우저에만 남습니다. 다른 사람의 결과와 섞이지 않습니다.
        </p>
      ) : null}

      {message ? (
        <p className="rounded-2xl border border-danger/20 bg-card px-4 py-3 text-sm text-danger" role="alert">
          {message}
        </p>
      ) : null}

      {!participation.voted ? (
        <section className="space-y-3">
          <h2 className="text-lg font-bold">선택지</h2>
          <div className="space-y-3">
            {question.options
              .slice()
              .sort((a, b) => a.position - b.position)
              .map((option) => {
                const active = selected === option.id;
                return (
                  <button
                    key={option.id}
                    type="button"
                    aria-pressed={active}
                    onClick={() => setDraftOption(option.id)}
                    className={`flex min-h-14 w-full items-center justify-between gap-3 rounded-3xl border px-4 py-3 text-left text-base font-semibold ${
                      active ? "border-accent bg-accent-soft text-accent-strong" : "border-line bg-card"
                    }`}
                  >
                    <span>{option.text}</span>
                    {active ? <Check className="h-5 w-5 shrink-0" aria-hidden="true" /> : null}
                  </button>
                );
              })}
          </div>
          <p className="text-sm text-muted">투표 후에는 선택을 바꿀 수 없습니다. 득표율은 투표 뒤에 공개됩니다.</p>
          <button
            type="button"
            onClick={() => void vote()}
            disabled={!selected || saving}
            className="inline-flex min-h-12 items-center gap-2 rounded-2xl bg-accent px-5 text-sm font-semibold text-white disabled:opacity-60"
          >
            {saving ? <LoaderCircle className="h-4 w-4 animate-spin" aria-hidden="true" /> : null}
            {saving ? "투표하는 중" : "투표하기"}
          </button>
        </section>
      ) : null}

      {summary ? <ResultBars summary={summary} scope={mode === "demo" ? "browser" : "shared"} /> : null}

      {participation.voted ? (
        <section className="space-y-4 rounded-3xl border border-line bg-card p-5">
          <div>
            <h2 className="text-lg font-bold">선택 이유</h2>
            <p className="mt-1 text-sm leading-6 text-muted">
              이유는 선택 사항입니다. 이름은 표시되지 않으며, 최대 {LIMITS.comment}자입니다.
            </p>
          </div>
          {participation.comment ? (
            <article className="rounded-2xl bg-background px-4 py-3">
              <p className="text-xs font-semibold text-accent">내 의견 · {optionText.get(participation.comment.optionId)}</p>
              {participation.comment.status === "visible" ? (
                <p className="mt-2 leading-7">{participation.comment.body}</p>
              ) : (
                <p className="mt-2 text-sm text-muted">작성한 의견이 숨김 처리되었습니다.</p>
              )}
              <p className="mt-2 text-xs text-muted">{formatDateTime(participation.comment.createdAt)}</p>
            </article>
          ) : (
            <form
              className="space-y-3"
              onSubmit={(event) => {
                event.preventDefault();
                void saveComment();
              }}
            >
              <label className="block text-sm font-semibold" htmlFor="comment-body">
                이 선택을 한 이유
                <textarea
                  id="comment-body"
                  value={commentBody}
                  onChange={(event) => setCommentBody(event.target.value)}
                  maxLength={LIMITS.comment}
                  rows={4}
                  className="mt-2 w-full rounded-2xl border border-line bg-background px-3 py-3 font-normal"
                />
              </label>
              <p className="text-right text-xs text-muted">
                {commentBody.length}/{LIMITS.comment}
              </p>
              {commentError ? (
                <p className="text-sm text-danger" role="alert">
                  {commentError}
                </p>
              ) : null}
              <button
                type="submit"
                disabled={commentSaving}
                className="inline-flex min-h-11 items-center rounded-2xl bg-foreground px-4 text-sm font-semibold text-card disabled:opacity-60"
              >
                {commentSaving ? "저장 중" : "이유 남기기"}
              </button>
            </form>
          )}

          <div>
            <h3 className="text-base font-bold">{mode === "demo" ? "이 브라우저에 남긴 이유" : "다른 사람들의 이유"}</h3>
            <div className="mt-3 flex gap-2 overflow-x-auto">
              <FilterChip active={filter === "all"} onClick={() => setFilter("all")} label="전체" />
              {question.options
                .slice()
                .sort((a, b) => a.position - b.position)
                .map((option) => (
                  <FilterChip
                    key={option.id}
                    active={filter === option.id}
                    onClick={() => setFilter(option.id)}
                    label={option.text}
                  />
                ))}
            </div>
            {visibleComments.length === 0 ? (
              <p className="mt-4 text-sm leading-6 text-muted">
                {mode === "demo"
                  ? "데모 모드에는 다른 사람의 의견이 없습니다. 직접 남긴 이유만 이 브라우저에 저장됩니다."
                  : "다른 사람의 이유는 아직 없습니다."}
              </p>
            ) : (
              <ul className="mt-4 space-y-3">
                {visibleComments.map((comment) => (
                  <li key={comment.id} className="rounded-2xl border border-line px-4 py-3">
                    <p className="text-xs font-semibold text-muted">{optionText.get(comment.optionId) ?? "선택"}</p>
                    <p className="mt-2 leading-7">{comment.body}</p>
                    <div className="mt-3 flex items-center justify-between gap-3">
                      <time className="text-xs text-muted" dateTime={comment.createdAt}>
                        {formatDateTime(comment.createdAt)}
                      </time>
                      <ReportForm
                        mode={mode}
                        targetType="comment"
                        targetId={comment.id}
                        demoState={demo}
                        onDemoState={writeDemoState}
                      />
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </section>
      ) : (
        <p className="rounded-3xl border border-dashed border-line px-4 py-5 text-sm leading-6 text-muted">
          투표한 뒤에 결과와 다른 사람의 이유를 볼 수 있습니다.
        </p>
      )}

      <div className="flex flex-col gap-4 border-t border-line pt-5 sm:flex-row sm:items-start sm:justify-between">
        <ShareActions title={question.title} description={question.description} />
        <ReportForm mode={mode} targetType="question" targetId={question.id} demoState={demo} onDemoState={writeDemoState} />
      </div>
    </div>
  );
}

function FilterChip({ active, label, onClick }: { active: boolean; label: string; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`inline-flex min-h-11 shrink-0 items-center rounded-full px-3 text-sm font-semibold ${
        active ? "bg-foreground text-card" : "border border-line bg-background"
      }`}
    >
      {label}
    </button>
  );
}
