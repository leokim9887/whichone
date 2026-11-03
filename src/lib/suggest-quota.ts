import { koreaDateKey } from "@/lib/daily";
import type { DemoState } from "@/lib/demo-state";
import { readDemoState } from "@/lib/demo-storage";
import { isSupabaseConfigured } from "@/lib/env";
import { LIMITS } from "@/lib/limits";
import { getMyQuestionWriteQuotaAction } from "@/server/actions";

export function demoCanWriteQuestionToday(state: DemoState, now = new Date()): boolean {
  const today = koreaDateKey(now);
  const used = (state.suggestions ?? []).filter(
    (suggestion) => koreaDateKey(new Date(suggestion.createdAt)) === today,
  ).length;
  return used < LIMITS.suggestionsPerDay;
}

export async function canWriteQuestionToday(): Promise<boolean> {
  if (!isSupabaseConfigured()) {
    return demoCanWriteQuestionToday(readDemoState());
  }
  const result = await getMyQuestionWriteQuotaAction();
  if (!result.ok) {
    return true;
  }
  return result.allowed;
}
