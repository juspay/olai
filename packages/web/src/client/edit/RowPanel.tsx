/**
 * The panel a row opens to ask one thing, and the one write it sends.
 *
 * TWO surfaces are this shape now — the date picker and the repeat picker — and
 * until this file they were this shape THREE TIMES. The third was the property
 * editor, whose own header said so out loud ("`../date/DatePicker.tsx`'s
 * arrangement, deliberately and line for line"): the confession that makes the
 * extraction a fact rather than a taste, since a rule held by three copies and
 * a comment is a rule that will hold in two of them the day it changes.
 *
 * That third one is gone with `props-doors-autoshow` — a property is typed in
 * the chip that draws it (`../props/PropsDrawer.tsx`), which is a different
 * shape and not this one: no panel, no button, no notice line. What is left
 * here are the two that genuinely have a stored value their control cannot hold
 * and a button whose label is a verb.
 *
 * ## What is the same, and why each part of it is
 *
 * Both of these panels do the same six things, and each was written out three
 * times back when there were three:
 *
 *   - **it sits UNDER the line it was opened on**, never floating. Everything
 *     else a row says about a write is drawn there — the refusal under a title
 *     being typed, the note, the aside about a mirror — and a popover would be
 *     the one editing surface with geometry of its own to keep anchored while
 *     the page scrolls. It is also what makes these work on a phone, where a
 *     floating panel lands under the thumb;
 *   - **Escape and Cancel are the ways out that write nothing**, and Escape is
 *     STOPPED here: the row's own editor and the command palette both listen
 *     for it further up, and one key must not also close something else;
 *   - **one press at a time.** The gate is a round trip, and a second Enter
 *     while the first is in flight is two writes for one intention;
 *   - **nothing to write is nothing to press.** The button is dead when the
 *     gesture would ask the directory for nothing — the editor's own rule one
 *     surface along (`./draft.ts`: a commit that would change nothing sends
 *     nothing), and never a fence on what may be WRITTEN;
 *   - **the button's LABEL is the verb**, so a panel that has absorbed a
 *     menu's gesture says the menu's word for it (`Clear date`, `Stop
 *     repeating`, `Remove`);
 *   - **a write that did not happen keeps the panel standing to say so**, in
 *     the ops layer's own words and in the two moods every surface has
 *     ({@link ../saying.ts}'s `Said`). A panel that closed on a refusal would
 *     be a write that vanished.
 *
 * ## What is NOT here
 *
 * The CONTROLS, which are the only thing that differs: a day box, a rule list,
 * two text boxes. They arrive as children, and what they mean — where a box
 * starts, whether pressing would write anything, what the button is then
 * called, and the one `Edit` a press sends — stays in each surface's own pure
 * module (`../date/pick.ts`, `../date/repeat.ts`, `../props/editor.ts`), where
 * it is answerable in a unit test. This file owns the SHELL and decides
 * nothing about any field.
 *
 * The EDGE panel is deliberately not a fourth consumer (`../edges/EdgePanel.tsx`).
 * It hangs under a row and stops Escape like these do, and there the likeness
 * ends: it is a search over the whole set with a `×` on each drawn reference
 * and `Done` as its way out — no single value, no one press, no button whose
 * label is a verb. Bending it to fit would be the shape this file exists to
 * refuse, one direction over.
 */

import { type JSX, Show } from "solid-js"

import type { PanelIds, Press } from "./panel.ts"
import type { Submission } from "./submission.ts"
import { SaidLine } from "../SaidLine.tsx"
import type { Said } from "../saying.ts"
import { PANEL_OUT } from "../pill.ts"
import { TARGET } from "../touch.ts"

