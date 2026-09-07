/**
 * THIS ROW'S OWN SIBLING CLIENT — PRIVATE to this package.
 *
 * It was a declared contract (`./client`) and `olai-plugin-plugin-inspector`
 * opened it for one verb, which is one plugin holding another plugin's wire
 * through a module variable. That reach is a declared service now
 * (`./index.ts`'s `Approvals`), so this module publishes nothing across a
 * package boundary and `maybeClient` — the optional read that existed only for
 * that consumer — is gone with it.
 */
import type { SurfaceClient } from "@kolu/surface/solid"
import type { surface } from "./surface.ts"
export type Client = SurfaceClient<typeof surface.spec>
let held: (() => Client) | undefined
export function holdClient(read: () => Client): () => void {
  if (held !== undefined) throw new Error("vault-plugins client already acquired")
  held = read
  return () => { if (held === read) held = undefined }
}
export function client(): Client {
  if (held === undefined) throw new Error("vault-plugins client read outside its activation")
  return held()
}
