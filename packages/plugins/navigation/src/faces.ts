/**
 * WHAT OTHER PLUGINS HUNG, as navigation reads it — the routes a plugin claims
 * a URL grammar with, the palette's rows and the verbs behind its prefixes.
 *
 * Private to this package, for `olai-plugin-layout`'s `faces.ts` reason. Both
 * readers are held by COMPONENTS rather than by the row: history and focus
 * activate without a renderer (`./browser.tsx`'s header), and a row that named
 * {@link Faces} would start waiting for one.
 */
import { heldFaces } from "@olai/plugin-api"

export const { hold: holdFaces, hung } = heldFaces()
