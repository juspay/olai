import type { Claims } from "@olai/format"
import type { Element, ElementContent, Root, RootContent, Text } from "hast"

import { NO_NEEDLES } from "@olai/markdown-ui/lit.ts"
import { markdownArrival } from "./chunk.ts"
import { plainTitle } from "./plain.ts"
import { hastToHtml, renderToTree, sourceText } from "./render.ts"
import { escapeSource, styleTags } from "./tags.ts"

export interface TitleRender {
  readonly links?: boolean
  readonly needles?: ReadonlyArray<string>
}

const plainTitles = new Map<string, TitleDrawing>()
const renderings = new WeakMap<Claims, Map<string, TitleDrawing>>()
const CACHE_LIMIT = 1024

export interface TitleDrawing {
  readonly html: string
  readonly waiting: boolean
}

const finished = (html: string): TitleDrawing => ({ html, waiting: false })

export const sameDrawing = (was: TitleDrawing, now: TitleDrawing): boolean =>
  was.html === now.html && was.waiting === now.waiting

export const renderTitle = (
  claims: Claims | undefined,
  title: string,
  from: string,
  options: TitleRender = {},
): TitleDrawing => {
  const needles = options.needles ?? NO_NEEDLES
  const links = options.links !== false

  if (needles.length === 0) {
    const wasPlain = plainTitles.get(title)
    if (wasPlain !== undefined) return wasPlain
  }
  const plain = plainTitle(title, needles)
  if (plain !== null) {
    return needles.length === 0
      ? remember(plainTitles, title, plain)
      : finished(plain)
  }

  let rendered = claims === undefined ? undefined : renderings.get(claims)
  if (rendered === undefined) {
    rendered = new Map()
    if (claims !== undefined) renderings.set(claims, rendered)
  }
  const key = `${links ? "a" : "n"}\n${from}\n${needles.join("\u0000")}\n${title}`
  const hit = rendered.get(key)
  if (hit !== undefined) return hit

  const arrival = markdownArrival()
  if (arrival.kind !== "ready") {
    return { html: escapeSource(title), waiting: arrival.kind === "waiting" }
  }

  return remember(rendered, key, build(claims, title, from, links, needles))
}

const remember = (
  cache: Map<string, TitleDrawing>,
  key: string,
  html: string,
): TitleDrawing => {
  if (cache.size >= CACHE_LIMIT) cache.clear()
  const drawing = finished(html)
  cache.set(key, drawing)
  return drawing
}

const build = (
  claims: Claims | undefined,
  title: string,
  from: string,
  links: boolean,
  needles: ReadonlyArray<string>,
): string => {
  const tree = renderToTree(claims, title, from, "inline")
  styleTags(tree, needles)
  if (!links) unwrapAnchors(tree)

  if (title.trim() !== "" && lostText(title, tree)) {
    return escapeSource(title)
  }
  return hastToHtml(tree)
}

const lostText = (title: string, tree: Root): boolean => {
  const drawn = collapse(renderedText(tree))
  if (drawn === "") return true
  const accounted = collapse(sourceText(title))
  return drawn.length < accounted.length
}

const collapse = (value: string): string => value.replace(/\s+/g, " ").trim()

const unwrapAnchors = (parent: Root | Element): void => {
  const next: ElementContent[] = []
  for (const child of parent.children) {
    if (child.type !== "element") {
      if (child.type === "text") next.push(child)
      continue
    }
    unwrapAnchors(child)
    if (child.tagName === "a") {
      next.push(...(child.children as ElementContent[]))
    } else {
      next.push(child)
    }
  }
  parent.children = next as typeof parent.children
}

const renderedText = (tree: Root): string => {
  let out = ""
  const walk = (nodes: ReadonlyArray<RootContent | ElementContent>): void => {
    for (const node of nodes) {
      if (node.type === "text") out += (node as Text).value
      else if (node.type === "element") walk(node.children)
    }
  }
  walk(tree.children)
  return out
}
