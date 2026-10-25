import { CATEGORIES, type Category } from "@/lib/types";

const DATE_KEY = /^(\d{4})-(\d{2})-(\d{2})$/;

export function koreaDateKey(now = new Date()): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Seoul",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(now);
}

export function isDateKey(value: string): boolean {
  const match = DATE_KEY.exec(value);
  if (!match) {
    return false;
  }
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const utc = new Date(Date.UTC(year, month - 1, day));
  return utc.getUTCFullYear() === year && utc.getUTCMonth() === month - 1 && utc.getUTCDate() === day;
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

export function pickDailyQuestions<
  T extends { id: string; category: Category; dailyFeatureDate: string | null },
>(questions: readonly T[], dateKey: string): T[] {
  return CATEGORIES.flatMap((category) => {
    const pool = questions.filter((question) => question.category === category);
    if (pool.length === 0) {
      return [];
    }
    const featured = pool.find((question) => question.dailyFeatureDate === dateKey);
    if (featured) {
      return [featured];
    }
    const ordered = [...pool].sort((a, b) => a.id.localeCompare(b.id));
    const picked = ordered[hashString(`${dateKey}:${category}`) % ordered.length];
    return picked ? [picked] : [];
  });
}
