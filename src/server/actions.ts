"use server";

import { isDateKey } from "@/lib/daily";
import { isSupabaseConfigured } from "@/lib/env";
import { messageForCode } from "@/lib/messages";
import {
  parseActionResult,
  parseParticipation,
  parsePublicComments,
} from "@/lib/parsers";
import { createServerSupabase } from "@/lib/supabase/server";
import type { Participation, PublicComment, QuestionStatus } from "@/lib/types";
import { isUuid } from "@/lib/uuid";
import { validateComment, validateReport, validateSuggestion } from "@/lib/validation";

export type FieldErrors = Record<string, string>;

export type VoteActionResult =
  | { ok: true; participation: Participation; comments: PublicComment[] }
  | {
      ok: false;
      code: string;
      message: string;
      participation?: Participation;
      comments?: PublicComment[];
    };

export type CommentActionResult =
  | { ok: true; participation: Participation; comments: PublicComment[] }
  | { ok: false; code: string; message: string; errors?: FieldErrors };

export type FormActionResult =
  | { ok: true; message: string }
  | { ok: false; code: string; message: string; errors?: FieldErrors };

type ServerClient = Awaited<ReturnType<typeof createServerSupabase>>;

async function withUser(): Promise<{ supabase: ServerClient; errorCode: string | null }> {
  const supabase = await createServerSupabase();
  const existing = await supabase.auth.getSession();
  if (!existing.error && existing.data.session?.user) {
    return { supabase, errorCode: null };
  }

  const signedIn = await supabase.auth.signInAnonymously();
  if (signedIn.error || !signedIn.data.user) {
    const disabled = /anonymous/i.test(signedIn.error?.message ?? "");
    return { supabase, errorCode: disabled ? "anonymous_disabled" : "auth_required" };
  }
  return { supabase, errorCode: null };
}

async function readSnapshot(supabase: ServerClient, questionId: string) {
  const [participationResult, commentResult] = await Promise.all([
    supabase.rpc("get_my_participation", { p_question_id: questionId }),
    supabase.rpc("list_visible_comments", { p_question_id: questionId }),
  ]);
  if (participationResult.error) {
    return null;
  }
  const participation = parseParticipation(participationResult.data);
  const comments = commentResult.error || !participation.voted ? [] : parsePublicComments(commentResult.data);
  return { participation, comments };
}

function failure(
  code: string,
  errors?: FieldErrors,
): { ok: false; code: string; message: string; errors?: FieldErrors } {
  return { ok: false, code, message: messageForCode(code), errors };
}

export async function castVoteAction(questionId: string, optionId: string): Promise<VoteActionResult> {
  if (!isSupabaseConfigured()) {
    return { ok: false, code: "demo", message: "" };
  }
  if (!isUuid(questionId) || !isUuid(optionId)) {
    return { ok: false, code: "invalid", message: messageForCode("invalid") };
  }

  try {
    const auth = await withUser();
    if (auth.errorCode) {
      return { ok: false, code: auth.errorCode, message: messageForCode(auth.errorCode) };
    }

    const { data, error } = await auth.supabase.rpc("cast_vote", {
      p_question_id: questionId,
      p_option_id: optionId,
    });
    if (error) {
      return { ok: false, code: "unavailable", message: messageForCode("unavailable") };
    }

    const result = parseActionResult(data);
    const shot = await readSnapshot(auth.supabase, questionId);
    if (!result.ok) {
      return {
        ok: false,
        code: result.code,
        message: messageForCode(result.code),
        participation: shot?.participation,
        comments: shot?.comments,
      };
    }
    if (!shot) {
      return { ok: false, code: "unavailable", message: messageForCode("unavailable") };
    }
    return { ok: true, ...shot };
  } catch {
    return { ok: false, code: "unavailable", message: messageForCode("unavailable") };
  }
}

