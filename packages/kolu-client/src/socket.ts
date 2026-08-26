/**
 * WHERE PADI IS — one answer, and it prefers being TOLD over guessing.
 *
 * kolu's `@kolu/padi-client/rendezvous` is pure path algebra: state-root →
 * digest → `$XDG_RUNTIME_DIR/padi-<digest>/padi.sock`. What it deliberately
 * does NOT ship is the correcting read-back — `discoverPadiDaemons` /
 * `residentPadiSocket`, which asks the box which padis are actually running —
 * because that half needs kaval and stayed with the daemon (juspay/kolu#2216;
 * the README's "Finding the socket" says exactly this and tells a client to be
 * given the socket instead).
 *
 * So the order here is: what somebody TOLD us, then the algebra's guess.
 * `$PADI_SOCKET` is kolu's own name for the first, and taking it means a
 * containerised padi, a second state-root, or a padi somebody moved is
 * reachable without olai growing a discovery it has no business owning.
 *
 * A guess that turns out to name nothing is not an error here — it is the
 * ABSENT state one module over ({@link ./link.ts}), which is the whole reason
 * `cells.kolu` has three arms instead of a boolean. Nothing in this file
 * touches the filesystem: it says where to look, and the dial finds out.
 */

import { padiSocketPath, productionPadiStateRoot } from "@kolu/padi-client/rendezvous"

/** The env var kolu tells a client to read. Named once. */
export const PADI_SOCKET = "PADI_SOCKET"

/** How this socket path was arrived at — carried so the hollow state can say
 *  WHICH path it found nothing at, which is the difference between a reader
 *  who can fix it and one who files a bug. */
export interface Rendezvous {
  readonly path: string
  readonly told: boolean
}

/**
 * Where to dial, given an environment.
 *
 * The env is a parameter rather than a read of `process.env`, so the decision
 * is a pure function with a test beside it and the one real read happens at
 * the composition root. That is the same shape `@olai/state` keeps for the
 * paths it owns.
 */
export const rendezvousIn = (env: Record<string, string | undefined>): Rendezvous => {
  const told = env[PADI_SOCKET]
  // An empty variable is an UNSET one. A shell that exports `PADI_SOCKET=`
  // means "I have nothing to tell you", and dialing the empty path would turn
  // that into a confusing absent-at-`""`.
  if (told !== undefined && told !== "") return { path: told, told: true }
  return { path: padiSocketPath(productionPadiStateRoot()), told: false }
}
