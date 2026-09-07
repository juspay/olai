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
 * `../browser.tsx` names the key and holds the table here; the faces below it
 * import these three rather than `@olai/web/client/writes.ts`'s, which are the
 * same algorithm over a writer HANDED IN.
 *
 * PER CALL, so a row that stopped and came back writes through the table it is
 * holding now — and a face drawn with nothing held refuses in the words a verb
 * whose provider left already got, rather than throwing inside a click.
 */
import { NO_EDITS, type EditWriters } from "@olai/plugin-api"
import { heldService } from "@olai/ui-primitives/held.ts"
import { type EditWriter, writingWith } from "@olai/web/client/writes.ts"

const table = heldService<EditWriters>()

/** Told by `../browser.tsx`, for that activation. */
export const holdEdits = table.hold

/** THE SEND, over whichever table this row is holding. `Edits` is spelled
 *  structurally in `@olai/plugin-api` (that package may not import
 *  `@olai/surface`), so the one cast is here — the reading end — and everything
 *  built on it below is typed. */
export const writeEdit = ((edit) => (table.read() ?? NO_EDITS).write(edit)) as EditWriter

export const { applying, applyingAll, applied } = writingWith(writeEdit)
