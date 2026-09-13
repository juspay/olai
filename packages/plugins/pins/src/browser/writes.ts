/**
 * WHERE A PIN'S WRITE GOES — `pin`, this row's one verb. The outline's `•••`
 * spends it too, and is refused in the ops layer's own words when this row is
 * not mounted, which is what `a_door_leaves_with_its_row.feature` holds.
 *
 * The app's edit table says which row writes which verb, and this is THIS
 * row's hold on it: `../browser.tsx` names `Edits`, claims the verbs above,
 * and holds the table here, so what the faces below spend is this activation's
 * hold and no other's. `@olai/web`'s `heldWrites` carries the design — why a
 * factory, why the send resolves per call, and what a row holding nothing
 * answers with.
 */
import type { Undo } from "@olai/edit-history/undoing.ts"
import type { Said } from "@olai/web/client/saying.ts"
import type { Pin } from "./pins.ts"
import { heldWrites } from "@olai/web/client/writes.ts"

/** Told by `../browser.tsx`, for that activation — and spent by its faces. */
export const { holdEdits, writeEdit, applying, applyingAll, applied } = heldWrites()


/** The caller resolves the existing pin once for its label and this write. */
export const togglePin = async (
  at: string,
  already: Pick<Pin, "id"> | undefined,
  record: Undo["record"],
): Promise<Said | undefined> =>
  already === undefined
    ? applying({ verb: "pin", at }, record)
    : applying({ verb: "trash", id: already.id }, record)
