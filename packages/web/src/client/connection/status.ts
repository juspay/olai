/**
 * The connection, as something to look at — and ONLY that.
 *
 * WHAT is true about the connection is not decided here and no longer can be:
 * `connectSurface` hands back a READOUT (kolu#2160), the five states folded
 * from both facts a page's liveness depends on — the wire's own four, plus the
 * one the transport cannot see, a socket that is open and answering while a
 * subscription riding it is dead. This file used to fold that itself, out of
 * `client.health()`, and the fold is upstream now: `degraded` NAMES the
 * subscriptions that stopped, a first frame that has not arrived never
 * degrades, and `needsReload` travels on the readout rather than being
 * re-derived from a hand-kept list of terminal states.
 *
 * What is left is the LOOK, which is this house's and stays this house's: what
 * each state is CALLED here, which colour it paints, and the sentence green
 * makes — "the files on disk reach this page as they change" is olai's claim
 * about olai, and no framework may write it.
 *
 * The five, and why a reader needs all five:
 *
 *   - `connecting` — the first dial has not answered yet. Not an alarm: every
 *     page load passes through it.
 *   - `live` — everything reaches this page. The ONLY green one.
 *   - `degraded` — a socket that is fine over something that is not. Its
 *     detail names what stopped, which is why it is not in the table below.
 *   - `reconnecting` — we had a server and the socket is gone; the link is
 *     re-dialling on its own. The page is showing what it last knew.
 *   - `retired` — the server closed this tab at the handshake, because the
 *     process that served it has been replaced. The link has stopped for good.
 *     There is nothing to wait for: recovery is a reload.
 */

import type {
  DegradedReadout,
  SurfaceReadout,
  SurfaceReadoutStatus,
} from "@kolu/surface-app/solid"

import type { Look } from "../readout.ts"

/** The one door to the readout's types for this folder, so a component, this
 *  table and the test that sweeps it are reading one spelling. */
export type { SurfaceReadout, SurfaceReadoutStatus }

/** The state whose look cannot be a constant, named by the framework's own type
 *  rather than by the string. A rename upstream then moves the exclusion with
 *  it; the string would have gone quietly vacuous, and the error would surface
 *  three lines down as a missing table row rather than as what it is. */
type Degraded = DegradedReadout["status"]

/** How one state is drawn — the readout's own shape (`../readout.ts`), shared
 *  with the Commit pill beside it so a change to what a readout IS lands on
 *  both.
 *  What each state says is still this file's: that is an argument about the
 *  connection. */
export type { Look }

/**
 * A `Record` over every state whose appearance is FIXED, so a sixth arriving
 * upstream is a type error in this table rather than a state with no
 * appearance.
 *
 * `degraded` is excluded rather than absent: its detail names what stopped, so
 * it cannot be a constant, and {@link lookOf} is where it is written. The
 * `Exclude` is what keeps the exhaustiveness — drop a state from the union up
 * there and this stops compiling too.
 */
export const LOOK: Record<Exclude<SurfaceReadoutStatus, Degraded>, Look> = {
  connecting: {
    dot: "bg-muted",
    label: "connecting",
    detail: "reaching the server that served this page",
  },
  live: {
    dot: "bg-done",
    label: "live",
    detail: "connected — the files on disk reach this page as they change",
  },
  reconnecting: {
    dot: "bg-doing",
    label: "reconnecting",
    detail:
      "the connection dropped and is being retried — what is on screen is the last thing the server said",
  },
  retired: {
    dot: "bg-alarm",
    label: "server restarted",
    detail:
      "the server that served this page has been replaced, so this page will not update again — reload it",
  },
}

/**
 * How a readout looks — all five states, through one door.
 *
 * It takes the READOUT rather than a state, and that is what keeps the
 * degraded sentence whole: `lookOf("degraded")` would draw "nothing is
 * arriving on " — a sentence with a hole in it — and the readout's `stopped`
 * is non-empty by type, so the hole is not spellable.
 */
export const lookOf = (readout: SurfaceReadout): Look =>
  readout.status !== "degraded" ? LOOK[readout.status] : {
    dot: "bg-doing",
    label: "partly live",
    detail:
      `connected, but nothing is arriving on ${readout.stopped.join(", ")} — what is on screen is missing whatever those carry, and may be missing it silently`,
  }
