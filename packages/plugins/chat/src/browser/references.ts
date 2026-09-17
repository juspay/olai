/**
 * THE OUTLINE'S NAMING OF A NODE, as this panel reads it — held for the
 * activation that declared it.
 *
 * The panel authors references: a chip on an armed message, a node an olai
 * write was about, and the line saying which ids the outline could not name.
 * Every one of those readings is `olai-plugin-outlines`', and it arrives as
 * `outlines.references` — a service `../browser.tsx`'s `references` component
 * names, rather than a module signal in the outline's own contract door, which
 * is what it was.
 *
 * THE PANEL DOES NOT WAIT FOR IT. A component of its own is the whole point:
 * with no outline row mounted the transcript, the composer and the roster keep
 * working and the chips draw the ids they carry, which is the absent arm
 * `olai-plugin-outlines/references` has always had. A `needs` on the row itself
 * would have taken the conversation away with the outline.
 */
import { heldService } from "@olai/ui-primitives/held.ts"
import {
  declaredFrom,
  failureFrom,
  showNodeFrom,
  type Declared,
  type References,
} from "olai-plugin-outlines/references"

const provider = heldService<References>()

/** Told by `../browser.tsx`'s `references` component, for that activation. */
export const holdReferences = provider.hold

/** One declaration, over whichever outline is mounted. */
export const createDeclared = (
  failure?: (message: string, ids: ReadonlyArray<string>) => void,
): Declared => declaredFrom(provider.read, failure)

/** ...the press that shows a node on the page the reader already has. */
export const useShowNode = (): ((id: string) => void) => showNodeFrom(provider.read)

/** ...and what the outline could not name. */
export const declaringFailure = failureFrom(provider.read)

export const focusedNode = () => provider.read()?.focused() ?? null
