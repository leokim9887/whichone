import { formatVoteCount } from "@/lib/format";
import type { ResultSummary } from "@/lib/types";

export function ResultBars({
  summary,
  scope,
}: {
  summary: ResultSummary;
  scope: "shared" | "browser";
}) {
  const leaders = summary.options.filter((option) => option.isLeader);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-2">
        <h3 className="text-lg font-bold">{scope === "browser" ? "이 브라우저의 기록" : "투표 결과"}</h3>
        <p className="text-sm text-muted">
          {scope === "browser"
            ? "다른 참여자와 합산되지 않습니다"
            : `전체 ${new Intl.NumberFormat("ko-KR").format(summary.total)}명`}
        </p>
      </div>
      {leaders.length > 0 ? (
        <p className="text-sm font-semibold text-accent-strong">
          {leaders.length > 1 ? "공동으로 가장 많은 선택" : "가장 많은 선택"}:{" "}
          {leaders.map((option) => option.text).join(", ")}
        </p>
      ) : (
        <p className="text-sm text-muted">아직 집계된 표가 없습니다.</p>
      )}
      <ul className="space-y-3">
        {summary.options.map((option) => (
          <li key={option.optionId}>
            <div className="mb-1 flex items-center justify-between gap-3 text-sm">
              <span className="font-semibold">
                {option.text}
                {option.isMine ? <span className="ml-2 text-accent">내 선택</span> : null}
              </span>
              <span className="shrink-0 text-muted">
                {formatVoteCount(option.voteCount)} · {option.percentage}%
              </span>
            </div>
            <div
              className="h-3 overflow-hidden rounded-full bg-accent-soft"
              role="img"
              aria-label={`${option.text} ${option.percentage}%`}
            >
              <div
                className={`h-full rounded-full ${option.isMine ? "bg-accent" : "bg-foreground/70"}`}
                style={{ width: `${option.percentage}%` }}
              />
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}
