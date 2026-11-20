import { createAfterGesture } from "@olai/web/client/after-gesture.ts"
import { focusMenuAfterMount, RetainedContent } from "./RetainedContent.tsx"
import { createEffect, splitProps } from "solid-js"
import { PAGE_SUBJECT } from "olai-plugin-navigation/contract"
import { useShown, useHere } from "olai-plugin-navigation/routing"
import { MENU_PANEL } from "@olai/ui-primitives/menu.ts"
import { TESTID } from "olai-plugin-outlines/testids"
import { DropdownMenu, type DropdownMenuContentProps } from "@kobalte/core/dropdown-menu"
import { useMenuContext } from "@kobalte/core/menu"
import type { PolymorphicProps } from "@kobalte/core/polymorphic"

import type { MenuAction, MenuEntry } from "./action.ts"
import type { MenuDoor } from "./door.ts"
import { DOTS } from "./Dots.tsx"
import { topmostWhileOpen } from "@olai/web/client/topmost.ts"
import { swallowGhost } from "../gestures.ts"
import { LAYER } from "@olai/web/client/layer.ts"
import { overlayRoot } from "../overlay.ts"
import { Panel } from "./Panel.tsx"
import { Tip } from "@olai/web/client/Tip.tsx"


/**
 * Kobalte selects an item on the pointer-up and `closeOnSelect` takes the panel
 * down in the same breath, so a touchscreen's synthesised click hit-tests to
 * whatever is under the point by then — the row the panel was covering. The
 * ghost is eaten (`../ghost.ts`). Touch only: a mouse's click is dispatched to
 * the ancestor of what was pressed rather than to a fresh hit-test.
 */
const tappedInPanel = (event: PointerEvent): void => {
  // Kobalte opens a submenu on the click itself, so the panel stays up and no
  // row is under the point.
  if (event.target instanceof Element && event.target.closest("[data-opens]") !== null) return
  if (event.pointerType === "touch") swallowGhost()
}

