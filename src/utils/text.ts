// Trims text and turns "nothing" into null. Text longer than `max` is cut.
export function cleanText(value: unknown, max: number): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  if (trimmed === "") return null;
  return trimmed.length > max ? trimmed.slice(0, max).trimEnd() : trimmed;
}
