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

import { NO_NEEDLES } from "@olai/markdown-ui/lit.ts"
import { isPlain } from "@olai/prose/plain.ts"
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
