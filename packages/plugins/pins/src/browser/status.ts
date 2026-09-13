/** The status line for shelf remove/reorder gestures.
 * The pins activation acquires this line and releases its timer and owner
 * on withdrawal. Palette commands use the palette's own status line. */
import { type Accessor,createRoot } from "solid-js"

import type { Said } from "@olai/web/client/saying.ts"
import { createSaying } from "@olai/web/client/saying.ts"

let line: ReturnType<typeof createSaying> | undefined
export function scopePinSaid():()=>void {
 return createRoot(dispose=>{const value=createSaying();line=value;return ()=>{if(line===value)line=undefined;dispose()}})
}

/** What the last pin gesture had to say — drawn under the header, beside what
 *  ⌘Z has to say, because both are gestures with no row of their own. */
export const pinSaid: Accessor<Said | null> = () => line?.said() ?? null

/** Say it, for the dwell every said-line in this client keeps. */
export const sayPin = (message: Said | null | void): void => line?.say(message)

