/**
 * What this deployment is CALLED — the word the tab, the wordmark and an
 * installed window all carry: `olai [machine]` — and WHEN the process
 * serving it started, the instant the header's uptime chip ticks from.
 *
 * One ask, and it is RE-ASKED until it has LANDED. Both facts are about the
 * PROCESS and do not move for its life — exactly the shape `who/asking.ts`
 * argues for the person looking — but the ask is a PROCEDURE, and a
 * procedure is bound to one socket epoch: a redial orphans it into a
 * failure nothing retries for us (subscriptions get the fence, one ask
 * does not — `@kolu/surface`'s websocket link). So "asked once" means
 * ANSWERED once: the ask re-arms on the readout's open edge until the
 * answer has landed, where "open" is `connection/reaching.ts`'s predicate
 * — which states may carry a question, and a live one may, a stopped
 * subscription on it notwithstanding — and a wire that ate one ask hears
 * the next edge ask again. Otherwise a page loaded through a restarting
 * server or a first-upgrade 502 would go fully green and keep the shell's
 * bare `olai` for the tab's life, while the served manifest — composed
 * server-side — says `olai [box]`: two answers, one page.
 *
 * A RESTART does not re-ask this page. The wire echoes the process id back
 * as `?pid=` on every re-dial; a replaced server closes the socket at the
 * handshake and the readout is `retired`, which `reaching.ts` will not
 * send a question down. Recovery is a reload — the overlay already says
 * so — and the page that comes back is a new ask of a new process, which
 * is why it can read `up 12s`. The start rides this landing; it is not a
 * second fact that moves under a live tab.
 *
 * It is a SURFACE ask (`app.get`) and not something the shell could have
 * shipped: `index.html` is built before any server exists, and a browser
 * has no way to learn its server's `os.hostname()` or its start — facts
 * about the process cross on the socket, the same way who is looking does.
 *
 * TWO readers of the name, two kinds. The chrome is imperative — a
 * `document.title` that may already be wearing the waiting mark when the
 * answer lands — so the word is handed to `theme/chrome.ts`, the one writer
 * of it (`claims.test.ts`). The wordmark is a render, so its half is the
 * signal below: `undefined` until the answer lands, and the header goes on
 * drawing the shell's own word ("olai") while that is so — a first paint,
 * not a wrong name. The start has one reader: the uptime chip.
 *
 * The SPELLING is the surface's (`@olai/surface`'s `appName`), not composed
 * here: every face of the app names itself with the one function, so the
 * manifest the server serves and the wordmark it draws cannot drift.
 */

import type { App } from "@olai/surface"
import { appName } from "@olai/surface"
import { Result } from "effect"
import { type Accessor, createEffect, createRoot, createSignal } from "solid-js"

import { reachable } from "./connection/reaching.ts"
import type { SurfaceReadout } from "./connection/status.ts"
import { nameChrome } from "./theme/chrome.ts"

const [called, setCalled] = createSignal<string | undefined>(undefined)
const [started, setStarted] = createSignal<string | undefined>(undefined)

/**
 * Whether this tab should send `app.get` right now.
 *
 * The three conjuncts are the three reasons not to: the wire cannot carry
 * a question (`retired` is one — a restart does not re-ask this page),
 * the name has already landed, or an ask is already in flight. A table
 * in `./named.test.ts`, because this is the seam a reconnect-reset claim
 * has to survive, and `retired` is where it does not.
 */
export const shouldAsk = (
  readout: SurfaceReadout,
  called: string | undefined,
  inFlight: boolean,
): boolean =>
  reachable(readout) && called === undefined && !inFlight

/** The two facts one landing writes — the name every face draws, and the
 *  start the chip ticks from. Together so a success cannot set one and
 *  drop the other. */
export const landingOf = (
  app: App,
): { readonly called: string; readonly startedAt: string } => ({
  called: appName(app.hostname),
  startedAt: app.startedAt,
})

/** What this deployment calls itself, when the server has said. Every face
 *  of the app that can be reactive draws this; the ones that cannot are
 *  handed it below at the one moment it arrives. */
export const calledApp: Accessor<string | undefined> = called

/** When the process serving this tab started, when the server has said.
 *  The uptime chip ticks from this. A later value on this page does not
 *  arrive: a replaced process retires the tab. */
export const startedAt: Accessor<string | undefined> = started

export interface FollowName {
  /** The wire's readout — `shouldAsk` of it is which states may carry
   *  this ask. Injected so this module does not import the wire (a test
   *  of the gate has no socket). */
  readonly readout: Accessor<SurfaceReadout>
  /** One `app.get`. Injected for the same reason. */
  readonly ask: () => Promise<Result.Result<App, unknown>>
  /** The chrome half of the name. Defaulted to {@link nameChrome}. */
  readonly named?: (called: string) => void
}

/** Ask the server what this deployment is called, and when it started,
 *  once per open of the wire, until the answer has landed (the header
 *  argues why a failed ask is not a settled one, and why a landed one
 *  is: a restart retires this tab rather than handing it a new start). */
export const followName = (opts: FollowName): (() => void) => {
  // TWO triggers, because neither alone closes the window. The live EDGE is
  // the wide one: the ask of the epoch that just closed is orphaned into a
  // failure no fence retries, so each opening is the honest moment to ask
  // again. The TICK is the closing one: an ask orphaned just BEFORE its
  // edge — `runAsync` settles a microtask after the readout flips — would
  // otherwise see the flip as `inFlight`, never re-arm, and the wire now
  // being stably `live` stops the edge ever firing: failed asks leave a
  // pulse behind them precisely so the very next task re-considers the
  // world as it stands.
  //
  // The GATE is the landing: once `called` has arrived, this tab has its
  // name and its start, and a later open (a reconnect to the SAME process,
  // or a retired handshake after a restart) must not re-ask. Reading
  // `called` is what keeps "once per landing" true; not reading it is what
  // would spin `nameChrome` and the failure pulse for the life of the tab.
  const [tick, pulse] = createSignal(0)
  let inFlight = false
  return createRoot((dispose) => {
    createEffect(() => {
      tick() // and the readout below: an edge OR a fresh failure re-considers
      if (!shouldAsk(opts.readout(), called(), inFlight)) return
      inFlight = true
      void opts.ask().then((outcome) => {
        inFlight = false
        if (!Result.isSuccess(outcome)) return pulse((n) => n + 1)
        const landed = landingOf(outcome.success)
        setCalled(landed.called)
        ;(opts.named ?? nameChrome)(landed.called)
        setStarted(landed.startedAt)
      })
    })
    return dispose
  })
}
