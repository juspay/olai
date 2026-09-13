/** Page pin toggles and the status line for shelf remove/reorder gestures.
 * The pins activation acquires this line and releases its timer and owner
 * on withdrawal. Palette commands use the palette's own status line. */
import { type Accessor,createRoot } from "solid-js"

import type { Undo } from "@olai/edit-history/undoing.ts"
import type { Said } from "@olai/web/client/saying.ts"
import { createSaying } from "@olai/web/client/saying.ts"
import { applying } from "./writes.ts"
import type { Route } from "olai-plugin-navigation/routes"
import type { Routing } from "olai-plugin-navigation/routes"
import type { Pin } from "./pins.ts"

let line: ReturnType<typeof createSaying> | undefined
export function scopePinSaid():()=>void {
 return createRoot(dispose=>{const value=createSaying();line=value;return ()=>{if(line===value)line=undefined;dispose()}})
}

/** What the last pin gesture had to say — drawn under the header, beside what
 *  ⌘Z has to say, because both are gestures with no row of their own. */
export const pinSaid: Accessor<Said | null> = () => line?.said() ?? null

/** Say it, for the dwell every said-line in this client keeps. */
export const sayPin = (message: Said | null | void): void => line?.say(message)

/** The caller resolves the existing pin once for its label and this write. */
export const togglePin = async (
  routes: Routing,
  route: Route,
  already: Pin | undefined,
  record: Undo["record"],
): Promise<Said | undefined> =>
  already === undefined
    ? applying({ verb: "pin", at: routes.href(route) }, record)
    : applying({ verb: "trash", id: already.id }, record)
