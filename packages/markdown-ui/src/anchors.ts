import type { Element } from "hast"
import type { Options as AutolinkOptions } from "rehype-autolink-headings"

export const ANCHOR_CLASS = "olai-md-anchor"

export const AUTOLINK: AutolinkOptions = {
  behavior: "append",
  content: { type: "text", value: "#" },
  properties: (heading) => ({
    className: [ANCHOR_CLASS],
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

export const isAnchor = (element: Element): boolean => {
  const classes = element.properties?.["className"]
  return Array.isArray(classes) && classes.includes(ANCHOR_CLASS)
}
