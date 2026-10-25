import { toPercentages } from "@/lib/percentages";
import type { Option, OptionCount, ResultSummary } from "@/lib/types";

export function buildSummary(
  options: readonly Option[],
  counts: readonly OptionCount[] | null,
  myOptionId: string | null,
): ResultSummary | null {
  if (!counts) {
    return null;
  }

  const countByOption = new Map(counts.map((count) => [count.optionId, count.voteCount]));
  const ordered = [...options].sort((a, b) => a.position - b.position);
  const voteCounts = ordered.map((option) => countByOption.get(option.id) ?? 0);
  const percentages = toPercentages(voteCounts);
  const total = voteCounts.reduce((sum, count) => sum + count, 0);
  const max = total === 0 ? 0 : Math.max(...voteCounts);
  const leaderIds =
    total === 0
      ? []
      : ordered.filter((_, index) => voteCounts[index] === max).map((option) => option.id);

  return {
    total,
    leaderIds,
    options: ordered.map((option, index) => ({
      optionId: option.id,
      text: option.text,
      voteCount: voteCounts[index] ?? 0,
      percentage: percentages[index] ?? 0,
      isMine: option.id === myOptionId,
      isLeader: leaderIds.includes(option.id),
    })),
  };
}
