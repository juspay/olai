import fs from "node:fs"
import path from "node:path"
import { fileURLToPath } from "node:url"

import { defineMdastPlugin, type PluginFactoryContext } from "satteri"

export const DOCS = fileURLToPath(new URL("../docs/", import.meta.url))

export const idOf = (file: string): string =>
  path.relative(DOCS, file).replace(/\.md$/, "").split(path.sep).join("/")

export const idFrom = (from: string, target: string): string =>
  path.posix.normalize(path.posix.join(path.posix.dirname(from), target.replace(/\.md$/, "")))

export const hrefOf = (id: string): string => (id === "index" ? "/docs/" : `/docs/${id}/`)

export const siteHref = (from: string, url: string): string => {
  const [target = "", fragment] = url.split("#")
  if (/^[a-z][a-z0-9+.-]*:/i.test(url) || /^[#/]/.test(url) || !target.endsWith(".md")) return url
  return hrefOf(idFrom(from, target)) + (fragment ? `#${fragment}` : "")
}

export interface Reading {
  sections: number[]
  notes: number
}

export const titleIn = (id: string, source: string): string => {
  const first = source.split("\n", 1)[0] ?? ""
  if (!first.startsWith("# ")) throw new Error(`docs/${id}.md does not open with "# Title"`)
  return first.slice(2).trim()
}

export const docsPage = (ctx: PluginFactoryContext) => {
  if (ctx.fileURL === undefined) return null
  const file = fileURLToPath(ctx.fileURL)
  if (!file.startsWith(DOCS)) return null
  const page = idOf(file)
  const reading: Reading = { sections: [], notes: 0 }
  const astro = ctx.data.astro as { frontmatter: Record<string, unknown> }
  astro.frontmatter.reading = reading
  let titled = false
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
