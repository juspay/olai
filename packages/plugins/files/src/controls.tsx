/** Static service consumers: actual controls arrive from files' activation. */
import { createSignal,Show } from "solid-js";
import type { FileControls } from "./contract.ts";
const [controls,setControls]=createSignal<FileControls>()
export function holdFileControls(value:FileControls):()=>void {
 setControls(value);return ()=>{if(controls()===value)setControls(undefined)}
}
export function DeleteFile(props:{readonly file:string}) {
 return <Show when={controls()?.Delete} keyed>{Control=><Control {...props}/>}</Show>
}
export function NewFile(props:Parameters<FileControls["New"]>[0]) {
 return <Show when={controls()?.New} keyed>{Control=><Control {...props}/>}</Show>
}
