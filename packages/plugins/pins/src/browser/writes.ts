/**
 * WHERE THIS ROW'S WRITES GO — the app's routing table, held for the activation
 * that declared it.
 *
 * A write follows the capability that owns its verb, and the table that says
 * which is the APP's (`@olai/plugin-api`'s `Edits`, supplied by `openApp`). It
 * used to be a `const writers = new Map()` at `@olai/edit-history`'s module
 * scope: five plugin activations wrote into it and four packages read it, with
 * nothing declared anywhere — the audit's §12, and the reason this file exists.
 *
 * `../browser.tsx` names the key and holds the table HERE, in this row's own
 * holder — which is the whole of what this file is. The algorithm over it is
 * one factory's (`@olai/web/client/writes.ts`'s `heldWrites`), because six rows
 * wanted the same ten lines and only differed in which activation holds the
 * table; the faces of this row import these from here rather than from that
 * door, so what they spend is this row's hold and no other's.
 */
import { heldWrites } from "@olai/web/client/writes.ts"

/** Told by `../browser.tsx`, for that activation — and spent by its faces. */
export const { holdEdits, writeEdit, applying, applyingAll, applied } = heldWrites()
