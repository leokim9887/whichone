"use client";

import { parseMyCommentsResult, parseMyQuestionsResult } from "@/lib/parsers";
import { browserSupabase } from "@/lib/supabase/browser";
import type { MyCommentItem, MyQuestionItem } from "@/lib/types";

export async function listMyQuestionsLive(): Promise<MyQuestionItem[] | null> {
  const supabase = browserSupabase();
  if (!supabase) {
    return null;
  }
  const existing = await supabase.auth.getUser();
  if (existing.error || !existing.data.user) {
    return null;
  }
  const { data, error } = await supabase.rpc("list_my_questions");
  if (error) {
    return null;
  }
  try {
    return parseMyQuestionsResult(data);
  } catch {
    return null;
  }
}

export async function listMyCommentsLive(): Promise<MyCommentItem[] | null> {
  const supabase = browserSupabase();
  if (!supabase) {
    return null;
  }
  const existing = await supabase.auth.getUser();
  if (existing.error || !existing.data.user) {
    return null;
  }
  const { data, error } = await supabase.rpc("list_my_comments");
  if (error) {
    return null;
  }
  try {
    return parseMyCommentsResult(data);
  } catch {
    return null;
  }
}