export async function addCommentAction(questionId: string, body: string): Promise<CommentActionResult> {
  if (!isSupabaseConfigured()) {
    return { ok: false, code: "demo", message: "" };
  }
  const validated = validateComment(body);
  if (!validated.ok) {
    return { ok: false, code: "invalid", message: validated.message, errors: validated.errors };
  }
  if (!isUuid(questionId)) {
    return { ok: false, code: "invalid", message: messageForCode("invalid") };
  }

  try {
    const auth = await withUser();
    if (auth.errorCode) {
      return failure(auth.errorCode);
    }
    const { data, error } = await auth.supabase.rpc("add_comment", {
      p_question_id: questionId,
      p_body: validated.value.body,
    });
    if (error) {
      return failure("unavailable");
    }
    const result = parseActionResult(data);
    if (!result.ok) {
      return failure(result.code);
    }
    const shot = await readSnapshot(auth.supabase, questionId);
    if (!shot) {
      return failure("unavailable");
    }
    return { ok: true, ...shot };
  } catch {
    return failure("unavailable");
  }
}

export async function addReplyAction(
  questionId: string,
  parentId: string,
  body: string,
): Promise<{ ok: true; comments: PublicComment[] | null } | { ok: false; code: string; message: string; errors?: FieldErrors }> {
  if (!isSupabaseConfigured()) {
    return { ok: false, code: "demo", message: "" };
  }
  const validated = validateComment(body);
  if (!validated.ok) {
    return { ok: false, code: "invalid", message: validated.message, errors: validated.errors };
  }
  if (!isUuid(questionId) || !isUuid(parentId)) {
    return { ok: false, code: "invalid", message: messageForCode("invalid") };
  }

  try {
    const auth = await withUser();
    if (auth.errorCode) {
      return failure(auth.errorCode);
    }
    const { data, error } = await auth.supabase.rpc("add_comment_reply", {
      p_question_id: questionId,
      p_parent_id: parentId,
      p_body: validated.value.body,
    });
    if (error) {
      return failure("unavailable");
    }
    const result = parseActionResult(data);
    if (!result.ok) {
      return failure(result.code);
    }
    const listed = await auth.supabase.rpc("list_visible_comments", { p_question_id: questionId });
    if (listed.error) {
      return { ok: true, comments: null };
    }
    try {
      return { ok: true, comments: parsePublicComments(listed.data) };
    } catch {
      return { ok: true, comments: null };
    }
  } catch {
    return failure("unavailable");
  }
}

export async function editCommentAction(
  questionId: string,
  commentId: string,
  body: string,
): Promise<{ ok: true } | { ok: false; code: string; message: string; errors?: FieldErrors }> {
  if (!isSupabaseConfigured()) {
    return { ok: false, code: "demo", message: "" };
  }
  const validated = validateComment(body);
  if (!validated.ok) {
    return { ok: false, code: "invalid", message: validated.message, errors: validated.errors };
  }
  if (!isUuid(questionId) || !isUuid(commentId)) {
    return { ok: false, code: "invalid", message: messageForCode("invalid") };
  }

  try {
    const auth = await withUser();
    if (auth.errorCode) {
      return failure(auth.errorCode);
    }
    const { data, error } = await auth.supabase.rpc("edit_own_comment", {
      p_question_id: questionId,
      p_comment_id: commentId,
      p_body: validated.value.body,
    });
    if (error) {
      return failure("unavailable");
    }
    const result = parseActionResult(data);
    if (!result.ok) {
      return failure(result.code);
    }
    return { ok: true };
  } catch {
    return failure("unavailable");
  }
}

