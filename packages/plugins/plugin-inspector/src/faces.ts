/**
 * WHAT OTHER PLUGINS HUNG ON THIS PANEL'S ROWS, as the inspector reads it.
 *
 * PRIVATE TO THIS PACKAGE, and that is the load-bearing half: this module is
 * behind no declared contract, so the value cannot become a second undeclared
 * cross-package path to the renderer's table. What is shared is the ALGORITHM
 * (`@olai/plugin-api`'s `heldFaces`, a factory); what is not shared is this
 * holder. `olai-plugin-layout`'s `faces.ts` argues the same thing one package
 * over.
 *
 * ONE HOLDER, ONE CONSUMER, ONE LIFETIME. The panel's rows are drawn by exactly
 * one component — `./browser.tsx`'s `tools` — so it is that component which
 * names {@link Faces} in its `needs` and holds the table, and a tab with no
 * renderer draws no rows rather than a row whose faces silently answer nothing.
 * The hold is released when that component stops, which is the same moment the
 * panel it draws goes: nothing here outlives the surface it was read for, and
 * nothing here reaches across an activation the way a module-level table would.
 *
 * A face that arrives WHILE the panel is open is drawn, because this reading is
 * the renderer's table read through its change signal — the reader below is
 * called from a tracked memo (`./Panel.tsx`'s `rowFaces`) and from the row's
 * own drawing, never once at construction.
 */
import { heldFaces } from "@olai/plugin-api"
import type { PluginsRowFace } from "./slots.ts"

const faces = heldFaces()

/** THE HOLD `./browser.tsx`'s `tools` takes, and the only writer this module
 *  has — the reading below is the only reader. */
export const holdRowFaces = faces.hold

/** THE PANEL'S OWN READING: one face per contributing plugin, keyed by the
 *  plugin that hung it — the same word the roster's rows are keyed by, so a row
 *  finds its face by the name it already draws. A plugin that hung none is
 *  simply absent, and the two readers (`./Panel.tsx`'s grouping and its row)
 *  both say so the same way. */
export const rowFaces = (): ReadonlyMap<string, PluginsRowFace> =>
  new Map(faces.hung("plugins.row").map((one) => [one.plugin, one.face]))
