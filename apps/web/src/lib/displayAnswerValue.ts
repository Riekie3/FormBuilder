import type { FieldDto } from "@sfb/shared";

// Answers store raw/stable values, not always what a human should read — map
// back to something legible so tables/dashboards read naturally without
// changing what's actually stored (DROPDOWN/RADIO/CHECKBOX store an option's
// `value`, not its label; ADDRESS stores a JSON blob).
export function displayAnswerValue(field: FieldDto, raw: string | undefined): string {
  if (!raw) return "";

  if (field.type === "ADDRESS") {
    try {
      const addr = JSON.parse(raw) as Record<string, string>;
      return [addr.street, addr.city, addr.state, addr.zip, addr.country].filter(Boolean).join(", ");
    } catch {
      return raw;
    }
  }

  if (field.type === "SIGNATURE") {
    return raw.startsWith("data:image") ? "(signed)" : raw;
  }

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
