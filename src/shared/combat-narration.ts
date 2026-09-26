export interface CombatNarrationPresentation {
  readonly text: string;
  readonly source: "model" | "fallback";
}

export function isCombatNarrationPresentation(value: unknown): value is CombatNarrationPresentation {
  return value !== null && typeof value === "object" && !Array.isArray(value)
    && Object.keys(value).length === 2
    && Object.hasOwn(value, "text") && Object.hasOwn(value, "source")
    && typeof (value as Record<string, unknown>).text === "string"
    && (value as { text: string }).text.trim().length > 0
    && Array.from((value as { text: string }).text).length <= 240
    && ((value as Record<string, unknown>).source === "model"
      || (value as Record<string, unknown>).source === "fallback");
}
