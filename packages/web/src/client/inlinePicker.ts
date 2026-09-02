/**
 * A LIST THAT HANGS OFF A CONTROL AND IS LAID OUT WHERE IT STANDS — whether it
 * is up, what it is up OVER, and the ways it goes away.
 *
 * There are two of them and they are both in the chat panel: the header's
 * a node agent's own sessions ({@link ./chat/NodeSessions.tsx}) and the wake strip's file
 * picker ({@link ./chat/Wake.tsx}). A quiet pill that opens it, a list hung from
 * the box the pill sits in rather than from the pill itself, and one small state
 * machine between them — which is what this is.
 *
 * ## ONE SIGNAL, because a picker is ONE fact
 *
 * It is shut, or it is up over something. Written as an `open` boolean beside
 * whatever the list is showing, "a query while shut" and "an answer while shut"
 * are states the type admits and the code has to remember not to be in — and the
 * remembering is what goes wrong: a list reopened still narrowed by what somebody
 * typed at it a conversation ago, with the box that says so scrolled out of
 * view. Shutting is one assignment here and it cannot leave anything behind.
 *
 * THE OPEN ARM IS THE CALLER'S, which is the one thing the two pickers genuinely
 * differ in and the whole reason this is generic. The file picker is up over what
 * has been typed at it; the conversations list is up over an ask in flight or
 * whichever answer came back. What that payload MEANS is never read here — only
 * that there IS one exactly while the list is up, which is the invariant the
 * union spells and a pair of fields could not.
 *
 * ## WHICH GESTURES SHUT IT is `./dismiss.ts`, as everywhere else
 *
 * A pointer down outside and Escape, in this client's one spelling of them, with
 * the topmost panel answering (`./topmost.ts`). BOTH ROOTS go over, which is the
 * bug worth naming here as it is there: the list is a SIBLING of its trigger
 * rather than a child of it, so a click-away that knew only the list would read a
 * press of the trigger as a press outside — shutting on the pointerdown, and
 * reopened by that same press's click. Pressing it a second time would do nothing
 * at all.
 *
 * What is left in this file is what shutting MEANS for these two: the caret goes
 * back to the trigger for the press that closes, because that press is a
 * dismissal a keyboard can reach and no dismissal can SEE it — it lands on the
 * trigger, which is inside as far as `./dismiss.ts` is concerned.
 *
 * ## WHY NOT `./popover.ts`, which is this sentence one layer up
 *
 * That receptacle is for a panel PORTALLED out of whatever its trigger sits in:
 * it owns `./anchor.ts`'s geometry, measures the trigger against the viewport on
 * every scroll, and carries a tab cycle of its own because a panel appended to
 * the body is the last thing on the page and opening one takes no keyboard into
 * it. These two lists are laid out INLINE and deliberately — a narrow list
 * `right-0` of a small pill runs off the left of a phone sheet, so each hangs
 * from its own strip's box instead (`absolute inset-x-3 top-full`, as wide as the
 * conversation), and its controls are simply the next thing in document order,
 * which is the reachability the portal is the price of. Putting them on
 * `popover.ts` would portal them, which is a change to what a reader sees and
 * nobody asked for one.
 *
 * So what the four panels share is the two GESTURES and nothing else, and the
 * three files are siblings rather than a stack: `./dismiss.ts` is the gestures,
 * `./popover.ts` is the panel that leaves its box, and this is the list that
 * stays where it was written.
 *
 * ## IT USED TO BE TWO, which is the argument, and it is not a new one
 *
 * `./popover.ts`'s own header records what happened the last time this client
 * had one state machine written down twice: "they had the same forty lines each,
 * which is how the two drifted: one grew Escape and a returned focus … and the
 * other never had them, and one of the two got its click-away WRONG in a way
 * nothing could see." The same situation had come back in one directory — a
 * union with a `shut` arm, a trigger ref and a list ref, a `shut()`, a
 * `dismissOn` call, a `toggle()` that hands the caret back, and a ref with an
 * `onCleanup` in it, spelled out twice with several of the comments word for
 * word identical between them.
 *
 * It is worth naming which way the copy went, because it is the same door: the
 * conversations picker had already been the one panel in this client that
 * answered NEITHER gesture until review found it, and the wake strip was then
 * written by reading it. Nothing had drifted yet. The copy was simply fresh.
 *
 * ## WHAT THIS DOES NOT OWN
 *
 * The classes, the markup, the rows, the filter box over them, the `aria-`
 * attributes and what the payload means. A picker here is ordinary elements with
 * two refs on them, which is the same division `./popover.ts` keeps and for the
 * same reason: the two lists have nothing in common to look at.
 */

