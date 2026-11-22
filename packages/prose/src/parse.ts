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
 * Its own module, and nothing first-paint imports it: the parser is ~150 KB
 * of the client, and the tag grammar (`./tags.ts`) and the plain-title test
 * (`./plain.ts`) are needed before it has loaded.
 */
import type { Root } from "mdast"
import type remarkGfmPlugin from "remark-gfm"
import type remarkParsePlugin from "remark-parse"
import type * as Unified from "unified"
import type { Processor } from "unified"

import type * as Bounded from "./bounded.ts"
import type * as Obsidian from "./obsidian.ts"

/** Built once, on the first parse, and LOADED then too: the parser's modules
 *  are required here rather than imported at the top, so importing this file
 *  — which every reader of `@olai/format` does — runs none of them. A bundle
 *  that never parses carries no parser, and a runtime without a DOM can import
 *  the reading even though the parser's browser build of the entity decoder
 *  (`decode-named-character-reference`) reaches for `document` when it loads. */
let parser: Processor<Root> | undefined

/** GitHub's dialect, then Obsidian's additions, then the bounds, which
 *  replace three of the constructs the two before them brought. */
const dialect = (): Processor<Root> => {
  const { unified } = require("unified") as typeof Unified
  const remarkParse = (require("remark-parse") as { readonly default: typeof remarkParsePlugin }).default
  const remarkGfm = (require("remark-gfm") as { readonly default: typeof remarkGfmPlugin }).default
  const { remarkObsidian } = require("./obsidian.ts") as typeof Obsidian
  const { remarkBounded } = require("./bounded.ts") as typeof Bounded
  return unified().use(remarkParse).use(remarkGfm).use(remarkObsidian).use(remarkBounded).freeze() as unknown as Processor<Root>
}

/** The Markdown tree of a text, in the dialect this app reads. */
export const parse = (text: string): Root => (parser ??= dialect()).parse(text) as Root

/**
 * Why a text has no tree: the parser threw, which no text should make it do.
 * The bounds (`./bounded.ts`) keep every shape the parser is not linear on to
 * milliseconds and its nesting far from the stack's end, so each of these is
 * a bug to find — told apart, because they are different bugs:
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
    return { refused: isStackOverflow(cause) ? { kind: "depth" } : { kind: "failed", cause } }
  }
}

/** JavaScriptCore and V8 both throw a `RangeError` that says so. */
const isStackOverflow = (cause: unknown): boolean => cause instanceof RangeError && /call stack/i.test(cause.message)
