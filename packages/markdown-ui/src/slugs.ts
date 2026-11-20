import { claim, type Slug, slugOf } from "@olai/format"
import type { Element, Root } from "hast"

import { textOf } from "./anchors.ts"

const HEADINGS = new Set(["h1", "h2", "h3", "h4", "h5", "h6"])

export const rehypeSlugs = () => (tree: Root): void => {
  const seen = new Map<string, number>()
  walk(tree, (element) => {
    if (!HEADINGS.has(element.tagName)) return
    const properties = element.properties ?? (element.properties = {})
    if (typeof properties["id"] === "string" && properties["id"] !== "") return
    const slug: Slug = slugOf(textOf(element))
    if (slug === "") return
    properties["id"] = claim(seen, slug)
  })
}

const walk = (node: Root | Element, visit: (element: Element) => void): void => {
  for (const child of node.children) {
    if (child.type !== "element") continue
    visit(child)
    walk(child, visit)
  }
}
