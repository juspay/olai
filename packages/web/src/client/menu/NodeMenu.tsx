/**
 * The `•••` hover menu to the left of a row's collapse triangle.
 *
 * Presentation only: open, close, a list of verbs, a question before the one
 * verb that asks one, and a line for whatever came back. What those verbs ARE
 * is the caller's catalog (`./actions.ts`) — a further action later is another
 * entry there, not a branch here.
 *
 * The panel is `absolute top-full` inside a positioned root — the same idiom
 * as `theme/Picker.tsx` and `chat/SlashMenu.tsx` — so it scrolls with its
 * anchor and never lands below the fold as a detached `fixed` box would.
 * Drawn only on pointer devices (`MENU_REVEAL`); a phone keeps the triangle
 * and spends the width on the title.
 *
 * THE CONFIRM IS THIS PANEL'S OWN SECOND STEP, and that is a decision rather
 * than a convenience: a `window.confirm()` is browser chrome olai does not
 * own, cannot theme and cannot say a sentence of its own inside — and it
 * freezes the page around a question about one row. So the panel swaps its
 * content for the question, in the same box under the same `•••`, and Escape
 * or a click outside is still the way out of it.
 */

import { createSignal, For, onCleanup, onMount, Show } from "solid-js"

import { TESTID } from "../testids.ts"
import { HOVER_CELL, MENU_REVEAL } from "../touch.ts"
import type { Said } from "./writes.ts"

export interface MenuAction {
  readonly id: string
  readonly label: string
  /** What this action asks before it runs, for the one verb whose reach is
   *  bigger than the row it was chosen on. The panel puts the question where
   *  the list was; choosing the verb again is the answer. */
  readonly confirm?: string
  /** A rule above this entry: the first verb that writes, so the half of the
   *  menu that changes the DIRECTORY is visibly a different half from the one
   *  that changes what this tab is looking at. */
  readonly divider?: boolean
  /** Do it. Answering with a {@link Said} is how a verb says what happened —
   *  a refusal in the ops layer's own words, or a nudge from a write that
   *  landed. Answering with nothing is the ordinary success. */
  readonly run: () => void | Promise<Said | void>
}

/** How long what an action said stays on the row. Long enough to read where
 *  the pointer already is, short enough that the gutter goes back to being a
 *  gutter without anybody dismissing anything. */
const SAID_MS = 6_000

