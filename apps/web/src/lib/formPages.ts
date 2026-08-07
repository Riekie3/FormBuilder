import type { FieldDto } from "@sfb/shared";

export interface FormPage {
  // The upcoming page's title, taken from the PAGE_BREAK field's label.
  // Null on the first page (nothing precedes it) or when left blank.
  title: string | null;
  fields: FieldDto[];
}

// Splits a flat field list into pages at each PAGE_BREAK marker. A form with
// no PAGE_BREAK fields returns a single page containing everything, so this
// is a no-op for every form built before multi-page support existed.
export function splitIntoPages(fields: FieldDto[]): FormPage[] {
  const pages: FormPage[] = [{ title: null, fields: [] }];
  for (const field of fields) {
    if (field.type === "PAGE_BREAK") {
      pages.push({ title: field.label.trim() || null, fields: [] });
      continue;
    }
    pages[pages.length - 1].fields.push(field);
  }
  return pages;
}
