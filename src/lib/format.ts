export function formatParticipantCount(count: number): string {
  return `참여 ${new Intl.NumberFormat("ko-KR").format(count)}명`;
}

export function formatVoteCount(count: number): string {
  return `${new Intl.NumberFormat("ko-KR").format(count)}표`;
}

export function formatDateTime(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) {
    return "";
  }
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: "Asia/Seoul",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).formatToParts(date);
  const value = (type: Intl.DateTimeFormatPartTypes) => parts.find((part) => part.type === type)?.value ?? "";
  return `${value("year")}. ${value("month")}. ${value("day")}. ${value("hour")}:${value("minute")}`;
}
