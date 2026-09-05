/**
 * The PRIMITIVE and its wiring — everything about the `•••` menu that is
 * Kobalte's, and the whole of what a first paint does not download.
 *
 * This file is the far side of a dynamic `import()` (`./chunk.ts`): it is
 * reached by that one specifier and by nothing else, which is what keeps
 * `@kobalte/core`'s `DropdownMenu` — 80,516 B raw, 23,438 B brotli as this
 * chunk is emitted — out of
 * `main-*.js` and in a chunk of its own. Everything it pulls in follows it
 * there (`./Panel.tsx`, `./Confirm.tsx`), so a STATIC import of any of them
 * from a file the entry reaches would silently undo the split; `../claims.test.ts`
 * sweeps for exactly that. `./NodeMenu.tsx` is what a row draws instead, and it
 * is where the two costs of this file — the bytes, and the per-row runtime the
 * lazy mount refuses — are written down together.
 *
 * ## Kobalte owns the menu, and that is the point of this file
 *
 * Being open, where the panel goes, the pointer outside that shuts it, Escape,
 * and the arrow keys that walk the list are `@kobalte/core`'s `DropdownMenu` —
 * the SolidJS ecosystem's accessible primitive, and the rule ("make
 * full use of the ecosystem of libraries in SolidJS instead of hard-rolling").
 * What this app hand-rolled instead was a fourth copy of the same forty lines,
 * with `role=menu` and the keyboard that role promises deliberately left out
 * because the copy did not implement them. The primitive brings them, so the
 * list is a menu now rather than a labelled group of buttons that reads like
 * one.
 *
 * WHAT IS STILL THIS FILE'S is the caret, both ways: in when the panel opens
 * and back on the `•••` when it goes. Kobalte has both (`onOpenAutoFocus`,
 * `onCloseAutoFocus`). Close-focus is refused here and replaced by
 * {@link handBack}, because the primitive restores the trigger on every close
 * and a pointer that landed somewhere else must not be pulled back. Open-focus
 * is the content's `ref`. `features/menu_panel.feature` holds both ends so a
 * Kobalte bump that changes them shows up as a passing suite rather than as a
 * surprise.
 *
 * Three decisions keep it drawn exactly where the hand-rolled panel was:
 *
 *   - **`placement="bottom-start"` with a 2px `gutter`** is what `absolute
 *     left-0 top-full mt-0.5` was. The panel is PORTALLED
 *     (`DropdownMenu.Portal`) so it leaves the outline's stacking contexts —
 *     a sticky section heading is one, at the same {@link LAYER.row} this
 *     panel rides, and an in-tree menu is the one that is cut in two
 *     (`menu-under-headers`). Floating-ui still hangs it off the trigger and
 *     still FLIPS it above the row near the bottom of the window; the `•••`
 *     stays revealed because the trigger wears `data-[expanded]`, not because
 *     the panel is a descendant of `group/row`. That root is `./NodeMenu.tsx`'s
 *     and stays on the page whether this file has arrived or not.
 *   - **`modal={false}`**: a row menu is not the only thing on the page. Modal
 *     would lock the scroll, disable pointer events outside and trap focus —
 *     none of which the panel this replaces did.
 *   - **focus leaving does not dismiss it** (`onFocusOutside` is prevented).
 *     The hand-rolled panel shut on a pointer outside and on Escape, and on
 *     nothing else; cancelling the confirm (`./Confirm.tsx`) moves the caret
 *     through `<body>` for a microtask on its way back to the entry it was
 *     asked from, and a menu that read that as "focus left" would shut on its
 *     own Cancel.
 *
 * ## AND IT DEFERS, which is the one thing the primitive cannot decide alone
 *
 * Kobalte keeps a stack of its own layers and gives a gesture to the topmost —
 * but this menu is the only layer on it, because the panels this client draws
 * itself are not components wrapping an element and cannot join one
 * (`../topmost.ts` has the whole argument). So the primitive always believes it
 * is on top, and an Escape with a popover opened OVER a menu shut both.
 *
 * The stack every dismissable in this client is on is `../topmost.ts`'s, and
 * this file joins it with {@link topmostWhileOpen} — the same call the popovers
 * and the note make one layer down. What is left is telling Kobalte to sit a
 * gesture out, and there is exactly one place to say it: **the menu's own OPEN
 * state**, which is CONTROLLED (`./door.ts`), so an ask to shut is a REQUEST
 * this app answers rather than a fact the library reports. `onOpenChange`
 * passes one on only while this menu is the panel a dismissal is for.
 *
 * The obvious alternative is to refuse each gesture where the primitive offers
 * it, and it does not work: `onPointerDownOutside` is `preventDefault`able, but
 * `MenuContentBase` closes on **Escape whether or not the event was prevented**
 * ("we force close on escape here", in its own words, because its selectable
 * list prevents the key first). So half the rule would have to live on a flag
 * carried from one handler to another anyway — two spellings of one sentence,
 * and a third gesture would need a third. Guarding the open state covers every
 * way the primitive can decide to close, including the ones it has not grown
 * yet.
 *
 * ## TWO DOORS, because below 48rem there is no `•••` to press
 *
 * A phone spends no gutter width on the menu (`../touch.ts`), so what opens it
 * there is a LONG PRESS on the row's line (`../longPress.ts`) — markup this
 * component does not own. Two things follow here (the third, being open, is
 * `./door.ts`'s):
 *
 *   - **the `•••` is not drawn below md** — `MENU_CELL` is `display: none`
 *     there, which is where that decision belongs and all it costs. The trigger
 *     stays in the MARKUP because it is what holds the primitive's state.
 *   - **the panel hangs off the row line there**, through `getAnchorRect`,
 *     which asks the `•••` for its box and takes the row's when there is none
 *     to have. Same left edge, same drop, one placement for both doors — and
 *     no media query in this file at all.
 */

