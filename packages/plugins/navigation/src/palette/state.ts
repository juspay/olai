import type {Asking} from "./asking.ts"
export interface OpenAt {readonly path:ReadonlyArray<string>;readonly text?:string}
export type Opened={readonly kind:"closed"}|{readonly kind:"open";readonly asking:Asking|null;readonly at?:OpenAt}
export const CLOSED:Opened={kind:"closed"}
export const LISTING:Opened={kind:"open",asking:null}
export interface PaletteState {
 readonly open:()=>boolean;readonly asking:()=>Asking|null;readonly at:()=>OpenAt|null
 readonly set:(value:Opened|((before:Opened)=>Opened))=>void
}
let state:PaletteState|undefined
export function holdPaletteState(value:PaletteState):()=>void {state=value;return()=>{if(state===value)state=undefined}}
export const paletteOpen=():boolean=>state?.open()??false
export const paletteAsking=():Asking|null=>state?.asking()??null
export const paletteAt=():OpenAt|null=>state?.at()??null
export const openPalette=():void=>state?.set(LISTING)
export const openPaletteAt=(path:ReadonlyArray<string>,text?:string):void=>
 state?.set({kind:"open",asking:null,at:text===undefined?{path:[...path]}:{path:[...path],text}})
export const askInPalette=(asking:Asking):void=>state?.set({kind:"open",asking})
export const dropQuestion=():void=>state?.set(it=>it.kind==="closed"?it:LISTING)
export const closePalette=():void=>state?.set(CLOSED)
