"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

import { categoryLabel } from "@/lib/categories";
import { formatDateTime } from "@/lib/format";
import type { AdminDashboard } from "@/lib/parsers";
import type { QuestionStatus } from "@/lib/types";
import {
  adminSignInAction,
  adminSignOutAction,
  resolveReportAction,
  reviewSuggestionAction,
  setQuestionStatusAction,
} from "@/server/actions";

const STATUS_LABEL: Record<QuestionStatus, string> = {
  draft: "초안",
  published: "공개",
  hidden: "숨김",
};

export function AdminLogin() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [message, setMessage] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  return (
    <form
      className="mx-auto max-w-md space-y-4 rounded-3xl border border-line bg-card p-5"
      onSubmit={(event) => {
        event.preventDefault();
        setPending(true);
        setMessage(null);
        void adminSignInAction(email, password).then((result) => {
          setPending(false);
          setMessage(result.ok ? result.message : result.message);
          if (result.ok) {
            router.refresh();
          }
        });
      }}
    >
      <h1 className="text-2xl font-bold">운영자 로그인</h1>
      <p className="text-sm leading-6 text-muted">
        관리자 이메일 계정으로만 들어갈 수 있습니다. 주소만 알아서는 제안 승인이나 숨김 처리를 할 수 없습니다.
      </p>
      <label className="block text-sm font-semibold">
        이메일
        <input
          type="email"
          autoComplete="username"
          value={email}
          onChange={(event) => setEmail(event.target.value)}
          required
          className="mt-2 w-full rounded-2xl border border-line bg-background px-3 py-3 font-normal"
        />
      </label>
      <label className="block text-sm font-semibold">
        비밀번호
        <input
          type="password"
          autoComplete="current-password"
          value={password}
          onChange={(event) => setPassword(event.target.value)}
          required
          className="mt-2 w-full rounded-2xl border border-line bg-background px-3 py-3 font-normal"
        />
      </label>
      {message ? (
        <p className="text-sm" role="status">
          {message}
        </p>
      ) : null}
      <button
        type="submit"
        disabled={pending}
        className="inline-flex min-h-11 items-center rounded-2xl bg-accent px-4 text-sm font-semibold text-white disabled:opacity-60"
      >
        {pending ? "확인 중" : "로그인"}
      </button>
    </form>
  );
}