import { DropdownMenu } from "@kobalte/core/dropdown-menu"
import { createSignal } from "solid-js"

import type { MenuAction } from "./action.ts"
import type { MenuDoor } from "./door.ts"
import { DOTS } from "./Dots.tsx"
import { topmostWhileOpen } from "../topmost.ts"
import { swallowGhost } from "../ghost.ts"
import { LAYER } from "../layer.ts"
import { overlayRoot } from "../overlay.ts"
import { Panel } from "./Panel.tsx"
import { TESTID } from "../testids.ts"

/**
 * A tap in the PANEL, and the click that is about to arrive for a gesture that
 * is over.
 *
 * Kobalte selects an item on the pointer-up, and `closeOnSelect` takes the
 * panel down in the same breath — so by the time a touchscreen makes up the
 * click that stands in for the tap, the entry is gone and the browser aims it
 * at whatever is now under the point, which is the ROW the panel was covering.
 * Choosing `Move to Trash` navigated into a mirror three rows down, and every
 * other entry had the same hole under it.
 *
 * So the ghost is eaten (`../ghost.ts`). Touch only: a mouse's click is
 * dispatched to the ancestor of what was pressed rather than to a fresh
 * hit-test, which is why a pointer has never seen this.
 *
 * On the CONTENT rather than on each entry, which is where it started: a rule
 * spelled per entry is a rule the next entry has to remember, and forgetting
 * it reproduces exactly the bug above. `pointerup` bubbles, so one handler
 * covers the list, the confirm's two buttons, and whatever the catalog grows.
 * A tap that chose nothing arms it too, and that costs nothing: the ghost then
 * lands on the panel it belongs to, which is nothing happening.
 */
const tappedInPanel = (event: PointerEvent): void => {
  if (event.pointerType === "touch") swallowGhost()
}

