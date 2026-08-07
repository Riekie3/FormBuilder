import { describe, expect, it } from "vitest";
import { renderSafeMarkdown } from "./safeMarkdown";

describe("renderSafeMarkdown", () => {
  it("renders bold, italic, links, and line breaks", () => {
    expect(renderSafeMarkdown("**bold**")).toBe("<strong>bold</strong>");
    expect(renderSafeMarkdown("_italic_")).toBe("<em>italic</em>");
    expect(renderSafeMarkdown("line one\nline two")).toBe("line one<br>line two");
    expect(renderSafeMarkdown("[click here](https://example.com)")).toBe(
      '<a href="https://example.com" target="_blank" rel="noopener noreferrer">click here</a>',
    );
  });

  it("escapes raw HTML instead of passing it through", () => {
    expect(renderSafeMarkdown("<script>alert(1)</script>")).toBe(
      "&lt;script&gt;alert(1)&lt;/script&gt;",
    );
    expect(renderSafeMarkdown('<img src=x onerror="alert(1)">')).not.toContain("<img");
  });

  it("only allows http(s) links, never javascript: URLs", () => {
    const result = renderSafeMarkdown("[click me](javascript:alert(1))");
    // The link pattern requires http(s), so this never becomes a clickable
    // element — it's left as inert escaped text, same as any other string.
    expect(result).not.toContain("<a ");
    expect(result).not.toContain('href="javascript:');
  });

  it("cannot be used to break out of the href attribute via a quote", () => {
    const result = renderSafeMarkdown('[x](https://example.com"onclick="alert(1))');
    // The quote gets HTML-escaped before the link pattern is applied, so it
    // can only ever appear as the harmless text &quot; inside the attribute.
    expect(result).not.toContain('"onclick="');
  });
});
