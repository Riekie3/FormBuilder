// A deliberately tiny, safe markdown subset for the Rich Text field —
// bold/italic/links/line breaks only. HTML-escapes the input FIRST, then
// applies whitelisted transformations on top of the already-escaped text, so
// there is no way for the source text to produce a tag or attribute we didn't
// intend (a quote in a URL becomes `&quot;`, not an attribute breakout, etc).
// This is intentionally not a general markdown parser — no raw HTML passthrough.

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

export function renderSafeMarkdown(source: string): string {
  let html = escapeHtml(source);

  // [text](https://example.com) — http(s) only, never javascript:/data:.
  html = html.replace(/\[([^\]]+)\]\((https?:\/\/[^\s)]+)\)/g, (_match, text: string, url: string) => {
    return `<a href="${url}" target="_blank" rel="noopener noreferrer">${text}</a>`;
  });

  html = html.replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>");
  html = html.replace(/_([^_]+)_/g, "<em>$1</em>");
  html = html.replace(/\n/g, "<br>");

  return html;
}
