/**
 * THE FILE CONTROLS an outline page DRAWS — held for the activation that declared them.
 *
 * Two controls belong to `olai-plugin-files`: the box that names a new file,
 * and the guarded verb that deletes one. This row draws both on its own page and in its own minting door, and
 * they arrive on `files.state` — declared on ``../browser.tsx`'s `file-controls` component`.
 *
 * They used to arrive through `olai-plugin-files/contract`'s `DeleteFile` and
 * `NewFile`, two wrappers over a module signal in that row's own door, read
 * across the wall with nothing declared (the audit's §12).
 *
 * A COMPONENT AND NOT THIS ROW: an outline with no files row mounted is a whole outline, with no delete verb under it and no minting box — which is what the empty read below
 * draws, and what those wrappers already drew before the files row's own
 * activation had installed anything.
 */
import { Show } from "solid-js"

import { heldService } from "@olai/ui-primitives/held.ts"
import type { FileControls } from "olai-plugin-files/contract"

const provider = heldService<FileControls>()

/** Told by ``../browser.tsx`'s `file-controls` component`, for that activation. */
export const holdFileControls = provider.hold

/** The guarded verb that deletes a served file — nothing at all with no files
 *  row mounted. */
export function DeleteFile(props: { readonly file: string }) {
  return <Show when={provider.read()?.Delete} keyed>{(Control) => <Control {...props} />}</Show>
}

/** ...and the box that names a new one. */
export function NewFile(props: Parameters<FileControls["New"]>[0]) {
  return <Show when={provider.read()?.New} keyed>{(Control) => <Control {...props} />}</Show>
}