export function NodeMenu(props: {
  readonly actions: ReadonlyArray<MenuAction>
}) {
  const [open, setOpen] = createSignal(false)
  /** What the last action had to say, or `null`. The menu is CLOSED by the
   *  time an action answers, so this belongs to the root beside the `•••`
   *  rather than to the panel: a message inside something that has gone is a
   *  message nobody reads. */
  const [said, setSaid] = createSignal<Said | null>(null)
  let root: HTMLDivElement | undefined
  let clearing: ReturnType<typeof setTimeout> | undefined

  onCleanup(() => clearTimeout(clearing))

  const close = (): void => {
    setOpen(false)
  }

  /**
   * Run it, and SAY SO — whether it happened or not.
   *
   * Every verb in the catalog does its thing, answers with a sentence about
   * what happened instead, or throws, and this is the one place a reader is
   * told about any of the three.
   *
   * The SENTENCE is the ops layer's own, verbatim, because it is the only one
   * that carries a reason: a mark refused over finished work, a placement
   * three other rows still name. What is left for this file to word is the
   * THROW — the clipboard, refused whenever the page is not a secure context,
   * which is every LAN reader on plain http — and it used to be the one that
   * caught its own failure and dropped it, so a copy that never happened was
   * indistinguishable from one that did.
   */
  const pick = async (action: MenuAction): Promise<void> => {
    close()
    clearTimeout(clearing)
    setSaid(null)
    try {
      const answer = await action.run()
      if (answer !== undefined) say(answer)
    } catch (cause) {
      // The verb's own words, lower-cased into a sentence — so a further
      // action needs no entry here, and none of them can be forgotten.
      say({ tone: "alarm", text: `couldn't ${action.label.toLowerCase()}` })
      // ...and the CAUSE is kept, because a few seconds of sentence in a
      // gutter cannot carry it and a reader who wants to know why has nowhere
      // else to look. A clipboard the browser refused and a bug in this app's
      // own href-building produce the same message on screen; they must not
      // produce the same thing in a console.
      console.warn(`olai: "${action.label}" did not happen`, cause)
    }
  }

  const say = (message: Said): void => {
    setSaid(message)
    clearing = setTimeout(() => setSaid(null), SAID_MS)
  }

  return (
    // Positioned root for the absolute panel. Hidden entirely below md so a
    // phone spends no gutter width on the menu (triangle stays).
    <div class="relative hidden shrink-0 md:block" ref={root}>
      <button
        type="button"
        class={`${HOVER_CELL} ${MENU_REVEAL} cursor-pointer border-0 bg-transparent p-0 text-[0.65rem] leading-none tracking-[0.05em] text-muted hover:text-ink`}
        data-testid={TESTID.nodeMenu}
        aria-haspopup="true"
        aria-expanded={open()}
        aria-label="node menu"
        title="node menu"
        onClick={(event) => {
          event.stopPropagation()
          setOpen((was) => !was)
        }}
      >
        •••
      </button>
      <Show when={open()}>
        <MenuPanel
          root={() => root}
          actions={props.actions}
          onPick={pick}
          onClose={close}
        />
      </Show>
      <Show when={said()}>
        {(message) => (
          // Absolute, like the panel: the gutter's width is shared by every row
          // in the tree (`touch.ts`), and a word that widened it would move the
          // whole outline sideways for a few seconds. It WRAPS, because a
          // refusal is a sentence rather than a word — the ops layer names the
          // node and says what to do about it — and a line that never wrapped
          // would run off the right of the screen with the reason on it.
          <span
            class="absolute left-0 top-full z-20 mt-0.5 max-w-[24rem] w-max rounded border border-rule bg-paper px-2 py-1 text-xs shadow-md"
            classList={{
              "text-alarm": message().tone === "alarm",
              "text-muted": message().tone === "aside",
            }}
            data-testid={TESTID.nodeMenuSaid}
            // WHICH mood, as a fact in the markup rather than as a colour: the
            // red is a styling decision a refactor may change, and a scenario
            // asking "was that a refusal or a remark" must not be asking about
            // a class name.
            data-tone={message().tone}
            // Announced, never focus-stealing — the reader's pointer is on the
            // row and their place in the outline is not ours to take. A
            // refusal is an alert, a remark is not: the difference is whether
            // it interrupts what a screen reader is already saying.
            role={message().tone === "alarm" ? "alert" : "status"}
            aria-live={message().tone === "alarm" ? "assertive" : "polite"}
          >
            {message().text}
          </span>
        )}
      </Show>
    </div>
  )
}

