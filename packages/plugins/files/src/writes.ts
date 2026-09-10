/**
 * WHERE A FILE'S WRITES GO — `outlineNew` and `fileDelete`: minting a file and
 * removing one, which are this row's and not the outline's.
 *
 * The app's edit table says which row writes which verb, and this is THIS
 * row's hold on it: `../browser.tsx` names `Edits`, claims the verbs above,
 * and holds the table here, so what the faces below spend is this activation's
 * hold and no other's. `@olai/web`'s `heldWrites` carries the design — why a
 * factory, why the send resolves per call, and what a row holding nothing
 * answers with.
 */
import { heldWrites } from "@olai/web/client/writes.ts"

/** Told by `./browser.tsx`, for that activation — and spent by its faces. */
export const { holdEdits, writeEdit, applying, applyingAll, applied } = heldWrites()
