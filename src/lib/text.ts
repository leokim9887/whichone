export function normalizeLine(value: string): string {
  return value.replace(/\s+/g, " ").trim();
}
