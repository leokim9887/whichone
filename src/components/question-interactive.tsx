"use client";

import { Check, LoaderCircle } from "lucide-react";
import { useSearchParams } from "next/navigation";
import { useMemo, useState } from "react";

import { CommentThread } from "@/components/comment-thread";
import { useProfile } from "@/components/profile-provider";
import { OptionImageThumb } from "@/components/question-images";
import { ReportForm } from "@/components/report-form";
import { ResultBars } from "@/components/result-bars";
import { ShareActions } from "@/components/share-actions";
import { categoryLabel } from "@/lib/categories";
import { addDemoComment, castDemoVote, demoPublicComments } from "@/lib/demo-state";
import { useDemoState, writeDemoState } from "@/lib/demo-storage";
import { formatParticipantCount, formatRegisteredDate } from "@/lib/format";
import { LIMITS } from "@/lib/limits";
import { messageForCode } from "@/lib/messages";
import { readDemoProfile } from "@/lib/profile-storage";
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
  const demo = useDemoState();
  const searchParams = useSearchParams();
  const focusCommentId = searchParams.get("comment");
  const { ensureProfile, openSetup, profile } = useProfile();
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
  const activeFilter = focusCommentId ? "all" : filter;

  const demoVote = mode === "demo" ? demo.votes[question.id] : undefined;
  const demoComments = mode === "demo" ? demo.comments[question.id] ?? [] : [];
  const demoComment = demoComments[0];
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
  const comments = mode === "demo" ? demoPublicComments(demo, question.id) : liveComments;
  const selected = participation.voted ? participation.optionId : draftOption;

  const summary = useMemo(
    () => buildSummary(question.options, participation.voted ? participation.counts : null, participation.optionId),
    [participation.counts, participation.optionId, participation.voted, question.options],
  );

  const visibleComments = comments.filter(
    (comment) => activeFilter === "all" || comment.optionId === activeFilter,
  );
  const optionText = new Map(question.options.map((option) => [option.id, option.text]));
  const optionImages = new Map(question.options.map((option) => [option.id, option.imageUrl]));
  const registeredLabel = formatRegisteredDate(question.publishedAt || question.createdAt);
  const participantLabel =
    mode === "demo"
      ? "공유 참여자 수는 집계하지 않습니다"
      : formatParticipantCount(participation.voted ? participation.participantCount : question.participantCount);

  async function vote() {
    if (!selected || participation.voted || saving) {
      return;
    }
    const ready = await ensureProfile();
    if (!ready) {
      setMessage(messageForCode("profile_required"));
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
      if (result.code === "profile_required") {
        openSetup();
      }
      setMessage(result.message);
      return;
    }
  }

  async function saveComment() {
    const validated = validateComment(commentBody);
    if (!validated.ok) {
      setCommentError(validated.message);
      return;
    }
    const ready = await ensureProfile();
    if (!ready) {
      setCommentError(messageForCode("profile_required"));
      return;
    }
    setCommentSaving(true);
    setCommentError(null);

    if (mode === "demo") {
      const demoProfile = profile ?? readDemoProfile();
      if (!demoProfile) {
        setCommentSaving(false);
        setCommentError(messageForCode("profile_required"));
        return;
      }
      const result = addDemoComment(demo, question.id, validated.value.body, demoProfile);
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
      if (result.code === "profile_required") {
        openSetup();
      }
      setCommentError(result.message);
      return;
    }
    setLiveParticipation(result.participation);
    setLiveComments(result.comments);
    setCommentBody("");
  }

  return (
    <div className="space-y-6">
      <header className="rise-in">
        <div className="surface-panel p-5 sm:p-6">
          <p className="text-sm font-semibold text-accent">{categoryLabel(question.category)}</p>
          <h1 className="mt-2 text-2xl font-bold leading-snug tracking-tight break-keep sm:text-3xl">{question.title}</h1>
          {question.description ? <p className="mt-3 leading-7 text-muted">{question.description}</p> : null}
          <p className="mt-3 text-sm text-muted">
            {registeredLabel ? `${registeredLabel} · ${participantLabel}` : participantLabel}
          </p>
        </div>
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
        <section className="rise-in space-y-3" style={{ animationDelay: "80ms" }}>
          <h2 className="text-lg font-bold">선택지</h2>
          <div className="space-y-3">
            {question.options
              .slice()
              .sort((a, b) => a.position - b.position)
              .map((option, index) => {
                const active = selected === option.id;
                return (
                  <div
                    key={option.id}
                    style={{ animationDelay: `${Math.min(index, 5) * 50}ms` }}
                    className={`rise-in flex items-stretch gap-2 rounded-3xl border transition ${
                      active
                        ? "border-accent bg-accent-soft text-accent-strong shadow-[0_10px_24px_rgba(47,75,255,0.12)]"
                        : "border-line bg-card"
                    }`}
                  >
                    <button
                      type="button"
                      aria-pressed={active}
                      onClick={() => setDraftOption(option.id)}
                      className="pressable flex min-h-14 min-w-0 flex-1 items-center justify-between gap-3 px-4 py-3 text-left text-base font-semibold"
                    >
                      <span className="break-keep">{option.text}</span>
                      {active ? <Check className="h-5 w-5 shrink-0" aria-hidden="true" /> : null}
                    </button>
                    {option.imageUrl ? (
                      <div className="flex items-center pr-3">
                        <OptionImageThumb src={option.imageUrl} alt={option.text} size="md" />
                      </div>
                    ) : null}
                  </div>
                );
              })}
          </div>
          <p className="text-sm text-muted">투표 후에는 선택을 바꿀 수 없습니다. 득표율은 투표 뒤에 공개됩니다.</p>
          <button
            type="button"
            onClick={() => void vote()}
            disabled={!selected || saving}
            className="btn-primary inline-flex min-h-12 w-full items-center justify-center gap-2 rounded-2xl px-5 text-sm font-semibold sm:w-auto"
          >
            {saving ? <LoaderCircle className="h-4 w-4 animate-spin" aria-hidden="true" /> : null}
            {saving ? "투표하는 중" : "투표하기"}
          </button>
        </section>
      ) : null}

      {summary ? (
        <div className="rise-in" style={{ animationDelay: "100ms" }}>
          <ResultBars
            summary={summary}
            scope={mode === "demo" ? "browser" : "shared"}
            imageByOptionId={optionImages}
          />
        </div>
      ) : null}

      {participation.voted ? (
        <section className="rise-in space-y-4 overflow-visible rounded-[1.75rem] border border-line bg-card p-4 shadow-[0_12px_40px_rgba(28,25,23,0.04)] sm:p-5">
          <div>
            <h2 className="text-lg font-bold">댓글 달기</h2>
            <p className="mt-1 text-sm leading-6 text-muted">
              닉네임과 프로필 사진이 함께 표시됩니다. 최대 {LIMITS.comment}자이며, 댓글·답글은 여러 번 남길 수 있습니다.
            </p>
          </div>
          {participation.comment && participation.comment.status !== "visible" ? (
            <p className="rounded-2xl bg-background px-4 py-3 text-sm text-muted">작성한 의견이 숨김 처리되었습니다.</p>
          ) : null}
          <form
            className="space-y-2"
            onSubmit={(event) => {
              event.preventDefault();
              void saveComment();
            }}
          >
            <label className="sr-only" htmlFor="comment-body">
              댓글
            </label>
            <textarea
              id="comment-body"
              value={commentBody}
              onChange={(event) => setCommentBody(event.target.value)}
              maxLength={LIMITS.comment}
              rows={4}
              placeholder="생각을 짧게 남겨 주세요."
              className="w-full rounded-2xl border border-line bg-background px-3.5 py-3 text-base font-normal outline-none transition focus:border-accent"
            />
            <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between sm:gap-3">
              <p className="text-xs text-muted">
                {commentBody.length}/{LIMITS.comment}
              </p>
              <button
                type="submit"
                disabled={commentSaving}
                className="pressable inline-flex min-h-11 w-full items-center justify-center rounded-2xl bg-foreground px-4 text-sm font-semibold text-card disabled:opacity-60 sm:w-auto"
              >
                {commentSaving ? "저장 중" : "등록"}
              </button>
            </div>
            {commentError ? (
              <p className="text-sm text-danger" role="alert">
                {commentError}
              </p>
            ) : null}
          </form>

          <div>
            <div className="-mx-4 px-4 sm:mx-0 sm:px-0">
              <div className="chip-scroll">
                <FilterChip active={activeFilter === "all"} onClick={() => setFilter("all")} label="전체" />
                {question.options
                  .slice()
                  .sort((a, b) => a.position - b.position)
                  .map((option) => (
                    <FilterChip
                      key={option.id}
                      active={activeFilter === option.id}
                      onClick={() => setFilter(option.id)}
                      label={option.text}
                    />
                  ))}
              </div>
            </div>
            {visibleComments.length === 0 ? (
              <p className="mt-4 text-sm leading-6 text-muted">댓글이 없습니다</p>
            ) : (
              <CommentThread
                mode={mode}
                questionId={question.id}
                comments={visibleComments}
                myOptionId={participation.optionId}
                optionText={optionText}
                demo={demo}
                onDemoState={writeDemoState}
                onComments={setLiveComments}
                focusCommentId={focusCommentId}
                onOwnRootDeleted={() => {
                  if (mode === "demo") {
                    return;
                  }
                  setLiveParticipation((current) => ({ ...current, comment: null }));
                }}
              />
            )}
          </div>
        </section>
      ) : (
        <p className="rounded-[1.75rem] border border-dashed border-line bg-card/60 px-4 py-5 text-sm leading-6 text-muted">
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
      className={`pressable inline-flex min-h-11 shrink-0 items-center rounded-full px-3 text-sm font-semibold transition ${
        active ? "bg-foreground text-card shadow-[0_8px_18px_rgba(28,25,23,0.14)]" : "border border-line bg-background"
      }`}
    >
      {label}
    </button>
  );
}