export function Dropdown(props: {
  readonly actions: ReadonlyArray<MenuAction>
  /** How this row's menu is reached, and whether it is open — the ROW's,
   *  because below `md` the door is a long press on markup this component does
   *  not own, and the panel then hangs off that same markup (`./door.ts`). */
  readonly door: MenuDoor
  /** Run one, and say what came of it. Created and drawn by the ROW
   *  (`./picking.ts`, `./MenuSaid.tsx`): the panel is gone by the time most
   *  answers arrive, and this file is gone with it. */
  readonly onPick: (action: MenuAction) => void | Promise<void>
}) {
  /** The `•••` once this row is armed — where the caret goes back to. */
  let trigger: HTMLElement | undefined
  const [above, setAbove] = createSignal(false)
  /** What last touched this menu: the two gestures leave the caret in
   *  different places, and only one of them wants it back (see `handBack`). */
  let lastGesture: "key" | "pointer" = "pointer"

  /** Is this menu the panel a dismissal is for — the last thing opened that is
   *  still up, across everything this client can put on screen
   *  (`../topmost.ts`)? Kobalte's own stack cannot answer that, because this
   *  menu is the only layer on it. */
  const topmost = topmostWhileOpen(() => props.door.open())

  /**
   * THE CARET COMES BACK when the panel that had it goes.
   *
   * Kobalte has this — `onCloseAutoFocus` puts the caret on the trigger — and
   * that is refused below, because the primitive restores the trigger on EVERY
   * close. A pointer that landed somewhere else must not be pulled back (the
   * same rule `../popover.ts` keeps for the header's panels). Called from the
   * panel's own disposal, which is a place that does run.
   *
   * Two guards, and each is a decision rather than a nicety:
   *
   *   - only a KEY gets the caret back, which is `../popover.ts`'s rule for the
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

  return (
    <DropdownMenu
      modal={false}
      placement="bottom-start"
      onCurrentPlacementChange={(placement) => setAbove(placement.startsWith("top"))}
      gutter={2}
      open={props.door.open()}
      // ...and AN ASK TO SHUT IS ONLY HEARD WHILE THIS MENU IS THE PANEL A
      // DISMISSAL IS FOR. One rule, in one place, for every way the primitive
      // can decide to close — the pointer outside, Escape, its own trigger,
      // an entry chosen — because a menu with something over it is a menu that
      // may not act on any of them. Everything that legitimately shuts it
      // happens while it IS the topmost: choosing an entry is a press inside,
      // and a press outside shuts what is over it first (`../topmost.ts`
      // settles inside that same write, so this reads the stack as it is by
      // then).
      onOpenChange={(open: boolean) => {
        if (open || topmost()) props.door.setOpen(open)
      }}
      // WHAT THE PANEL HANGS OFF: the `•••` where one is DRAWN, and the
      // row's own line where it is not. Below md the `•••` is `hidden` —
      // it is still in the markup, because Kobalte's trigger is what holds
      // the menu's state, and a `display: none` box measures 0×0 at the
      // corner of the window, which is where the panel would be placed.
      // So the anchor is a question about the drawing rather than about
      // the viewport, asked of the box itself: no width, no anchor, and
      // the line the finger was held on takes over (`./door.ts`). Same
      // left edge, same drop below the row, one placement for both doors —
      // and no media query in here at all.
      getAnchorRect={(anchor?: HTMLElement) => {
        const dots = anchor?.getBoundingClientRect()
        return dots !== undefined && dots.width > 0
          ? dots
          : props.door.at()?.getBoundingClientRect()
      }}
    >
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
      <DropdownMenu.Portal mount={overlayRoot()}>
      <DropdownMenu.Content
        ref={(el: HTMLElement) => {
          // AND THE CARET GOES IN. Kobalte's own mount focus
          // (`onOpenAutoFocus`) is the same job, and a portal makes it
          // fire on every open — the content unmounts when the menu shuts.
          // The first-ask still creates this component WHILE already open
          // (`./door.ts` arms and opens in one verb), and that one mount
          // is the case a binding-not-a-signal can miss. The ref covers
          // every open the same way. From the panel, `Home`/`End` and the
          // arrows reach the entries.
          //
          // A menu opened with a POINTER still ends up with the caret on
          // the button that was pressed, exactly as the panel this replaces
          // did: the press focuses the trigger back immediately afterwards.
          // `queueMicrotask` for the same reason `../popover.ts` uses one:
          // the element is not attached at the instant the ref runs.
          // `preventScroll`: a portal mounts the panel before floating-ui
          // has placed it, and a focus that scrolled to that first box
          // jumped the page out from under the row the menu belongs to.
          queueMicrotask(() => el.focus({ preventScroll: true }))
        }}
        data-testid={TESTID.nodeMenuPanel}
        // NAMED here rather than by the trigger Kobalte would point at
        // (`aria-labelledby`), because below md there is no trigger to
        // point at and a dangling id names nothing. The same two words the
        // `•••` carries either way.
        aria-label="node menu"
        // `relative` so the layer bites: Kobalte's positioner is the
        // absolute box, and a z-index on a STATIC child of it would do
        // nothing. (Kobalte's content carries `position: relative` in an
        // inline style of its own; this says so in the class list rather
        // than depending on it.) `LAYER.row` is the whole claim — over the
        // rows it covers, under every piece of chrome (`../layer.ts`) —
        // and it is true because the portal above took the panel out of
        // the outline. Everything else here is the panel the hand-rolled
        // one drew, class for class.
        // `focus:outline-none` because the caret lands on this BOX when the
        // menu opens (see the ref above) and a box is not what anybody is
        // aiming at — the ring belongs on the entry the keyboard is
        // standing on, and that is `data-[highlighted]` in `./Panel.tsx`.
        // Without it, Chromium rings the whole panel for a menu opened with
        // a mouse.
        // A PANEL TALLER THAN THE WINDOW STILL REACHES ITS LAST ENTRY, and the
        // height limit and scroll use the popper's own answer rather than a
        // measurement taken here. Floating-ui already flips this list to
        // whichever side of the row has more room; when NEITHER side has
        // enough — seventeen verbs on a node with children, and a laptop window
        // is not tall — flipping picks the better side and the rest hangs off
        // the screen, where nothing can press it. `--kb-popper-content-
        // available-height` is what the primitive's `size` middleware measures
        // for exactly this, published on the positioner every time the panel is
        // placed; the cap belongs on THIS box (the positioner's own
        // `max-height`, which `fitViewport` would set, is a limit its
        // overflowing child ignores), and the scroll is what turns a cap into a
        // list somebody can still reach the end of.
        class={`relative ${LAYER.row} min-w-[10.5rem] overflow-y-auto rounded border border-rule/70 bg-panel py-1 text-sm text-ink shadow-md focus:outline-none`}
        // The primitive measures from the viewport edge. An upward menu must
        // reserve the app header as well, or its first entries sit behind it.
        style={{ "max-height": above()
          ? "max(0px, calc(var(--kb-popper-content-available-height) - var(--height-header)))"
          : "var(--kb-popper-content-available-height)" }}
        // The primitive restores the trigger on every close. A KEY still
        // gets the caret back (`handBack`); a pointer that landed somewhere
        // else must not be pulled off it.
        onCloseAutoFocus={(event: Event) => event.preventDefault()}
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
        // ...and the tap that any of it leaves behind (see above).
        onPointerUp={tappedInPanel}
      >
        <Panel actions={props.actions} onPick={props.onPick} onGone={handBack} />
      </DropdownMenu.Content>
      </DropdownMenu.Portal>
    </DropdownMenu>
  )
}
