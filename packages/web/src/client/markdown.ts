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

export const renderMarkdown = (source: string): string =>
  String(pipeline.processSync(source))
