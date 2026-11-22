/**
 * WHETHER A TEXT HOLDS NO MARKUP — which is nearly every title there is.
 *
 * Such a text is its own parse: `sow the basil`, `kitchen remodel #home` are
 * words and tags, and what a markdown parser does to words is hand them back.
 * So the page can draw it before the parser has loaded, and a reader can skip
 * the parser for it. It is deliberately NOT a second markdown dialect — there is
 * no parser here and nothing here interprets anything. It is a REFUSAL: it says
 * `false` for any text that could possibly be markdown, and the caller asks the
 * parser for those. `@olai/markdown-ui`'s `plain.test.ts` proves it, rendering
 * every accepted title both ways, byte for byte.
 *
 * That makes the rule one-directional: a construct nobody thought of costs a
 * text the shortcut, while a mistake in the other direction would draw
 * somebody's `**word**` with its asterisks forever. When in doubt, refuse.
 */

/**
 * Nothing in this string can be markdown.
 *
 * Read as a list of everything CommonMark and GFM can do to a line, each with
 * the reason it disqualifies the line rather than the shape it would take —
 * because what happens to a `*` is not this file's business; that it happens
 * at all is.
 */
export const isPlain = (title: string): boolean => {
  // Leading and trailing whitespace is dropped by the parser, and a tab can be
  // block indentation. Two lines are two blocks (and `\r` is a line too).
  if (title === "" || title !== title.trim()) return false
  if (/[\n\r\t]/.test(title)) return false

  // Every character that STARTS something: emphasis, code, links and images
  // and footnotes (all of which open with a bracket), raw HTML and autolinks,
  // entities, escapes, strikethrough, tables.
  //
  // What is deliberately absent is as much of the rule as what is here. `!`
  // means an image only in front of a `[`, and `(` `)` are a link's
  // destination only after one — with brackets gone, all three are punctuation
  // again, and `fix the sink (again)!` is a title people write. `#` is judged
  // below rather than here, because a tag is made of one.
  if (/[*_`[\]<>\\~|]/.test(title)) return false

  // An `&` is only markup as the head of a character reference — `&amp;`,
  // `&#39;` — so it is judged by what follows it. `Zoom & navigation` is a
  // title this repository's own roadmap has eight of, and an ampersand
  // followed by a space is an ampersand.
  if (/&(?=[A-Za-z0-9#])/.test(title)) return false

  // `#` opens a heading only with a space after it; anything else is a literal
  // — and the one literal this app gives meaning to is a tag, whose alphabet
  // starts right after the hash (./tags.ts). So a `#` that is not the start of
  // a tag is a `#` this file will not vouch for.
  if (/#(?![A-Za-z0-9_/-])/.test(title)) return false

  // A line that opens with a list marker or an ordered number is a list item,
  // and the marker would be eaten. (`*` is already gone with the emphasis
  // characters above; `-`, `+` and a digit are not.)
  if (/^(?:[-+]|\d{1,9}[.)])(?:\s|$)/.test(title)) return false

  // A line of dashes or equals is a rule, not words.
  if (/^[-=\s]+$/.test(title)) return false

  // GFM turns a bare URL or an email address into a link where it stands. The
  // schemes are the extension's own; the address shape is its `@` rule.
  if (/(?::\/\/|\bwww\.|\bmailto:|\bxmpp:)/i.test(title)) return false
  if (/[\w.+-]+@[\w-]+\.[\w-]/.test(title)) return false

  return true
}
