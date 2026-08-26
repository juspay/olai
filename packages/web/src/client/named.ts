/**
 * What this deployment is CALLED — the word the tab, the wordmark and an
 * installed window all carry: `olai [machine]`.
 *
 * One ask, asked once: the machine the server runs on does not move for the
 * life of the page, exactly the shape `who/asking.ts` argues for the person
 * looking. It is a SURFACE ask (`app.get`) and not something the shell could
 * have shipped: `index.html` is built before any server exists, and a
 * browser has no way to learn its server's `os.hostname()` — the box's name
 * is a fact about the process, and facts about the process cross on the
 * socket, the same way who is looking does.
 *
 * TWO readers, two kinds. The chrome is imperative — a `document.title`
 * that may already be wearing the waiting mark when the answer lands — so
 * the word is handed to `theme/chrome.ts`, the one writer of it
 * (`claims.test.ts`). The wordmark is a render, so its half is the signal
 * below: `undefined` until the answer lands, and the header goes on drawing
 * the shell's own word ("olai") while that is so — a first paint, not a
 * wrong name. A FAILED ask lands in the same place as no answer yet: the
 * box is this page's own origin, so the wordmark's failure face would be a
 * fault card's; staying readable is the honest face of it.
 *
 * The SPELLING is the surface's (`@olai/surface`'s `appName`), not composed
 * here: every face of the app names itself with the one function, so the
 * manifest the server serves and the wordmark it draws cannot drift.
 */

import { appName } from "@olai/surface"
import { Result } from "effect"
import { type Accessor, createSignal } from "solid-js"

import { runAsync } from "./run.ts"
import { nameChrome } from "./theme/chrome.ts"
import { olai } from "./wire.ts"

const [called, setCalled] = createSignal<string | undefined>(undefined)

/** What this deployment calls itself, when the server has said. Every face
 *  of the app that can be reactive draws this; the ones that cannot are
 *  handed it below at the one moment it arrives. */
export const calledApp: Accessor<string | undefined> = called

/** Ask the server what this deployment is called: ONCE, at boot, beside the
 *  other document-lifetime followers (`main.tsx`). No teardown: the only
 *  thing that ends this page also ends the question. */
export const followName = (): void => {
  void runAsync(olai.procedures.app.get()).then((outcome) => {
    if (!Result.isSuccess(outcome)) return
    const called = appName(outcome.success.hostname)
    setCalled(called)
    nameChrome(called)
  })
}
