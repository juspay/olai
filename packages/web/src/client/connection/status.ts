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
 * The FREEZE GATE used to be derived here too: a local list of the one state
 * whose overlay was graced, wrapped in the framework's `gracedDown`. It is not
 * any more. The readout carries `presentingDown` — the grace-windowed "not live"
 * bit, computed once for every consumer (kolu#2312, `createSurfaceReadout`) —
 * and {@link isFrozen} reads it, so there is no second place for the window's
 * length or its exceptions to drift. What stays olai's is the exception the
 * framework cannot know: a roster change THIS page asked for.
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
import { reachable } from "./reaching.ts"

/** The one door to the readout's types for this folder, so a component, this
 *  table and the test that sweeps it are reading one spelling. */
export type { SurfaceReadout, SurfaceReadoutStatus }

/** The state whose look cannot be a constant, named by the framework's own type
 *  rather than by the string. A rename upstream then moves the exclusion with
 *  it; the string would have gone quietly vacuous, and the error would surface
 *  three lines down as a missing table row rather than as what it is. */
type Degraded = DegradedReadout["status"]

/** Its runtime spelling, declared AT that type rather than typed out a second
 *  time — so the table's exclusion below and the door in {@link lookOf} are the
 *  same fact, and a rename upstream fails here, at the spelling, rather than
 *  leaving one of the two silently comparing against a state nothing can be. */
const DEGRADED: Degraded = "degraded"

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
    tone: "quiet",
    label: "Connecting…",
    detail: "Reaching the server.",
  },
  live: {
    tone: "healthy",
    label: "Connected",
    detail: "Changes to your files show up here as they happen.",
  },
  reconnecting: {
    tone: "notice",
    label: "Reconnecting…",
    detail: "Connection lost. What you see may be out of date.",
  },
  retired: {
    tone: "alarm",
    label: "The server restarted",
    detail: "Reload the page to keep working.",
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
  readout.status !== DEGRADED ? LOOK[readout.status] : {
    tone: "notice",
    label: "Partly connected",
    detail: `Some updates aren't arriving (${readout.stopped.join(", ")}).`,
  }

/**
 * What the freeze card says: a heading for what happened and, where there is
 * one, a line for what is being done about it. Said the way a person would —
 * `Connection lost` / `Reconnecting…` for a dropped wire, `Connecting…` on the
 * first connect, and the readout's own words over the Reload for a replaced
 * server. Here, because this file is the one reader of the raw states.
 */
export const frozenLookOf = (readout: SurfaceReadout): { readonly title: string; readonly line?: string } =>
  readout.needsReload || readout.status === DEGRADED
    ? { title: lookOf(readout).label, line: lookOf(readout).detail }
    : readout.status === CONNECTING
      ? { title: LOOK.connecting.label }
      : { title: "Connection lost", line: LOOK.reconnecting.label }

const CONNECTING: SurfaceReadoutStatus = "connecting"

/** The one connection state that is news on a phone while the page is still
 *  usable. Dead-wire states are the freeze overlay; `live` is health. Named
 *  here so a banner does not spell the readout's raw states — that is this
 *  file's table, and `claims.test.ts` holds it shut. */
export const isDegraded = (readout: SurfaceReadout): boolean =>
  readout.status === DEGRADED

/**
 * WHEN THE FREEZE IS UP — the readout's own presenting bit, and the one drop
 * this page ASKED for.
 *
 * `presentingDown` is kolu's grace-windowed "not live": a sub-second drop a
 * redial heals never presents, `retired` presents at once (it is terminal, so
 * there is nothing a window could hold back), and every other down state waits
 * out the framework's `DISCONNECT_OVERLAY_GRACE_MS`. It reads the FOLDED
 * status, so a mirror over a live socket with a dead upstream presents like any
 * other drop. The first dial is not special to it either: it presents when the
 * window says so, and that is the framework's one policy rather than a second
 * one kept here.
 *
 * `urged` is the exception the framework cannot know: a roster change this page
 * made. It freezes from the first frame — the freeze is also the owner of the
 * keyboard hand-back (`./focus.ts`), and a grace there would leave a remounted
 * control holding nothing. `./Offline.tsx` latches it while the readout is down,
 * because `rosterChanging` can fall a moment before the readout reads `live`;
 * the guard below is the falling edge, so a latch still set for one tick over a
 * live readout cannot hold the dialog open.
 *
 * `reachable` is the same predicate the doors ask (`./reaching.ts`): a question
 * and a full-screen alarm want different patience, but neither may call a wire
 * reachable that the other cannot.
 */
export const isFrozen = (readout: SurfaceReadout, urged: boolean): boolean =>
  !reachable(readout) && (urged || readout.presentingDown)
