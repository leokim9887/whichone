import "server-only";

import { connection } from "next/server";

import { pickDailyQuestion, koreaDateKey } from "@/lib/daily";
import { isSupabaseConfigured } from "@/lib/env";
import {
  emptyParticipation,
  parseActionResult,
  parseAdminDashboard,
  parseIdList,
  parseParticipation,
  parsePublicComments,
  parseQuestionList,
  parseQuestionState,
  type AdminDashboard,
} from "@/lib/parsers";
import { relatedQuestions } from "@/lib/catalog";
import { getSeedQuestions } from "@/lib/seed-questions";
import { createPublicSupabase, createServerSupabase } from "@/lib/supabase/server";
import type { DataMode, Participation, PublicComment, Question } from "@/lib/types";
import { isUuid } from "@/lib/uuid";

export type HomeData = {
  mode: DataMode;
  error: string | null;
  dateKey: string;
  questions: Question[];
  today: Question | null;
  votedIds: string[];
};

export type QuestionData =
  | { state: "missing" }
  | { state: "unpublished"; mode: DataMode }
  | { state: "unavailable"; mode: DataMode }
  | {
      state: "ok";
      mode: DataMode;
      question: Question;
      participation: Participation;
      comments: PublicComment[];
      related: Question[];
      participationError: string | null;
    };

async function loadLiveQuestions(): Promise<Question[]> {
  const supabase = createPublicSupabase();
  const { data, error } = await supabase.rpc("list_published_questions");
  if (error) {
    throw new Error("list failed");
  }
  return parseQuestionList(data);
}

async function loadVotedIds(): Promise<string[]> {
  try {
    const supabase = await createServerSupabase();
    const { data, error } = await supabase.rpc("my_voted_question_ids");
    if (error) {
      return [];
    }
    return parseIdList(data);
  } catch {
    return [];
  }
}

export async function loadHome(): Promise<HomeData> {
  await connection();
  const dateKey = koreaDateKey(new Date());
  if (!isSupabaseConfigured()) {
    const questions = getSeedQuestions();
    return {
      mode: "demo",
      error: null,
      dateKey,
      questions,
      today: pickDailyQuestion(questions, dateKey),
      votedIds: [],
    };
  }

  try {
    const questions = await loadLiveQuestions();
    const votedIds = await loadVotedIds();
    return {
      mode: "live",
      error: null,
      dateKey,
      questions,
      today: pickDailyQuestion(questions, dateKey),
      votedIds,
    };
  } catch {
    return {
      mode: "live",
      error: "질문을 불러오지 못했습니다. 연결을 확인한 뒤 다시 시도해 주세요.",
      dateKey,
      questions: [],
      today: null,
      votedIds: [],
    };
  }
}

export async function loadQuestion(id: string): Promise<QuestionData> {
  const mode: DataMode = isSupabaseConfigured() ? "live" : "demo";
  if (!isUuid(id)) {
    return { state: "missing" };
  }

  if (mode === "demo") {
    const questions = getSeedQuestions();
    const question = questions.find((item) => item.id === id);
    if (!question) {
      return { state: "missing" };
    }
    return {
      state: "ok",
      mode,
      question,
      participation: emptyParticipation(0),
      comments: [],
      related: relatedQuestions(questions, question),
      participationError: null,
    };
  }

  try {
    const supabase = createPublicSupabase();
    const { data, error } = await supabase.rpc("get_published_question", {
      p_question_id: id,
    });
    if (error) {
      return { state: "unavailable", mode };
    }
    const parsed = parseQuestionState(data);
    if (parsed.state === "missing") {
      return { state: "missing" };
    }
    if (parsed.state === "unpublished") {
      return { state: "unpublished", mode };
    }

    const questions = await loadLiveQuestions().catch(() => [parsed.question]);
    let participation = emptyParticipation(parsed.question.participantCount);
    let comments: PublicComment[] = [];
    let participationError: string | null = null;

    try {
      const authed = await createServerSupabase();
      const participationResult = await authed.rpc("get_my_participation", {
        p_question_id: id,
      });
      if (participationResult.error) {
        participationError = "내 참여 기록을 확인하지 못했습니다. 투표는 다시 시도할 수 있습니다.";
      } else {
        participation = parseParticipation(participationResult.data);
      }
      if (participation.voted) {
        const commentResult = await authed.rpc("list_visible_comments", {
          p_question_id: id,
        });
        if (!commentResult.error) {
          comments = parsePublicComments(commentResult.data);
        }
      }
    } catch {
      participationError = "내 참여 기록을 확인하지 못했습니다. 투표는 다시 시도할 수 있습니다.";
    }

    return {
      state: "ok",
      mode,
      question: { ...parsed.question, participantCount: participation.participantCount },
      participation,
      comments,
      related: relatedQuestions(questions, parsed.question),
      participationError,
    };
  } catch {
    return { state: "unavailable", mode };
  }
}

export type AdminData =
  | { state: "unconfigured" }
  | { state: "signed_out" }
  | { state: "anonymous" }
  | { state: "forbidden" }
  | { state: "unavailable" }
  | { state: "ready"; dashboard: AdminDashboard };

export async function loadAdmin(): Promise<AdminData> {
  if (!isSupabaseConfigured()) {
    return { state: "unconfigured" };
  }

  try {
    const supabase = await createServerSupabase();
    const { data } = await supabase.auth.getUser();
    const user = data.user;
    if (!user) {
      return { state: "signed_out" };
    }
    if (user.is_anonymous) {
      return { state: "anonymous" };
    }

    const dashboard = await supabase.rpc("admin_dashboard");
    if (dashboard.error) {
      return { state: "unavailable" };
    }
    const result = parseActionResult(dashboard.data);
    if (!result.ok) {
      return { state: result.code === "forbidden" ? "forbidden" : "unavailable" };
    }
    return { state: "ready", dashboard: parseAdminDashboard(dashboard.data) };
  } catch {
    return { state: "unavailable" };
  }
}

export async function loadQuestionMetadata(id: string): Promise<{ title: string; description: string } | null> {
  if (!isUuid(id)) {
    return null;
  }
  if (!isSupabaseConfigured()) {
    const question = getSeedQuestions().find((item) => item.id === id);
    if (!question) {
      return null;
    }
    return {
      title: question.title,
      description: question.description ?? "다른 사람들은 어떻게 생각할까?",
    };
  }

  try {
    const supabase = createPublicSupabase();
    const { data, error } = await supabase.rpc("get_published_question", {
      p_question_id: id,
    });
    if (error) {
      return null;
    }
    const parsed = parseQuestionState(data);
    if (parsed.state !== "ok") {
      return null;
    }
    return {
      title: parsed.question.title,
      description: parsed.question.description ?? "다른 사람들은 어떻게 생각할까?",
    };
  } catch {
    return null;
  }
}
