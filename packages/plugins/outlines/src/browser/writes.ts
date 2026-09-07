/**
 * WHERE A ROW'S OWN WRITES GO — every verb the outline owns, which is most of
 * them: a title, a mark, a date, a move, a split, a mirror, a trash.
 *
 * `writeEdit` has a second caller here that the other rows have no use for:
 * the editor sends through it and reserves its place on the undo stack while
 * the write is still in flight (`./edit/editing.tsx`), so it needs the promise
 * before it is awaited rather than the sentence afterwards.
 *
 * The app's edit table says which row writes which verb, and this is THIS
 * row's hold on it: `../browser.tsx` names `Edits`, claims the verbs above,
 * and holds the table here, so what the faces below spend is this activation's
 * hold and no other's. `@olai/web`'s `heldWrites` carries the design — why a
 * factory, why the send resolves per call, and what a row holding nothing
 * answers with.
 */
import { heldWrites } from "@olai/web/client/writes.ts"

/** Told by `../browser.tsx`, for that activation — and spent by its faces. */
export const { holdEdits, writeEdit, applying, applyingAll, applied } = heldWrites()
