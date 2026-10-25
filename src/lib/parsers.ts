import { isCategory } from "@/lib/categories";
import type {
  Category,
  CommentStatus,
  Option,
  OptionCount,
  OwnComment,
  Participation,
  PublicComment,
  Question,
  QuestionStatus,
} from "@/lib/types";

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function asString(value: unknown): string | null {
  return typeof value === "string" ? value : null;
}

function asNumber(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value)) {
    return value;
  }
  if (typeof value === "string" && value.trim() && Number.isFinite(Number(value))) {
    return Number(value);
  }
  return null;
}

function asBoolean(value: unknown): boolean | null {
  return typeof value === "boolean" ? value : null;
}

export function parseQuestion(value: unknown, requireOptions: boolean): Question {
  if (!isRecord(value)) {
    throw new Error("invalid question");
  }

  const id = asString(value.id);
  const title = asString(value.title);
  const category = asString(value.category);
  const publishedAt = asString(value.publishedAt);
  const createdAt = asString(value.createdAt) ?? publishedAt;
  const participantCount = asNumber(value.participantCount);
  const description = value.description === null ? null : asString(value.description);
  const dailyFeatureDate =
    value.dailyFeatureDate === null || value.dailyFeatureDate === undefined
      ? null
      : asString(value.dailyFeatureDate);

  if (!id || !title || !category || !isCategory(category) || !publishedAt || !createdAt) {
    throw new Error("invalid question");
  }
  if (participantCount === null || description === null && value.description !== null) {
    throw new Error("invalid question");
  }
  if (dailyFeatureDate === null && value.dailyFeatureDate) {
    throw new Error("invalid question");
  }

  const options = Array.isArray(value.options) ? value.options.map(parseOption) : [];
  if (requireOptions && options.length < 2) {
    throw new Error("invalid options");
  }

  return {
    id,
    title,
    description,
    category,
    publishedAt,
    createdAt,
    dailyFeatureDate,
    participantCount,
    options,
  };
}

function parseOption(value: unknown): Option {
  if (!isRecord(value)) {
    throw new Error("invalid option");
  }
  const id = asString(value.id);
  const text = asString(value.text);
  const position = asNumber(value.position);
  if (!id || !text || position === null) {
    throw new Error("invalid option");
  }
  return { id, text, position };
}

export function parseQuestionList(value: unknown): Question[] {
  if (!Array.isArray(value)) {
    throw new Error("invalid list");
  }
  return value.map((item) => parseQuestion(item, false));
}

export function parseQuestionState(value: unknown):
  | { state: "missing" }
  | { state: "unpublished" }
  | { state: "ok"; question: Question } {
  if (!isRecord(value) || typeof value.state !== "string") {
    throw new Error("invalid state");
  }
  if (value.state === "missing" || value.state === "unpublished") {
    return { state: value.state };
  }
  if (value.state !== "ok") {
    throw new Error("invalid state");
  }
  return { state: "ok", question: parseQuestion(value.question, true) };
}

function parseCommentStatus(value: unknown): CommentStatus {
  if (value === "visible" || value === "hidden" || value === "deleted") {
    return value;
  }
  return "visible";
}

function parseOwnComment(value: unknown): OwnComment | null {
  if (value === null || value === undefined) {
    return null;
  }
  if (!isRecord(value)) {
    throw new Error("invalid comment");
  }
  const id = asString(value.id);
  const optionId = asString(value.optionId);
  const body = asString(value.body);
  const createdAt = asString(value.createdAt);
  if (!id || !optionId || !body || !createdAt) {
    throw new Error("invalid comment");
  }
  return { id, optionId, body, createdAt, status: parseCommentStatus(value.status) };
}

export function parsePublicComments(value: unknown): PublicComment[] {
  if (!Array.isArray(value)) {
    throw new Error("invalid comments");
  }
  return value.map((item) => {
    if (!isRecord(item)) {
      throw new Error("invalid comment");
    }
    const id = asString(item.id);
    const optionId = asString(item.optionId);
    const body = asString(item.body);
    const createdAt = asString(item.createdAt);
    if (!id || !optionId || !body || !createdAt) {
      throw new Error("invalid comment");
    }
    return { id, optionId, body, createdAt };
  });
}

