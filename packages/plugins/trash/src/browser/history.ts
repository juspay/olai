import type { Undo } from "@olai/edit-history/undoing.ts"
let held: Undo | undefined
export const useTrashUndo = (): Undo => {
 if(held===undefined) throw new Error("trash history is not active")
 return held
}
export function holdTrashUndo(value:Undo):()=>void {held=value;return ()=>{if(held===value)held=undefined}}
