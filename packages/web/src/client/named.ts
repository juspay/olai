/**
 * What this deployment is CALLED — the word the tab, the wordmark and an
 * installed window all carry: `olai [machine]`.
 *
 * One ask, and it is RE-ASKED. The machine the server runs on does not move
 * for the life of the page, exactly the shape `who/asking.ts` argues for the
 * person looking — but the ask is a PROCEDURE, and a procedure is bound to
 * one socket epoch: a redial orphans it into a failure nothing retries for
 * us (subscriptions get the fence, one ask does not — `@kolu/surface`'s
 * websocket link). So "asked once" means ANSWERED once: the ask re-arms on
 * the readout's open edge until the word has landed, where "open" is
 * `connection/reaching.ts`'s predicate — which states may carry a question,
 * and a live one may, a stopped subscription on it notwithstanding — and a
 * wire that ate one ask hears the next edge ask again. Otherwise a page
 * loaded through a restarting server or a first-upgrade 502 would go fully green and keep
 * the shell's bare `olai` for the tab's life, while the served manifest —
 * composed server-side — says `olai [box]`: two answers, one page. It is a
 * SURFACE ask (`app.get`) and not something the shell could have shipped:
 * `index.html` is built before any server exists, and a browser has no way
 * to learn its server's `os.hostname()` — the box's name is a fact about
 * the process, and facts about the process cross on the socket, the same
 * way who is looking does.
 *
 * TWO readers, two kinds. The chrome is imperative — a `document.title`
 * that may already be wearing the waiting mark when the answer lands — so
 * the word is handed to `theme/chrome.ts`, the one writer of it
 * (`claims.test.ts`). The wordmark is a render, so its half is the signal
 * below: `undefined` until the answer lands, and the header goes on drawing
 * the shell's own word ("olai") while that is so — a first paint, not a
 * wrong name.
 *
 * The SPELLING is the surface's (`@olai/surface`'s `appName`), not composed
 * here: every face of the app names itself with the one function, so the
 * manifest the server serves and the wordmark it draws cannot drift.
 */

import { appName } from "@olai/surface"
import { Result } from "effect"
import { type Accessor, createEffect, createRoot, createSignal } from "solid-js"

import { reachable } from "./connection/reaching.ts"
import { runAsync } from "./run.ts"
import { nameChrome } from "./theme/chrome.ts"
import { connectionReadout, olai } from "./wire.ts"

const [called, setCalled] = createSignal<string | undefined>(undefined)

/** What this deployment calls itself, when the server has said. Every face
 *  of the app that can be reactive draws this; the ones that cannot are
 *  handed it below at the one moment it arrives. */
export const calledApp: Accessor<string | undefined> = called

/** Ask the server what this deployment is called, once per open of the
 *  wire, until the answer has landed (the header's first paragraph argues
 *  why a failed ask is not a settled one). No teardown: the only thing that
 *  ends this page also ends the question — a wire that opens to `retired`
 *  never goes through `live` again, which is the page's own end too. */
export const followName = (): void => {
  // TWO triggers, because neither alone closes the window. The live EDGE is
  // the wide one: the ask of the epoch that just closed is orphaned into a
  // failure no fence retries, so each opening is the honest moment to ask
  // again. The TICK is the closing one: an ask orphaned just BEFORE its
  // edge — `runAsync` settles a microtask after the readout flips — would
  // otherwise see the flip as `inFlight`, never re-arm, and the wire now
  // being stably `live` stops the edge ever firing: failed asks leave a
  // pulse behind them precisely so the very next task re-considers the
  // world as it stands.
  const [tick, pulse] = createSignal(0)
  let inFlight = false
  createRoot(() =>
    createEffect(() => {
      tick() // and the readout below: an edge OR a fresh failure re-considers
      if (
        !reachable(connectionReadout()) ||
        called() !== undefined ||
        inFlight
      ) return
      inFlight = true
      void runAsync(olai.procedures.app.get()).then((outcome) => {
        inFlight = false
        if (!Result.isSuccess(outcome)) return pulse((n) => n + 1)
        const called = appName(outcome.success.hostname)
        setCalled(called)
        nameChrome(called)
      })
    }),
  )
}
