/**
 * Where the reader was, remembered per history entry.
 *
 * A page in this app is a ROUTE, and a route change redraws the main pane
 * without touching the scroll position — so zooming into a node from halfway
 * down a long outline used to land on the new page halfway down, at a line
 * nobody had chosen, and going back landed wherever the redraw happened to
 * leave things. Neither is a decision; both are what happens when nobody makes
 * one. This is the decision: a page you go TO starts at the top, a page you go
 * BACK to is where you left it, and every statement that moves the page is in
 * here — including telling the browser to stop moving it itself. ./router.tsx
 * says WHICH of the two a navigation gets, because a push and a pop are the one
 * thing it knows that this module does not.
 *
 * Recorded as the reader SCROLLS rather than as they navigate, and that is the
 * whole design. `popstate` fires after the entry has already changed, so there
 * is no moment at which the outgoing entry can be asked where it was — by then
 * the browser is on the next one and `scrollY` is about a page nobody is on. A
 * scroll listener is the only place the answer still exists.
 *
 * WHICH ENTRY the reader is on is not kept here. It is a fact the browser
 * already holds, and a second copy would have to be pushed in and kept in step
 * — which is an ordering rule between two modules where there is no rule at
 * all: the recording reads the key at the moment it writes, and it is whatever
 * `history.state` says then. A restore is told which key instead, because the
 * router is the only thing that knows a navigation has happened at all, and
 * that is what it has just learnt.
 *
 * Not throttled, deliberately. The obvious economy — batch the writes through
 * `@solid-primitives/scheduled` — is what makes this wrong: a trailing write
 * scheduled before a navigation lands AFTER it, and records the position of the
 * page being left against the entry being arrived at. What it would be saving
 * is a `history.state` read, a `scrollY` read and a `Map.set` per scroll event,
 * on an event browsers already coalesce to one a frame — less than the
 * scheduling that replaced it. The one that is not free is `scrollY`, which can
 * force layout if a wire frame has just touched the DOM; there is no cheaper
 * way to ask where the page is, and a scroll listener that did not know that
 * would be worse.
 *
 * IN MEMORY, so it lives exactly as long as the document that recorded it. A
 * reload starts over at the top — the browser's own restoration cannot do
 * better here and is turned off (./router.tsx): it runs when the document
 * loads, and at that moment this client has no rows to be scrolled through,
 * because the set arrives over a WebSocket a moment later.
 *
 * The one case this does NOT serve, said out loud rather than left to be
 * discovered: a restore lands the instant the new page is drawn, and a page
 * that has not finished LAYING OUT is shorter than it will be — a document with
 * `/media/*` pictures in it grows as they arrive. The browser clamps a restore
 * to the height it has, so that page comes back near its end rather than at the
 * line it was left on. Waiting for the height to settle is the transcript's
 * `ResizeObserver` (./chat/Transcript.tsx), and it is not obviously right here:
 * it would move the page under a reader who has already started scrolling the
 * one they came back to. Left as it is until somebody is actually bitten.
 *
 * The chat transcript's follow-discipline (./chat/Transcript.tsx) is the house
 * standard this is written to: scrolling somebody's page is done deliberately,
 * on a rule that can be stated, or it is not done at all.
 */

import { onCleanup } from "solid-js"

/** The two things a navigation may do to the page, and between them they are
 *  every statement in this client that moves it. WHICH of them a navigation
 *  deserves is the router's to say, because a push and a pop are the only
 *  thing here it knows and this module does not. */
export interface ScrollMemory {
  /** A page the reader ASKED for. */
  readonly toTop: () => void
  /** A page the reader is COMING BACK to: where the entry keyed `key` was
   *  left, or the top if this document never saw it there. */
  readonly restore: (key: string) => void
}

/** Start remembering, reading which history entry the reader is on from
 *  `keyHere` — the browser's own answer rather than a copy of it. An entry
 *  with no key of its own has no memory, which is the honest answer for one
 *  reached before this document existed. */
export const createScrollMemory = (keyHere: () => string | undefined): ScrollMemory => {
  // The browser is told to stop restoring the moment something else starts:
  // its own restoration fires while the page it is restoring INTO has not been
  // drawn — on a back, the document is still the height of the page being left
  // — so what it puts back is a position in the wrong page. Here rather than in
  // the router because it is not a fact about navigating; it is this memory
  // taking over from the one it replaces.
  history.scrollRestoration = "manual"

  /** Entry key → how far down the page that entry was left. */
  const left = new Map<string, number>()

  const record = (): void => {
    const key = keyHere()
    if (key !== undefined) left.set(key, scrollY)
  }
  // Passive: this listener never prevents the scroll it is watching, and
  // saying so is what keeps it off the critical path of the gesture.
  addEventListener("scroll", record, { passive: true })
  onCleanup(() => removeEventListener("scroll", record))

  // `instant` in both, whatever the page's own scroll behaviour is: neither of
  // these is a gesture. One is a page starting where pages start; the other is
  // the page being where the reader already was.
  return {
    toTop: () => scrollTo({ top: 0, behavior: "instant" }),
    restore: (key) => scrollTo({ top: left.get(key) ?? 0, behavior: "instant" }),
  }
}
