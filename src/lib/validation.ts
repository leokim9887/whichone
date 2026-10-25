import { isCategory } from "@/lib/categories";
import { LIMITS } from "@/lib/limits";
import { normalizeLine } from "@/lib/text";
import { topicBelongsTo } from "@/lib/topics";
import { REPORT_REASONS, type Category, type ReportReason, type SuggestionDraft } from "@/lib/types";

export type FieldErrors = Record<string, string>;

export type ValidationResult<T> =
  | { ok: true; value: T }
  | { ok: false; message: string; errors: FieldErrors };

function fail(message: string, errors: FieldErrors): ValidationResult<never> {
  return { ok: false, message, errors };
}

export function validateSuggestion(input: {
  title: string;
  description: string;
  category: string;
  topic: string;
  options: string[];
}): ValidationResult<SuggestionDraft> {
  const errors: FieldErrors = {};
  const title = normalizeLine(input.title);
  const description = normalizeLine(input.description);
  const options = input.options.map((option) => normalizeLine(option));

  if (!title) {
    errors.title = "질문 제목을 입력해 주세요.";
  } else if (title.length > LIMITS.title) {
    errors.title = `질문 제목은 ${LIMITS.title}자 이하로 입력해 주세요.`;
  }

  if (description.length > LIMITS.description) {
    errors.description = `설명은 ${LIMITS.description}자 이하로 입력해 주세요.`;
  }

  if (!isCategory(input.category)) {
    errors.category = "주제를 선택해 주세요.";
  } else if (!topicBelongsTo(input.topic, input.category)) {
    errors.topic = "세부 주제를 선택해 주세요.";
  }

  const filled = options.map((option, index) => ({ option, index })).filter((item) => item.option);
  if (filled.length < LIMITS.minOptions) {
    errors.options = `선택지는 최소 ${LIMITS.minOptions}개 필요합니다.`;
  }
  if (filled.length > LIMITS.maxOptions) {
    errors.options = `선택지는 최대 ${LIMITS.maxOptions}개까지 가능합니다.`;
  }

  const seen = new Set<string>();
  filled.forEach(({ option, index }) => {
    if (option.length > LIMITS.option) {
      errors[`option-${index}`] = `선택지는 ${LIMITS.option}자 이하로 입력해 주세요.`;
      return;
    }
    if (seen.has(option)) {
      errors[`option-${index}`] = "같은 선택지를 두 번 넣을 수 없습니다.";
      return;
    }
    seen.add(option);
  });

  if (Object.keys(errors).length > 0) {
    return fail("입력 내용을 다시 확인해 주세요.", errors);
  }

  return {
    ok: true,
    value: {
      title,
      description,
      category: input.category as Category,
      topic: input.topic,
      options: filled.map((item) => item.option),
    },
  };
}

export function validateComment(body: string): ValidationResult<{ body: string }> {
  const normalized = normalizeLine(body);
  if (!normalized) {
    return fail("이유를 입력해 주세요.", {
      body: "이유를 입력해 주세요.",
    });
  }
  if (normalized.length > LIMITS.comment) {
    return fail(`의견은 ${LIMITS.comment}자 이하로 입력해 주세요.`, {
      body: `의견은 ${LIMITS.comment}자 이하로 입력해 주세요.`,
    });
  }
  return { ok: true, value: { body: normalized } };
}

export function validateReport(input: {
  reason: string;
  detail: string;
}): ValidationResult<{ reason: string }> {
  const known = REPORT_REASONS.find((item) => item.id === input.reason);
  if (!known) {
    return fail("신고 이유를 선택해 주세요.", {
      reason: "신고 이유를 선택해 주세요.",
    });
  }

  const detail = normalizeLine(input.detail);
  const reason = detail ? `${known.label} ${detail}` : known.label;
  if (reason.length > LIMITS.report) {
    return fail(`신고 내용은 ${LIMITS.report}자 이하로 입력해 주세요.`, {
      detail: `신고 내용은 ${LIMITS.report}자 이하로 입력해 주세요.`,
    });
  }

  return { ok: true, value: { reason } };
}

export function isReportReason(value: string): value is ReportReason {
  return REPORT_REASONS.some((item) => item.id === value);
}
