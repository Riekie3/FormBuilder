import type { FieldDto } from "@sfb/shared";
import { isLayoutField } from "@sfb/shared";

export interface FormPage {
  // The upcoming page's title, taken from the PAGE_BREAK field's label.
  // Null on the first page (nothing precedes it), when left blank, or in
  // one-question-per-page mode (pages aren't titled there).
  title: string | null;
  fields: FieldDto[];
}

// Splits a flat field list into pages. Two modes:
//
// - Standard (default): splits at each PAGE_BREAK marker. A form with none
//   returns a single page containing everything, so this is a no-op for
//   every form built before multi-page support existed.
// - One-question-per-page ("conversational"): every real question gets its
//   own page, with any layout content directly ahead of it (a heading, a
//   rich-text blurb) riding along on the same page rather than getting a
//   blank page of its own. PAGE_BREAK fields are ignored here — manual
//   breaks are redundant once every question is already isolated.
export function splitIntoPages(fields: FieldDto[], oneQuestionPerPage = false): FormPage[] {
  const pages: FormPage[] = [{ title: null, fields: [] }];
  for (const field of fields) {
    if (field.type === "PAGE_BREAK") {
      if (!oneQuestionPerPage) {
        pages.push({ title: field.label.trim() || null, fields: [] });
      }
      continue;
    }
    const currentPage = pages[pages.length - 1];
    if (oneQuestionPerPage && currentPage.fields.some((f) => !isLayoutField(f.type))) {
      pages.push({ title: null, fields: [field] });
    } else {
      currentPage.fields.push(field);
    }
  }
  return pages;
}
