"use client";

import { messageForCode } from "@/lib/messages";
import { parseActionResult, parsePublicComments } from "@/lib/parsers";
import { browserSupabase } from "@/lib/supabase/browser";
import type { PublicComment } from "@/lib/types";
import {
  addReplyAction,
  deleteCommentAction,
  editCommentAction,
  toggleCommentLikeAction,
} from "@/server/actions";

type LiveResult = { ok: true; comments: PublicComment[] | null } | { ok: false; message: string };
type SimpleResult = { ok: true } | { ok: false; message: string };

async function listComments(questionId: string, supabase: NonNullable<Awaited<ReturnType<typeof authedBrowser>>>): Promise<PublicComment[] | null> {
  const listed = await supabase.rpc("list_visible_comments", { p_question_id: questionId });
  if (listed.error) {
    return null;
  }
  try {
    return parsePublicComments(listed.data);
  } catch {
    return null;
  }
}

async function authedBrowser() {
  const supabase = browserSupabase();
  if (!supabase) {
    return null;
  }
  const existing = await supabase.auth.getSession();
  if (existing.error || !existing.data.session) {
    return null;
  }
  return supabase;
}

export async function toggleLikeLive(questionId: string, commentId: string): Promise<{ ok: true } | { ok: false; message: string }> {
  const supabase = await authedBrowser();
  if (!supabase) {
    const fallback = await toggleCommentLikeAction(questionId, commentId);
    return fallback.ok ? { ok: true } : { ok: false, message: fallback.message };
  }

  const { data, error } = await supabase.rpc("toggle_comment_like", {
    p_question_id: questionId,
    p_comment_id: commentId,
  });
  if (error) {
    return { ok: false, message: messageForCode("unavailable") };
  }
  const result = parseActionResult(data);
  if (!result.ok) {
    return { ok: false, message: messageForCode(result.code) };
  }
  return { ok: true };
}

export async function addReplyLive(questionId: string, parentId: string, body: string): Promise<LiveResult> {
  const supabase = await authedBrowser();
  if (!supabase) {
    const fallback = await addReplyAction(questionId, parentId, body);
    if (!fallback.ok) {
      return { ok: false, message: fallback.message };
    }
    return { ok: true, comments: fallback.comments };
  }

  const { data, error } = await supabase.rpc("add_comment_reply", {
    p_question_id: questionId,
    p_parent_id: parentId,
    p_body: body,
  });
  if (error) {
    return { ok: false, message: messageForCode("unavailable") };
  }
  const result = parseActionResult(data);
  if (!result.ok) {
    return { ok: false, message: messageForCode(result.code) };
  }

  return { ok: true, comments: await listComments(questionId, supabase) };
}

export async function editCommentLive(questionId: string, commentId: string, body: string): Promise<SimpleResult> {
  const supabase = await authedBrowser();
  if (!supabase) {
    const fallback = await editCommentAction(questionId, commentId, body);
    return fallback.ok ? { ok: true } : { ok: false, message: fallback.message };
  }

  const { data, error } = await supabase.rpc("edit_own_comment", {
    p_question_id: questionId,
    p_comment_id: commentId,
    p_body: body,
  });
  if (error) {
    return { ok: false, message: messageForCode("unavailable") };
  }
  const result = parseActionResult(data);
  if (!result.ok) {
    return { ok: false, message: messageForCode(result.code) };
  }
  return { ok: true };
}

export async function deleteCommentLive(questionId: string, commentId: string): Promise<LiveResult> {
  const supabase = await authedBrowser();
  if (!supabase) {
    const fallback = await deleteCommentAction(questionId, commentId);
    if (!fallback.ok) {
      return { ok: false, message: fallback.message };
    }
    return { ok: true, comments: fallback.comments };
  }

  const { data, error } = await supabase.rpc("delete_own_comment", {
    p_question_id: questionId,
    p_comment_id: commentId,
  });
  if (error) {
    return { ok: false, message: messageForCode("unavailable") };
  }
  const result = parseActionResult(data);
  if (!result.ok) {
    return { ok: false, message: messageForCode(result.code) };
  }
  return { ok: true, comments: await listComments(questionId, supabase) };
}
