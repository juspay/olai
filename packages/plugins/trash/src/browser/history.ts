import type { Undo } from "@olai/edit-history/undoing.ts"
import { heldService } from "@olai/ui-primitives/held.ts"
const held = heldService<Undo>()
export const useTrashUndo = (): Undo => {
 const value = held.read()
 if (value === undefined) throw new Error("trash history is not active")
 return value
}
export const holdTrashUndo = held.hold
