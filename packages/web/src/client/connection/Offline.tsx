/**
 * THE APP, FROZEN — one overlay over everything, drawn exactly while a
 * question cannot reach the server.
 *
 * The human's ruling (`docs/brainstorming/vault-in-browser.md` §5b): "the app
 * freezes with an offline overlay." It is the "live or nothing" doctrine —
 * this app ships no service worker, because a cached shell shows outlines that
 * have stopped being true — carried to the end it was always headed for. The
 * browser used to hold the whole vault, so a dead wire only paused UPDATES and
 * the page could go on answering out of its local copy. It answers nothing for
 * itself any more: navigation, search, the filter, tag completion, the shelf
 * are all questions now, so a page left interactive under a dead socket is a
 * page of doors that pretend. There are no half-alive pages here.
 *
 * ## When it is up
 *
 * Exactly when `./reaching.ts` says a question cannot be asked — `connecting`,
 * `reconnecting`, `retired` — and that is the same predicate the doors that
 * ask questions consult, not a second list of state names kept in step by
 * hand. `live` and `degraded` are NOT frozen: a degraded readout means a
 * subscription riding the socket stopped, so the wire still carries a
 * question, and the pill already names what stopped in its own words. The
 * first dial IS frozen, because it is the same fact — there is nowhere to send
 * anything yet — and §5b names `connecting` as one of the three the overlay
 * draws its words from.
 *
 * DISMISSAL IS ONLY THE WIRE COMING BACK. There is no close button, `Escape`
 * is refused (`onCancel`), and nothing under it can take a keystroke. The one
 * state that has something else to offer is `retired` — the server that served
 * this page has been replaced, so no reconnect is ever coming and the recovery
 * is a reload — and that offer is made HERE rather than on a screen of its
 * own, which is what this file replaces (`Restarted.tsx`, deleted with it).
 *
 * ## The words are the pill's
 *
 * Every sentence on it comes from `./status.ts`'s `lookOf`, which is what the
 * connection pill in the header says. Two wordings of one wire are two claims
 * free to disagree, and this app already had that bug once, on a hand-kept
 * list of terminal states. What is this file's own is the one line about the
 * FREEZE ({@link FROZEN}) — a fact about the app rather than about the socket,
 * and the only thing the pill has no reason to say.
 *
 * ## Why a `<dialog>`, and why it spells no layer
 *
 * "Nothing underneath is interactive" is the modal dialog's contract, and the
 * browser is the only thing that can actually keep it. `showModal()` puts this
 * in the TOP LAYER — above every stacking context on the page, including the
 * panels that portal to `document.body` and open at `LAYER.over` — makes the
 * whole rest of the document inert (no pointer, no focus, no tab stop, nothing
 * for a screen reader to wander into), and puts focus in here. A `z-index`
 * cannot make that claim: `../layer.ts`'s table orders the page's own stack,
 * and a menu portalled to the body AFTER this mounted would sit at the same
 * number and paint over it, which is exactly the hole a freeze may not have.
 * So this is the one thing in the client that is above the table, `../layer.ts`
 * says so beside it, and `../claims.test.ts` holds it to being the only
 * `showModal` in the client.
 *
 * No fallback for a browser without `showModal`, deliberately: this client's
 * stylesheet is Tailwind 4, whose own floor (Safari 16.4, Chrome 111, Firefox
 * 128) is already years above the dialog's (Safari 15.4, March 2022). A guard
 * here would be a branch nothing this app runs in can take, drawing a
 * half-freeze in the name of a browser that cannot render the page anyway.
 *
 * The one thing the top layer does not cover is a listener on the WINDOW: an
 * inert element cannot be pressed, but a global chord is not pressed on an
 * element (`../keys.ts`'s chords are heard on the window, and ⌘Z would fire an
 * edit into a socket that is not there). So the freeze swallows keys at the
 * capture phase for as long as it is up — `stopPropagation` and never
 * `preventDefault`, so the reload button on this card still activates on
 * `Enter` while every listener under it hears nothing.
 */

import { reloadForUpdate } from "@kolu/surface-app/lifecycle"
import { createEffect, onCleanup, Show } from "solid-js"

