import { describe, expect, it } from "vitest";
import { parseSimpleCsv } from "./simpleCsv";

describe("parseSimpleCsv", () => {
  it("splits a plain newline-separated list", () => {
    expect(parseSimpleCsv("Acme Corp\nGlobex\nInitech")).toEqual(["Acme Corp", "Globex", "Initech"]);
  });

  it("takes only the first column of a multi-column CSV line", () => {
    expect(parseSimpleCsv("Acme Corp,New York,USA\nGlobex,Chicago,USA")).toEqual(["Acme Corp", "Globex"]);
  });

  it("strips surrounding quotes (no comma inside the quoted field)", () => {
    expect(parseSimpleCsv('"Acme Corp"\nGlobex')).toEqual(["Acme Corp", "Globex"]);
  });

  it("is not comma-aware inside quotes — a naive first-column split, documented as a known limit", () => {
    // Splitting happens on the literal comma before quotes are considered,
    // so a comma inside a quoted field still breaks the line early. This is
    // a deliberate simplification (see the file's top comment), not a bug.
    expect(parseSimpleCsv('"Acme, Inc"')).toEqual(['"Acme']);
  });

  it("ignores blank lines and trims whitespace", () => {
    expect(parseSimpleCsv("  Acme  \n\n  \nGlobex\n")).toEqual(["Acme", "Globex"]);
  });

  it("returns an empty array for empty input", () => {
    expect(parseSimpleCsv("")).toEqual([]);
    expect(parseSimpleCsv("   \n  \n")).toEqual([]);
  });
});
