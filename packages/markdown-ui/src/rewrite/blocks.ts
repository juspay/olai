/**
 * A FENCE SOMEBODY CLAIMED IS A PLACE THE PAGE MOUNTS THEIR DRAWING.
 *
 * A caller hands the render the languages it has a drawing for (`../
 * Markdown.tsx`'s `blocks`, which only the document page fills). A fence in one
 * of those languages becomes a placeholder, `<div data-olai-block="<language>">`,
 * holding the fence's text as a plain code block: what a reader sees until the
 * drawing is mounted into it, and what the drawing is handed.
 *
 * Made HERE, after the sanitiser, like every other element this walk writes:
 * the sanitiser's allowlist does not grow by an attribute, so a placeholder
 * somebody wrote into a note never survives to be mistaken for one, and the
 * text is a text node, escaped when the tree becomes HTML. The fence's own
 * markup — the highlighter's spans, its language class — is dropped; only its
 * text is kept.
 *
 * Any other fence is left exactly as it was drawn.
 */
import type { Element, ElementContent } from "hast"

/** The attribute a placeholder carries, naming the language it was claimed by. */
export const BLOCK_ATTRIBUTE = "data-olai-block"

/** The language of a `<pre><code class="language-…">` fence, if one of these
 *  claims it. */
export const claimedLanguage = (element: Element, blocks: ReadonlySet<string>): string | undefined => {
  if (element.tagName !== "pre") return undefined
  const code = element.children.find((child): child is Element => child.type === "element" && child.tagName === "code")
  const classes = code?.properties["className"]
  if (!Array.isArray(classes)) return undefined
  for (const one of classes) {
    if (typeof one !== "string" || !one.startsWith("language-")) continue
    const language = one.slice("language-".length)
    if (blocks.has(language)) return language
  }
  return undefined
}

/** Turn a claimed fence into its placeholder, in place. The text is the
 *  fence's as written: the line break the parser closes a fence's code with
 *  is not part of it. */
export const toPlaceholder = (pre: Element, language: string): void => {
  const text = textOf(pre).replace(/\n$/, "")
  pre.tagName = "div"
  pre.properties = { dataOlaiBlock: language }
  pre.children = [{
    type: "element",
    tagName: "pre",
    properties: {},
    children: [{ type: "element", tagName: "code", properties: {}, children: [{ type: "text", value: text }] }],
  }]
}

const textOf = (element: Element): string =>
  element.children.map((child: ElementContent) =>
    child.type === "text" ? child.value : child.type === "element" ? textOf(child) : "",
  ).join("")
