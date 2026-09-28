/**
 * THE OUTLINES HEADING'S `+`, open: one item per kind of file a reader can
 * start here (`New outline`, `New document`), each contributed by that kind's
 * own row on `files.types` (`./contract.ts`).
 *
 * Loaded on the first press, the way chat's engine menu is: Kobalte's dropdown
 * with the shared menu paint (`@olai/ui-primitives/menu.ts`), anchored at the
 * button, portalled at the overlay layer so the sidebar's chrome cannot clip
 * it, and on the dismissal stack so Escape shuts this menu and nothing under
 * it. Escape or a click away puts focus back on the `+`; picking an item
 * hands it to the path box that item opened instead.
 */
import { DropdownMenu } from "@kobalte/core/dropdown-menu"
import { For, onCleanup } from "solid-js"
import { MENU_ITEM, MENU_PANEL } from "@olai/ui-primitives/menu.ts"
import { LAYER } from "@olai/web/client/layer.ts"
import { topmostWhileOpen } from "@olai/web/client/topmost.ts"
import { TESTID } from "olai-plugin-files/testids"
import type { Making } from "olai-plugin-files/making"

export default function NewMenu(props: {
  readonly anchor: HTMLElement
  readonly items: ReadonlyArray<Making>
  readonly pick: (making: Making) => void
  readonly close: () => void
}) {
  const anchor = props.anchor
  const portal = document.createElement("div")
  portal.className = `fixed left-0 top-0 ${LAYER.over}`
  document.body.append(portal)
  onCleanup(() => portal.remove())
  const topmost = topmostWhileOpen(() => true)
  let picked = false
  return <DropdownMenu open modal={false} placement="bottom-end" gutter={2}
    getAnchorRect={() => anchor.getBoundingClientRect()}
    onOpenChange={open => { if (!open && topmost()) props.close() }}>
    <DropdownMenu.Portal mount={portal}>
      <DropdownMenu.Content class={`${MENU_PANEL} ${LAYER.over}`} aria-label="New file"
        data-testid={TESTID.newFileMenu}
        ref={element => queueMicrotask(() => { if (element.isConnected) element.focus({ preventScroll: true }) })}
        onCloseAutoFocus={event => {
          event.preventDefault()
          // A pick has already put the caret in its path box; only a dismissal
          // returns focus to the `+` it came from.
          if (!picked && anchor.isConnected) anchor.focus({ preventScroll: true })
        }}>
        <For each={props.items}>{making =>
          <DropdownMenu.Item class={`block ${MENU_ITEM}`} data-testid={making.testids.open}
            onSelect={() => { picked = true; props.pick(making) }}>{making.label}</DropdownMenu.Item>
        }</For>
      </DropdownMenu.Content>
    </DropdownMenu.Portal>
  </DropdownMenu>
}
