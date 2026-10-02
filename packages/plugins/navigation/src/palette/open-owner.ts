import {createMemo,createRoot,createSignal} from "solid-js"
import {CLOSED,holdPaletteState,type Opened} from "./state.ts"
export function scopePaletteState():()=>void {
 return createRoot(dispose=>{
  const [opened,setOpened]=createSignal<Opened>(CLOSED)
  const stop=holdPaletteState({open:createMemo(()=>opened().kind!=="closed"),
   asking:createMemo(()=>{const it=opened();return it.kind==="closed"?null:it.asking}),
   at:createMemo(()=>{const it=opened();return it.kind==="closed"?null:it.at??null}),set:setOpened})
  return ()=>{stop();dispose()}
 })
}