export async function deleteCommentAction(
  questionId: string,
  commentId: string,
): Promise<{ ok: true; comments: PublicComment[] | null } | { ok: false; code: string; message: string }> {
  if (!isSupabaseConfigured()) {
    return { ok: false, code: "demo", message: "" };
  }
  if (!isUuid(questionId) || !isUuid(commentId)) {
    return { ok: false, code: "invalid", message: messageForCode("invalid") };
  }

  try {
    const auth = await withUser();
    if (auth.errorCode) {
      return failure(auth.errorCode);
    }
    const { data, error } = await auth.supabase.rpc("delete_own_comment", {
      p_question_id: questionId,
      p_comment_id: commentId,
    });
    if (error) {
      return failure("unavailable");
    }
    const result = parseActionResult(data);
    if (!result.ok) {
      return failure(result.code);
    }
    const listed = await auth.supabase.rpc("list_visible_comments", { p_question_id: questionId });
    if (listed.error) {
      return { ok: true, comments: null };
    }
    try {
      return { ok: true, comments: parsePublicComments(listed.data) };
    } catch {
      return { ok: true, comments: null };
    }
  } catch {
    return failure("unavailable");
  }
}

export async function toggleCommentLikeAction(
  questionId: string,
  commentId: string,
): Promise<{ ok: true } | { ok: false; code: string; message: string }> {
  if (!isSupabaseConfigured()) {
    return { ok: false, code: "demo", message: "" };
  }
  if (!isUuid(questionId) || !isUuid(commentId)) {
    return { ok: false, code: "invalid", message: messageForCode("invalid") };
  }

  try {
    const auth = await withUser();
    if (auth.errorCode) {
      return failure(auth.errorCode);
    }
    const { data, error } = await auth.supabase.rpc("toggle_comment_like", {
      p_question_id: questionId,
      p_comment_id: commentId,
    });
    if (error) {
      return failure("unavailable");
    }
    const result = parseActionResult(data);
    if (!result.ok) {
      return failure(result.code);
    }
    return { ok: true };
  } catch {
    return failure("unavailable");
  }
}

export async function submitSuggestionAction(input: {
  title: string;
  description: string;
  category: string;
  topic: string;
  options: string[];
  company: string;
}): Promise<FormActionResult> {
  const validated = validateSuggestion(input);
  if (!validated.ok) {
    return { ok: false, code: "invalid", message: validated.message, errors: validated.errors };
  }
  if (input.company.trim()) {
    return {
      ok: true,
      message: "제안을 받았습니다. 검토가 끝난 뒤에만 공개됩니다.",
    };
  }
  if (!isSupabaseConfigured()) {
    return { ok: false, code: "demo", message: "" };
  }

  try {
    const auth = await withUser();
    if (auth.errorCode) {
      return failure(auth.errorCode);
    }
    const { data, error } = await auth.supabase.rpc("submit_suggestion", {
      p_title: validated.value.title,
      p_description: validated.value.description,
      p_category: validated.value.category,
      p_topic: validated.value.topic,
      p_options: validated.value.options,
    });
    if (error) {
      return failure("unavailable");
    }
    const result = parseActionResult(data);
    if (!result.ok) {
      return failure(result.code);
    }
    return {
      ok: true,
      message: "제안을 받았습니다. 검토가 끝난 뒤에만 공개됩니다.",
    };
  } catch {
    return failure("unavailable");
  }
}

export async function submitReportAction(input: {
  targetType: "question" | "comment";
  targetId: string;
  reason: string;
  detail: string;
  company: string;
}): Promise<FormActionResult> {
  const validated = validateReport(input);
  if (!validated.ok) {
    return { ok: false, code: "invalid", message: validated.message, errors: validated.errors };
  }
  if (!isUuid(input.targetId) || (input.targetType !== "question" && input.targetType !== "comment")) {
    return failure("invalid");
  }
  if (input.company.trim()) {
    return { ok: true, message: "신고를 접수했습니다. 검토 후 조치합니다." };
  }
  if (!isSupabaseConfigured()) {
    return { ok: false, code: "demo", message: "" };
  }

  try {
    const auth = await withUser();
    if (auth.errorCode) {
      return failure(auth.errorCode);
    }
    const { data, error } = await auth.supabase.rpc("submit_report", {
      p_target_type: input.targetType,
      p_target_id: input.targetId,
      p_reason: validated.value.reason,
    });
    if (error) {
      return failure("unavailable");
    }
    const result = parseActionResult(data);
    if (!result.ok) {
      return failure(result.code);
    }
    return { ok: true, message: "신고를 접수했습니다. 검토 후 조치합니다." };
  } catch {
    return failure("unavailable");
  }
}

