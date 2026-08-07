// A minimal, safe arithmetic evaluator for the Calculation field. Deliberately
// NOT using eval()/new Function() — untrusted formula text (typed by whoever
// built the form) must never reach real JS execution. This hand-rolled
// recursive-descent parser only understands numbers and + - * / ( ), so
// there is no property access, no function calls, nothing to inject.

function tokenize(expr: string): string[] {
  const tokens: string[] = [];
  let i = 0;
  while (i < expr.length) {
    const ch = expr[i];
    if (/\s/.test(ch)) {
      i++;
    } else if ("+-*/()".includes(ch)) {
      tokens.push(ch);
      i++;
    } else if (/[0-9.]/.test(ch)) {
      let num = "";
      while (i < expr.length && /[0-9.]/.test(expr[i])) {
        num += expr[i];
        i++;
      }
      tokens.push(num);
    } else {
      throw new Error(`Unexpected character "${ch}" in formula`);
    }
  }
  return tokens;
}

class Parser {
  private pos = 0;
  constructor(private tokens: string[]) {}

  private peek() {
    return this.tokens[this.pos];
  }

  private next() {
    return this.tokens[this.pos++];
  }

  parseExpression(): number {
    let value = this.parseTerm();
    while (this.peek() === "+" || this.peek() === "-") {
      const op = this.next();
      const rhs = this.parseTerm();
      value = op === "+" ? value + rhs : value - rhs;
    }
    return value;
  }

  private parseTerm(): number {
    let value = this.parseFactor();
    while (this.peek() === "*" || this.peek() === "/") {
      const op = this.next();
      const rhs = this.parseFactor();
      value = op === "*" ? value * rhs : value / rhs;
    }
    return value;
  }

  private parseFactor(): number {
    if (this.peek() === "-") {
      this.next();
      return -this.parseFactor();
    }
    if (this.peek() === "(") {
      this.next();
      const value = this.parseExpression();
      if (this.next() !== ")") throw new Error("Mismatched parentheses");
      return value;
    }
    const token = this.next();
    const value = Number(token);
    if (token === undefined || Number.isNaN(value)) throw new Error("Expected a number");
    return value;
  }

  assertConsumed() {
    if (this.pos !== this.tokens.length) throw new Error("Unexpected trailing input");
  }
}

/** Replaces every {fieldId} token with the numeric value from `values` (0 if missing/non-numeric). */
function resolveTokens(formula: string, values: Record<string, string>): string {
  return formula.replace(/\{([^}]+)\}/g, (_match, fieldId: string) => {
    const raw = values[fieldId];
    const num = raw ? Number(raw) : 0;
    return Number.isFinite(num) ? String(num) : "0";
  });
}

/** Returns the computed value, or null if the formula is empty/malformed. */
export function evaluateFormula(formula: string, values: Record<string, string>, precision = 2): number | null {
  if (!formula.trim()) return null;
  try {
    const resolved = resolveTokens(formula, values);
    const parser = new Parser(tokenize(resolved));
    const result = parser.parseExpression();
    parser.assertConsumed();
    if (!Number.isFinite(result)) return null;
    const factor = 10 ** precision;
    return Math.round(result * factor) / factor;
  } catch {
    return null;
  }
}
