/**
 * THE PLUGINS' OWN PAGES, as this row reads them: what each plugin hung in
 * `plugin.page` (`../slots.ts`).
 *
 * PRIVATE TO THIS PACKAGE, for `olai-plugin-plugin-inspector`'s `faces.ts`
 * reason: what is shared is the algorithm (`heldFaces`), not this holder. The
 * hold is taken by `../browser.tsx`'s `page` component, the one that draws
 * these pages and declares the seat, and is released when it stops.
 */
import { heldFaces } from "@olai/plugin-api"
import type { PluginPageFace } from "../slots.ts"

const faces = heldFaces()

export const holdOwnPages = faces.hold

/** The page the plugin named `word` hung, or nothing. Keyed by the plugin's
 *  own name, which `Slots` stamps, so a plugin can fill only its own. */
export const ownPageOf = (word: string): PluginPageFace | undefined =>
  faces.hung("plugin.page").find((one) => one.plugin === word)?.face
