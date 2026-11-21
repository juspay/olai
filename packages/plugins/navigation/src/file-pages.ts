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
 * No JSX here, so a test at the root reads it; the drawing is the caller's
 * (`draw`), which is where the file's revision is read.
 */
import type { Address } from "@olai/format"
import type { Hung } from "@olai/plugin-api"
import type { JSX } from "solid-js"

import type { FilePage } from "./index.ts"
import type { FilePageFace } from "./slots.ts"

export const filePagesOf = (
  entries: ReadonlyArray<Hung<FilePageFace>>,
  draw: (face: FilePageFace, file: string) => JSX.Element,
): ReadonlyArray<FilePage> =>
  entries.map(({ plugin, face }) => ({
    by: { kind: plugin },
    edits: false,
    page: (address: Address) => draw(face, "path" in address ? address.path : ""),
  }))
