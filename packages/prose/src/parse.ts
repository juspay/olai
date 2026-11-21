/**
 * TEXT TO TREE — the one Markdown parse this app makes, for the page and,
 * from a later stage of this package, for every other reader of text.
 *
 * `remark-parse` with `remark-gfm` and Obsidian's wikilinks and spaced
 * addresses (`./obsidian.ts`): CommonMark and GitHub's dialect, which is
 * what brings footnotes, tables, task lists and strikethrough into the same
 * dialect an agent and a reader already write. These are the options the
 * person sees; `@olai/markdown-ui`'s pipeline starts from the tree this makes
 * and draws it.
 *
 * NO FRONTMATTER here: a `---` block is a FILE's own record and is taken off
 * by the caller that knows its text is a whole file (`./frontmatter.ts`'s
 * `proseIn`). A note under a row is not a file, and a leading `---` in one is
 * the thematic break Markdown says it is.
 *
 * Its own module, and nothing first-paint imports it: the parser is ~150 KB
 * of the client, and the tag grammar (`./tags.ts`) and the plain-title test
 * (`./plain.ts`) are needed before it has loaded.
 */
import type { Root } from "mdast"
import remarkGfm from "remark-gfm"
import remarkParse from "remark-parse"
import { type Processor, unified } from "unified"

import { obsidianFromMarkdown, obsidianSyntax } from "./obsidian.ts"

/** `./obsidian.ts`'s two halves, attached the way `remark-gfm` attaches its
 *  own: after it, so a spaced address is tried before a footnote's `]`. */
function remarkObsidian(this: Processor): void {
  const data = this.data()
  ;(data.micromarkExtensions ??= []).push(obsidianSyntax)
  ;(data.fromMarkdownExtensions ??= []).push(obsidianFromMarkdown)
}

/** Built once, when this module is evaluated: attaching the extensions is
 *  work a parse per text must not repeat. */
const parser = unified().use(remarkParse).use(remarkGfm).use(remarkObsidian).freeze()

/** The Markdown tree of a text, in the dialect this app reads. */
export const parse = (text: string): Root => parser.parse(text)