export function AdminConsole({ dashboard }: { dashboard: AdminDashboard }) {
  const router = useRouter();
  const [message, setMessage] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  async function run(task: () => Promise<{ ok: boolean; message: string }>) {
    setPending(true);
    setMessage(null);
    const result = await task();
    setPending(false);
    setMessage(result.message);
    if (result.ok) {
      router.refresh();
    }
  }

  return (
    <div className="space-y-8">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-3xl font-bold">운영</h1>
        <button
          type="button"
          onClick={() => void run(() => adminSignOutAction())}
          className="inline-flex min-h-11 items-center rounded-2xl border border-line px-4 text-sm font-semibold"
        >
          로그아웃
        </button>
      </div>
      {message ? (
        <p className="text-sm" role="status">
          {message}
        </p>
      ) : null}

      <section className="space-y-3">
        <h2 className="text-xl font-bold">검토 대기 제안</h2>
        {dashboard.suggestions.length === 0 ? <p className="text-sm text-muted">대기 중인 제안이 없습니다.</p> : null}
        {dashboard.suggestions.map((suggestion) => (
          <article key={suggestion.id} className="rounded-3xl border border-line bg-card p-5">
            <p className="text-xs font-semibold text-accent">{categoryLabel(suggestion.category)}</p>
            <h3 className="mt-1 text-lg font-bold">{suggestion.title}</h3>
            {suggestion.description ? <p className="mt-2 text-sm leading-6 text-muted">{suggestion.description}</p> : null}
            <ul className="mt-3 list-disc space-y-1 pl-5 text-sm">
              {suggestion.options.map((option) => (
                <li key={option}>{option}</li>
              ))}
            </ul>
            <p className="mt-2 text-xs text-muted">{formatDateTime(suggestion.createdAt)}</p>
            <div className="mt-4 flex flex-wrap gap-2">
              <button
                type="button"
                disabled={pending}
                onClick={() => void run(() => reviewSuggestionAction(suggestion.id, "approved"))}
                className="inline-flex min-h-11 items-center rounded-2xl bg-accent px-4 text-sm font-semibold text-white disabled:opacity-60"
              >
                승인 후 공개
              </button>
              <button
                type="button"
                disabled={pending}
                onClick={() => void run(() => reviewSuggestionAction(suggestion.id, "rejected"))}
                className="inline-flex min-h-11 items-center rounded-2xl border border-line px-4 text-sm font-semibold disabled:opacity-60"
              >
                거절
              </button>
            </div>
          </article>
        ))}
      </section>

      <section className="space-y-3">
        <h2 className="text-xl font-bold">신고</h2>
        {dashboard.reports.length === 0 ? <p className="text-sm text-muted">처리 대기 중인 신고가 없습니다.</p> : null}
        {dashboard.reports.map((report) => (
          <article key={report.id} className="rounded-3xl border border-line bg-card p-5">
            <p className="text-xs font-semibold text-muted">{report.targetType === "question" ? "질문" : "의견"}</p>
            <h3 className="mt-1 font-bold">{report.preview}</h3>
            <p className="mt-2 text-sm leading-6">{report.reason}</p>
            <p className="mt-2 text-xs text-muted">{formatDateTime(report.createdAt)}</p>
            <div className="mt-4 flex flex-wrap gap-2">
              <button
                type="button"
                disabled={pending}
                onClick={() => void run(() => resolveReportAction(report.id, "hide"))}
                className="inline-flex min-h-11 items-center rounded-2xl bg-foreground px-4 text-sm font-semibold text-card disabled:opacity-60"
              >
                숨기기
              </button>
              {report.targetType === "comment" ? (
                <button
                  type="button"
                  disabled={pending}
                  onClick={() => void run(() => resolveReportAction(report.id, "remove"))}
                  className="inline-flex min-h-11 items-center rounded-2xl border border-line px-4 text-sm font-semibold disabled:opacity-60"
                >
                  의견 삭제
                </button>
              ) : null}
              <button
                type="button"
                disabled={pending}
                onClick={() => void run(() => resolveReportAction(report.id, "dismiss"))}
                className="inline-flex min-h-11 items-center rounded-2xl border border-line px-4 text-sm font-semibold disabled:opacity-60"
              >
                문제없음
              </button>
            </div>
          </article>
        ))}
      </section>

      <section className="space-y-3">
        <h2 className="text-xl font-bold">질문 공개 상태</h2>
        {dashboard.questions.map((question) => (
          <article key={question.id} className="rounded-3xl border border-line bg-card p-5">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h3 className="font-bold">{question.title}</h3>
              <span className="rounded-full bg-accent-soft px-3 py-1 text-xs font-semibold text-accent-strong">
                {STATUS_LABEL[question.status]}
              </span>
            </div>
            <p className="mt-2 text-sm text-muted">
              {categoryLabel(question.category)} · 참여 {question.participantCount}명
            </p>
            <div className="mt-4 flex flex-wrap gap-2">
              {question.status !== "published" ? (
                <button
                  type="button"
                  disabled={pending}
                  onClick={() => void run(() => setQuestionStatusAction(question.id, "published"))}
                  className="inline-flex min-h-11 items-center rounded-2xl bg-accent px-4 text-sm font-semibold text-white disabled:opacity-60"
                >
                  공개
                </button>
              ) : (
                <button
                  type="button"
                  disabled={pending}
                  onClick={() => void run(() => setQuestionStatusAction(question.id, "hidden"))}
                  className="inline-flex min-h-11 items-center rounded-2xl border border-line px-4 text-sm font-semibold disabled:opacity-60"
                >
                  숨기기
                </button>
              )}
            </div>
          </article>
        ))}
      </section>
    </div>
  );
}
