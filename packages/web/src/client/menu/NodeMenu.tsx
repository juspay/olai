/**
 * The `•••` hover menu to the left of a row's collapse triangle — the
 * PRIMITIVE and its wiring, which after the split is the whole of what is
 * left here.
 *
 * What the entries are is the caller's catalog (`./actions.ts`) over a
 * description this file never reads (`./action.ts`); what the open panel LOOKS
 * like is `./Panel.tsx`; running one and saying what came of it is
 * `./picking.ts` and `./MenuSaid.tsx`; the `•••` before anybody has pressed it
 * is `./Dots.tsx`. This file is the four things that are true of the menu as a
 * MENU: what owns it, where it is drawn, what it hangs off, and where the
 * caret goes.
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
 *     nothing else; cancelling the confirm (`./Confirm.tsx`) moves the caret
 *     through `<body>` for a microtask on its way back to the entry it was
 *     asked from, and a menu that read that as "focus left" would shut on its
 *     own Cancel.
 *
 * ONE MORE DECISION, and it is about the OUTLINE rather than the menu: a shut
 * `DropdownMenu` is not free, and there is one per row. So the primitive is
 * mounted the first time a row is asked for its menu and not before — see
 * `./Dots.tsx`, which is what the `•••` is until then, has the measurements,
 * and is the reason this component is under a `<Show>` at all.
 *
 * ## TWO DOORS, because below 48rem there is no `•••` to press
 *
 * A phone spends no gutter width on the menu (`../touch.ts`), so what opens it
 * there is a LONG PRESS on the row's line (`../longPress.ts`) — markup this
 * component does not own. Three things follow, and they are the whole of the
 * difference:
 *
 *   - **being open is the ROW's** (`./door.ts`), not a signal in here, since
 *     both doors have to write it — and the menu is CONTROLLED rather than
 *     `defaultOpen` for the same reason: a row asked a second time has a
 *     primitive already mounted with nothing to remount.
 *   - **the `•••` is not drawn below md** — `MENU_CELL` is `display: none`
 *     there, which is where that decision belongs and all it costs. What
 *     cannot be `hidden` is the ROOT, the way it used to be before a phone had
 *     any door at all: the panel is inside it, and a `display: none` ancestor
 *     takes the panel with it. So the root is out of the gutter's flow instead
 *     — a zero-width absolute box at the row's left edge — and the phone's
 *     strip is exactly the triangle it always was.
 *   - **the panel hangs off the row line there**, through `getAnchorRect`,
 *     which asks the `•••` for its box and takes the row's when there is none
 *     to have. Same left edge, same drop, one placement for both doors — and
 *     no media query in this file at all.
 */

import { DropdownMenu } from "@kobalte/core/dropdown-menu"
import { Show } from "solid-js"

import type { MenuAction } from "./action.ts"
import type { MenuDoor } from "./door.ts"
import { DOTS, Dots } from "./Dots.tsx"
import { swallowGhost } from "../ghost.ts"
import { LAYER } from "../layer.ts"
import { MenuSaid } from "./MenuSaid.tsx"
import { Panel } from "./Panel.tsx"
import { createPicking } from "./picking.ts"
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

export function NodeMenu(props: {
  readonly actions: ReadonlyArray<MenuAction>
  /** How this row's menu is reached, and whether it is open — the ROW's,
   *  because below `md` the door is a long press on markup this component does
   *  not own, and the panel then hangs off that same markup (`./door.ts`). */
  readonly door: MenuDoor
}) {
  /** Running a verb, and what it had to say (`./picking.ts`). Created in the
   *  ROW's owner rather than the panel's: the menu is closed by the time most
   *  answers arrive. */
  const picking = createPicking()
  /** The `•••` once this row is armed — where the caret goes back to. */
  let trigger: HTMLElement | undefined
  /** What last touched this menu: the two gestures leave the caret in
   *  different places, and only one of them wants it back (see `handBack`). */
  let lastGesture: "key" | "pointer" = "pointer"

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
    // Positioned root for Kobalte's positioner — in the gutter's flow on a
    // pointer device, where it holds the `•••`, and OUT of it below md, where
    // it holds nothing: a zero-width absolute box at the row's left edge, so
    // the phone's strip is the triangle and the gap arithmetic in `touch.ts`
    // stays what it says it is. It cannot simply be `hidden` there, the way it
    // was before a phone had any door at all — the panel is inside it.
    <div class="absolute inset-y-0 left-0 w-0 shrink-0 md:relative md:w-auto">
      <Show when={props.door.armed()} fallback={<Dots onArm={props.door.show} />}>
        <DropdownMenu
          modal={false}
          placement="bottom-start"
          gutter={2}
          open={props.door.open()}
          onOpenChange={props.door.setOpen}
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
              // open (arming a row opens it in the same breath — `./door.ts`),
              // so that one focuses
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
            // rows it covers, under every piece of chrome (`../layer.ts`).
            // Everything else here is the panel the hand-rolled one drew,
            // class for class.
            // `focus:outline-none` because the caret lands on this BOX when the
            // menu opens (see the ref above) and a box is not what anybody is
            // aiming at — the ring belongs on the entry the keyboard is
            // standing on, and that is `data-[highlighted]` in `./Panel.tsx`.
            // Without it, Chromium rings the whole panel for a menu opened with
            // a mouse.
            class={`relative ${LAYER.row} min-w-[10.5rem] rounded border border-rule/70 bg-panel py-1 text-sm text-ink shadow-md focus:outline-none`}
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
            <Panel actions={props.actions} onPick={picking.pick} onGone={handBack} />
          </DropdownMenu.Content>
        </DropdownMenu>
      </Show>
      <MenuSaid said={picking.said()} />
    </div>
  )
}
