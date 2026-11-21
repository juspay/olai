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
 * No JSX here, so a test at the root reads it; the drawing is the caller's
 * (`draw`), which is where the file's revision is read.
 */
import type { Address } from "@olai/format"
import type { Hung } from "@olai/plugin-api"
import type { JSX } from "solid-js"

import type { FilePage } from "./index.ts"
import type { FilePageFace } from "./slots.ts"

type Draw = (face: FilePageFace, file: string) => JSX.Element

const pageOf = ({ plugin, face }: Hung<FilePageFace>, draw: Draw): FilePage => ({
  by: { kind: plugin },
  edits: false,
  page: (address: Address) => draw(face, "path" in address ? address.path : ""),
})

/** The pages for these registrations, as they stand now — one each. */
export const filePagesOf = (entries: ReadonlyArray<Hung<FilePageFace>>, draw: Draw): ReadonlyArray<FilePage> =>
  entries.map((one) => pageOf(one, draw))

/**
 * ...AND OVER A READING THAT MOVES, keeping each registration's page: a
 * registration is the object the slot table holds for as long as the face is
 * hung, so the same object is the same page, and a new one is a new page.
 *
 * A PLAIN FUNCTION, called inside the caller's own memo (`./PageView.tsx`'s
 * `contributions`), so the reading is tracked by what that memo tracks — the
 * renderer's slot signal — including on the frames before the faces are held,
 * when `read` answers `[]` having read no signal at all. Its own memo would
 * track nothing on such a frame and never run again.
 */
export const filePagesOver = (read: () => ReadonlyArray<Hung<FilePageFace>>, draw: Draw): (() => ReadonlyArray<FilePage>) => {
  let held = new Map<Hung<FilePageFace>, FilePage>()
  return () => {
    const next = new Map<Hung<FilePageFace>, FilePage>()
    const pages = read().map((one) => {
      const page = held.get(one) ?? pageOf(one, draw)
      next.set(one, page)
      return page
    })
    held = next
    return pages
  }
}
