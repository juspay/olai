/**
 * THE PALETTE'S OPEN STATE — this row's own, and PRIVATE to this package.
 *
 * It was `./open.ts`, a declared contract (`olai-plugin-navigation/palette-open`)
 * carrying a module variable: `olai-plugin-pins` asked a question in the palette
 * through it and `olai-plugin-search` opened one, both across a package wall
 * with no dependency declared anywhere (the audit's §12).
 *
 * The verbs travel on `navigation.palette` now — a service `../browser.tsx`
 * offers and each of those rows declares on the component that draws. What is
 * left here is this row's own hold, installed by the same activation that
 * offers the service, so what the palette reads and what a sibling row is
 * handed cannot be two different states.
 */
import type {Asking} from "./asking.ts"
export type Opened={readonly kind:"closed"}|{readonly kind:"open";readonly asking:Asking|null}
export const CLOSED:Opened={kind:"closed"}
export const LISTING:Opened={kind:"open",asking:null}
export interface PaletteState {
 readonly open:()=>boolean;readonly asking:()=>Asking|null
 readonly set:(value:Opened|((before:Opened)=>Opened))=>void
}
let state:PaletteState|undefined
export function holdPaletteState(value:PaletteState):()=>void {state=value;return()=>{if(state===value)state=undefined}}
export const paletteOpen=():boolean=>state?.open()??false
export const paletteAsking=():Asking|null=>state?.asking()??null
export const openPalette=():void=>state?.set(LISTING)
export const askInPalette=(asking:Asking):void=>state?.set({kind:"open",asking})
export const dropQuestion=():void=>state?.set(it=>it.kind==="closed"?it:LISTING)
export const closePalette=():void=>state?.set(CLOSED)
