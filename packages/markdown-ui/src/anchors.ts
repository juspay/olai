import type { Element } from "hast"
import type { Options as AutolinkOptions } from "rehype-autolink-headings"

/** The class the anchor carries — the one value ./sanitise.ts admits, the hook
 *  `styles.css` draws it by, and what {@link textOf} skips. One spelling, so
 *  those three cannot disagree. */
export const ANCHOR_CLASS = "olai-md-anchor"

export const AUTOLINK: AutolinkOptions = {
  behavior: "append",
  content: { type: "text", value: "#" },
  properties: (heading) => ({
    className: [ANCHOR_CLASS],
    // Read BEFORE this anchor exists, so the label is the heading and not the
    // heading plus a hash.
    ariaLabel: `Link to “${textOf(heading)}”`,
  }),
}

export const textOf = (element: Element): string => read(element).replace(/\s+/g, " ").trim()

const read = (element: Element): string => {
  let text = ""
  for (const child of element.children) {
    if (child.type === "text") text += child.value
    else if (child.type === "element" && !isAnchor(child)) text += read(child)
  }
  return text
}

/** True when this element is the heading autolink — HAST `className` is an
 *  array, so a string `.includes` on it would be the wrong check. */
export const isAnchor = (element: Element): boolean => {
  const classes = element.properties?.["className"]
  return Array.isArray(classes) && classes.includes(ANCHOR_CLASS)
}
