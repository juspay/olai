import type { Claims } from "@olai/format"
import { styleTags } from "./tags.ts"
import type { Element } from "hast"
import type { Root } from "hast"

import { pipelineNow } from "./chunk.ts"
import { toInline } from "./inline.ts"
import type { Heading } from "./outline.ts"
import { rewrite } from "./rewrite.ts"

interface Rendered {
  readonly html: string
  readonly headings: readonly Heading[]
}

const renderings = new WeakMap<Claims, WeakMap<object, Map<string, Rendered>>>()
const CACHE_LIMIT = 512

const keyFor = (
  shape: "block" | "inline",
  from: string,
  source: string,
): string => `${shape}\n${from}\n${source}`

const renderingOf = (
  claims: Claims | undefined,
  source: string,
  from: string,
  shape: "block" | "inline",
  members?: ReadonlySet<string>,
): Rendered => {
  if (claims === undefined) return render(claims, source, from, keyFor(shape, from, source), shape, members)
  let revisions = renderings.get(claims)
  if (revisions === undefined) {
    revisions = new WeakMap()
    renderings.set(claims, revisions)
  }
  // Membership identity scopes the cache; it must not move heading IDs.
  const namespace = members ?? claims
  let rendered = revisions.get(namespace)
  if (rendered === undefined) {
    rendered = new Map()
    revisions.set(namespace, rendered)
  }
  const key = keyFor(shape, from, source)
  const hit = rendered.get(key)
  if (hit !== undefined) return hit

  const result = render(claims, source, from, key, shape, members)
  if (rendered.size >= CACHE_LIMIT) rendered.clear()
  rendered.set(key, result)
  return result
}

export const renderMarkdown = (claims: Claims | undefined, source: string, from: string, members?: ReadonlySet<string>): string =>
  renderingOf(claims, source, from, "block", members).html

export const renderInlineMarkdown = (claims: Claims | undefined, source: string, from: string): string =>
  renderingOf(claims, source, from, "inline").html

export const outlineOf = (claims: Claims | undefined, source: string, from: string): readonly Heading[] =>
  renderingOf(claims, source, from, "block").headings

// Same key shape as {@link renderingOf} for "block": footnote ids are minted
// from the key, so a streamed answer and its final render must agree or
// every `href="#md-…-fn-1"` breaks the instant streaming ends.
export const renderStreaming = (claims: Claims | undefined, source: string, from: string): string =>
  render(claims, source, from, keyFor("block", from, source), "block").html

export const renderToTree = (
  claims: Claims | undefined,
  source: string,
  from: string,
  shape: "block" | "inline",
  members?: ReadonlySet<string>,
): Root => {
  const key = keyFor(shape, from, source)
  const tree = pipelineNow().treeOf(source)
  if (shape === "inline") toInline(tree)
  rewrite(tree, { claims, from, ids: idsFor(key), ...(members === undefined ? {} : { members }) })
  return tree
}

export const sourceText = (source: string): string =>
  pipelineNow().sourceTextOf(source)

export const landingId = (source: string, from: string, at: string): string =>
  `${idsFor(keyFor("block", from, source))}-${at}`

export const hastToHtml = (tree: Root): string => pipelineNow().htmlOf(tree)

const render = (
  claims: Claims | undefined,
  source: string,
  from: string,
  key: string,
  shape: "block" | "inline",
  members?: ReadonlySet<string>,
): Rendered => {
  const pipeline = pipelineNow()
  const tree = pipeline.treeOf(source)
  if (shape === "inline") toInline(tree)
  const headings = rewrite(tree, { claims, from, ids: idsFor(key), ...(members === undefined ? {} : { members }) })
  return { html: pipeline.htmlOf(tree), headings }
}

const idsFor = (key: string): string => {
  let hash = 0x811c9dc5
  for (let at = 0; at < key.length; at++) {
    hash ^= key.charCodeAt(at)
    hash = Math.imul(hash, 0x01000193)
  }
  return `md-${(hash >>> 0).toString(36)}`
}

export const renderLineLanding = (claims: Claims | undefined, source: string, from: string, line: number, needles: ReadonlyArray<string>, members?: ReadonlySet<string>): string => {
  const tree = renderToTree(claims, source, from, "block", members)
  if (line < 1 || line > source.split("\n").length) return hastToHtml(tree)
  const lines = source.split("\n")
  const blocks = new Set(["p", "pre", "li", "ul", "ol", "blockquote", "h1", "h2", "h3", "h4", "h5", "h6", "table", "tr", "hr"])
  const candidates: Array<{ element: Element; start: number; end: number; depth: number }> = []
  const walk = (parent: Root | Element, depth: number): void => {
    for (const child of parent.children) {
      if (child.type !== "element") continue
      if (blocks.has(child.tagName) && child.position !== undefined) {
        let start = child.position.start.line
        let end = child.position.end.line
        if (child.tagName === "pre" && /^\s*(?:>\s*)*(```|~~~)/.test(lines[start - 1] ?? "")) { start++; end-- }
        candidates.push({ element: child, start, end, depth })
      }
      walk(child, depth + 1)
    }
  }
  walk(tree, 0)
  const unmapped = (lines[line - 1]?.trim() ?? "") === "" || /^\s*(?:>\s*)*(```|~~~)/.test(lines[line - 1] ?? "")
  const containing = unmapped ? [] : candidates.filter(block => block.start <= line && block.end >= line)
  containing.sort((a, b) => b.depth - a.depth)
  const before = candidates.filter(block => block.end < line)
  before.sort((a, b) => b.end - a.end || b.depth - a.depth)
  const selected = (containing[0] ?? before[0])?.element
  if (selected !== undefined) {
    selected.properties.dataSearchLanding = "true"
    styleTags(selected, needles)
  }
  return hastToHtml(tree)
}
