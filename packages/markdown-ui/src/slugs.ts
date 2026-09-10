/**
 * THE ID ON A HEADING, from the format's own rule.
 *
 * A rehype plugin, and it exists to replace `rehype-slug` for one reason: two
 * things have to agree about what a heading is called and they run in different
 * processes. The FACE says which headings a document has — `README.md#install`
 * is an address, and the set is what says whether it names anything
 * (`@olai/format`'s `Document`) — and this puts the id on the `<h2>` a reader
 * lands at. A slug spelled twice is an address this app writes and cannot open,
 * which is the class of bug the address grammar was centralised to end.
 *
 * So the SPELLING is the format's (`slugOf`) and the COUNTER is too (`claim`,
 * which is what makes the second `## Notes` on a page `notes-1`). What is left
 * here is the walk of the tree, which is the one thing the format cannot do:
 * it holds no markdown parser, deliberately, because it is the floor the write
 * gate stands on.
 *
 * WHAT THE TWO STILL DECIDE SEPARATELY is which lines are headings and what
 * their text is: this reads a parsed tree and the face reads lines
 * (`@olai/format`'s `slug.ts` says what that costs). The gap is measured
 * rather than assumed — ./slugs.test.ts renders the fixture vault through the
 * real pipeline and holds the ids it produces to the list the face promises.
 *
 * A HEADING THAT ALREADY HAS AN ID keeps it, which is `rehype-slug`'s own rule
 * and the seam an explicit `## Install {#setup}` will arrive through when the
 * design's later evolution lands.
 */

import { claim, type Slug, slugOf } from "@olai/format"
import type { Element, Root } from "hast"

import { textOf } from "./anchors.ts"

/** The six elements a heading can be. A `Set` rather than a regex, because
 *  this is asked of every element of every rendered body. */
const HEADINGS = new Set(["h1", "h2", "h3", "h4", "h5", "h6"])

/**
 * Give every heading an id, in document order.
 *
 * The counter is per DOCUMENT — one `Map` per run — which is what makes two
 * headings with the same words two addresses rather than one.
 */
export const rehypeSlugs = () => (tree: Root): void => {
  const seen = new Map<string, number>()
  walk(tree, (element) => {
    if (!HEADINGS.has(element.tagName)) return
    const properties = element.properties ?? (element.properties = {})
    if (typeof properties["id"] === "string" && properties["id"] !== "") return
    const slug: Slug = slugOf(textOf(element))
    // A heading whose words slug to nothing is left WITHOUT an id, which is the
    // face's own answer about it: an empty slug is an address nobody can write
    // down, and inventing `section-3` for it would be an identity that moves
    // when a heading above it is added.
    if (slug === "") return
    properties["id"] = claim(seen, slug)
  })
}

/** Every element under a node, in document order — the smallest walk that does
 *  the job, rather than a dependency on `unist-util-visit` for eight lines. */
const walk = (node: Root | Element, visit: (element: Element) => void): void => {
  for (const child of node.children) {
    if (child.type !== "element") continue
    visit(child)
    walk(child, visit)
  }
}
