import type { Undo } from "@olai/edit-history/undoing.ts"
let held: Undo | undefined
export const usePinUndo = (): Undo => {
 if(held===undefined) throw new Error("pins history is not active")
 return held
}
export function holdPinUndo(value:Undo):()=>void {held=value;return ()=>{if(held===value)held=undefined}}
