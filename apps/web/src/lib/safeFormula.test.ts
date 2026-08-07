import { describe, expect, it } from "vitest";
import { evaluateFormula } from "./safeFormula";

describe("evaluateFormula", () => {
  it("evaluates basic arithmetic", () => {
    expect(evaluateFormula("2 + 3", {})).toBe(5);
    expect(evaluateFormula("2 + 3 * 4", {})).toBe(14);
    expect(evaluateFormula("(2 + 3) * 4", {})).toBe(20);
    expect(evaluateFormula("10 / 4", {})).toBe(2.5);
  });

  it("substitutes field tokens with their numeric value", () => {
    expect(evaluateFormula("{qty} * {price}", { qty: "3", price: "9.5" })).toBe(28.5);
  });

  it("treats a missing or non-numeric field value as zero", () => {
    expect(evaluateFormula("{missing} + 5", {})).toBe(5);
    expect(evaluateFormula("{qty} + 5", { qty: "not-a-number" })).toBe(5);
  });

  it("rounds to the requested precision", () => {
    expect(evaluateFormula("10 / 3", {}, 2)).toBe(3.33);
    expect(evaluateFormula("10 / 3", {}, 0)).toBe(3);
  });

  it("returns null for an empty formula", () => {
    expect(evaluateFormula("", {})).toBeNull();
    expect(evaluateFormula("   ", {})).toBeNull();
  });

  it("returns null instead of throwing for malformed input", () => {
    expect(evaluateFormula("2 +", {})).toBeNull();
    expect(evaluateFormula("(2 + 3", {})).toBeNull();
    expect(evaluateFormula("2 ** 3", {})).toBeNull();
  });

  it("never executes arbitrary JavaScript embedded in a formula", () => {
    // If this were eval()/Function()-based, these would throw ReferenceErrors
    // or actually execute; the safe parser just rejects them as malformed.
    expect(evaluateFormula("require('fs')", {})).toBeNull();
    expect(evaluateFormula("(() => { throw new Error('pwned') })()", {})).toBeNull();
    expect(evaluateFormula("global.process.exit(1)", {})).toBeNull();
  });
});