import { reachable } from "./reaching.ts"
import { lookOf, type SurfaceReadout } from "./status.ts"
import { Reload } from "../Reload.tsx"
import { TESTID } from "../testids.ts"

/** What the freeze itself says, and the only sentence here that is not the
 *  pill's: the pill reports on the WIRE, and this reports on what that does to
 *  the app. Said only where waiting is the whole of the recovery — a retired
 *  wire is offered the reload instead, and telling somebody to wait for a
 *  connection that is never coming back would be the page pretending in the
 *  one state it must not. */
const FROZEN = "Nothing on this page can be used until it is back."

export function Offline(props: { readonly readout: SurfaceReadout }) {
  let overlay!: HTMLDialogElement
  /** The freeze, as one bit — the reachability rule, read from the one module
   *  that holds it, so the overlay and the doors cannot disagree about whether
   *  the wire carries a question. */
  const frozen = () => !reachable(props.readout)
  const look = () => lookOf(props.readout)

  // OPENING IS A CALL, not a class: the top layer is only entered through
  // `showModal`, and the inertness of everything else comes with it. Guarded on
  // `open` because a second call on an open dialog throws.
  createEffect(() => {
    if (frozen()) {
      if (!overlay.open) overlay.showModal()
      return
    }
    // The wire came back. Closing hands focus back to whatever had it when the
    // freeze began — the browser's own restoration, which is what makes
    // "the page resumes" true for a reader who was mid-row rather than only for
    // the pixels.
    if (overlay.open) overlay.close()
  })

  // THE CHORDS, for as long as the freeze is up. Capture on the window, which
  // is ahead of every listener in this client (`../keys.ts`'s global layer, the
  // palette's, the outline's bulk keys, the completion menus): they are heard
  // on the window and on the document, and an inert page does not silence a
  // listener that was never on an element.
  createEffect(() => {
    if (!frozen()) return
    const swallow = (event: KeyboardEvent) => event.stopPropagation()
    window.addEventListener("keydown", swallow, true)
    onCleanup(() => window.removeEventListener("keydown", swallow, true))
  })

  return (
    <dialog
      ref={overlay}
      // No `z-*` of any kind, and that is the point — see the header. The
      // backdrop is the dim, painted by the browser over the whole viewport
      // including the app bar, and the box is the card.
      //
      // `focus:outline-none` because `showModal` FOCUSES this: with no reload
      // button on it the dialog itself takes the focus, and a focus ring drawn
      // around a card nobody navigated to reads as a border somebody chose.
      // The focus itself is kept — it is half of what makes the page under this
      // unreachable by keyboard.
      class="m-auto max-w-sm rounded-2xl border-0 bg-panel px-6 py-5 text-ink shadow-xl ring-1 ring-rule/40 focus:outline-none backdrop:bg-black/60"
      data-testid={TESTID.offline}
      // WHICH state froze it, for a test and for whoever is reading the DOM —
      // the same attribute and the same values the pill publishes
      // (`./Indicator.tsx`), because it is the same fact and a scenario should
      // not have to learn two spellings of it.
      data-connection={props.readout.status}
      // `Escape` closes a dialog by default. Not this one: the only thing that
      // dismisses the freeze is the wire coming back, and a page that could be
      // uncovered by a keystroke would be interactive underneath again with
      // nothing to answer it.
      onCancel={(event) => event.preventDefault()}
    >
      <h2 class="m-0 mb-1 text-base font-bold">{look().label}</h2>
      <p class="m-0 text-sm text-muted">{look().detail}</p>
      {/* The recovery, where there is one. `needsReload` rides the readout
          (kolu#2160) rather than being re-derived from a list of terminal
          states kept here by hand — the hand-kept list is what once drew
          "reconnecting…" over a page that never would. */}
      <Show
        when={props.readout.needsReload}
        fallback={<p class="m-0 mt-3 text-sm text-muted">{FROZEN}</p>}
      >
        <div class="mt-4">
          <Reload onReload={reloadForUpdate} />
        </div>
      </Show>
    </dialog>
  )
}
