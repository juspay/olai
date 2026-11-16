/**
 * The docs' page map, read off `docs/index.md`.
 *
 * The index is the one place a page is placed: its `##` headings are the
 * sidebar's groups, its `###` headings the groups inside one, and each table
 * row links one page with a line on what it covers. That line is also the
 * summary under the page's title. A page the index does not link, or a row
 * that links no page, fails the build: a page nobody can reach from the
 * sidebar is a page nobody notices going stale.
 */

import { getCollection, type CollectionEntry } from "astro:content"
import { markdownToHtml } from "satteri"

import { hrefOf, titleIn } from "./markdown.ts"

export type Page = CollectionEntry<"docs">

export interface Link {
  readonly id: string
  readonly href: string
  readonly title: string
  /** What the page covers, as inline HTML. */
  readonly summary: string
}

export interface Group {
  readonly title: string
  readonly links: Link[]
  readonly groups: Group[]
}

const escape = (text: string): string =>
  text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")

/** A table cell's words as inline HTML: code stays code, and a link keeps only
 *  its words. */
const inline = (node: { type: string; value?: string; children?: unknown[] }): string => {
  if (node.type === "text") return escape(node.value ?? "")
  if (node.type === "inlineCode") return `<code>${escape(node.value ?? "")}</code>`
  const inner = ((node.children ?? []) as Parameters<typeof inline>[0][]).map(inline).join("")
  if (node.type === "emphasis") return `<em>${inner}</em>`
  if (node.type === "strong") return `<strong>${inner}</strong>`
  return inner
}

/** A heading's words as plain text. */
const words = (node: { type: string; value?: string; children?: unknown[] }): string =>
  node.value ?? ((node.children ?? []) as Parameters<typeof words>[0][]).map(words).join("")

type Row = { target: string; summary: string }
type Block = { kind: "heading"; depth: number; text: string } | { kind: "table"; rows: Row[] }

/** The index's headings and table rows, in order. Read inside the visitor:
 *  satteri's nodes are only readable during their pass. */
const blocksOf = (source: string): Block[] => {
  const blocks: Block[] = []
  markdownToHtml(source, {
    mdastPlugins: [
      {
        name: "olai-docs-index",
        heading(node) {
          blocks.push({ kind: "heading", depth: node.depth, text: words(node) })
        },
        table(node) {
          const rows = node.children.slice(1).flatMap((row): Row[] => {
            const [first, second] = row.children
            const link = first?.children.find((child) => child.type === "link")
            if (link?.type !== "link" || second === undefined) return []
            return [{ target: link.url, summary: second.children.map(inline).join("") }]
          })
          blocks.push({ kind: "table", rows })
        },
      },
    ],
  })
  return blocks
}

export interface SiteMap {
  readonly groups: Group[]
  /** Every page but the index, in the order the index lists them. */
  readonly order: Link[]
  readonly byId: ReadonlyMap<string, { link: Link; trail: string[] }>
}

export const siteMap = async (): Promise<SiteMap> => {
  const pages = new Map((await getCollection("docs")).map((page) => [page.id, page]))
  const index = pages.get("index")
  if (index === undefined) throw new Error("docs/index.md is missing")

  const groups: Group[] = []
  const order: Link[] = []
  const byId = new Map<string, { link: Link; trail: string[] }>()
  for (const block of blocksOf(index.body ?? "")) {
    const top = groups.at(-1)
    if (block.kind === "heading") {
      const group = { title: block.text, links: [], groups: [] }
      if (block.depth === 2) groups.push(group)
      else if (block.depth === 3 && top !== undefined) top.groups.push(group)
      continue
    }
    if (top === undefined) continue
    const inner = top.groups.at(-1)
    const home = inner ?? top
    for (const row of block.rows) {
      const id = row.target.replace(/\.md$/, "")
      const page = pages.get(id)
      if (page === undefined) throw new Error(`docs/index.md links ${row.target}, which is not a page`)
      if (byId.has(id)) throw new Error(`docs/index.md lists ${row.target} twice`)
      const title = titleIn(id, page.body ?? "")
      const link = { id, href: hrefOf(id), title, summary: row.summary }
      home.links.push(link)
      order.push(link)
      byId.set(id, { link, trail: inner === undefined ? [top.title] : [top.title, inner.title] })
    }
  }

  const unlisted = [...pages.keys()].filter((id) => id !== "index" && !byId.has(id))
  if (unlisted.length > 0) {
    throw new Error(`docs/index.md does not list: ${unlisted.map((id) => `${id}.md`).join(", ")}`)
  }
  return { groups, order, byId }
}
