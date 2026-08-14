/**
 * The `•••` hover menu to the left of a row's collapse triangle.
 *
 * Presentation only: open, close, a list of verbs, a question before the one
 * verb that asks one, and a line for whatever came back. What those verbs ARE
 * is the caller's catalog (`./actions.ts`) — a further action later is another
 * entry there, not a branch here.
 *
 * ## Kobalte owns the menu, and that is the point of this file
 *
 * Being open, where the panel goes, the pointer outside that shuts it, Escape,
 * the focus that returns to the `•••` afterwards, and the arrow keys that walk
 * the list are `@kobalte/core`'s `DropdownMenu` — the SolidJS ecosystem's
 * accessible primitive, and HACKING.md's rule ("make full use of the ecosystem
 * of libraries in SolidJS instead of hard-rolling"). What this file hand-rolled
 * instead was a fourth copy of the same forty lines, with `role=menu` and the
 * keyboard that role promises deliberately left out because the copy did not
 * implement them. The primitive brings them, so the list is a menu now rather
 * than a labelled group of buttons that reads like one.
 *
 * Three decisions keep it drawn exactly where the hand-rolled panel was:
 *
 *   - **`placement="bottom-start"` with a 2px `gutter`** is what `absolute
 *     left-0 top-full mt-0.5` was, and Kobalte's positioner is an `absolute`
 *     box in this row's own positioned root — NOT portalled (there is no
 *     `DropdownMenu.Portal` below) — so the panel still scrolls with its anchor
 *     instead of being a detached `fixed` box, and the open menu is still
 *     inside `group/row` so the `•••` it hangs off stays revealed while it is
 *     up. What is new is that floating-ui FLIPS it above the row near the
 *     bottom of the window, which the hand-rolled one could not do.
 *   - **`modal={false}`**: a row menu is not the only thing on the page. Modal
 *     would lock the scroll, disable pointer events outside and trap focus —
 *     none of which the panel this replaces did.
 *   - **focus leaving does not dismiss it** (`onFocusOutside` is prevented).
 *     The hand-rolled panel shut on a pointer outside and on Escape, and on
 *     nothing else; cancelling the confirm below moves the caret through
 *     `<body>` for a microtask on its way back to the entry it was asked from,
 *     and a menu that read that as "focus left" would shut on its own Cancel.
 *
 * THE CONFIRM IS THIS PANEL'S OWN SECOND STEP, and that is a decision rather
 * than a convenience: a `window.confirm()` is browser chrome olai does not
 * own, cannot theme and cannot say a sentence of its own inside — and it
 * freezes the page around a question about one row. So the panel swaps its
 * content for the question, in the same box under the same `•••`, and Escape
 * or a click outside is still the way out of it.
 */

import { DropdownMenu } from "@kobalte/core/dropdown-menu"
import { createSignal, For, onCleanup, onMount, Show } from "solid-js"

import { QUIET_PILL } from "../pill.ts"
import { TESTID } from "../testids.ts"
import { HOVER_CELL, MENU_REVEAL } from "../touch.ts"
import { type Said, SAID_MS } from "../edit/undoing.ts"

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

/** One entry, and the rule that may sit above it. The classes are the panel's
 *  own — Kobalte ships no styles — so this is the same box the hand-rolled
 *  `<button>` was, in a `role="menuitem"` this time. */
const ITEM = "cursor-pointer px-3 py-1.5 text-left text-ink hover:bg-rule"

/**
 * Whether this verb asks before it runs.
 *
 * ONE reading of the confirm, because the entry below acts on it twice: the
 * question replaces the list instead of the verb happening, AND the menu stays
 * open to ask it (`closeOnSelect`). Spelled at both props, the two could drift
 * into a menu that shuts on the way to a question nobody then sees.
 *
 * What ANSWERING the question does is the confirm's own entry, which calls
 * `onPick` directly — so "ask, then do" stays two call sites rather than one
 * function telling them apart by object identity.
 */
const asks = (action: MenuAction): boolean => action.confirm !== undefined

