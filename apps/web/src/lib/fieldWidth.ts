import type { FieldConfig } from "@sfb/shared";

// A 6-column grid lets "full" take the whole row, "half" pair two per row,
// and "third" pack three per row. Stacks back to full width below the `sm`
// breakpoint so narrow/mobile viewports never see a cramped half-width field.
export function widthSpanClass(width: FieldConfig["width"]): string {
  switch (width) {
    case "half":
      return "col-span-6 sm:col-span-3";
    case "third":
      return "col-span-6 sm:col-span-2";
    default:
      return "col-span-6";
  }
}
