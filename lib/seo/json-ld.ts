/**
 * Serialising structured data for a `<script type="application/ld+json">` tag.
 *
 * React escapes text children into HTML entities, which a browser does not decode
 * inside a script element, so an escaped ampersand would end up in the parsed JSON.
 * The JSON therefore has to be injected as raw HTML, and this function is what makes
 * that safe: every character that could end the script element or break a JavaScript
 * parser is emitted as a JSON unicode escape, which parses back to exactly the
 * original string.
 */

/**
 * U+2028 and U+2029 are legal inside a JSON string but are line terminators to a
 * JavaScript parser. They are built from their code points so that no source file here
 * has to contain a character that would break the file it appears in.
 */
const LINE_SEPARATOR = String.fromCharCode(0x2028);
const PARAGRAPH_SEPARATOR = String.fromCharCode(0x2029);

/** Each value is the six-character JSON escape, not the character it stands for. */
const ESCAPES: Record<string, string> = {
  "<": String.raw`\u003c`,
  ">": String.raw`\u003e`,
  "&": String.raw`\u0026`,
  [LINE_SEPARATOR]: String.raw`\u2028`,
  [PARAGRAPH_SEPARATOR]: String.raw`\u2029`,
};

const UNSAFE = new RegExp(`[<>&${LINE_SEPARATOR}${PARAGRAPH_SEPARATOR}]`, "g");

export function jsonLdHtml(data: unknown): string {
  return JSON.stringify(data).replace(UNSAFE, (match) => ESCAPES[match]!);
}
