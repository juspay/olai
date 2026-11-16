/**
 * Where a docs page lives on the site, and the one Markdown pass that puts it
 * there.
 *
 * Pages are written as plain Markdown files under `website/docs/`, linking each
 * other by relative `.md` paths so they read the same on GitHub and when
 * `just serve` opens the directory in olai. On the site, each page is
 * `/docs/<its path without .md>/`, so every such link is rewritten to that
 * address here, and a link whose words are just the file's name
 * (`[chat.md](chat.md)`) shows the page's title instead. The page's own
 * `# Title` line is lifted out too: the layout draws the title itself, with
 * the page's summary under it.
 */

import fs from "node:fs"
import path from "node:path"
import { fileURLToPath } from "node:url"

import { defineMdastPlugin, type PluginFactoryContext } from "satteri"

/** The directory the pages are written in. */
export const DOCS = fileURLToPath(new URL("../docs/", import.meta.url))

/** A page's id: its path under `docs/`, without `.md`, with `/` separators. */
export const idOf = (file: string): string =>
  path.relative(DOCS, file).replace(/\.md$/, "").split(path.sep).join("/")

/** The id of the page a relative `.md` link on page `from` names. */
export const idFrom = (from: string, target: string): string =>
  path.posix.normalize(path.posix.join(path.posix.dirname(from), target.replace(/\.md$/, "")))

/** A page's address on the site. */
export const hrefOf = (id: string): string => (id === "index" ? "/docs/" : `/docs/${id}/`)

/** Where a link written on page `from` goes on the site: a relative `.md`
 *  link goes to that page's address, and anything else stays as written. */
export const siteHref = (from: string, url: string): string => {
  const [target = "", fragment] = url.split("#")
  if (/^[a-z][a-z0-9+.-]*:/i.test(url) || /^[#/]/.test(url) || !target.endsWith(".md")) return url
  return hrefOf(idFrom(from, target)) + (fragment ? `#${fragment}` : "")
}

/** What a reader meets before opening anything, as the page's own pass sees
 *  it. How long it is, the docs lint already holds to a minute. */
export interface Reading {
  /** Which of the page's `##` headings, counted in order, are in the main
   *  flow: the page minus its footnotes and `<details>` blocks. */
  sections: number[]
  /** How many footnotes the page has. */
  notes: number
}

/** A page's title: the words of its first line, `# Title`. */
export const titleIn = (id: string, source: string): string => {
  const first = source.split("\n", 1)[0] ?? ""
  if (!first.startsWith("# ")) throw new Error(`docs/${id}.md does not open with "# Title"`)
  return first.slice(2).trim()
}

/**
 * The docs pass, for one page: it rewrites links (see {@link siteHref}),
 * lifts the title out, and records what the main flow holds into the page's
 * frontmatter as `reading`. Pages outside `docs/` (none today) are left
 * alone. A relative link to anything but a page stays as written, and the
 * build's link check fails on it, since the site publishes pages only.
 */
export const docsPage = (ctx: PluginFactoryContext) => {
  if (ctx.fileURL === undefined) return null
  const file = fileURLToPath(ctx.fileURL)
  if (!file.startsWith(DOCS)) return null
  const page = idOf(file)
  const reading: Reading = { sections: [], notes: 0 }
  // Astro seeds `data.astro` with the page's frontmatter, and hands back what
  // a plugin adds to it as `remarkPluginFrontmatter`; satteri types the bag
  // as open data.
  const astro = ctx.data.astro as { frontmatter: Record<string, unknown> }
  astro.frontmatter.reading = reading
  // The title line, which `titleIn` reads and the layout draws. `titleIn`
  // refuses a page whose first line is not `# Title`, so the first heading of
  // depth 1 is that line. satteri tracks no positions for a plugin to check.
  let titled = false
  // How many `<details>` are open at the top level, in document order.
  let folded = 0
  let h2 = 0
  return defineMdastPlugin({
    name: "olai-docs-page",
    html(node, edit) {
      if (edit.parent(node)?.type !== "root") return
      folded += (node.value.match(/<details\b/gu) ?? []).length - (node.value.match(/<\/details>/gu) ?? []).length
    },
    heading(node, edit) {
      if (!titled && node.depth === 1) {
        titled = true
        edit.removeNode(node)
        return
      }
      if (node.depth !== 2 || edit.parent(node)?.type !== "root") return
      if (folded === 0) reading.sections.push(h2)
      h2 += 1
    },
    footnoteDefinition() {
      reading.notes += 1
    },
    link(node, edit) {
      const href = siteHref(page, node.url)
      if (href === node.url) return
      edit.setField(node, "url", href)
      const target = node.url.split("#")[0] ?? ""
      const [words] = node.children
      if (node.children.length !== 1 || words?.type !== "text") return
      if (words.value !== target && words.value !== path.posix.basename(target)) return
      const id = idFrom(page, target)
      const title = titleIn(id, fs.readFileSync(path.join(DOCS, `${id}.md`), "utf8"))
      edit.setField(node, "children", [{ type: "text", value: title }])
    },
  })
}
