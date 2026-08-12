/**
 * The connection, as something to look at.
 *
 * One pure table over the wire's own four states, and it is a table rather than
 * a derivation because there is nothing left to derive: the transport reports
 * `connecting` / `live` / `reconnecting` / `retired` directly, terminal state
 * included. It used to say `down` for a wire that had been retired, which is
 * where this class of bug hides — the one state that never heals, wearing the
 * name of the one that does. A page must never draw those the same.
 *
 * The four, and why a reader needs all four:
 *
 *   - `connecting` — the first dial has not answered yet. Not an alarm: every
 *     page load passes through it.
 *   - `live` — a socket is open and answering. This is the ONLY green one.
 *   - `reconnecting` — we had a server and the socket is gone; the link is
 *     re-dialling on its own. The page is showing what it last knew.
 *   - `retired` — the server closed this tab at the handshake, because the
 *     process that served it has been replaced. The link has stopped for good.
 *     There is nothing to wait for: recovery is a reload.
 *
 * And a FIFTH the transport cannot report, because it is not about the
 * transport: a socket that is open and answering while a subscription over it
 * is dead ({@link Readout}, below). Green here is a claim about what reaches
 * the page, not about a socket, so it is the conjunction of the two.
 */

import type { SurfaceHealth } from "@kolu/surface/solid"
import type { SurfaceConnectionStatus } from "@kolu/surface-app/solid"

import type { Look } from "../readout.ts"

export type { SurfaceConnectionStatus }

/** How one state is drawn — the readout's own shape (`../readout.ts`), shared
 *  with the header's other one so a change to what a readout IS lands on both.
 *  What each state says is still this file's: that is an argument about the
 *  connection. */
export type { Look }

/** A `Record`, so every state must be given a look: an unlisted one would be a
 *  connection state with no appearance, which is the bug wearing a new hat. */
export const LOOK: Record<SurfaceConnectionStatus, Look> = {
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

/** Is this a state a reload, and only a reload, gets out of? The one place the
 *  rule lives, beside the reload it gates. */
export const needsReload = (status: SurfaceConnectionStatus): boolean =>
  status === "retired"

/**
 * The fifth state, and the one the transport CANNOT SEE.
 *
 * A socket is open and answering while a subscription over it is dead: the
 * framework's `client.health()` knows, and until this nothing in olai read it.
 * What that cost is exactly the shape of bug the pill exists to prevent — a
 * dead `documents.keys` renders as a directory with no documents in it, under
 * a green light saying the files on disk reach this page as they change.
 *
 * So the readout is a function of BOTH facts, and the green one is the
 * conjunction. `live` is the only state that can degrade: the other three are
 * already saying something about the wire, and a subscription's error while
 * the socket is down is a consequence rather than news.
 */
export type Readout = SurfaceConnectionStatus | "degraded"

/**
 * ERRORS degrade the pill; PENDING does not — which is a policy decision, and
 * ours to make (the framework's `gateStatus` is deliberately policy for a GATE:
 * whether to draw the body at all).
 *
 * A first frame that has not arrived is what every page load looks like, and a
 * per-key document subscription is pending every time somebody opens a row. A
 * pill that went amber for those would be amber most of the time, which is a
 * pill nobody reads — and an indicator nobody reads is the failure this whole
 * file is about, wearing the opposite hat.
 */
export const unhealthy = (health: SurfaceHealth): ReadonlyArray<string> =>
  health.subs.filter((sub) => sub.error !== undefined).map((sub) => sub.name)

/** What the header draws: the wire's own state, unless the wire is fine and
 *  something riding it is not. */
export const readoutOf = (
  status: SurfaceConnectionStatus,
  stopped: ReadonlyArray<string>,
): Readout => (status === "live" && stopped.length > 0 ? "degraded" : status)

/**
 * How the readout looks — ALL five states, through one door.
 *
 * `LOOK` stays a `Record` because a missing transport state must be a type
 * error, and the fifth cannot join it: its detail NAMES what stopped, and a
 * reader told only that "something is not arriving" has been told the least
 * useful true thing available. So the table answers four and this answers
 * five, and what a caller asks is "how does this look" rather than "which of
 * the two shapes is this one in".
 */
export const lookOf = (
  readout: Readout,
  stopped: ReadonlyArray<string>,
): Look =>
  readout !== "degraded" ? LOOK[readout] : {
    dot: "bg-doing",
    label: "partly live",
    detail:
      `connected, but nothing is arriving on ${stopped.join(", ")} — what is on screen is missing whatever those carry, and may be missing it silently`,
  }