export function NodeMenu(props: {
  readonly actions: ReadonlyArray<MenuAction>
}) {
  /** What the last action had to say, or `null`. The menu is CLOSED by the
   *  time an action answers, so this belongs to the root beside the `•••`
   *  rather than to the panel: a message inside something that has gone is a
   *  message nobody reads. */
  const [said, setSaid] = createSignal<Said | null>(null)
  /** The open panel, for the one thing the confirm has to find in it (below).
   *  Kobalte owns everything else about it. */
  let panel: HTMLElement | undefined
  let clearing: ReturnType<typeof setTimeout> | undefined

  onCleanup(() => clearTimeout(clearing))

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
    // Positioned root for Kobalte's positioner. Hidden entirely below md so a
    // phone spends no gutter width on the menu (triangle stays).
    <div class="relative hidden shrink-0 md:block">
      <DropdownMenu modal={false} placement="bottom-start" gutter={2}>
        <DropdownMenu.Trigger
          class={`${HOVER_CELL} ${MENU_REVEAL} cursor-pointer border-0 bg-transparent p-0 text-[0.65rem] leading-none tracking-[0.05em] text-muted hover:text-ink`}
          data-testid={TESTID.nodeMenu}
          aria-label="node menu"
          title="node menu"
          // Kobalte toggles on the POINTERDOWN (and on the click for a touch
          // pointer), so both are stopped here: opening a row's menu is not
          // also a press on the row it belongs to.
          onPointerDown={(event: PointerEvent) => event.stopPropagation()}
          onClick={(event: MouseEvent) => event.stopPropagation()}
        >
          •••
        </DropdownMenu.Trigger>
        <DropdownMenu.Content
          ref={(el: HTMLElement) => {
            panel = el
            // AND THE CARET GOES IN, which is the price of laying the panel
            // out in the row instead of portalling it: Kobalte's mount focus
            // lands only for a PORTALLED content, so a menu opened with the
            // keyboard would otherwise leave the caret on the `•••` — and the
            // arrow keys, which are half of what the primitive is FOR, would
            // have nothing to walk. From the panel, `Home`/`End` and the
            // arrows reach the entries. A menu opened with a POINTER still
            // ends up with the caret on the button that was pressed, exactly
            // as the panel this replaces did: the press focuses the trigger
            // back immediately afterwards. `queueMicrotask` for the same
            // reason `../popover.ts` uses one: the element is not attached at
            // the instant the ref runs.
            queueMicrotask(() => el.focus())
          }}
          data-testid={TESTID.nodeMenuPanel}
          // `relative` so the `z-20` bites: Kobalte's positioner is the
          // absolute box, and a z-index on a STATIC child of it would do
          // nothing. (Kobalte's content carries `position: relative` in an
          // inline style of its own; this says so in the class list rather
          // than depending on it.) Everything else here is the panel the
          // hand-rolled one drew, class for class.
          class="relative z-20 min-w-[10.5rem] rounded border border-rule/70 bg-panel py-1 text-sm text-ink shadow-md"
          onFocusOutside={(event: Event) => event.preventDefault()}
        >
          <MenuPanel actions={props.actions} onPick={pick} panel={() => panel} />
        </DropdownMenu.Content>
      </DropdownMenu>
      <Show when={said()}>
        {(message) => (
          // Absolute, like the panel: the gutter's width is shared by every row
          // in the tree (`touch.ts`), and a word that widened it would move the
          // whole outline sideways for a few seconds. It WRAPS, because a
          // refusal is a sentence rather than a word — the ops layer names the
          // node and says what to do about it — and a line that never wrapped
          // would run off the right of the screen with the reason on it.
          <span
            class="absolute left-0 top-full z-20 mt-0.5 max-w-[24rem] w-max rounded border border-rule/70 bg-panel px-2 py-1 text-xs shadow-md"
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

/**
 * What is inside the open panel: the list, or the question one verb asks
 * first.
 *
 * It lives in `DropdownMenu.Content`, which Kobalte unmounts when the menu
 * shuts — so `asking` dies with the panel, and a menu closed on Escape and
 * reopened is a menu that is not still asking.
 */
function MenuPanel(props: {
  readonly actions: ReadonlyArray<MenuAction>
  readonly onPick: (action: MenuAction) => void | Promise<void>
  readonly panel: () => HTMLElement | undefined
}) {
  const [asking, setAsking] = createSignal<MenuAction | null>(null)

  /** Backing out of the question, with the caret put back where it was asked
   *  from. The confirm takes the focus when it opens (a panel that swapped its
   *  content under an unmoved focus would leave the keyboard on an element that
   *  is gone), so cancelling has to hand it back — otherwise a person who
   *  opened this menu with the keyboard is returned to the top of the document
   *  and has to walk down the whole page again. After the frame that redraws
   *  the list, because the entry being aimed at does not exist until then. */
  const cancel = (action: MenuAction): void => {
    setAsking(null)
    queueMicrotask(() =>
      props.panel()?.querySelector<HTMLElement>(`[data-action="${action.id}"]`)
        ?.focus()
    )
  }

  return (
    <Show
      when={asking()}
      fallback={
        <For each={props.actions}>
          {(action) => (
            <>
              {/* The rule between the halves, as a `role="separator"` rather
                  than as a border on the entry below it: the same 4px above,
                  hairline, 4px below the `<li>` used to draw, and this way the
                  hover band is still exactly the entry. */}
              <Show when={action.divider}>
                <DropdownMenu.Separator class="my-1 border-t border-rule" />
              </Show>
              <DropdownMenu.Item
                class={ITEM}
                data-testid={TESTID.nodeMenuItem}
                data-action={action.id}
                closeOnSelect={!asks(action)}
                onSelect={() =>
                  asks(action) ? setAsking(action) : void props.onPick(action)}
              >
                {action.label}
              </DropdownMenu.Item>
            </>
          )}
        </For>
      }
    >
      {(action) => (
        <Confirm action={action()} onGo={props.onPick} onCancel={cancel} />
      )}
    </Show>
  )
}

/**
 * The second step: the question, and the two ways out of it.
 *
 * The QUESTION is the group's accessible name as well as its text, so a reader
 * arriving on the confirm entry by keyboard is told what they are confirming
 * rather than reading the words "Move to Trash" twice. The caret goes to that
 * on mount — a panel that swapped its content under an unmoved focus would
 * leave the keyboard on an element that is no longer there. (A menu being
 * driven by a POINTER may take it straight back off again: Kobalte's list
 * follows the mouse, and the mouse is over where the entry used to be. That is
 * the primitive's own behaviour and it costs the pointer nothing — what the
 * focus was FOR is the keyboard.)
 *
 * Both ways out are `DropdownMenu.Item`s, which is what makes them reachable
 * with the arrow keys the list is walked with — and what closes the menu when
 * the verb goes ahead, since that is what an item does when it is chosen.
 */
function Confirm(props: {
  readonly action: MenuAction
  readonly onGo: (action: MenuAction) => void | Promise<void>
  readonly onCancel: (action: MenuAction) => void
}) {
  let go: HTMLElement | undefined
  onMount(() => go?.focus())

  return (
    // A WIDTH rather than a maximum: the panel is as wide as its longest verb
    // otherwise, and a question set in that column is eight lines of two words.
    <div class="w-64 px-3 py-1.5" role="group" aria-label={props.action.confirm}>
      <p class="m-0 text-xs leading-snug text-ink" data-testid={TESTID.nodeMenuConfirm}>
        {props.action.confirm}
      </p>
      <div class="mt-2 flex gap-2">
        <DropdownMenu.Item
          ref={(el: HTMLElement) => {
            go = el
          }}
          class="cursor-pointer rounded border border-alarm bg-transparent px-2 py-1 text-xs text-alarm hover:bg-alarm/10"
          data-testid={TESTID.nodeMenuItem}
          data-action={props.action.id}
          onSelect={() => void props.onGo(props.action)}
        >
          {props.action.label}
        </DropdownMenu.Item>
        <DropdownMenu.Item
          class={`${QUIET_PILL} cursor-pointer`}
          data-testid={TESTID.nodeMenuItem}
          data-action="cancel"
          closeOnSelect={false}
          onSelect={() => props.onCancel(props.action)}
        >
          Cancel
        </DropdownMenu.Item>
      </div>
    </div>
  )
}
