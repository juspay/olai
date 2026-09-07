/**
 * THIS ROW'S OWN SIBLING CLIENT — PRIVATE to this package.
 *
 * The read is held by `./browser.tsx`'s activation and cleared by identity when
 * it stops, so a face of this row spends the wire it was mounted over and a
 * stopped activation cannot answer for a replacement.
 *
 * IT WAS A DECLARED CONTRACT (`./client` in `exports` and in `olai.contracts`)
 * and no other package ever opened it. A door that publishes a live value is a
 * cross-package path to another activation's state whether or not anybody walks
 * through it today — the shape the Cordis audit's §12 is about — and the honest
 * fix for one nobody walks through is to stop declaring it rather than to mint
 * a service nobody consumes. Every reader is this package's own and reaches it
 * by a relative path.
 */
import type { SurfaceClient } from "@kolu/surface/solid"
import type { surface } from "./surface.ts"
export type Client = SurfaceClient<typeof surface.spec>
let held: (() => Client) | undefined
export function holdClient(read: () => Client): () => void {
  if (held !== undefined) throw new Error("files client already acquired")
  held = read
  return () => { if (held === read) held = undefined }
}
export function client(): Client {
  if (held === undefined) throw new Error("files client read outside its activation")
  return held()
}
