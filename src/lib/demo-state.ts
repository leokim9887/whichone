import { LIMITS } from "@/lib/limits";
import type { Category, PublicComment, SuggestionDraft } from "@/lib/types";

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

export type DemoReply = {
  id: string;
  questionId: string;
  parentId: string;
  optionId: string;
  body: string;
  createdAt: string;
};

export type DemoState = {
  votes: Record<string, DemoVote>;
  comments: Record<string, DemoComment>;
  replies: DemoReply[];
  likes: Record<string, true>;
  suggestions: DemoSuggestion[];
  reports: DemoReport[];
};

export const EMPTY_DEMO_STATE: DemoState = {
  votes: {},
  comments: {},
  replies: [],
  likes: {},
  suggestions: [],
  reports: [],
};

export type DemoMutation<T> = { ok: true; state: DemoState; value: T } | { ok: false; code: string };

function clone(state: DemoState): DemoState {
  return {
    votes: { ...state.votes },
    comments: { ...state.comments },
    replies: [...(state.replies ?? [])],
    likes: { ...(state.likes ?? {}) },
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

export function addDemoReply(
  state: DemoState,
  questionId: string,
  parentId: string,
  body: string,
  now = new Date().toISOString(),
): DemoMutation<DemoReply> {
  const vote = state.votes[questionId];
  const parent = state.comments[questionId];
  if (!vote) {
    return { ok: false, code: "vote_required" };
  }
  if (!parent || parent.id !== parentId) {
    return { ok: false, code: "not_found" };
  }
  if ((state.replies ?? []).some((reply) => reply.parentId === parentId)) {
    return { ok: false, code: "already_replied" };
  }

  const reply: DemoReply = {
    id: `demo-reply-${parentId}`,
    questionId,
    parentId,
    optionId: vote.optionId,
    body,
    createdAt: now,
  };
  const next = clone(state);
  next.replies = [reply, ...next.replies];
  return { ok: true, state: next, value: reply };
}

export function toggleDemoLike(state: DemoState, questionId: string, commentId: string): DemoMutation<boolean> {
  const vote = state.votes[questionId];
  if (!vote) {
    return { ok: false, code: "vote_required" };
  }
  const root = state.comments[questionId];
  const reply = (state.replies ?? []).find((item) => item.id === commentId && item.questionId === questionId);
  if (root?.id !== commentId && !reply) {
    return { ok: false, code: "not_found" };
  }
  return { ok: false, code: "own_like" };
}

export function demoPublicComments(state: DemoState, questionId: string): PublicComment[] {
  const root = state.comments[questionId];
  if (!root) {
    return [];
  }
  const liked = (id: string) => Boolean(state.likes?.[id]);
  return [
    {
      id: root.id,
      optionId: root.optionId,
      body: root.body,
      createdAt: root.createdAt,
      likeCount: liked(root.id) ? 1 : 0,
      likedByMe: liked(root.id),
      mine: true,
      replies: (state.replies ?? [])
        .filter((reply) => reply.parentId === root.id)
        .slice()
        .sort((a, b) => a.createdAt.localeCompare(b.createdAt))
        .map((reply) => ({
          id: reply.id,
          optionId: reply.optionId,
          body: reply.body,
          createdAt: reply.createdAt,
          likeCount: liked(reply.id) ? 1 : 0,
          likedByMe: liked(reply.id),
          mine: true,
        })),
    },
  ];
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
