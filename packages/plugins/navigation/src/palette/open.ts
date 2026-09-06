/** Static palette service consumers. Importing this module starts no UI state;
 * navigation installs a fresh state circuit for its activation. */
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
