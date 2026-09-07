/**
 * WHERE A CAPTURE'S WRITE GOES — `capture`, this row's one verb: a line into
 * the directory's inbox from wherever the reader was.
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
