import { koreaDateKey } from "@/lib/daily";
import type { DemoState } from "@/lib/demo-state";
import { readDemoState } from "@/lib/demo-storage";
import { isSupabaseConfigured } from "@/lib/env";
import { LIMITS } from "@/lib/limits";
import { getMyQuestionWriteQuotaAction } from "@/server/actions";

type QuotaCache = {
  allowed: boolean;
  used: number;
  limit: number;
  at: number;
};

let cache: QuotaCache | null = null;
let inflight: Promise<boolean> | null = null;

const CACHE_MS = 30_000;

export function demoCanWriteQuestionToday(state: DemoState, now = new Date()): boolean {
  const today = koreaDateKey(now);
  const used = (state.suggestions ?? []).filter(
    (suggestion) => koreaDateKey(new Date(suggestion.createdAt)) === today,
  ).length;
  return used < LIMITS.suggestionsPerDay;
}

export function getCachedWriteAllowed(): boolean | null {
  if (!cache) {
    return null;
  }
  if (Date.now() - cache.at > CACHE_MS) {
    return null;
  }
  return cache.allowed;
}

export function setCachedWriteQuota(allowed: boolean, used = 0, limit: number = LIMITS.suggestionsPerDay): void {
  cache = { allowed, used, limit, at: Date.now() };
}

export function invalidateWriteQuotaCache(): void {
  cache = null;
  inflight = null;
}

export async function canWriteQuestionToday(options?: { force?: boolean }): Promise<boolean> {
  if (!isSupabaseConfigured()) {
    const allowed = demoCanWriteQuestionToday(readDemoState());
    setCachedWriteQuota(allowed);
    return allowed;
  }

  if (!options?.force) {
    const cached = getCachedWriteAllowed();
    if (cached !== null) {
      return cached;
    }
    if (inflight) {
      return inflight;
    }
  }

  inflight = (async () => {
    const result = await getMyQuestionWriteQuotaAction();
    if (!result.ok) {
      // 조회 실패 시에는 작성을 막지 않음 (제출 단계에서 다시 검사)
      setCachedWriteQuota(true);
      return true;
    }
    setCachedWriteQuota(result.allowed, result.used, result.limit);
    return result.allowed;
  })();

  try {
    return await inflight;
  } finally {
    inflight = null;
  }
}

export function prefetchWriteQuota(): void {
  void canWriteQuestionToday();
}
