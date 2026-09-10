/** Outlines owns this activation's undo stack. The serial replay algorithm is static. */
import { createContext, useContext } from "solid-js"
import type { Undo } from "@olai/edit-history/undoing.ts"
export { createUndo, type Undo, type Apply } from "@olai/edit-history/undoing.ts"
export const UndoContext = createContext<Undo>()
let ownedUndo: Undo | undefined
export const useUndo = (): Undo => {
 const undo = useContext(UndoContext) ?? ownedUndo
 if (undo === undefined) throw new Error("outlines history is unavailable")
 return undo
}
export const holdUndo = (value: Undo): (() => void) => {
 ownedUndo = value
 return () => { if (ownedUndo === value) ownedUndo = undefined }
}
