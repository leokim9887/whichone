"use client";

import { useState } from "react";
import { Flag } from "lucide-react";

import { addDemoReport, type DemoState } from "@/lib/demo-state";
import { writeDemoState } from "@/lib/demo-storage";
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
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState<ReportReason | "">("");
  const [detail, setDetail] = useState("");
  const [company, setCompany] = useState("");
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

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
      setOpen(false);
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
    setOpen(false);
  }

  return (
    <div>
      <button
        type="button"
        onClick={() => setOpen((value) => !value)}
        className="inline-flex min-h-11 items-center gap-2 text-sm font-semibold text-muted"
      >
        <Flag className="h-4 w-4" aria-hidden="true" />
        신고
      </button>
      {message ? (
        <p className="mt-2 text-sm text-ok" role="status">
          {message}
        </p>
      ) : null}
      {open ? (
        <form
          className="mt-3 space-y-3 rounded-2xl border border-line bg-background p-4"
          onSubmit={(event) => {
            event.preventDefault();
            void submit();
          }}
        >
          <fieldset>
            <legend className="text-sm font-semibold">신고 이유</legend>
            <div className="mt-2 space-y-2">
              {REPORT_REASONS.map((item) => (
                <label key={item.id} className="flex min-h-11 items-center gap-2 text-sm">
                  <input
                    type="radio"
                    name={`reason-${targetId}`}
                    value={item.id}
                    checked={reason === item.id}
                    onChange={() => setReason(item.id)}
                  />
                  {item.label}
                </label>
              ))}
            </div>
          </fieldset>
          <label className="block text-sm font-semibold">
            보충 설명
            <textarea
              value={detail}
              onChange={(event) => setDetail(event.target.value)}
              maxLength={300}
              rows={3}
              className="mt-2 w-full rounded-2xl border border-line bg-card px-3 py-2 font-normal"
            />
          </label>
          <div className="absolute left-[-9999px] h-0 overflow-hidden" aria-hidden="true">
            <label>
              회사
              <input value={company} onChange={(event) => setCompany(event.target.value)} tabIndex={-1} autoComplete="off" />
            </label>
          </div>
          {error ? (
            <p className="text-sm text-danger" role="alert">
              {error}
            </p>
          ) : null}
          <button
            type="submit"
            disabled={pending}
            className="inline-flex min-h-11 items-center rounded-2xl bg-foreground px-4 text-sm font-semibold text-card disabled:opacity-60"
          >
            {pending ? "접수 중" : "신고 접수"}
          </button>
        </form>
      ) : null}
    </div>
  );
}
