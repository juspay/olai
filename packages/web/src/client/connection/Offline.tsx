/**
 * THE APP, FROZEN — one overlay over everything, drawn exactly while a
 * question cannot reach the server.
 *
 * The human's ruling (`https://github.com/juspay/oss.olai/blob/main/projects/olai/brainstorming/vault-in-browser.md` §5b): "the app
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
 * Exactly while `./reaching.ts` says a question cannot be asked — `connecting`,
 * `reconnecting`, `retired` — and the readout's `presentingDown` says the
 * down-state has been down long enough to present; that is the same predicate
 * the doors that ask questions consult, not a second list of state names kept
 * in step by hand. `live` and `degraded` are NOT frozen: a degraded readout
 * means a subscription riding the socket stopped, so the wire still carries a
 * question, and the pill already names what stopped in its own words. The
 * first dial presents through the same window as any other down state — it is
 * the same fact (there is nowhere to send anything yet), and §5b names
 * `connecting` as one of the three the overlay draws its words from.
 *
 * ONE OF THE THREE IS HELD BACK, and only the drop nobody asked for. The
 * readout carries `presentingDown` — kolu's grace-windowed "not live"
 * (kolu#2312) — so a drop the wire heals in well under a second never presents
 * the card, and `retired` presents at once. A roster change this app itself
 * asked for (`wire.ts`'s `rosterChanging`) is the exception: it freezes
 * IMMEDIATELY, exactly as it did before the grace existed — and that is
 * load-bearing, not conservative, because the freeze is also the owner of the
 * keyboard hand-back ({@link handBackFocus}): the redial opens the dialog, takes
 * the keyboard, and hands it back when the wire lands. A grace there would
 * remove that lifetime and leave a remounted control holding nothing. The
 * DOORS disagree with the overlay here on purpose: `./reaching.ts` stays
 * instantaneous, because a question sent down a socket that is mid-redial is a
 * question wasted, while a full-screen alarm for the same blink is noise — two
 * clocks for two costs.
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
import { TESTID } from "@olai/web/client/testids.ts"
import { reloadForUpdate } from "@kolu/surface-app/lifecycle"
import { createEffect, createMemo, createSignal, onCleanup, Show, type Accessor } from "solid-js"

import { handBackFocus, withOfflineFocus, type FocusMemory } from "./focus.ts"
import { reachable } from "./reaching.ts"
import { frozenLookOf, isFrozen, type SurfaceReadout } from "./status.ts"
import { Reload } from "../Reload.tsx"


export function Offline(props: {
  readonly readout: SurfaceReadout
  readonly memory: FocusMemory
  /**
   * THE OUTAGE NOBODY SUFFERED BY ACCIDENT: a roster change this page made —
   * the `wire.ts` redial loop's count. It is a supersede the app itself asked
   * for, so it is not graced (see {@link frozen}). Passed in rather than
   * imported because `../wire.ts` dials at module scope; the frame that mounts
   * this component already holds it.
   */
  readonly rosterChanging: Accessor<boolean>
}) {
  let overlay!: HTMLDialogElement
  /**
   * The freeze, as one bit — the reachability rule, read from the one module
   * that holds it, so the overlay and the doors cannot disagree about whether the
   * wire carries a question.
   *
   * A MEMO, because the two effects below are the whole of what it drives and
   * what it is derived from moves far more often than it does: a readout
   * carries the ATTEMPT COUNT while the wire is reconnecting, so a plain
   * function had both effects tracking every field of it — and the second one
   * unregistered and re-registered the window's keydown swallower on every
   * attempt, mid-freeze, for a boolean that had not moved
   * (https://github.com/juspay/oss.olai/blob/main/projects/olai/brainstorming/reactivity-after-the-flip.md §4.1).
   *
   * The RULE lives in `./status.ts`'s `isFrozen`, so the test that holds the
   * grace honest reads the same predicate the overlay paints. It is the
   * READOUT's `presentingDown` (kolu#2312) plus the latch below — no local
   * `gracedDown`, no list of the states that are graced here.
   *
   * TWO KINDS OF DOWN, and only one is held back:
   *
   *   - a roster change is a KNOWN, SELF-INFLICTED supersede (`rosterChanging`).
   *     The app asked for it, it is about to close and reopen the socket, and
   *     the page must be frozen for the whole of it — that is also what makes
   *     the keyboard hand-back ({@link handBackFocus}) belong to the REDIAL:
   *     the freeze opens, takes the keyboard, and gives it back when the redial
   *     lands. A grace here would remove that owner's lifetime and leave a
   *     remounted control holding nothing.
   *   - a drop nobody asked for is the readout's own bit: the framework holds
   *     the card back until the down-state has PRESENTED
   *     (`DISCONNECT_OVERLAY_GRACE_MS`), so the half-open watchdog recovering
   *     or a Wi-Fi roam never flashes it.
   *
   * The doors that ask questions keep reading `reachable` instantaneously
   * (`./reaching.ts`), which is the half of the split worth keeping: a call and
   * a full-screen alarm want different patience.
   */
  /**
   * A FREEZE THIS REDIAL OWNS, latched for the WHOLE down. `rosterChanging` goes
   * false when the redial resolves, which can be a moment before the readout
   * says `live`; without the latch the overlay would close that moment and
   * reopen if the grace had not elapsed — a hand-back and a second takeover for
   * one redial. Cleared only when the wire is reachable again.
   */
  const [urged, setUrged] = createSignal(false)
  createEffect(() => {
    if (reachable(props.readout)) setUrged(false)
    else if (props.rosterChanging()) setUrged(true)
  })
  const frozen = createMemo(() => isFrozen(props.readout, urged()))
  /** The hand-back in progress, if any. ONE at a time: it is cancelled before a
   *  new one starts, when the freeze goes back up, and when this component
   *  leaves — the three ways a frame could otherwise outlive the dialog that
   *  started it, or a second hand-back could run underneath the first. */
  let handing: (() => void) | undefined
  const stopHanding = () => { handing?.(); handing = undefined }
  onCleanup(stopHanding)
  const look = () => frozenLookOf(props.readout)

  // OPENING IS A CALL, not a class: the top layer is only entered through
  // `showModal`, and the inertness of everything else comes with it. Guarded on
  // `open` because a second call on an open dialog throws.
  createEffect(() => {
    if (frozen()) {
      // THE KEYBOARD IS TAKEN AGAIN: a hand-back still waiting on the last
      // freeze is over — the dialog it was for is up again.
      stopHanding()
      if (!overlay.open) withOfflineFocus(() => overlay.showModal())
      return
    }
    // The wire came back. Closing hands focus back to whatever had it when the
    // freeze began: the browser restores it when nothing moved the caret
    // first, and `./focus.ts` hands it back when something did — a control the
    // roster froze goes `disabled` under the caret, which is a blur the browser
    // makes, and the dialog that opens after it would otherwise record the
    // <body> as the focus it took and restore the caret to the top of the
    // document. "The page resumes" is then true for a reader who was mid-row,
    // not only for the pixels.
    if (overlay.open) {
      overlay.close()
      stopHanding()
      handing = handBackFocus(props.memory)
    }
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
      class="m-auto max-w-sm rounded-surface border-0 bg-panel px-6 py-5 text-ink shadow-overlay ring-1 ring-rule/40 focus:outline-none backdrop:bg-black/60"
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
      <h2 class="m-0 mb-1 text-title font-bold">{look().title}</h2>
      <Show when={look().line}>
        {(line) => <p class="m-0 text-body text-muted">{line()}</p>}
      </Show>
      {/* The recovery, where there is one. `needsReload` rides the readout
          (kolu#2160) rather than being re-derived from a list of terminal
          states kept here by hand — the hand-kept list is what once drew
          "reconnecting…" over a page that never would. */}
      <Show when={props.readout.needsReload}>
        <div class="mt-4">
          <Reload onReload={reloadForUpdate} />
        </div>
      </Show>
    </dialog>
  )
}