export function RowPanel(props: {
  readonly submission: Submission
  readonly ids: PanelIds
  /** What the button IS, over whatever the surface's own control holds. A
   *  getter, because it is read on every frame the control changes. */
  readonly press: () => Press
  /** Send it, and answer with what to SAY — or nothing, which is the ordinary
   *  success and closes the panel. The host is what knows the write gate and
   *  the undo stack (`../writes.ts`); this knows only that a press is one at a
   *  time. */
  readonly send: () => Promise<Said | undefined>
  readonly onClose: () => void
  /** What the panel says about a stored value its control cannot hold, drawn
   *  under the form. Absent for the ordinary case, which is nearly every
   *  panel. */
  readonly notice?: string | undefined
  /** What this panel is ABOUT, when it is about a named thing — the property
   *  editor's key, carried as `data-key` where a `•••` entry put it. Absent
   *  everywhere else: a date and a repeat rule are the node's, and the row
   *  already says which node that is. */
  readonly about?: string | undefined
  /** The controls, between the label and the two buttons. */
  readonly children: JSX.Element
}) {
  /** Keep the pending guard and the ops layer's response with the form,
   *  including while its controls are unmounted. */
  const { said, setSaid, sending, setSending } = props.submission
  let submit: HTMLButtonElement | undefined
  let cancel: HTMLButtonElement | undefined
  /** Dismissal invalidates the old response without undoing its write. */
  const dismiss = () => {
    props.submission.dismiss()
    props.onClose()
  }

  /** The press, whole — the guard, the round trip, and the two things that can
   *  come back. It is HERE rather than in each surface because every line of it
   *  was in each surface, identically, and the one that matters is the
   *  `finally`: a panel that stopped clearing `sending` on a throw would be a
   *  button nobody could press again, and three copies is three places for that
   *  to be true in two. */
  const press = async (): Promise<void> => {
    if (sending() || !props.press().writes) return
    // Disabling the focused submit button sends keyboard focus to the body.
    // Keep Escape and keyboard navigation inside the form while it waits.
    if (document.activeElement === submit) cancel?.focus()
    setSending(true)
    setSaid(null)
    const revision = props.submission.revision()
    try {
      const answer = await props.send()
      // Cancelling and reopening is a new form, even if the old write is
      // still waiting for its response. It cannot close or annotate that form.
      if (revision !== props.submission.revision()) return
      if (answer !== undefined) {
        setSaid(answer)
        return
      }
      props.onClose()
    } finally {
      setSending(false)
    }
  }

  return (
    <div
      class="my-1"
      data-testid={props.ids.panel}
      data-key={props.about}
      onKeyDown={(event) => {
        if (event.key !== "Escape") return
        // Stopped HERE: the row's own editor and the palette both listen for
        // Escape further up, and one key must not also close something else.
        event.preventDefault()
        event.stopPropagation()
        dismiss()
      }}
    >
      {/* A form, so Enter in any control submits — which is what a person who
          has just typed or chosen something expects, and what the button does
          with a click. */}
      <form
        class="flex flex-wrap items-center gap-2"
        onSubmit={(event) => {
          event.preventDefault()
          void press()
        }}
      >
        {props.children}
        <button
          ref={submit}
          type="submit"
          class={`${TARGET} md:min-h-0 cursor-pointer rounded border border-rule bg-transparent px-2 py-1 text-sm text-ink hover:bg-rule disabled:cursor-default disabled:text-muted disabled:hover:bg-transparent`}
          data-testid={props.ids.set}
          disabled={sending() || !props.press().writes}
        >
          {props.press().label}
        </button>
        <button
          ref={cancel}
          type="button"
          class={PANEL_OUT}
          data-testid={props.ids.cancel}
          onClick={dismiss}
        >
          Cancel
        </button>
      </form>

      <Show when={props.notice}>
        {(notice) => (
          <p class="mt-1 mb-0 text-xs leading-snug text-muted" data-testid={props.ids.notice}>
            {notice()}
          </p>
        )}
      </Show>

      <Show when={said()}>
        {(message) => (
          // The mood — its colour, its `data-tone`, and whether it interrupts a
          // screen reader — is `../SaidLine.tsx`'s for every surface that says
          // something about a write. What is the PANEL's is where the line
          // sits: under the form, in the panel that opened.
          <SaidLine
            said={message()}
            class="mt-1 mb-0 text-[0.8125rem] leading-snug"
            testid={props.ids.said}
          />
        )}
      </Show>
    </div>
  )
}
