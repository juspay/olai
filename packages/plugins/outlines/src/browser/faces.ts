/**
 * WHAT OTHER PLUGINS HUNG ON A ROW, as the outline reads it — the door on a
 * row, the verbs on its `•••`, and the dressing a contributed kind wears.
 *
 * Held by the `content` component, which is the one activation that draws any
 * of them: every one of these reads happens inside the page that component
 * contributes, so the hold precedes the drawing and leaves with it.
 *
 * Private to this package, for `olai-plugin-layout`'s `faces.ts` reason.
 */
import { heldFaces } from "@olai/plugin-api"

export const { hold: holdFaces, hung, dressed } = heldFaces()
