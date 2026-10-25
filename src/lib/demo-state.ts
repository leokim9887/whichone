import { LIMITS } from "@/lib/limits";
import type { Category, SuggestionDraft } from "@/lib/types";

export type DemoVote = {
  optionId: string;
  createdAt: string;
};

export type DemoComment = {
  id: string;
  optionId: string;
  body: string;
  createdAt: string;
};

export type DemoSuggestion = SuggestionDraft & {
  id: string;
  description: string;
  status: "pending";
  createdAt: string;
};

export type DemoReport = {
  id: string;
  targetType: "question" | "comment";
  targetId: string;
  reason: string;
  createdAt: string;
};

export type DemoState = {
  votes: Record<string, DemoVote>;
  comments: Record<string, DemoComment>;
  suggestions: DemoSuggestion[];
  reports: DemoReport[];
};

export const EMPTY_DEMO_STATE: DemoState = {
  votes: {},
  comments: {},
  suggestions: [],
  reports: [],
};

export type DemoMutation<T> = { ok: true; state: DemoState; value: T } | { ok: false; code: string };

function clone(state: DemoState): DemoState {
  return {
    votes: { ...state.votes },
    comments: { ...state.comments },
    suggestions: [...state.suggestions],
    reports: [...state.reports],
  };
}

export function castDemoVote(
  state: DemoState,
  questionId: string,
  optionId: string,
  allowedOptionIds: readonly string[],
  now = new Date().toISOString(),
): DemoMutation<DemoVote> {
  if (!allowedOptionIds.includes(optionId)) {
    return { ok: false, code: "invalid" };
  }
  if (state.votes[questionId]) {
    return { ok: false, code: "already_voted" };
  }

  const vote = { optionId, createdAt: now };
  const next = clone(state);
  next.votes[questionId] = vote;
  return { ok: true, state: next, value: vote };
}

export function addDemoComment(
  state: DemoState,
  questionId: string,
  body: string,
  now = new Date().toISOString(),
): DemoMutation<DemoComment> {
  const vote = state.votes[questionId];
  if (!vote) {
    return { ok: false, code: "vote_required" };
  }
  if (state.comments[questionId]) {
    return { ok: false, code: "already_commented" };
  }

  const comment = {
    id: `demo-comment-${questionId}`,
    optionId: vote.optionId,
    body,
    createdAt: now,
  };
  const next = clone(state);
  next.comments[questionId] = comment;
  return { ok: true, state: next, value: comment };
}

export function addDemoSuggestion(
  state: DemoState,
  draft: SuggestionDraft,
  now = new Date().toISOString(),
): DemoMutation<DemoSuggestion> {
  const dayAgo = Date.parse(now) - 24 * 60 * 60 * 1000;
  const recent = state.suggestions.filter((suggestion) => Date.parse(suggestion.createdAt) >= dayAgo);
  if (recent.length >= LIMITS.suggestionsPerDay) {
    return { ok: false, code: "rate_limited" };
  }

  const suggestion: DemoSuggestion = {
    ...draft,
    description: draft.description,
    id: `demo-suggestion-${state.suggestions.length + 1}`,
    status: "pending",
    createdAt: now,
  };
  const next = clone(state);
  next.suggestions = [suggestion, ...next.suggestions];
  return { ok: true, state: next, value: suggestion };
}

export function addDemoReport(
  state: DemoState,
  report: Omit<DemoReport, "id" | "createdAt">,
  now = new Date().toISOString(),
): DemoMutation<DemoReport> {
  const duplicate = state.reports.some(
    (item) => item.targetType === report.targetType && item.targetId === report.targetId,
  );
  if (duplicate) {
    return { ok: false, code: "already_reported" };
  }

  const stored: DemoReport = {
    ...report,
    id: `demo-report-${state.reports.length + 1}`,
    createdAt: now,
  };
  const next = clone(state);
  next.reports = [stored, ...next.reports];
  return { ok: true, state: next, value: stored };
}

export function isDemoState(value: unknown): value is DemoState {
  if (!value || typeof value !== "object") {
    return false;
  }
  const record = value as Partial<DemoState>;
  return Boolean(record.votes && record.comments && record.suggestions && record.reports);
}

export function categoryOfSuggestion(value: string): Category | null {
  if (
    value === "daily" ||
    value === "love" ||
    value === "money" ||
    value === "work" ||
    value === "food" ||
    value === "values"
  ) {
    return value;
  }
  return null;
}
