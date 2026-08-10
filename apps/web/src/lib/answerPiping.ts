// Substitutes "{fieldId}" tokens in a label/help-text string with the
// visitor's current answer to that field — e.g. a later question's label
// can read "Thanks, {name}! What's your favorite color?" A field that
// hasn't been answered yet (or doesn't exist) pipes in as an empty string,
// matching the Calculation field's "unanswered defaults to a sensible
// empty value" convention rather than leaving the raw token visible.
export function pipeAnswers(text: string, values: Record<string, string>): string {
  if (!text) return text;
  return text.replace(/\{([^}]+)\}/g, (_match, id) => values[id] ?? "");
}
