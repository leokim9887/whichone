"use client";

import { messageForCode } from "@/lib/messages";
import { parseActionResult } from "@/lib/parsers";
import { browserSupabase } from "@/lib/supabase/browser";
import { deleteMyQuestionAction } from "@/server/actions";

type DeleteResult = { ok: true } | { ok: false; code: string; message: string };

export async function deleteMyQuestionLive(
  id: string,
  source: "question" | "suggestion",
): Promise<DeleteResult> {
  const supabase = browserSupabase();
  if (!supabase) {
    return toDeleteResult(await deleteMyQuestionAction(id, source));
  }

  const existing = await supabase.auth.getUser();
  if (existing.error || !existing.data.user) {
    const signedIn = await supabase.auth.signInAnonymously();
    if (signedIn.error || !signedIn.data.user) {
      return toDeleteResult(await deleteMyQuestionAction(id, source));
    }
  }

  const rpcName = source === "suggestion" ? "delete_my_pending_suggestion" : "delete_my_question";
  const { data, error } = await supabase.rpc(rpcName, { p_id: id });
  if (error) {
    // option_count 트리거로 하드 삭제가 막힌 경우 서버 액션도 동일하게 실패하므로 원인을 분명히 알림
    if (error.code === "23514" || /option_count/i.test(error.message ?? "")) {
      return {
        ok: false,
        code: "unavailable",
        message:
          "질문 삭제가 DB 제약에 막혀 있습니다. Supabase SQL Editor에서 scripts/fix-question-delete.sql 을 실행한 뒤 다시 시도해 주세요.",
      };
    }
    return toDeleteResult(await deleteMyQuestionAction(id, source));
  }

  const result = parseActionResult(data);
  if (!result.ok) {
    return { ok: false, code: result.code, message: messageForCode(result.code) };
  }
  return { ok: true };
}

function toDeleteResult(
  result: { ok: true; message: string } | { ok: false; code: string; message: string },
): DeleteResult {
  if (result.ok) {
    return { ok: true };
  }
  return { ok: false, code: result.code, message: result.message };
}
