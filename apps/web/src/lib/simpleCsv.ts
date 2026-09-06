// A deliberately minimal CSV reader for the Lookup field's reference list —
// not a general CSV parser. It handles the two shapes that actually matter
// here: a plain newline-separated list, and a single-column CSV export
// (optionally quoted). It does NOT handle multi-column CSVs, escaped quotes,
// or embedded commas/newlines inside quoted fields — anything past the
// first column on a line is simply ignored, since a Lookup dataset is just
// a flat list of values, not tabular data.
export function parseSimpleCsv(text: string): string[] {
  return text
    .split(/\r?\n/)
    .map((line) => {
      const firstCell = line.split(",")[0] ?? "";
      return firstCell.trim().replace(/^"(.*)"$/, "$1").trim();
    })
    .filter(Boolean);
}
