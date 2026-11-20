import { bracketSpacedLinks } from "@olai/format"
import nix from "highlight.js/lib/languages/nix"
import { common } from "lowlight"
import { toString } from "mdast-util-to-string"
import rehypeAutolinkHeadings from "rehype-autolink-headings"
import rehypeHighlight from "rehype-highlight"
import rehypeSanitize from "rehype-sanitize"
import rehypeStringify from "rehype-stringify"
import remarkGfm from "remark-gfm"
import remarkParse from "remark-parse"
import remarkRehype from "remark-rehype"
import { unified } from "unified"
import type { Root } from "hast"

import { AUTOLINK } from "./anchors.ts"
import { SANITISE } from "./sanitise.ts"
import { rehypeSlugs } from "./slugs.ts"

/** `rehype-highlight` builds its lowlight from whatever `languages` says, so
 *  the option REPLACES the common set rather than adding to it: `{ nix }`
 *  alone would be a client that had forgotten TypeScript. */
const languages = { ...common, nix }

// Before the sanitiser, not after: the id is
// made out of a heading somebody WROTE, so what it produces is checked by
// the allowlist rather than trusted for having arrived late.
// Highlighting runs AFTER the sanitiser deliberately: the `hljs-` spans are
// ours, produced from the code's own text, so they need no allowlist entry.
const pipeline = unified()
  .use(remarkParse)
  .use(remarkGfm)
  .use(remarkRehype, { clobberPrefix: "" })
  .use(rehypeSlugs)
  .use(rehypeAutolinkHeadings, AUTOLINK)
  .use(rehypeSanitize, SANITISE)
  .use(rehypeHighlight, { detect: false, languages })
  .use(rehypeStringify)

export interface Pipeline {
  readonly treeOf: (source: string) => Root
  readonly sourceTextOf: (source: string) => string
  readonly htmlOf: (tree: Root) => string
}

const asRead = (source: string): string => bracketSpacedLinks(source)

export const treeOf = (source: string): Root =>
  pipeline.runSync(pipeline.parse(asRead(source))) as Root

/** `mdast-util-to-string`'s defaults are the two decisions this needs, which
 *  is why they are not spelled: `includeHtml` keeps a raw `<Component>`'s
 *  characters, and `includeImageAlt` keeps a picture's words. */
export const sourceTextOf = (source: string): string =>
  toString(pipeline.parse(asRead(source)))

export const htmlOf = (tree: Root): string => pipeline.stringify(tree)

export interface MarkdownNode {
  readonly type: string
  readonly value?: string | undefined
  readonly url?: string | undefined
  readonly depth?: number | undefined
  readonly identifier?: string | undefined
  readonly children?: ReadonlyArray<MarkdownNode> | undefined
  readonly position?: { readonly start: { readonly line: number } } | undefined
}

export const mdastOf = (source: string): MarkdownNode =>
  pipeline.parse(asRead(source)) as MarkdownNode
