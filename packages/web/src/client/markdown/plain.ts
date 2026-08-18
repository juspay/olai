/**
 * A title with no markdown in it — which is nearly every title there is.
 *
 * The tree an outline paints first is rows of titles, and ./pipeline.ts is
 * ~391 KB the page would otherwise have to fetch and evaluate before it could
 * draw one. Almost none of them need it: `sow the basil`, `kitchen remodel
 * #home`, `Roadmap initial load feels very slow` are words and tags, and what
 * the pipeline does to words is hand them back.
 *
 * So this is the fast answer, and it is deliberately NOT a second markdown
 * dialect — there is no parser here, and nothing here interprets anything. It
 * is a REFUSAL: {@link plainTitle} says `null` for any title that could
 * possibly be markdown, and the caller waits for the real pipeline for those.
 * The only titles it answers are ones where "interpret the markdown" and
 * "escape the text" are provably the same operation, which is what
 * ./plain.test.ts proves — every accepted title, rendered both ways, byte for
 * byte.
 *
 * That makes the rule below one-directional: a construct nobody thought of
 * costs a title the fast path (a fetch it would have made anyway), while a
 * mistake in the other direction would draw somebody's `**word**` with its
 * asterisks forever. When in doubt, refuse.
 *
 * `#tags` are not an exception to that. They are not markdown at all — `#`
 * mid-line is a literal in every dialect — they are this app's own view-time
 * split (./tags.ts), and running it over plain words gives the same pills the
 * walk over a parsed tree gives.
 */

import { NO_NEEDLES } from "../filter/lit.ts"
import { taggedHtml } from "./tags.ts"

/**
 * This title as HTML, or `null` if it is not one this can answer.
 *
 * `null` is not a failure — it is "ask the pipeline", which is exactly what
 * ./title.ts then does.
 */
export const plainTitle = (
  title: string,
  /** The query's words, where the page is filtered — lit inside the words and
   *  the tags alike (../filter/lit.ts). They change nothing about WHICH titles
   *  this path answers: a highlight is a wrapper around text that was going to
   *  be written either way, which is why ./plain.test.ts sweeps the same
   *  strings with needles and without. */
  needles: ReadonlyArray<string> = NO_NEEDLES,
): string | null => (isPlain(title) ? taggedHtml(title, needles) : null)

/**
 * Nothing in this string can be markdown.
 *
 * Read as a list of everything CommonMark and GFM can do to a line, each with
 * the reason it disqualifies the line rather than the shape it would take —
 * because what happens to a `*` is not this file's business; that it happens
 * at all is.
 */
const isPlain = (title: string): boolean => {
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
