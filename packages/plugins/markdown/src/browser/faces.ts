/**
 * WHAT OTHER PLUGINS HUNG ON A NOTE'S PAGE — `document.page.head`,
 * `document.page.foot` and `document.block` (`../slots.ts`), as this row reads
 * them.
 *
 * Private to this package, for `olai-plugin-outlines`' `faces.ts` reason: what
 * is shared is the algorithm (`heldFaces`), not this holder. The hold is taken
 * by `../browser.tsx`'s `content` component, which contributes the page and
 * declares the seats, and is released when it stops.
 */
import type { DocumentBlockFace } from "../slots.ts"
import { heldFaces } from "@olai/plugin-api"

const faces = heldFaces()

export const holdNoteFaces = faces.hold
export const noteHeads = () => faces.hung("document.page.head")
export const noteFeet = () => faces.hung("document.page.foot")

/** Each plugin's fence drawing, by the language it claims: its own name. */
export const noteBlocks = (): ReadonlyMap<string, DocumentBlockFace> =>
  new Map(faces.hung("document.block").map((one) => [one.plugin, one.face]))

/** Whether two readings of {@link noteBlocks} hand the same drawing to every
 *  language — the table moves whenever any face in the tab arrives or leaves,
 *  and a fence's drawing is mounted again only when its own does. */
export const sameBlocks = (a: ReadonlyMap<string, DocumentBlockFace>, b: ReadonlyMap<string, DocumentBlockFace>): boolean =>
  a.size === b.size && [...a].every(([language, face]) => b.get(language) === face)