export function Dropdown(props: {
  readonly actions: ReadonlyArray<MenuEntry>
  readonly door: MenuDoor
  readonly onPick: (action: MenuAction) => void | Promise<void>
}) {
  const shown = useShown()
  const here = useHere()
  const afterGesture = createAfterGesture()
  let lastFocused: HTMLElement | undefined
  const rememberFocus = (event: FocusEvent) => {
    if (event.target instanceof HTMLElement && event.target.getAttribute("role") !== "menu") lastFocused = event.target
  }
  createEffect(() => {
    if (!shown() || !props.door.open()) return
    queueMicrotask(() => {
      if (shown() && props.door.open() && lastFocused?.isConnected) lastFocused.focus({ preventScroll: true })
    })
  })
  let trigger: HTMLElement | undefined
  let lastGesture: "key" | "pointer" = "pointer"

  const topmost = topmostWhileOpen(() => shown() && props.door.open())

  /**
   * Kobalte's `onCloseAutoFocus` restores the trigger on EVERY close, so it is
   * refused below and the caret is handed back here instead — only for a KEY
   * and only from `<body>`: Chromium rings a control handed the caret
   * programmatically, so a mouse-driven menu would draw a ring nobody asked
   * for.
   */
  const handBack = (): void => {
    if (!shown() || lastGesture !== "key") return
    queueMicrotask(() => {
      const caret = document.activeElement
      if (shown() && (caret === null || caret === document.body)) trigger?.focus()
    })
  }

  return (
    <DropdownMenu
      modal={false}
      placement="bottom-start"
      gutter={2}
      open={props.door.open()}
      onOpenChange={(open: boolean) => {
        if (!shown() || (!open && !topmost())) return
        if (open) props.door.setOpen(true)
        else afterGesture(() => { if (shown()) props.door.setOpen(false) })
      }}
      // Below md the `•••` is `hidden` but stays in the markup, because
      // Kobalte's trigger holds the menu's state — and a `display: none` box
      // measures 0×0 at the corner of the window, which is where the panel
      // would be placed. No width, no anchor: the row's line takes over.
      getAnchorRect={(anchor?: HTMLElement) => {
        const dots = anchor?.getBoundingClientRect()
        return dots !== undefined && dots.width > 0
          ? dots
          : props.door.at()?.getBoundingClientRect()
      }}
    >
      <Tip text="More">
        <DropdownMenu.Trigger
          ref={trigger}
          class={DOTS}
          data-testid={TESTID.nodeMenu}
          aria-label="More"
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
      </Tip>
      <DropdownMenu.Portal mount={overlayRoot()}>
      <ViewportContent
        {...{ [PAGE_SUBJECT]: String(here()) }}
        ref={(el: HTMLElement) => {
          // Kobalte's `onOpenAutoFocus` misses the first ask, which creates
          // this component while already open (`./door.ts`); the ref covers
          // every open. `preventScroll`: a portal mounts the panel before
          // floating-ui has placed it, and a focus that scrolled to that first
          // box jumped the page out from under the row.
          const remembered = lastFocused
          focusMenuAfterMount(el, shown, () => {
            if (remembered?.isConnected) return remembered
            // Reopening with the keyboard lets Kobalte focus its first item;
            // moving the caret back to the panel leaves that item selected in
            // its focus manager, so Home cannot focus it again and Enter does
            // nothing.
            const active = document.activeElement
            return active !== el && el.contains(active) ? undefined : el
          })
        }}
        data-testid={TESTID.nodeMenuPanel}
        aria-label="More"
        // `relative` so the layer bites: Kobalte's positioner is the absolute
        // box, and a z-index on a static child of it would do nothing.
        // `focus:outline-none` reaches only the plain `:focus` the UA draws for
        // a mouse open — Chromium rings the whole panel without it; the app's
        // own `:focus-visible` ring is unlayered and is not stood down here.
        // `--kb-popper-content-available-height` is what the primitive's `size`
        // middleware measures and publishes on the positioner each time the
        // panel is placed; the cap belongs on THIS box, since the positioner's
        // own `max-height` is a limit its overflowing child ignores.
        class={`${MENU_PANEL} ${LAYER.row}`}
        // The primitive restores the trigger on every close; a KEY still gets
        // the caret back (`handBack`).
        onCloseAutoFocus={(event: Event) => event.preventDefault()}
        onFocusOutside={(event: Event) => event.preventDefault()}
        onFocusIn={rememberFocus}
        onKeyDown={() => {
          lastGesture = "key"
        }}
        onPointerDown={() => {
          lastGesture = "pointer"
        }}
        onPointerDownOutside={() => {
          lastGesture = "pointer"
        }}
        onPointerUp={tappedInPanel}
      >
        <Panel actions={props.actions} onPick={props.onPick} onGone={handBack} gestures={{
          onFocusIn: rememberFocus,
          onKeyDown: () => { lastGesture = "key" },
          onPointerDown: () => { lastGesture = "pointer" },
          onPointerUp: tappedInPanel,
        }} />
      </ViewportContent>
      </DropdownMenu.Portal>
    </DropdownMenu>
  )
}

function ViewportContent(props: PolymorphicProps<"div", DropdownMenuContentProps<"div">>) {
  const menu = useMenuContext()
  const [local, rest] = splitProps(props, ["children"])
  return <RetainedContent draw={content => <DropdownMenu.Content
    {...rest}
    // Retained item owners sit outside this replaceable layer. Kobalte's menu
    // context still owns the nested menu registry across every suspension.
    onPointerDownOutside={event => {
      rest.onPointerDownOutside?.(event)
      const target = event.detail.originalEvent.target
      if (target instanceof Node && menu.nestedMenus().some(element => element.contains(target))) event.preventDefault()
    }}
    // The primitive measures from the viewport edge. An upward menu must
    // reserve the header and strip as well, or its first entries sit behind it.
    // Portal mount={overlayRoot()} is on document.body, so this inherits the
    // root reserve even when the trigger lives in a pane with a zero offset.
    // Downward menus reserve any bottom chrome reported by the phone strip.
    style={{ "max-height": menu.currentPlacement().startsWith("top")
      ? "max(0px, calc(var(--kb-popper-content-available-height) - var(--height-chrome)))"
      : "max(0px, calc(var(--kb-popper-content-available-height) - var(--height-bottom-chrome, 0px)))" }}
  >{content()}</DropdownMenu.Content>}>{local.children}</RetainedContent>
}
