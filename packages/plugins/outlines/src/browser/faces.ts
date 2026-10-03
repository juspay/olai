/**
 * WHAT OTHER PLUGINS HUNG ON A ROW, as the outline reads it — the door on a
 * row, the verbs on its `•••`, and the dressing a contributed kind wears.
 *
 * Held by the `content` component, which is the one activation that draws any
 * of them: every one of these reads happens inside the page that component
 * contributes, so the hold precedes the drawing and leaves with it.
 *
 * Private to this package, for `olai-plugin-layout`'s `faces.ts` reason.
 */
import type {} from "../slots.ts"
import { Effect } from "effect"
import { createMemo, createRoot } from "solid-js"
import { heldService } from "@olai/ui-primitives/held.ts"
import { sameList } from "@olai/web/client/same.ts"
import { type Faces, heldFaces } from "@olai/plugin-api"

const faces = heldFaces()
export const { hung, dressed } = faces
const createLists = () => ({
  asides: createMemo(() => hung("outline.row.aside"), undefined, { equals: sameList }),
  folds: createMemo(() => hung("outline.row.fold"), undefined, { equals: sameList }),
  heads: createMemo(() => hung("outline.page.head"), undefined, { equals: sameList }),
  feet: createMemo(() => hung("outline.page.foot"), undefined, { equals: sameList }),
})
const lists = heldService<ReturnType<typeof createLists>>()
export const holdFaces = (value: Faces) => Effect.gen(function*() {
  yield* faces.hold(value)
  yield* Effect.acquireRelease(Effect.sync(() => createRoot(dispose => {
    const release = lists.hold(createLists())
    return () => { release(); dispose() }
  })), stop => Effect.sync(stop))
})
export const rowAsides = () => lists.read()?.asides() ?? []
export const rowFolds = () => lists.read()?.folds() ?? []
export const pageHeads = () => lists.read()?.heads() ?? []
export const pageFeet = () => lists.read()?.feet() ?? []
