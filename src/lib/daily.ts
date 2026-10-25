const DATE_KEY = /^(\d{4})-(\d{2})-(\d{2})$/;

export function koreaDateKey(now = new Date()): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Seoul",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(now);
}

export function formatKoreanDate(dateKey: string): string {
  const match = DATE_KEY.exec(dateKey);
  if (!match) {
    return dateKey;
  }
  return `${match[1]}년 ${Number(match[2])}월 ${Number(match[3])}일`;
}

export function hashString(value: string): number {
  let hash = 0;
  for (let index = 0; index < value.length; index += 1) {
    hash = (hash * 31 + value.charCodeAt(index)) >>> 0;
  }
  return hash;
}

export function pickDailyQuestion<T extends { id: string; dailyFeatureDate: string | null }>(
  questions: readonly T[],
  dateKey: string,
): T | null {
  if (questions.length === 0) {
    return null;
  }

  const featured = questions.find((question) => question.dailyFeatureDate === dateKey);
  if (featured) {
    return featured;
  }

  const ordered = [...questions].sort((a, b) => a.id.localeCompare(b.id));
  return ordered[hashString(dateKey) % ordered.length] ?? null;
}
