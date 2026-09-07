/**
 * THE VAULT'S DOORS, AS THIS ROW HOLDS THEM — declared by two components of
 * its own, and absent without a word from anybody.
 *
 * ## What this replaced
 *
 * `HostServices`: one capability whose whole shape is *give me whatever stands
 * behind this key*, named in this row's `needs` and then spent on three keys it
 * had not declared — `Directory`, `Ops` and `Ledger`. The dependency graph a
 * person reads (`plugins.inspect`, the panel's *carrying* sentence, the row's
 * own `needs`) said this row wanted a transport and nothing else, while the
 * code reached for the vault's gate on every tool call. That is the audit's §5,
 * and it is why `HostServices` no longer exists at all.
 *
 * ## Why COMPONENTS and not the row
 *
 * **MCP must work without a vault.** The protocol server, its route, its
 * carrier and its ticket mint are the ROW's, and they stand up on a serve with
 * no vault at all — a failed directory, `--plugins=mcp,ws,web-app`, the vault
 * switched off at the panel — where the endpoint keeps serving and the domain
 * tools refuse in the vault's own words. A row that named `Directory` would
 * take `/mcp` down with the directory, which is the one thing
 * `a_failed_mcp_server.feature` and the profile benches hold it to.
 *
 * So each optional half is a component: `served-doors` names `Directory` and
 * `Ops`, `ledger` names `Ledger`. The runtime holds each of them `waiting`
 * while its provider is absent, reports which key on the panel, and unwinds it
 * when the provider leaves — which is what the lookup could never do.
 *
 * ## The reads stay PER CALL
 *
 * A tool call resolves the gate at the moment it runs, because the roster moves
 * under a standing connection: a vault switched off mid-session must refuse the
 * next call rather than the one after the next reconnect. What changed is where
 * the answer comes from — a value this row's own activation installed, cleared
 * by identity when that activation stops — rather than a lookup over the whole
 * host.
 */
import type { Directory, Ops } from "@olai/ops"

/** What the vault's two doors are, as this row holds them together: they arrive
 *  on one activation and leave on one, so a call that had the gate and not the
 *  directory is a state that cannot be reached. */
export interface ServedDoors {
  readonly directory: Directory
  readonly ops: Ops
}

let served: ServedDoors | undefined

/** Told by `./server.ts`'s `vault-tools` component, for that activation. The
 *  answer clears BY IDENTITY, so a stopped activation whose finalizer runs
 *  after a replacement installed its own cannot take the replacement's doors
 *  out from under a call in flight. */
export const holdServedDoors = (doors: ServedDoors): (() => void) => {
  served = doors
  return () => { if (served === doors) served = undefined }
}

/** The served directory, or nothing on a serve with no served. */
export const openDirectory = (): Directory | undefined => served?.directory

/** ...and the write gate, the same way. */
export const writeGate = (): Ops | undefined => served?.ops

/** WHETHER ANYBODY IS RECORDING WRITES INTO A HISTORY — a token rather than a
 *  boolean, for the identity rule above: two activations of the ledger
 *  component would otherwise have one flag between them, and the first to stop
 *  would tell the tools nobody is recording while the second still is. */
let recording: object | undefined

/** Told by `./server.ts`'s `ledger` component. It carries no VALUE: what the
 *  tools ask is only whether a ledger is mounted at all, and the recording
 *  itself goes through the write gate. */
export const holdLedger = (): (() => void) => {
  const own = {}
  recording = own
  return () => { if (recording === own) recording = undefined }
}

export const ledgerMounted = (): boolean => recording !== undefined
