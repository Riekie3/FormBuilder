import type { FieldDto } from "@sfb/shared";

// Answers store the option's stable `value`, not its display label — map back
// to the label so tables/dashboards read naturally without changing what's stored.
export function displayAnswerValue(field: FieldDto, raw: string | undefined): string {
  if (!raw) return "";
  const options = field.config.options;
  if (!options) return raw;
  if (field.type === "CHECKBOX") {
    const selected = new Set(raw.split(","));
    return options
      .filter((o) => selected.has(o.value))
      .map((o) => o.label)
      .join(", ");
  }
  return options.find((o) => o.value === raw)?.label ?? raw;
}