export async function adminSignInAction(email: string, password: string): Promise<FormActionResult> {
  if (!isSupabaseConfigured()) {
    return { ok: false, code: "unavailable", message: "Supabase 환경 변수를 먼저 설정해 주세요." };
  }
  const trimmed = email.trim();
  if (!trimmed || !password) {
    return { ok: false, code: "invalid", message: "이메일과 비밀번호를 입력해 주세요." };
  }

  try {
    const supabase = await createServerSupabase();
    const { error } = await supabase.auth.signInWithPassword({
      email: trimmed,
      password,
    });
    if (error) {
      return { ok: false, code: "invalid", message: "이메일 또는 비밀번호가 올바르지 않습니다." };
    }
    return { ok: true, message: "로그인했습니다." };
  } catch {
    return failure("unavailable");
  }
}

export async function adminSignOutAction(): Promise<FormActionResult> {
  if (!isSupabaseConfigured()) {
    return failure("unavailable");
  }
  try {
    const supabase = await createServerSupabase();
    await supabase.auth.signOut();
    return { ok: true, message: "로그아웃했습니다." };
  } catch {
    return failure("unavailable");
  }
}

export async function reviewSuggestionAction(
  id: string,
  decision: "approved" | "rejected",
): Promise<FormActionResult> {
  if (!isUuid(id) || (decision !== "approved" && decision !== "rejected")) {
    return failure("invalid");
  }
  return runAdminRpc("admin_review_suggestion", {
    p_id: id,
    p_decision: decision,
  });
}

export async function setQuestionStatusAction(
  id: string,
  status: QuestionStatus,
): Promise<FormActionResult> {
  if (!isUuid(id) || (status !== "draft" && status !== "published" && status !== "hidden")) {
    return failure("invalid");
  }
  return runAdminRpc("admin_set_question_status", {
    p_id: id,
    p_status: status,
  });
}

export async function setDailyFeatureAction(id: string, dateKey: string): Promise<FormActionResult> {
  if (!isUuid(id)) {
    return failure("invalid");
  }
  const date = dateKey.trim();
  if (date && !isDateKey(date)) {
    return failure("invalid");
  }
  return runAdminRpc("admin_set_daily_feature", {
    p_id: id,
    p_date: date,
  });
}

export async function resolveReportAction(
  id: string,
  action: "dismiss" | "hide" | "remove",
): Promise<FormActionResult> {
  if (!isUuid(id) || (action !== "dismiss" && action !== "hide" && action !== "remove")) {
    return failure("invalid");
  }
  return runAdminRpc("admin_resolve_report", {
    p_id: id,
    p_action: action,
  });
}

async function runAdminRpc(
  name:
    | "admin_review_suggestion"
    | "admin_set_question_status"
    | "admin_resolve_report"
    | "admin_set_daily_feature",
  args: Record<string, string>,
): Promise<FormActionResult> {
  if (!isSupabaseConfigured()) {
    return { ok: false, code: "unavailable", message: "Supabase 환경 변수를 먼저 설정해 주세요." };
  }
  try {
    const supabase = await createServerSupabase();
    const { data, error } = await supabase.rpc(name, args);
    if (error) {
      return failure("unavailable");
    }
    const result = parseActionResult(data);
    if (!result.ok) {
      return failure(result.code);
    }
    return { ok: true, message: "처리했습니다." };
  } catch {
    return failure("unavailable");
  }
}
