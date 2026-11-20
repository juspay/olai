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
 *  the option REPLACES the common set rather than adding to it. */
const languages = { ...common, nix }

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

export const sourceTextOf = (source: string): string =>
  toString(pipeline.parse(asRead(source)), { includeHtml: true, includeImageAlt: true })

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
