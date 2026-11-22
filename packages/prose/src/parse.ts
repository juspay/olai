/**
 * TEXT TO TREE — the one Markdown parse this app makes, for the page and for
 * every other reader of text.
 *
 * `remark-parse` with `remark-gfm` and Obsidian's wikilinks and spaced
 * addresses (`./obsidian.ts`): CommonMark and GitHub's dialect, which is
 * what brings footnotes, tables, task lists and strikethrough into the same
 * dialect an agent and a reader already write. These are the options the
 * page has always rendered with; `@olai/markdown-ui`'s pipeline starts from
 * the tree this makes and draws it. Last come the bounds the parse keeps
 * (`./bounded.ts`), so no text, whatever its shape, costs more than its
 * length says.
 *
 * NO FRONTMATTER here: a `---` block is a FILE's own record and is taken off
 * by the caller that knows its text is a whole file (`./frontmatter.ts`'s
 * `proseIn`). A note under a row is not a file, and a leading `---` in one is
 * the thematic break Markdown says it is.
 *
 * Its own module, and imported only where a text becomes a reading:
 * `@olai/format/read` (decode) and `@olai/markdown-ui`'s pipeline chunk. The
 * parser is ~150 KB of the client and its browser build of the entity decoder
 * reaches for `document` as it loads, so a module that asks what a text SAYS
 * reads the reading decode kept and never imports this; `@olai/bundle`'s
 * `fence.test.ts` holds the client's first-load chunk to that.
 */
import type { Root } from "mdast"
import remarkGfm from "remark-gfm"
import remarkParse from "remark-parse"
import { unified } from "unified"

import { remarkBounded } from "./bounded.ts"
import { remarkObsidian } from "./obsidian.ts"

/** GitHub's dialect, then Obsidian's additions, then the bounds, which
 *  replace three of the constructs the two before them brought. */
const dialect = unified().use(remarkParse).use(remarkGfm).use(remarkObsidian).use(remarkBounded).freeze()

/** The Markdown tree of a text, in the dialect this app reads. */
export const parse = (text: string): Root => dialect.parse(text)

/**
 * Why a text has no tree: the parser threw, which no text should make it do.
 * The bounds (`./bounded.ts`) keep the nesting they hold far from the stack's
 * end, so each of these is a bug to find — told apart, because they are
 * different bugs:
 *
 *   - `depth`: the parser ran out of stack, on some nesting the bounds do not
 *     hold;
 *   - `failed`: anything else the parser threw, kept as `cause` so the one
 *     who runs the server can be shown it.
 */
export type Refusal =
  | { readonly kind: "depth" }
  | { readonly kind: "failed"; readonly cause: unknown }

/** The tree of a text, or why there is none. */
export type Guarded =
  | { readonly tree: Root; readonly refused?: undefined }
  | { readonly tree?: undefined; readonly refused: Refusal }

/**
 * The parse, its throw caught: a text the parser cannot read is read by its
 * reader as plain words, and says why. The page and the index ask this one
 * function, so they read the same texts the same way.
 */
export const guarded = (text: string): Guarded => {
  try {
    return { tree: parse(text) }
  } catch (cause) {
    return { refused: refusalOf(cause) }
  }
}

/** Which of the two a throw is. JavaScriptCore and V8 both run out of stack
 *  with a `RangeError` that says so. */
export const refusalOf = (cause: unknown): Refusal =>
  cause instanceof RangeError && /call stack/i.test(cause.message) ? { kind: "depth" } : { kind: "failed", cause }
