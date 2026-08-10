/**
 * A note, rendered.
 *
 * Markdown is rendered only at view time; the stored text stays verbatim, so
 * this is a pure function from the string on disk to HTML — no caching layer,
 * no pre-rendered field in the record, nothing that could go stale.
 *
 * `rehype-sanitize` runs between the parse and the serialise, which is what
 * makes the result safe to hand to `innerHTML`: the notes come from files an
 * agent or a git merge may have written, and a note is not a place where a
 * `<script>` should be able to appear.
 *
 * Highlighting runs AFTER the sanitiser, and the order is the point. Before it,
 * every `<span class="hljs-keyword">` the highlighter had just produced would
 * have to be allow-listed back in — a schema saying "spans with classes are
 * fine", written to admit our own output, and admitting a hand-written one just
 * the same. After it, the input is already safe: the highlighter reads the TEXT
 * of a code block and emits spans it names itself, so nothing from the file
 * decides what appears. The default sanitiser keeps `language-*` on `<code>`,
 * which is exactly the one thing this stage needs to survive the scrub.
 *
 * The language set is the highlighter's `common` bundle — vendored through the
 * dependency like everything else, because a stylesheet or a script from a CDN
 * is a third party in the reader's page and olai serves its own files.
 */

import rehypeHighlight from "rehype-highlight"
import rehypeSanitize from "rehype-sanitize"
import rehypeStringify from "rehype-stringify"
import remarkParse from "remark-parse"
import remarkRehype from "remark-rehype"
import { unified } from "unified"

const pipeline = unified()
  .use(remarkParse)
  .use(remarkRehype)
  .use(rehypeSanitize)
  .use(rehypeHighlight, { detect: false })
  .use(rehypeStringify)

/**
 * Keyed by the note itself, because the note IS the input: identical text can
 * only render to identical HTML.
 *
 * It earns its place at the two moments a row is rebuilt from scratch —
 * folding an ancestor and expanding it again, and every frame the live store
 * publishes. Both throw away the per-row memo and would
 * otherwise re-run the whole `unified` pipeline over text that has not
 * changed.
 *
 * Capped rather than unbounded: an editing session rewrites notes, and every
 * intermediate version would otherwise be kept alive by its own rendering. The
 * cap is a whole-cache drop rather than an eviction policy — an LRU here would
 * be more machinery than the thing it manages.
 */
const rendered = new Map<string, string>()
const CACHE_LIMIT = 512

export const renderMarkdown = (source: string): string => {
  const hit = rendered.get(source)
  if (hit !== undefined) return hit

  const html = String(pipeline.processSync(source))
  if (rendered.size >= CACHE_LIMIT) rendered.clear()
  rendered.set(source, html)
  return html
}
