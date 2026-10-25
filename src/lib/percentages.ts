/**
 * 득표율을 정수로 맞추고, 가장 큰 소수 부분부터 1%씩 더해 합계를 100으로 맞춘다.
 * 표가 없으면 모두 0이다.
 */
export function toPercentages(counts: number[]): number[] {
  const total = counts.reduce((sum, count) => sum + count, 0);
  if (total <= 0) {
    return counts.map(() => 0);
  }

  const exact = counts.map((count) => (count / total) * 100);
  const floors = exact.map((value) => Math.floor(value));
  let remainder = 100 - floors.reduce((sum, value) => sum + value, 0);
  const order = exact
    .map((value, index) => ({
      index,
      fraction: value - Math.floor(value),
    }))
    .sort((a, b) => b.fraction - a.fraction || a.index - b.index);

  const percentages = [...floors];
  let cursor = 0;
  while (remainder > 0 && order.length > 0) {
    percentages[order[cursor % order.length].index] += 1;
    remainder -= 1;
    cursor += 1;
  }

  return percentages;
}
