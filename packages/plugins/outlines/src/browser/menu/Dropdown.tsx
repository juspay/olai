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
 * whatever is under the point by then. Touch only: a mouse's click is
 * dispatched to the ancestor of what was pressed rather than to a fresh
 * hit-test.
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
   * Kobalte's `onCloseAutoFocus` restores the trigger on EVERY close, and
   * Chromium draws a focus ring on a control handed the caret programmatically.
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
      // Kobalte's trigger holds the menu's state, so below md the `•••` stays
      // in the markup as a `display: none` box — which measures 0×0 at the
      // corner of the window, where the panel would otherwise be placed.
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
          // pointer), so both are stopped here.
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
          // Kobalte's `onOpenAutoFocus` misses a content created while already
          // open, and floating-ui places the panel only after the portal has
          // mounted it — so `preventScroll`, or the focus scrolls to that first
          // unplaced box.
          const remembered = lastFocused
          focusMenuAfterMount(el, shown, () => {
            if (remembered?.isConnected) return remembered
            // Kobalte's focus manager keeps its first item selected once it has
            // focused one, so Home cannot focus it again and Enter does nothing.
            const active = document.activeElement
            return active !== el && el.contains(active) ? undefined : el
          })
        }}
        data-testid={TESTID.nodeMenuPanel}
        aria-label="More"
        // Kobalte's positioner is the absolute box, so `relative` is what lets
        // the layer bite on a static child of it.
        // `--kb-popper-content-available-height` is what the primitive's `size`
        // middleware measures and publishes on the positioner each time the
        // panel is placed; the cap belongs on THIS box, since the positioner's
        // own `max-height` is a limit its overflowing child ignores.
        class={`${MENU_PANEL} ${LAYER.row}`}
        // The primitive restores the trigger on every close.
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
    // Kobalte's own menu context keeps the nested-menu registry across every
    // suspension of this content.
    onPointerDownOutside={event => {
      rest.onPointerDownOutside?.(event)
      const target = event.detail.originalEvent.target
      if (target instanceof Node && menu.nestedMenus().some(element => element.contains(target))) event.preventDefault()
    }}
    // The primitive measures the available height from the viewport edge,
    // which does not know about the app's own fixed chrome.
    style={{ "max-height": menu.currentPlacement().startsWith("top")
      ? "max(0px, calc(var(--kb-popper-content-available-height) - var(--height-chrome)))"
      : "max(0px, calc(var(--kb-popper-content-available-height) - var(--height-bottom-chrome, 0px)))" }}
  >{content()}</DropdownMenu.Content>}>{local.children}</RetainedContent>
}
