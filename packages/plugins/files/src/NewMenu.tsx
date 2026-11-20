import { Key } from "@solid-primitives/keyed"
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
          if (!picked && anchor.isConnected) anchor.focus({ preventScroll: true })
        }}>
        <Key each={props.items} by="of">{making =>
          <DropdownMenu.Item class={`block ${MENU_ITEM}`} data-testid={making().testids.open}
            onSelect={() => { picked = true; props.pick(making()) }}>{making().label}</DropdownMenu.Item>
        }</Key>
      </DropdownMenu.Content>
    </DropdownMenu.Portal>
  </DropdownMenu>
}
