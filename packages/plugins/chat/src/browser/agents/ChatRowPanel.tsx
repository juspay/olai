import { DropdownMenu } from "@kobalte/core/dropdown-menu"
import { Key } from "@solid-primitives/keyed"
import { createEffect, createMemo, onCleanup } from "solid-js"
import { MENU_ITEM, MENU_PANEL } from "@olai/ui-primitives/menu.ts"
import { LAYER } from "@olai/web/client/layer.ts"
import { topmostWhileOpen } from "@olai/web/client/topmost.ts"
import { useShown } from "olai-plugin-navigation/routing"
import type { RowVerb } from "olai-plugin-outlines/slots"
import { TESTID } from "../../testids.ts"

export default function ChatRowPanel(props: {
  readonly anchor: HTMLElement
  readonly node: string
  readonly verbs: ReadonlyArray<RowVerb>
  readonly pick: (verb: RowVerb) => void
  readonly close: () => void
}) {
  const shown = useShown()
  const anchor = createMemo(() => props.anchor)
  const portal = document.createElement("div")
  createEffect(() => { portal.className = `fixed left-0 top-0 ${LAYER.over}` })
  document.body.append(portal)
  onCleanup(() => portal.remove())
  const topmost = topmostWhileOpen(shown)
  return <DropdownMenu open={shown()} modal={false} placement="bottom-end" gutter={2}
    getAnchorRect={() => anchor().getBoundingClientRect()}
    onOpenChange={open => { if (!open && topmost()) props.close() }}>
    <DropdownMenu.Portal mount={portal}>
      <DropdownMenu.Content class={`${MENU_PANEL} ${LAYER.over}`} aria-label="Chat actions"
        data-testid={TESTID.chatRowMenuPanel} data-agent={props.node}
        ref={element => queueMicrotask(() => { if (shown() && element.isConnected) element.focus({ preventScroll: true }) })}
        onCloseAutoFocus={event => { event.preventDefault(); shown() && anchor().isConnected && anchor().focus({ preventScroll: true }) }}>
        <Key each={props.verbs} by="id">{verb =>
          <DropdownMenu.Item class={MENU_ITEM} data-testid={TESTID.chatRowMenuItem} data-action={verb().id}
            onSelect={() => props.pick(verb())}>{verb().label}</DropdownMenu.Item>
        }</Key>
      </DropdownMenu.Content>
    </DropdownMenu.Portal>
  </DropdownMenu>
}
