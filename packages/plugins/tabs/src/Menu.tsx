/**
 * A MENU AT A POINT — what a right-click on a tab or on a link opens. Loaded
 * behind `import()` by both, so Kobalte's dropdown stays off first paint.
 *
 * The outline's `•••` menu's paint (`@olai/ui-primitives`' `menu.ts`) and
 * Kobalte's dropdown, anchored at the pointer rather than at a trigger, the
 * way chat's engine menu anchors at its button. Portalled to the document at
 * the overlay layer, and on the dismissal stack like every other panel.
 */
import { DropdownMenu } from "@kobalte/core/dropdown-menu"
import { For, onCleanup, Show } from "solid-js"

import { MENU_ITEM, MENU_PANEL } from "@olai/ui-primitives/menu.ts"
import { LAYER } from "@olai/web/client/layer.ts"
import { topmostWhileOpen } from "@olai/web/client/topmost.ts"

import { TESTID } from "./testids.ts"

export type MenuEntry =
  | { readonly label: string; readonly run: () => void }
  | { readonly rule: true }

export default function PointMenu(props: {
  readonly x: number
  readonly y: number
  readonly label: string
  readonly entries: ReadonlyArray<MenuEntry>
  readonly close: () => void
}) {
  const portal = document.createElement("div")
  portal.className = `fixed left-0 top-0 ${LAYER.over}`
  document.body.append(portal)
  onCleanup(() => portal.remove())
  // ON THE STACK DIRECTLY, like chat's engine menu: its dismissal gestures are
  // Kobalte's, so it joins without `dismissOn`.
  const topmost = topmostWhileOpen(() => true)
  const { x, y } = props
  return <DropdownMenu open modal={false} placement="bottom-start" gutter={0}
    getAnchorRect={() => ({ x, y, width: 0, height: 0 })}
    onOpenChange={(open) => { if (!open && topmost()) props.close() }}>
    <DropdownMenu.Portal mount={portal}>
      <DropdownMenu.Content class={`${MENU_PANEL} ${LAYER.over}`} aria-label={props.label}
        data-testid={TESTID.tabsMenu}
        ref={(element) => queueMicrotask(() => { if (element.isConnected) element.focus({ preventScroll: true }) })}
        onCloseAutoFocus={(event) => event.preventDefault()}>
        <For each={props.entries}>{(entry) =>
          <Show when={"label" in entry ? entry : undefined} fallback={<DropdownMenu.Separator class="my-1 border-0 border-t border-rule" />}>
            {(item) => <DropdownMenu.Item class={`block ${MENU_ITEM}`} onSelect={() => item().run()}>{item().label}</DropdownMenu.Item>}
          </Show>
        }</For>
      </DropdownMenu.Content>
    </DropdownMenu.Portal>
  </DropdownMenu>
}
