/**
 * WHAT OTHER PLUGINS HUNG, as the sidebar reads it — its sections and its
 * directory entries, off {@link Faces} rather than off the tab's own runtime.
 *
 * Private to this package, for `olai-plugin-layout`'s `faces.ts` reason: the
 * algorithm is shared through a factory in the plugin API, the holder is not
 * shared at all.
 */
import { heldFaces } from "@olai/plugin-api"

export const { hold: holdFaces, hung } = heldFaces()