function MenuPanel(props: {
  readonly root: () => HTMLDivElement | undefined
  readonly actions: ReadonlyArray<MenuAction>
  readonly onPick: (action: MenuAction) => void | Promise<void>
  readonly onClose: () => void
}) {
  /** The verb waiting for an answer, or `null` while the list is showing. It
   *  lives in the PANEL rather than beside `said`, so the question dies with
   *  the panel: a menu closed on Escape and reopened is a menu that is not
   *  still asking. */
  const [asking, setAsking] = createSignal<MenuAction | null>(null)

  onMount(() => {
    const onPointer = (event: PointerEvent): void => {
      const target = event.target
      if (!(target instanceof Node)) return
      if (props.root()?.contains(target)) return
      props.onClose()
    }
    const onKey = (event: KeyboardEvent): void => {
      if (event.key === "Escape") props.onClose()
    }
    // pointerdown, capture — same as theme/Picker and note/expand.
    document.addEventListener("pointerdown", onPointer, true)
    document.addEventListener("keydown", onKey)
    onCleanup(() => {
      document.removeEventListener("pointerdown", onPointer, true)
      document.removeEventListener("keydown", onKey)
    })
  })

  /** Choosing an entry: the question first, for the verb that has one, and the
   *  verb itself once it has been asked. */
  const chose = (action: MenuAction): void => {
    if (action.confirm !== undefined && asking() !== action) {
      setAsking(action)
      return
    }
    void props.onPick(action)
  }

  /** Backing out of the question, with the caret put back where it was asked
   *  from. The confirm takes the focus when it opens (a panel that swapped its
   *  content under an unmoved focus would leave the keyboard on an element that
   *  is gone), so cancelling has to hand it back — otherwise a person who
   *  opened this menu with the keyboard is returned to the top of the document
   *  and has to walk down the whole page again. After the frame that redraws
   *  the list, because the button being aimed at does not exist until then. */
  let list: HTMLUListElement | undefined
  const cancel = (action: MenuAction): void => {
    setAsking(null)
    queueMicrotask(() =>
      list?.querySelector<HTMLElement>(`[data-action="${action.id}"]`)?.focus()
    )
  }

  return (
    <div
      data-testid={TESTID.nodeMenuPanel}
      class="absolute left-0 top-full z-20 mt-0.5 min-w-[10.5rem] rounded border border-rule bg-paper py-1 text-sm text-ink shadow-md"
    >
      <Show
        when={asking()}
        fallback={
          // Plain list, not role=menu: we do not implement roving focus /
          // arrow keys. A labelled group of buttons matches what is here.
          <ul ref={list} aria-label="node actions" class="m-0 list-none p-0">
            <For each={props.actions}>
              {(action) => (
                <li classList={{ "mt-1 border-t border-rule pt-1": action.divider }}>
                  <button
                    type="button"
                    class="block w-full cursor-pointer border-0 bg-transparent px-3 py-1.5 text-left text-ink hover:bg-rule"
                    data-testid={TESTID.nodeMenuItem}
                    data-action={action.id}
                    onClick={() => chose(action)}
                  >
                    {action.label}
                  </button>
                </li>
              )}
            </For>
          </ul>
        }
      >
        {(action) => <Confirm action={action()} onGo={chose} onCancel={cancel} />}
      </Show>
    </div>
  )
}

/**
 * The second step: the question, and the two ways out of it.
 *
 * The QUESTION is the group's accessible name as well as its text, so a reader
 * arriving on the confirm button by keyboard is told what they are confirming
 * rather than reading the word "Archive" twice. The caret goes to that button
 * on mount — a panel that swapped its content under an unmoved focus would
 * leave the keyboard on an element that is no longer there.
 */
function Confirm(props: {
  readonly action: MenuAction
  readonly onGo: (action: MenuAction) => void
  readonly onCancel: (action: MenuAction) => void
}) {
  let go: HTMLButtonElement | undefined
  onMount(() => go?.focus())

  return (
    // A WIDTH rather than a maximum: the panel is as wide as its longest verb
    // otherwise, and a question set in that column is eight lines of two words.
    <div class="w-64 px-3 py-1.5" role="group" aria-label={props.action.confirm}>
      <p class="m-0 text-xs leading-snug text-ink" data-testid={TESTID.nodeMenuConfirm}>
        {props.action.confirm}
      </p>
      <div class="mt-2 flex gap-2">
        <button
          ref={go}
          type="button"
          class="cursor-pointer rounded border border-alarm bg-transparent px-2 py-1 text-xs text-alarm hover:bg-alarm/10"
          data-testid={TESTID.nodeMenuItem}
          data-action={props.action.id}
          onClick={() => props.onGo(props.action)}
        >
          {props.action.label}
        </button>
        <button
          type="button"
          class="cursor-pointer rounded border border-rule bg-transparent px-2 py-1 text-xs text-muted hover:text-ink"
          data-testid={TESTID.nodeMenuItem}
          data-action="cancel"
          onClick={() => props.onCancel(props.action)}
        >
          Cancel
        </button>
      </div>
    </div>
  )
}
