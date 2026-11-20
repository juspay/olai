import type { Element } from "hast"

import { textOf } from "./anchors.ts"

export interface Heading {
  readonly depth: number
  readonly id: string
  readonly text: string
  readonly route?: string
}

export const headingOf = (element: Element): Heading | null => {
  const tag = element.tagName
  if (tag.length !== 2 || tag[0] !== "h") return null
  const depth = Number(tag[1])
  if (!(depth >= 1 && depth <= 6)) return null

  const id = element.properties?.["id"]
  if (typeof id !== "string" || id === "") return null
  return { depth, id, text: textOf(element) }
}
