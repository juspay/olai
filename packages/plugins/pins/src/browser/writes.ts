import type { Undo } from "@olai/edit-history/undoing.ts"
import type { Said } from "@olai/web/client/saying.ts"
import type { Pin } from "./pins.ts"
import { heldWrites } from "@olai/web/client/writes.ts"

export const { holdEdits, writeEdit, applying, applyingAll, applied } = heldWrites()


export const togglePin = async (
  at: string,
  already: Pick<Pin, "id"> | undefined,
  record: Undo["record"],
): Promise<Said | undefined> =>
  already === undefined
    ? applying({ verb: "pin", at }, record)
    : applying({ verb: "trash", id: already.id }, record)
