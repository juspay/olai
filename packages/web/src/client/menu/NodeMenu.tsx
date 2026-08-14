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
 * and the arrow keys that walk the list are `@kobalte/core`'s `DropdownMenu` —
 * the SolidJS ecosystem's accessible primitive, and HACKING.md's rule ("make
 * full use of the ecosystem of libraries in SolidJS instead of hard-rolling").
 * What this file hand-rolled instead was a fourth copy of the same forty lines,
 * with `role=menu` and the keyboard that role promises deliberately left out
 * because the copy did not implement them. The primitive brings them, so the
 * list is a menu now rather than a labelled group of buttons that reads like
 * one.
 *
 * WHAT IS STILL THIS FILE'S is the caret, both ways: in when the panel opens
 * and back on the `•••` when it goes. Kobalte has both, and neither fires for a
 * menu laid out in the row rather than portalled — each is registered by an
 * effect owned by a component that outlives every open and close. The two are
 * named where they are done (the content's `ref`, and `handBack`), and
 * `features/menu_panel.feature` holds both ends so a Kobalte bump that fixes
 * them upstream shows up as a passing suite rather than as a surprise.
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
 * ONE MORE DECISION, and it is about the OUTLINE rather than the menu: a shut
 * `DropdownMenu` is not free, and there is one per row. So the primitive is
 * mounted the first time a row is asked for its menu and not before — see
 * {@link Dots}, which is what the `•••` is until then and which has the
 * measurements.
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

import { ALARM_PILL, QUIET_PILL } from "../pill.ts"
import { TESTID } from "../testids.ts"
import { HOVER_CELL, MENU_REVEAL } from "../touch.ts"
import { SaidLine } from "../edit/SaidLine.tsx"
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

/** The `•••` itself, in the one spelling both the dead button and Kobalte's
 *  trigger are drawn from — they stand in for each other (see {@link Dots}),
 *  so a class on one and not the other would be a flicker at the press. */
const DOTS =
  `${HOVER_CELL} ${MENU_REVEAL} cursor-pointer border-0 bg-transparent p-0 ` +
  "text-[0.65rem] leading-none tracking-[0.05em] text-muted hover:text-ink"

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
  /**
   * Whether this row has ever reached for its menu — and so whether it pays
   * for one. See {@link Dots}: until the first press, the `•••` is a plain
   * button and Kobalte is not mounted here at all.
   */
  const [armed, setArmed] = createSignal(false)
  let clearing: ReturnType<typeof setTimeout> | undefined
  /** The `•••` once this row is armed — where the caret goes back to. */
  let trigger: HTMLElement | undefined
  /** What last touched this menu: the two gestures leave the caret in
   *  different places, and only one of them wants it back (see `handBack`). */
  let lastGesture: "key" | "pointer" = "pointer"

  onCleanup(() => clearTimeout(clearing))

  /**
   * THE CARET COMES BACK when the panel that had it goes.
   *
   * Kobalte has this — `onCloseAutoFocus` puts the caret on the trigger — and
   * here it never fires: the hook is the focus scope's UNMOUNT half, registered
   * by an effect owned by the content COMPONENT, and that component outlives
   * every open/close of an armed row (the panel is a `<Show>` inside it). So
   * the cleanup that would restore the caret is never reached, and Escape out
   * of a menu opened with the keyboard leaves it on `<body>` — the whole page
   * to walk down again, which is the same failure the confirm's own focus is
   * written down to prevent. Called from the panel's own disposal, which is a
   * place that does run.
   *
   * Two guards, and each is a decision rather than a nicety:
   *
   *   - only a KEY gets the caret back, which is `./popover.ts`'s rule for the
   *     header's panels word for word: a pointer put the caret where it landed
   *     and that is where the reader is now, so a menu that took it back would
   *     be pulling them out of whatever they just pressed. It is also what
   *     keeps a menu opened and dismissed with the mouse drawing exactly what
   *     the hand-rolled panel drew — Chromium rings a control it is handed the
   *     caret programmatically, and a ring nobody's keyboard asked for is a
   *     ring in the wrong place.
   *   - the caret is only taken back from NOWHERE (`<body>`). Anything else has
   *     it on purpose — a verb that moved the page, a control the press went
   *     on to — and this menu does not get to overrule that.
   */
  const handBack = (): void => {
    if (lastGesture !== "key") return
    // After the frame that removes the panel: until then the caret is still on
    // an element that is on its way out, and `<body>` is what it becomes.
    queueMicrotask(() => {
      const caret = document.activeElement
      if (caret === null || caret === document.body) trigger?.focus()
    })
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
      <Show when={armed()} fallback={<Dots onArm={() => setArmed(true)} />}>
        <DropdownMenu modal={false} placement="bottom-start" gutter={2} defaultOpen>
          <DropdownMenu.Trigger
            ref={trigger}
            class={DOTS}
            data-testid={TESTID.nodeMenu}
            aria-label="node menu"
            title="node menu"
            // Kobalte toggles on the POINTERDOWN (and on the click for a touch
            // pointer), so both are stopped here: opening a row's menu is not
            // also a press on the row it belongs to. It is also a gesture the
            // caret's way home has to know about (`handBack`): pressing the
            // `•••` to shut a menu the KEYBOARD opened is still a press.
            onPointerDown={(event: PointerEvent) => {
              lastGesture = "pointer"
              event.stopPropagation()
            }}
            onClick={(event: MouseEvent) => event.stopPropagation()}
          >
            •••
          </DropdownMenu.Trigger>
          <DropdownMenu.Content
            ref={(el: HTMLElement) => {
              // AND THE CARET GOES IN — on the SECOND open and every one after
              // it, which is the case this exists for.
              //
              // Kobalte's own mount focus (`onOpenAutoFocus`, and the focus
              // scope behind it) is registered by an effect that reads the
              // content's element through a plain binding rather than a signal,
              // so it lands once and is never asked again. Without a
              // `DropdownMenu.Portal` the panel is a `<Show>` INSIDE that
              // component: the first open creates the component while already
              // open (`Dots` arms with `defaultOpen`), so that one focuses
              // itself — and every REOPEN swaps the `<Show>` back in under a
              // component that never re-runs, leaving the caret on the `•••`
              // with the arrow keys, half of what the primitive is FOR, with
              // nothing to walk. Both halves verified by driving the browser
              // with this line and without it. From the panel, `Home`/`End` and
              // the arrows reach the entries.
              //
              // A menu opened with a POINTER still ends up with the caret on
              // the button that was pressed, exactly as the panel this replaces
              // did: the press focuses the trigger back immediately afterwards.
              // `queueMicrotask` for the same reason `../popover.ts` uses one:
              // the element is not attached at the instant the ref runs.
              queueMicrotask(() => el.focus())
            }}
            data-testid={TESTID.nodeMenuPanel}
            // `relative` so the `z-20` bites: Kobalte's positioner is the
            // absolute box, and a z-index on a STATIC child of it would do
            // nothing. (Kobalte's content carries `position: relative` in an
            // inline style of its own; this says so in the class list rather
            // than depending on it.) Everything else here is the panel the
            // hand-rolled one drew, class for class.
            // `focus:outline-none` because the caret lands on this BOX when the
            // menu opens (see the ref above) and a box is not what anybody is
            // aiming at — the ring belongs on the entry the keyboard is
            // standing on, and that is `data-[highlighted]` below. Without it,
            // Chromium rings the whole panel for a menu opened with a mouse.
            class="relative z-20 min-w-[10.5rem] rounded border border-rule/70 bg-panel py-1 text-sm text-ink shadow-md focus:outline-none"
            onFocusOutside={(event: Event) => event.preventDefault()}
            // WHICH GESTURE is driving this menu, for the caret's way home. A
            // key anywhere in the panel (Escape, an entry chosen with Enter,
            // the arrows) is the one that gets it back; a press inside or
            // outside is not. Kobalte keeps the same distinction for its own
            // close-focus — it just cannot act on it here (see `handBack`).
            onKeyDown={() => {
              lastGesture = "key"
            }}
            onPointerDown={() => {
              lastGesture = "pointer"
            }}
            onPointerDownOutside={() => {
              lastGesture = "pointer"
            }}
          >
            <MenuPanel actions={props.actions} onPick={pick} onGone={handBack} />
          </DropdownMenu.Content>
        </DropdownMenu>
      </Show>
      <Show when={said()}>
        {(message) => (
          // Absolute, like the panel: the gutter's width is shared by every row
          // in the tree (`touch.ts`), and a word that widened it would move the
          // whole outline sideways for a few seconds. It WRAPS, because a
          // refusal is a sentence rather than a word — the ops layer names the
          // node and says what to do about it — and a line that never wrapped
          // would run off the right of the screen with the reason on it.
          //
          // The MOOD is `../edit/SaidLine.tsx`'s — its colour, its `data-tone`
          // and whether a screen reader is interrupted are one decision this
          // app makes once. Where the line hangs is this menu's.
          <SaidLine
            said={message()}
            class="absolute left-0 top-full z-20 m-0 mt-0.5 max-w-[24rem] w-max rounded border border-rule/70 bg-panel px-2 py-1 text-xs shadow-md"
            testid={TESTID.nodeMenuSaid}
          />
        )}
      </Show>
    </div>
  )
}

/**
 * The `•••` before anybody has pressed it: the same three dots, drawn by a
 * `<button>` that costs nothing.
 *
 * THE OUTLINE IS HUNDREDS OF ROWS, and a Kobalte `DropdownMenu` is not free
 * while it is shut — the root builds its disclosure state, its list state and
 * its popper, and the content's body runs eagerly (only its DOM waits on the
 * open state), which between them is an `IntersectionObserver`, a deferred
 * autofocus timer, four locale subscriptions and a few dozen signals PER ROW.
 * Measured on this app's own roadmap (140 rows): 140 IntersectionObservers and
 * 33 MB of heap where the hand-rolled panel had none and 19 MB.
 *
 * So a row mounts the primitive the first time somebody reaches for it, and
 * the press that armed it is the press that opens it (`defaultOpen`). The row
 * stays armed afterwards — the second press is Kobalte's own trigger, doing
 * its own toggle. Only rows a person has actually touched ever pay, which on
 * any real page is a handful.
 *
 * The KEYS matter as much as the pointer here: this button is what a Tab
 * lands on, so the keys that open a menu have to arm it too, or a keyboard
 * would press an inert button. Enter, Space and the two arrows Kobalte's own
 * trigger opens on, and the caret lands in the panel from there (see the
 * content's ref above).
 */
function Dots(props: { readonly onArm: () => void }) {
  const arm = (event: Event): void => {
    // The same reason Kobalte's trigger stops these: opening a row's menu is
    // not also a press on the row it belongs to.
    event.stopPropagation()
    props.onArm()
  }

  return (
    <button
      type="button"
      class={DOTS}
      data-testid={TESTID.nodeMenu}
      aria-haspopup="true"
      aria-expanded={false}
      aria-label="node menu"
      title="node menu"
      onPointerDown={arm}
      onKeyDown={(event) => {
        if (!["Enter", " ", "ArrowDown", "ArrowUp"].includes(event.key)) return
        // Prevented HERE, unlike the press above: Space would scroll the page
        // out from under the menu it just opened, and Enter on a button
        // synthesises a click that would arrive at whatever took this one's
        // place.
        event.preventDefault()
        arm(event)
      }}
      onClick={(event) => event.stopPropagation()}
    >
      •••
    </button>
  )
}

/**
 * What is inside the open panel: the list, or the question one verb asks
 * first.
 *
 * It lives in `DropdownMenu.Content`, which Kobalte unmounts when the menu
 * shuts — so `asking` dies with the panel, and a menu closed on Escape and
 * reopened is a menu that is not still asking. That disposal is also the one
 * event in the whole primitive that fires on every close, which is why the
 * caret's way home hangs off it (`onGone`, and {@link NodeMenu}'s `handBack`
 * for why Kobalte's own hook cannot be the one to do it).
 */
function MenuPanel(props: {
  readonly actions: ReadonlyArray<MenuAction>
  readonly onPick: (action: MenuAction) => void | Promise<void>
  readonly onGone: () => void
}) {
  const [asking, setAsking] = createSignal<MenuAction | null>(null)
  onCleanup(() => props.onGone())
  /** The entries as they stand, by the verb each one is for — so cancelling
   *  below can hand the caret back to an ELEMENT rather than look one up by a
   *  selector. Rewritten as the list is redrawn, which is what makes it right
   *  after the swap back from the question. */
  const entries = new Map<string, HTMLElement>()

  /** Backing out of the question, with the caret put back where it was asked
   *  from. The confirm takes the focus when it opens (a panel that swapped its
   *  content under an unmoved focus would leave the keyboard on an element that
   *  is gone), so cancelling has to hand it back — otherwise a person who
   *  opened this menu with the keyboard is returned to the top of the document
   *  and has to walk down the whole page again. After the frame that redraws
   *  the list, because the entry being aimed at does not exist until then. */
  const cancel = (action: MenuAction): void => {
    setAsking(null)
    queueMicrotask(() => entries.get(action.id)?.focus())
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
                ref={(el: HTMLElement) => entries.set(action.id, el)}
                // The classes are the panel's own — Kobalte ships no styles —
                // so this is the same box the hand-rolled `<button>` was, in a
                // `role="menuitem"` this time. `data-[highlighted]` is where
                // the entry the KEYBOARD is standing on shows, in the same
                // band a pointer gets: the arrow keys are new here, and a
                // walk nobody can see is not a walk. It replaces the focus
                // ring rather than joining it (`focus:outline-none`) —
                // Chromium draws that one for pointer opens too.
                class="cursor-pointer px-3 py-1.5 text-left text-ink hover:bg-rule focus:outline-none data-[highlighted]:bg-rule"
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
  // A MICROTASK, and it is load-bearing rather than superstitious: `onMount`
  // runs while this subtree is still being built into the open panel, so the
  // element the ref just handed over is not in the document yet and focusing
  // it does nothing at all. One tick later it is attached, the caret lands,
  // and the list this replaced has finished going away. (Without it the
  // question comes up with the caret on `<body>` — the keyboard is left
  // nowhere, which is the exact thing focusing it here is for.)
  onMount(() => queueMicrotask(() => go?.focus()))

  return (
    // A WIDTH rather than a maximum: the panel is as wide as its longest verb
    // otherwise, and a question set in that column is eight lines of two words.
    <div class="w-64 px-3 py-1.5" role="group" aria-label={props.action.confirm}>
      <p class="m-0 text-xs leading-snug text-ink" data-testid={TESTID.nodeMenuConfirm}>
        {props.action.confirm}
      </p>
      <div class="mt-2 flex gap-2">
        <DropdownMenu.Item
          ref={go}
          class={`${ALARM_PILL} cursor-pointer focus:outline-none`}
          data-testid={TESTID.nodeMenuItem}
          data-action={props.action.id}
          onSelect={() => void props.onGo(props.action)}
        >
          {props.action.label}
        </DropdownMenu.Item>
        <DropdownMenu.Item
          class={`${QUIET_PILL} cursor-pointer focus:outline-none`}
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
