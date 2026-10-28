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
  nickname: string;
  avatarUrl: string | null;
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
  nickname: string;
  avatarUrl: string | null;
};

export type DemoState = {
  votes: Record<string, DemoVote>;
  comments: Record<string, DemoComment[]>;
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
  const comments: Record<string, DemoComment[]> = {};
  for (const [questionId, list] of Object.entries(state.comments ?? {})) {
    comments[questionId] = [...list];
  }
  return {
    votes: { ...state.votes },
    comments,
    replies: [...(state.replies ?? [])],
    likes: { ...(state.likes ?? {}) },
    suggestions: [...state.suggestions],
    reports: [...state.reports],
  };
}

function rootsFor(state: DemoState, questionId: string): DemoComment[] {
  return state.comments[questionId] ?? [];
}

export function normalizeDemoComments(value: unknown): Record<string, DemoComment[]> {
  if (!value || typeof value !== "object") {
    return {};
  }
  const next: Record<string, DemoComment[]> = {};
  for (const [questionId, entry] of Object.entries(value as Record<string, unknown>)) {
    if (Array.isArray(entry)) {
      next[questionId] = entry.filter((item): item is DemoComment => Boolean(item && typeof item === "object"));
      continue;
    }
    if (entry && typeof entry === "object") {
      next[questionId] = [entry as DemoComment];
    }
  }
  return next;
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
  profile: { nickname: string; avatarUrl: string | null },
  now = new Date().toISOString(),
): DemoMutation<DemoComment> {
  const vote = state.votes[questionId];
  if (!vote) {
    return { ok: false, code: "vote_required" };
  }

  const existing = rootsFor(state, questionId);
  const comment = {
    id: `demo-comment-${questionId}-${existing.length + 1}`,
    optionId: vote.optionId,
    body,
    createdAt: now,
    nickname: profile.nickname,
    avatarUrl: profile.avatarUrl,
  };
  const next = clone(state);
  next.comments[questionId] = [comment, ...existing];
  return { ok: true, state: next, value: comment };
}

export function addDemoReply(
  state: DemoState,
  questionId: string,
  parentId: string,
  body: string,
  profile: { nickname: string; avatarUrl: string | null },
  now = new Date().toISOString(),
): DemoMutation<DemoReply> {
  const vote = state.votes[questionId];
  const parent = rootsFor(state, questionId).find((item) => item.id === parentId);
  if (!vote) {
    return { ok: false, code: "vote_required" };
  }
  if (!parent) {
    return { ok: false, code: "not_found" };
  }

  const reply: DemoReply = {
    id: `demo-reply-${parentId}-${(state.replies ?? []).length + 1}`,
    questionId,
    parentId,
    optionId: vote.optionId,
    body,
    createdAt: now,
    nickname: profile.nickname,
    avatarUrl: profile.avatarUrl,
  };
  const next = clone(state);
  next.replies = [reply, ...next.replies];
  return { ok: true, state: next, value: reply };
}

export function editDemoPost(
  state: DemoState,
  questionId: string,
  commentId: string,
  body: string,
): DemoMutation<string> {
  const next = clone(state);
  const roots = next.comments[questionId] ?? [];
  const rootIndex = roots.findIndex((item) => item.id === commentId);
  if (rootIndex >= 0) {
    const current = roots[rootIndex];
    if (!current) {
      return { ok: false, code: "not_found" };
    }
    roots[rootIndex] = { ...current, body };
    next.comments[questionId] = roots;
    return { ok: true, state: next, value: body };
  }
  const index = next.replies.findIndex((reply) => reply.id === commentId && reply.questionId === questionId);
  if (index < 0) {
    return { ok: false, code: "not_found" };
  }
  const current = next.replies[index];
  if (!current) {
    return { ok: false, code: "not_found" };
  }
  next.replies[index] = { ...current, body };
  return { ok: true, state: next, value: body };
}

export function deleteDemoPost(state: DemoState, questionId: string, commentId: string): DemoMutation<null> {
  const next = clone(state);
  const roots = next.comments[questionId] ?? [];
  if (roots.some((item) => item.id === commentId)) {
    const removed = new Set<string>([commentId]);
    for (const reply of next.replies) {
      if (reply.parentId === commentId) {
        removed.add(reply.id);
      }
    }
    next.comments[questionId] = roots.filter((item) => item.id !== commentId);
    if (next.comments[questionId]?.length === 0) {
      delete next.comments[questionId];
    }
    next.replies = next.replies.filter((reply) => reply.parentId !== commentId);
    for (const id of removed) {
      delete next.likes[id];
    }
    return { ok: true, state: next, value: null };
  }

  const reply = next.replies.find((item) => item.id === commentId && item.questionId === questionId);
  if (!reply) {
    return { ok: false, code: "not_found" };
  }
  next.replies = next.replies.filter((item) => item.id !== commentId);
  delete next.likes[commentId];
  return { ok: true, state: next, value: null };
}

export function toggleDemoLike(state: DemoState, questionId: string, commentId: string): DemoMutation<boolean> {
  const vote = state.votes[questionId];
  if (!vote) {
    return { ok: false, code: "vote_required" };
  }
  const root = rootsFor(state, questionId).some((item) => item.id === commentId);
  const reply = (state.replies ?? []).find((item) => item.id === commentId && item.questionId === questionId);
  if (!root && !reply) {
    return { ok: false, code: "not_found" };
  }
  const next = clone(state);
  const liked = Boolean(next.likes[commentId]);
  if (liked) {
    delete next.likes[commentId];
  } else {
    next.likes[commentId] = true;
  }
  return { ok: true, state: next, value: !liked };
}

export function demoPublicComments(state: DemoState, questionId: string): PublicComment[] {
  const roots = rootsFor(state, questionId);
  if (roots.length === 0) {
    return [];
  }
  const liked = (id: string) => Boolean(state.likes?.[id]);
  return roots
    .slice()
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
    .map((root) => ({
      id: root.id,
      optionId: root.optionId,
      body: root.body,
      createdAt: root.createdAt,
      nickname: root.nickname || "익명",
      avatarUrl: root.avatarUrl ?? null,
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
          nickname: reply.nickname || "익명",
          avatarUrl: reply.avatarUrl ?? null,
          likeCount: liked(reply.id) ? 1 : 0,
          likedByMe: liked(reply.id),
          mine: true,
        })),
    }));
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
