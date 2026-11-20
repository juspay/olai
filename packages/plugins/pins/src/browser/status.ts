import { type Accessor,createRoot } from "solid-js"

import type { Said } from "@olai/web/client/saying.ts"
import { createSaying } from "@olai/web/client/saying.ts"

let line: ReturnType<typeof createSaying> | undefined
export function scopePinSaid():()=>void {
 return createRoot(dispose=>{const value=createSaying();line=value;return ()=>{if(line===value)line=undefined;dispose()}})
}

export const pinSaid: Accessor<Said | null> = () => line?.said() ?? null

export const sayPin = (message: Said | null | void): void => line?.say(message)

