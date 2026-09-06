/** The capture browser capability's scoped client. Importing the contract
 * opens no connection; its activation supplies Wired and revokes it on exit. */
import type { SurfaceClient } from "@kolu/surface/solid"
import type { surface } from "./surface.ts"
export type Client = SurfaceClient<typeof surface.spec>
let held: (() => Client) | undefined
export function holdClient(read: () => Client): () => void {
  if (held !== undefined) throw new Error("capture client already acquired")
  held = read
  return () => { if (held === read) held = undefined }
}
export function client(): Client {
  if (held === undefined) throw new Error("capture client read outside its activation")
  return held()
}
