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

import { getCollection } from "astro:content"
import { markdownToHtml } from "satteri"

import { hrefOf, idFrom, titleIn } from "./markdown.ts"

export interface Link {
  readonly id: string
  readonly href: string
  readonly title: string
  /** What the page covers, as inline HTML, and as plain words. */
  readonly summary: string
  readonly description: string
}

export interface Group {
  readonly title: string
  readonly links: Link[]
  readonly groups: Group[]
}

/** One page's place in the map: the groups it sits in, and its neighbours in
 *  the index's order. The index itself sits in no group. */
export interface Place {
  readonly link: Link
  readonly trail: string[]
  previous?: Link
  next?: Link
}

type Node = { type: string; value?: string; children?: unknown[] }

const escape = (text: string): string =>
  text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")

/** A table cell's words as inline HTML: code stays code, and a link keeps only
 *  its words. */
const inline = (node: Node): string => {
  if (node.type === "text") return escape(node.value ?? "")
  if (node.type === "inlineCode") return `<code>${escape(node.value ?? "")}</code>`
  const inner = ((node.children ?? []) as Node[]).map(inline).join("")
  if (node.type === "emphasis") return `<em>${inner}</em>`
  if (node.type === "strong") return `<strong>${inner}</strong>`
  return inner
}

/** A node's words as plain text. */
const words = (node: Node): string =>
  node.value ?? ((node.children ?? []) as Node[]).map(words).join("")

type Row = { target: string; summary: string; description: string }
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
            return [{ target: link.url, summary: inline(second), description: words(second) }]
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
  /** Every page, the index included. */
  readonly places: ReadonlyMap<string, Place>
}

export const siteMap = async (): Promise<SiteMap> => {
  const pages = new Map((await getCollection("docs")).map((page) => [page.id, page]))
  const index = pages.get("index")
  if (index === undefined) throw new Error("docs/index.md is missing")
  const source = index.body ?? ""

  const groups: Group[] = []
  const places = new Map<string, Place>()
  const overview = titleIn("index", source)
  places.set("index", {
    link: { id: "index", href: hrefOf("index"), title: overview, summary: "", description: overview },
    trail: [],
  })
  // The index leads into the first page it lists, and that page back to it.
  let last = places.get("index")
  for (const block of blocksOf(source)) {
    const top = groups.at(-1)
    if (block.kind === "heading") {
      const group = { title: block.text, links: [], groups: [] }
      if (block.depth === 2) groups.push(group)
      else if (block.depth === 3 && top !== undefined) top.groups.push(group)
      continue
    }
    if (top === undefined) continue
    const inner = top.groups.at(-1)
    for (const row of block.rows) {
      const id = idFrom("index", row.target)
      const page = pages.get(id)
      if (page === undefined) throw new Error(`docs/index.md links ${row.target}, which is not a page`)
      if (places.has(id)) throw new Error(`docs/index.md lists ${row.target} twice`)
      const title = titleIn(id, page.body ?? "")
      const link = { id, href: hrefOf(id), title, summary: row.summary, description: row.description }
      ;(inner ?? top).links.push(link)
      const place: Place = { link, trail: inner === undefined ? [top.title] : [top.title, inner.title], previous: last?.link }
      if (last !== undefined) last.next = link
      places.set(id, place)
      last = place
    }
  }

  const unlisted = [...pages.keys()].filter((id) => !places.has(id))
  if (unlisted.length > 0) {
    throw new Error(`docs/index.md does not list: ${unlisted.map((id) => `${id}.md`).join(", ")}`)
  }
  return { groups, places }
}
