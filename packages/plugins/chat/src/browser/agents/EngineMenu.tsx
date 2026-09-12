/** Loaded on the first engine-choice press, with a portal owned by that menu. */
import { DropdownMenu } from "@kobalte/core/dropdown-menu"
import { For, onCleanup } from "solid-js"
import { MENU_ITEM, MENU_PANEL } from "@olai/ui-primitives/menu.ts"
import { LAYER } from "@olai/web/client/layer.ts"
import { topmostWhileOpen } from "@olai/web/client/topmost.ts"
import type { AgentChoice } from "../../wire.ts"
import { TESTID } from "../../testids.ts"

export default function EngineMenu(props: {
  readonly anchor: HTMLElement
  readonly engines: ReadonlyArray<AgentChoice>
  readonly pick: (engine: string) => void
  readonly close: () => void
}) {
  // Kobalte restores focus after the enclosing Show has withdrawn the menu.
  const anchor = props.anchor
  const portal = document.createElement("div")
  portal.className = `fixed left-0 top-0 ${LAYER.row}`
  document.body.append(portal)
  onCleanup(() => portal.remove())
  const topmost = topmostWhileOpen(() => true)
  return <DropdownMenu open modal={false} placement="bottom-start" gutter={2}
    getAnchorRect={() => anchor.getBoundingClientRect()}
    onOpenChange={open => { if (!open && topmost()) props.close() }}>
    <DropdownMenu.Portal mount={portal}>
      <DropdownMenu.Content class={`${MENU_PANEL} ${LAYER.row}`} aria-label="choose an engine"
        data-testid={TESTID.agentEngineMenu}
        ref={element => queueMicrotask(() => { if (element.isConnected) element.focus({ preventScroll: true }) })}
        onCloseAutoFocus={event => { event.preventDefault(); anchor.isConnected && anchor.focus({ preventScroll: true }) }}>
        <For each={props.engines}>{engine => <DropdownMenu.Item class={MENU_ITEM}
          onSelect={() => props.pick(engine.id)}>{engine.name}</DropdownMenu.Item>}</For>
      </DropdownMenu.Content>
    </DropdownMenu.Portal>
  </DropdownMenu>
}
