"use client";

import { useDemoState } from "@/lib/demo-storage";
import type { DataMode } from "@/lib/types";

export function VoteHint({
  mode,
  questionId,
  voted,
}: {
  mode: DataMode;
  questionId: string;
  voted: boolean;
}) {
  const demo = useDemoState();
  const localVoted = mode === "demo" ? Boolean(demo.votes[questionId]) : voted;
  return localVoted ? "결과 보기" : "참여하기";
}
