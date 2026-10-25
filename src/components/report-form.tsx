"use client";

import { Flag, X } from "lucide-react";
import { useEffect, useId, useRef, useState } from "react";

import { addDemoReport, type DemoState } from "@/lib/demo-state";
import { writeDemoState } from "@/lib/demo-storage";
import { LIMITS } from "@/lib/limits";
import { messageForCode } from "@/lib/messages";
import { REPORT_REASONS, type DataMode, type ReportReason } from "@/lib/types";
import { validateReport } from "@/lib/validation";
import { submitReportAction } from "@/server/actions";

export function ReportForm({
  mode,
  targetType,
  targetId,
  demoState,
  onDemoState,
}: {
  mode: DataMode;
  targetType: "question" | "comment";
  targetId: string;
  demoState?: DemoState;
  onDemoState?: (state: DemoState) => void;
}) {
  const titleId = useId();
  const dialogRef = useRef<HTMLDialogElement>(null);
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState<ReportReason | "">("");
  const [detail, setDetail] = useState("");
  const [company, setCompany] = useState("");
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const subject = targetType === "question" ? "질문" : "의견";

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!open || !dialog || dialog.open) {
      return;
    }
    dialog.showModal();
  }, [open]);

  function close() {
    dialogRef.current?.close();
    setOpen(false);
    setError(null);
  }

  async function submit() {
    setError(null);
    const validated = validateReport({ reason, detail });
    if (!validated.ok) {
      setError(validated.message);
      return;
    }
    setPending(true);
    if (mode === "demo") {
      if (!demoState || !onDemoState) {
        setPending(false);
        setError(messageForCode("unavailable"));
        return;
      }
      const result = addDemoReport(demoState, { targetType, targetId, reason: validated.value.reason });
      setPending(false);
      if (!result.ok) {
        setError(messageForCode(result.code));
        return;
      }
      writeDemoState(result.state);
      onDemoState(result.state);
      setMessage("신고를 이 브라우저에만 저장했습니다. 공유 운영 대기열에는 들어가지 않습니다.");
      setReason("");
      setDetail("");
      close();
      return;
    }

    const result = await submitReportAction({
      targetType,
      targetId,
      reason,
      detail,
      company,
    });
    setPending(false);
    if (!result.ok) {
      setError(result.message);
      return;
    }
    setMessage(result.message);
    setReason("");
    setDetail("");
    close();
  }

  return (
    <div>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="inline-flex min-h-11 items-center gap-1.5 rounded-full px-3 text-sm font-semibold text-muted transition duration-300 hover:bg-background hover:text-foreground"
      >
        <Flag className="h-4 w-4" aria-hidden="true" />
        신고
      </button>
      {message ? (
        <p className="mt-2 text-sm leading-6 text-ok" role="status">
          {message}
        </p>
      ) : null}
      {open ? (
        <dialog
          ref={dialogRef}
          aria-labelledby={titleId}
          className="report-dialog"
          onClose={() => setOpen(false)}
          onClick={(event) => {
            if (event.target === event.currentTarget) {
              close();
            }
          }}
        >
          <form
            className="rounded-[28px] border border-line bg-card p-5 shadow-[0_24px_60px_rgba(28,25,23,0.18)] sm:p-6"
            onSubmit={(event) => {
              event.preventDefault();
              void submit();
            }}
          >
            <div className="flex items-start justify-between gap-3">
              <div>
                <h2 id={titleId} className="text-xl font-bold">
                  {subject} 신고
                </h2>
                <p className="mt-1 text-sm leading-6 text-muted">이름 없이 접수되고, 운영자가 확인합니다.</p>
              </div>
              <button
                type="button"
                onClick={close}
                aria-label="닫기"
                className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-full border border-line"
              >
                <X className="h-4 w-4" aria-hidden="true" />
              </button>
            </div>

            <fieldset className="mt-5">
              <legend className="text-sm font-semibold">이유</legend>
              <div className="mt-2 grid gap-2">
                {REPORT_REASONS.map((item) => {
                  const selected = reason === item.id;
                  return (
                    <label
                      key={item.id}
                      className={`flex min-h-12 cursor-pointer items-center gap-3 rounded-2xl border px-3 text-sm font-medium transition duration-200 ${
                        selected ? "border-foreground bg-foreground text-card" : "border-line bg-background"
                      }`}
                    >
                      <input
                        type="radio"
                        name={`reason-${targetId}`}
                        value={item.id}
                        checked={selected}
                        onChange={() => setReason(item.id)}
                        className="sr-only"
                      />
                      <span
                        aria-hidden="true"
                        className={`h-4 w-4 shrink-0 rounded-full border ${
                          selected ? "border-card bg-card shadow-[inset_0_0_0_4px_#1c1917]" : "border-line bg-card"
                        }`}
                      />
                      {item.label}
                    </label>
                  );
                })}
              </div>
            </fieldset>

            <label className="mt-4 block text-sm font-semibold">
              보충 설명
              <span className="ml-1 font-normal text-muted">선택</span>
              <textarea
                value={detail}
                onChange={(event) => setDetail(event.target.value)}
                maxLength={LIMITS.report}
                rows={3}
                placeholder="어떤 부분이 문제인지 짧게 적어 주세요."
                className="mt-2 w-full rounded-2xl border border-line bg-background px-3 py-3 font-normal outline-none transition duration-300 focus:border-foreground"
              />
            </label>
            <p className="mt-1 text-right text-xs text-muted">
              {detail.length}/{LIMITS.report}
            </p>

            <div className="absolute left-[-9999px] h-0 overflow-hidden" aria-hidden="true">
              <label>
                회사
                <input value={company} onChange={(event) => setCompany(event.target.value)} tabIndex={-1} autoComplete="off" />
              </label>
            </div>

            {error ? (
              <p className="mt-3 text-sm leading-6 text-danger" role="alert">
                {error}
              </p>
            ) : null}

            <div className="mt-4 flex justify-end gap-2">
              <button
                type="button"
                onClick={close}
                className="inline-flex min-h-11 items-center rounded-2xl border border-line px-4 text-sm font-semibold"
              >
                취소
              </button>
              <button
                type="submit"
                disabled={pending}
                className="inline-flex min-h-11 items-center rounded-2xl bg-foreground px-4 text-sm font-semibold text-card disabled:opacity-60"
              >
                {pending ? "접수 중" : "신고 접수"}
              </button>
            </div>
          </form>
        </dialog>
      ) : null}
    </div>
  );
}