export function parseParticipation(value: unknown): Participation {
  if (!isRecord(value)) {
    throw new Error("invalid participation");
  }
  if (value.state && value.state !== "ok") {
    throw new Error("invalid participation");
  }
  const participantCount = asNumber(value.participantCount);
  const voted = asBoolean(value.voted);
  if (participantCount === null || voted === null) {
    throw new Error("invalid participation");
  }
  const optionId = value.optionId === null || value.optionId === undefined ? null : asString(value.optionId);
  if (optionId === null && value.optionId) {
    throw new Error("invalid participation");
  }

  let counts: OptionCount[] | null = null;
  if (value.counts !== null && value.counts !== undefined) {
    if (!Array.isArray(value.counts)) {
      throw new Error("invalid counts");
    }
    counts = value.counts.map((item) => {
      if (!isRecord(item)) {
        throw new Error("invalid count");
      }
      const countOptionId = asString(item.optionId);
      const voteCount = asNumber(item.voteCount);
      if (!countOptionId || voteCount === null) {
        throw new Error("invalid count");
      }
      return { optionId: countOptionId, voteCount };
    });
  }

  return {
    participantCount,
    voted,
    optionId,
    comment: parseOwnComment(value.comment),
    counts,
  };
}

export function parseIdList(value: unknown): string[] {
  if (!Array.isArray(value)) {
    return [];
  }
  return value.filter((item): item is string => typeof item === "string");
}

export function parseActionResult(value: unknown): { ok: true; extra: Record<string, unknown> } | { ok: false; code: string } {
  if (!isRecord(value) || typeof value.ok !== "boolean") {
    return { ok: false, code: "unavailable" };
  }
  if (!value.ok) {
    return { ok: false, code: asString(value.code) ?? "unavailable" };
  }
  return { ok: true, extra: value };
}

export function parseQuestionStatus(value: unknown): QuestionStatus | null {
  if (value === "draft" || value === "published" || value === "hidden") {
    return value;
  }
  return null;
}

export function emptyParticipation(participantCount = 0): Participation {
  return {
    participantCount,
    voted: false,
    optionId: null,
    comment: null,
    counts: null,
  };
}

export type AdminSuggestion = {
  id: string;
  title: string;
  description: string | null;
  category: Category;
  options: string[];
  createdAt: string;
};

export type AdminReport = {
  id: string;
  targetType: "question" | "comment";
  targetId: string;
  reason: string;
  createdAt: string;
  preview: string;
};

export type AdminQuestion = {
  id: string;
  title: string;
  category: Category;
  status: QuestionStatus;
  participantCount: number;
  publishedAt: string | null;
};

export type AdminDashboard = {
  suggestions: AdminSuggestion[];
  reports: AdminReport[];
  questions: AdminQuestion[];
};

export function parseAdminDashboard(value: unknown): AdminDashboard {
  if (!isRecord(value)) {
    throw new Error("invalid dashboard");
  }
  const suggestions = Array.isArray(value.suggestions) ? value.suggestions.map(parseAdminSuggestion) : [];
  const reports = Array.isArray(value.reports) ? value.reports.map(parseAdminReport) : [];
  const questions = Array.isArray(value.questions) ? value.questions.map(parseAdminQuestion) : [];
  return { suggestions, reports, questions };
}

function parseAdminSuggestion(value: unknown): AdminSuggestion {
  if (!isRecord(value)) {
    throw new Error("invalid suggestion");
  }
  const id = asString(value.id);
  const title = asString(value.title);
  const category = asString(value.category);
  const createdAt = asString(value.createdAt);
  const description = value.description === null ? null : asString(value.description);
  if (!id || !title || !category || !isCategory(category) || !createdAt || (description === null && value.description !== null)) {
    throw new Error("invalid suggestion");
  }
  if (!Array.isArray(value.options) || !value.options.every((option) => typeof option === "string")) {
    throw new Error("invalid suggestion");
  }
  return {
    id,
    title,
    description,
    category,
    options: value.options,
    createdAt,
  };
}

function parseAdminReport(value: unknown): AdminReport {
  if (!isRecord(value)) {
    throw new Error("invalid report");
  }
  const id = asString(value.id);
  const targetType = asString(value.targetType);
  const targetId = asString(value.targetId);
  const reason = asString(value.reason);
  const createdAt = asString(value.createdAt);
  const preview = asString(value.preview) ?? "";
  if (!id || !targetId || !reason || !createdAt || (targetType !== "question" && targetType !== "comment")) {
    throw new Error("invalid report");
  }
  return { id, targetType, targetId, reason, createdAt, preview };
}

function parseAdminQuestion(value: unknown): AdminQuestion {
  if (!isRecord(value)) {
    throw new Error("invalid admin question");
  }
  const id = asString(value.id);
  const title = asString(value.title);
  const category = asString(value.category);
  const status = parseQuestionStatus(value.status);
  const participantCount = asNumber(value.participantCount);
  const publishedAt = value.publishedAt === null ? null : asString(value.publishedAt);
  if (!id || !title || !category || !isCategory(category) || !status || participantCount === null) {
    throw new Error("invalid admin question");
  }
  if (publishedAt === null && value.publishedAt) {
    throw new Error("invalid admin question");
  }
  return { id, title, category, status, participantCount, publishedAt };
}
