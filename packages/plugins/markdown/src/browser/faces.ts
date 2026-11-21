/**
 * WHAT OTHER PLUGINS HUNG ON A NOTE'S PAGE — `document.page.head` and
 * `document.page.foot` (`../slots.ts`), as this row reads them.
 *
 * Private to this package, for `olai-plugin-outlines`' `faces.ts` reason: what
 * is shared is the algorithm (`heldFaces`), not this holder. The hold is taken
 * by `../browser.tsx`'s `content` component, which contributes the page and
 * declares the seats, and is released when it stops.
 */
import type {} from "../slots.ts"
import { heldFaces } from "@olai/plugin-api"

const faces = heldFaces()

export const holdNoteFaces = faces.hold
export const noteHeads = () => faces.hung("document.page.head")
export const noteFeet = () => faces.hung("document.page.foot")
