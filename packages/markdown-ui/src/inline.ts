import type { ElementContent, Root, RootContent } from "hast"

const PHRASING = new Set([
  "a",
  "abbr",
  "b",
  "bdi",
  "bdo",
  "br",
  "cite",
  "code",
  "data",
  "del",
  "dfn",
  "em",
  "i",
  "ins",
  "kbd",
  "mark",
  "q",
  "rp",
  "rt",
  "rtc",
  "ruby",
  "s",
  "samp",
  "small",
  "span",
  "strong",
  "sub",
  "sup",
  "time",
  "u",
  "var",
  "wbr",
])

export const toInline = (tree: Root): void => {
  tree.children = phrasingOf(tree.children)
}

const phrasingOf = (
  nodes: ReadonlyArray<RootContent | ElementContent>,
): ElementContent[] => {
  const out: ElementContent[] = []
  let gap = false

  const push = (node: ElementContent): void => {
    if (gap && out.length > 0) {
      if (node.type === "text") {
        out.push({ type: "text", value: leadingSpace(node.value) })
        gap = false
        return
      }
      out.push({ type: "text", value: " " })
    }
    gap = false
    out.push(node)
  }

  const walk = (kids: ReadonlyArray<RootContent | ElementContent>): void => {
    for (const node of kids) {
      if (node.type === "text") {
        if (node.value.length === 0) continue
        push(node)
        continue
      }
      if (node.type !== "element") continue

      if (PHRASING.has(node.tagName)) {
        push(node)
        continue
      }

      walk(node.children)
      gap = true
    }
  }

  walk(nodes)
  return out
}

const leadingSpace = (value: string): string =>
  value.length === 0 || /^\s/.test(value) ? value : ` ${value}`
