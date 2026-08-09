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
 */

import rehypeSanitize from "rehype-sanitize"
import rehypeStringify from "rehype-stringify"
import remarkParse from "remark-parse"
import remarkRehype from "remark-rehype"
import { unified } from "unified"

const pipeline = unified()
  .use(remarkParse)
  .use(remarkRehype)
  .use(rehypeSanitize)
  .use(rehypeStringify)

/**
 * Keyed by the note itself, because the note IS the input: identical text can
 * only render to identical HTML.
 *
 * It earns its place at the two moments a row is rebuilt from scratch —
 * folding an ancestor and expanding it again, and (from phase 3) every frame
 * the live store publishes. Both throw away the per-row memo and would
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
