/**
 * Force a rendered markdown tree down to phrasing content only.
 *
 * A title sits on a tree row's baseline. A heading, a list or a fenced block
 * that escaped into that row would grow it into a multi-line layout, so anything
 * block-shaped is unwrapped to the phrasing it contains (a fence becomes its
 * `<code>`, a heading becomes its words) and pure structure (`hr`, empty
 * wrappers) is dropped. The words stay; the boxes do not.
 *
 * This is a walk over the finished HAST, not a second parser: the pipeline in
 * ./render.ts has already sanitised and highlighted, and this only rearranges
 * what it produced.
 */

import type { ElementContent, Root, RootContent } from "hast"

/**
 * HTML phrasing content — the tags a title may still carry after a block is
 * unwrapped. Kept as a set rather than "everything that is not a block" so an
 * unknown tag the sanitiser let through cannot reintroduce a box.
 */
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
  // img is NOT phrasing for titles: a local picture would grow the row to
  // image height, undoing the whole point of this walk. Dropped by lifting
  // its (empty) children. Notes still draw images — they use the block path.
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

/** Replace the root's children with the phrasing content of the whole tree. */
export const toInline = (tree: Root): void => {
  tree.children = phrasingOf(tree.children)
}

const phrasingOf = (
  nodes: ReadonlyArray<RootContent | ElementContent>,
): ElementContent[] => {
  const out: ElementContent[] = []
  // True after a block closed: the next bit of content needs a space so
  // "foo\n\nbar" becomes "foo bar" rather than "foobar".
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

      // Block (or unknown structure): lift its children, then open a gap.
      walk(node.children)
      gap = true
    }
  }

  walk(nodes)
  return out
}

/** Guarantee a leading space without doubling one the text already has. */
const leadingSpace = (value: string): string =>
  value.length === 0 || /^\s/.test(value) ? value : ` ${value}`
