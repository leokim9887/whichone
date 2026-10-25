import type { CategoryFilter } from "@/lib/categories";
import type { Question } from "@/lib/types";

export function filterQuestions(
  questions: readonly Question[],
  category: CategoryFilter,
  topic: string,
  query: string,
): Question[] {
  const needle = query.trim().toLowerCase();
  return questions.filter((question) => {
    if (category !== "all" && question.category !== category) {
      return false;
    }
    if (category !== "all" && topic && question.topic !== topic) {
      return false;
    }
    if (!needle) {
      return true;
    }
    const haystack = `${question.title} ${question.description ?? ""}`.toLowerCase();
    return haystack.includes(needle);
  });
}

export function popularQuestions(questions: readonly Question[], limit = 6): {
  items: Question[];
  showingRecentBecauseNoVotes: boolean;
} {
  const hasVotes = questions.some((question) => question.participantCount > 0);
  const items = [...questions]
    .sort((a, b) => {
      if (b.participantCount !== a.participantCount) {
        return b.participantCount - a.participantCount;
      }
      return b.publishedAt.localeCompare(a.publishedAt);
    })
    .slice(0, limit);

  return {
    items,
    showingRecentBecauseNoVotes: !hasVotes && items.length > 0,
  };
}

export function latestQuestions(questions: readonly Question[], limit = 6): Question[] {
  return [...questions]
    .sort((a, b) => b.publishedAt.localeCompare(a.publishedAt))
    .slice(0, limit);
}

export function relatedQuestions(
  questions: readonly Question[],
  current: Question,
  limit = 3,
): Question[] {
  return [...questions]
    .filter((question) => question.id !== current.id && question.category === current.category)
    .sort((a, b) => {
      if (b.participantCount !== a.participantCount) {
        return b.participantCount - a.participantCount;
      }
      return b.publishedAt.localeCompare(a.publishedAt);
    })
    .slice(0, limit);
}
