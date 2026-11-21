/**
 * `file.page`, READ AS FILE PAGES — what `./PageView.tsx` dispatches a file
 * address over, beside what `navigation.pages` holds.
 *
 * A plugin's `file.page` face is the page for the kind its server half claimed
 * with `FileKinds`, and that kind's word is the plugin's own name (the claim is
 * stamped), so the face is keyed `{ kind: <plugin> }` and `forFileClaim` chooses
 * it for that kind over the general drawing for what such a file holds. It
 * never edits: a plugin that wants an editor draws one.
 *
 * ONE PAGE PER REGISTRATION, for as long as it stands ({@link filePagesOver}).
 * The reading moves whenever any face in the tab arrives or leaves, and
 * `./PageView.tsx` draws the chosen page through a keyed `<Show>`: a page minted
 * afresh per reading would be the open file drawn again from nothing each time
 * some other plugin hung a chip.
 *
 * SETTLED WHERE THE FACES ARE HELD: `./browser.tsx`'s `renderer` component
 * holds the faces and, in its own root, settles them into pages held in
 * `./pages.ts`, as it settles `app.route`. `./PageView.tsx` reads that tracked
 * holder, so the pages exist exactly while that component stands.
 *
 * No JSX here, so a test at the root reads it; the drawing is the caller's
 * (`draw`), which is where the file's revision is read.
 */
import type { Address } from "@olai/format"
import type { Hung } from "@olai/plugin-api"
import { type Accessor, type JSX, mapArray } from "solid-js"

import type { FilePage } from "./index.ts"
import type { FilePageFace } from "./slots.ts"

type Draw = (face: FilePageFace, file: string) => JSX.Element

const pageOf = ({ plugin, face }: Hung<FilePageFace>, draw: Draw): FilePage => ({
  by: { kind: plugin },
  edits: false,
  page: (address: Address) => draw(face, "path" in address ? address.path : ""),
})

/**
 * THE PAGES OVER A READING THAT MOVES, keeping each registration's page: a
 * registration is the object the slot table holds for as long as the face is
 * hung, so the same object is the same page, and a new one is a new page.
 * Solid's `mapArray` keeps one mapped value per source object, which is that
 * rule; it is made in the owner of the root that calls it.
 */
export const filePagesOver = (read: Accessor<ReadonlyArray<Hung<FilePageFace>>>, draw: Draw): Accessor<ReadonlyArray<FilePage>> =>
  mapArray(read, (one) => pageOf(one, draw))
