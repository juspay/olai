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

/** A page's title: the words of its first line, `# Title`. */
export const titleIn = (id: string, source: string): string => {
  const first = source.split("\n", 1)[0] ?? ""
  if (!first.startsWith("# ")) throw new Error(`docs/${id}.md does not open with "# Title"`)
  return first.slice(2).trim()
}

/**
 * The docs pass, for one page. Pages outside `docs/` (none today) are left
 * alone, and so is any link but a relative one to a page: a web address, an
 * anchor, a site path. A relative link to anything else stays as written, and
 * the build's link check fails on it, since the site publishes pages only.
 */
export const docsPage = (ctx: PluginFactoryContext) => {
  if (ctx.fileURL === undefined) return null
  const file = fileURLToPath(ctx.fileURL)
  if (!file.startsWith(DOCS)) return null
  const page = idOf(file)
  // The title line, which `titleIn` reads and the layout draws. `titleIn`
  // refuses a page whose first line is not `# Title`, so the first heading of
  // depth 1 is that line. satteri tracks no positions for a plugin to check.
  let titled = false
  return defineMdastPlugin({
    name: "olai-docs-page",
    heading(node, edit) {
      if (titled || node.depth !== 1) return
      titled = true
      edit.removeNode(node)
    },
    link(node, edit) {
      const [target = "", fragment] = node.url.split("#")
      if (/^[a-z][a-z0-9+.-]*:/i.test(node.url) || /^[#/]/.test(node.url) || !target.endsWith(".md")) return
      const id = idFrom(page, target)
      edit.setField(node, "url", hrefOf(id) + (fragment ? `#${fragment}` : ""))
      const [words] = node.children
      if (node.children.length !== 1 || words?.type !== "text") return
      if (words.value !== target && words.value !== path.posix.basename(target)) return
      const title = titleIn(id, fs.readFileSync(path.join(DOCS, `${id}.md`), "utf8"))
      edit.setField(node, "children", [{ type: "text", value: title }])
    },
  })
}