import { type Accessor, createSignal, onCleanup } from "solid-js"

import { dismissOn } from "./dismiss.ts"

/**
 * Shut, or up over one value of the caller's.
 *
 * Private on purpose: what a caller reads is {@link InlinePicker.open} and
 * {@link InlinePicker.showing}, which are the two questions this answers, and a
 * caller able to spell the union could spell `shut` while carrying something.
 */
type Up<T> =
  | { readonly _tag: "shut" }
  | { readonly _tag: "open"; readonly over: T }

export interface InlinePicker<T> {
  /** Is the list up? The union's own "not shut", asked in ONE place — the
   *  dismissal, the toggle, the `aria-expanded` and the `<Show>` are four
   *  askings of one question. */
  readonly open: Accessor<boolean>
  /** What it is up OVER, and `undefined` exactly while it is shut — so a
   *  caller cannot read a stale payload, because there is none to read. */
  readonly showing: Accessor<T | undefined>
  /** Put it up over this, or replace what it is already up over: the answer
   *  that came back, the next thing typed at it. */
  readonly show: (over: T) => void
  /** Put it away. Only that — where the caret goes is the two callers', which
   *  is `./dismiss.ts`'s own division: it hands the caret back for the key and
   *  leaves it alone for a press. */
  readonly shut: () => void
  /** The trigger's press: up over {@link Opening.opening}'s value, or away and
   *  the caret back where it came from. */
  readonly toggle: () => void
  /** `ref` on the control that opens it — what a dismissal counts as inside as
   *  well as where the caret goes back to. */
  readonly setTrigger: (el: HTMLElement | undefined) => void
  /** `ref` on the list. It disposes itself: see the call. */
  readonly setList: (el: HTMLElement | undefined) => void
}

export interface Opening<T> {
  /**
   * What a press opens the list OVER, asked at that press.
   *
   * Asked every time rather than held as a constant, which is the same rule the
   * union is: a fresh payload per opening is what makes "shutting leaves nothing
   * behind" true of the thing a reader sees as well as of the signal. A caller
   * with something to ASK for starts the asking here and returns the state that
   * says so — the answer arrives later through {@link InlinePicker.show}, which
   * is also where it can be dropped if the reader has moved on.
   */
  readonly opening: () => T
}

export const createInlinePicker = <T>(on: Opening<T>): InlinePicker<T> => {
  const [up, setUp] = createSignal<Up<T>>({ _tag: "shut" })

  const open = (): boolean => up()._tag !== "shut"

  const showing = (): T | undefined => {
    const state = up()
    return state._tag === "open" ? state.over : undefined
  }

  const show = (over: T): void => {
    setUp({ _tag: "open", over })
  }

  const shut = (): void => {
    setUp({ _tag: "shut" })
  }

  /** Two roots, because the list is a sibling of the button rather than a child
   *  of it — the header paragraph on the gestures has what that costs. */
  let trigger: HTMLElement | undefined
  let list: HTMLElement | undefined

  dismissOn({ open, root: () => list, trigger: () => trigger, dismiss: shut })

  return {
    open,
    showing,
    show,
    shut,
    toggle: () => {
      if (!open()) return show(on.opening())
      shut()
      // A press of the trigger while the list is up is a dismissal a keyboard
      // can reach, so the caret goes back the way Escape's does — spelled here
      // because no dismissal can see this press (see the header).
      trigger?.focus()
    },
    setTrigger: (el) => {
      trigger = el
    },
    setList: (el) => {
      list = el
      // Solid never calls a ref with `undefined`, and this one lives inside the
      // `<Show>` that draws the list — so the disposal is what says the list is
      // gone. Without it a shut picker keeps its detached box and everything
      // that was in it, and `root()` answers a dismissal with an element that is
      // no longer on the page.
      onCleanup(() => {
        list = undefined
      })
    },
  }
}
