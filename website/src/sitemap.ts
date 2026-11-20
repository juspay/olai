import { getCollection } from "astro:content"
import { markdownToHtml } from "satteri"

import { hrefOf, idFrom, siteHref, titleIn } from "./markdown.ts"

export interface Link {
  readonly id: string
  readonly href: string
  readonly title: string
  readonly summary: string
  readonly description: string
}

export interface Group {
  readonly title: string
  readonly slug: string
  intro: string
  readonly links: Link[]
  readonly groups: Group[]
}

export interface Place {
  readonly link: Link
  readonly trail: string[]
  previous?: Link
  next?: Link
}

type Node = { type: string; value?: string; children?: unknown[] }

const escape = (text: string): string =>
  text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;")

const inline = (node: Node & { url?: string }): string => {
  if (node.type === "text") return escape(node.value ?? "")
  if (node.type === "inlineCode") return `<code>${escape(node.value ?? "")}</code>`
  const inner = ((node.children ?? []) as Node[]).map(inline).join("")
  if (node.type === "emphasis") return `<em>${inner}</em>`
  if (node.type === "strong") return `<strong>${inner}</strong>`
  if (node.type === "link" && node.url !== undefined) return `<a href="${escape(siteHref("index", node.url))}">${inner}</a>`
  return inner
}

const words = (node: Node): string =>
  node.value ?? ((node.children ?? []) as Node[]).map(words).join("")

type Row = { target: string; summary: string; description: string }
type Block =
  | { kind: "heading"; depth: number; text: string }
  | { kind: "paragraph"; html: string }
  | { kind: "table"; rows: Row[] }

const blocksOf = (source: string): Block[] => {
  const blocks: Block[] = []
  markdownToHtml(source, {
    mdastPlugins: [
      {
        name: "olai-docs-index",
        heading(node) {
          blocks.push({ kind: "heading", depth: node.depth, text: words(node) })
        },
        paragraph(node, edit) {
          if (edit.parent(node)?.type === "root") blocks.push({ kind: "paragraph", html: node.children.map(inline).join("") })
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
  readonly intro: string
  readonly groups: Group[]
  readonly closing: string[]
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
  const opening: string[] = []
  const closing: string[] = []
  let last = places.get("index")
  for (const block of blocksOf(source)) {
    const top = groups.at(-1)
    const current = top?.groups.at(-1) ?? top
    if (block.kind === "heading") {
      if (closing.length > 0) throw new Error(`docs/index.md has prose after ${current?.title}'s table that the overview cannot place: move it under a heading, or to the end`)
      const slug = block.text.toLowerCase().replace(/[^\p{L}\p{N}\s-]/gu, "").replace(/\s/g, "-")
      const group = { title: block.text, slug, intro: "", links: [], groups: [] }
      if (block.depth === 2) groups.push(group)
      else if (block.depth === 3 && top !== undefined) top.groups.push(group)
      continue
    }
    if (block.kind === "paragraph") {
      if (current === undefined) opening.push(block.html)
      else if (current.intro === "" && current.links.length === 0) current.intro = block.html
      else closing.push(block.html)
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
  return { intro: opening.join(" "), groups, closing, places }
}
