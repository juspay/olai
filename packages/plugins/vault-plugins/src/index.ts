import { serviceTag } from "@olai/plugin-api/services"
import type { Effect } from "effect"
export const name = "vault-plugins"
export const chunks = serviceTag<{ readonly chunk: (path: string) => string | null }>("vault-plugins.chunks")

/** One definition, at one version, as the panel asks about it. */
export interface ApprovalRequest {
  readonly name: string
  readonly version: string
  /** Whether every later version is approved too, or only this one. */
  readonly forever: boolean
}

/**
 * SAYING YES TO CODE — the one verb the plugins panel needs of this row, and
 * the whole of what it may reach.
 *
 * The inspector used to import this row's `./client` and call
 * `procedures.plugins.approve` on it: one plugin holding another plugin's WIRE,
 * which is the thing `Wired` exists to make unspellable (a client is keyed by
 * the asking fiber's own name, so there is no argument anywhere for another
 * plugin's members). The module holder was the way around it, and it was
 * undeclared besides — the audit's §12.
 *
 * A SERVICE with one verb on it instead. The inspector declares this key on a
 * component of its own, so the runtime knows who is asking, the plugins panel
 * can say when the provider is absent, and what the inspector can reach is one
 * verb rather than every member this row composes.
 *
 * ABSENCE IS THE CONSUMER'S TO DRAW and is unchanged: with no vault-plugins row
 * mounted the panel refuses in its own words rather than disappearing.
 */
export interface Approvals {
  readonly approve: (request: ApprovalRequest) => Effect.Effect<unknown, { readonly message: string }>
}
export const approvals = serviceTag<Approvals>("vault-plugins.approval")
