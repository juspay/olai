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
import { type Accessor, createMemo } from "solid-js"
import {
  declaredFrom,
  failureFrom,
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

/** ...and what the outline could not name. */
export const declaringFailure = failureFrom(provider.read)

/**
 * WHICH OUTLINE A NODE LIVES IN — owned by the caller, re-asked when an
 * outline arrives or leaves, `null` until it answers and for an id nothing
 * declares.
 *
 * One reader: the head of a chat's own page, which says where its item is
 * and has only an id to say it from when the chat roster has no row for that
 * node yet (`./agents/ChatPage.tsx`). The row carries the file once there is
 * a chat, so this is asked for exactly the frames before one.
 */
export const createHome = (id: Accessor<string | null>): Accessor<string | null> => {
  const reading = createMemo(() => {
    const node = id()
    const outline = provider.read()
    return node === null || outline === undefined ? undefined : outline.home(node)
  })
  return () => {
    const answer = reading()?.()
    return typeof answer === "string" ? answer : null
  }
}

export const focusedNode = () => provider.read()?.focused() ?? null
