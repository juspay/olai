/** Loaded on the first engine-choice press, with a portal owned by that menu. */
import { DropdownMenu } from "@kobalte/core/dropdown-menu"
import { For, onCleanup } from "solid-js"
import { MENU_ITEM, MENU_PANEL } from "@olai/ui-primitives/menu.ts"
import { LAYER } from "@olai/web/client/layer.ts"
import { topmostWhileOpen } from "@olai/web/client/topmost.ts"
import type { AgentChoice } from "../../wire.ts"
import { TESTID } from "../../testids.ts"
import { EngineAbsence } from "./EngineAbsence.tsx"

export default function EngineMenu(props: {
  /** A sidebar menu must clear its chrome; row menus keep their row layer. */
  readonly layer?: typeof LAYER.row | typeof LAYER.over
  readonly anchor: HTMLElement
  /** The whole standing table, in the caller's order — `here` rows pickable,
   *  `not-here` rows greyed with the engine's own sentence. Fresh start puts
   *  the node's current engine first; other callers preserve bundle order. */
  readonly engines: ReadonlyArray<AgentChoice>
  readonly pick: (engine: string) => void
  readonly close: () => void
}) {
  // Kobalte restores focus after the enclosing Show has withdrawn the menu.
  const layer = props.layer ?? LAYER.row
  const anchor = props.anchor
  const portal = document.createElement("div")
  portal.className = `fixed left-0 top-0 ${layer}`
  document.body.append(portal)
  onCleanup(() => portal.remove())
  const topmost = topmostWhileOpen(() => true)
  return <DropdownMenu open modal={false} placement="bottom-start" gutter={2}
    getAnchorRect={() => anchor.getBoundingClientRect()}
    onOpenChange={open => { if (!open && topmost()) props.close() }}>
    <DropdownMenu.Portal mount={portal}>
      <DropdownMenu.Content class={`${MENU_PANEL} ${layer}`} aria-label="choose an engine"
        data-testid={TESTID.agentEngineMenu}
        ref={element => queueMicrotask(() => { if (element.isConnected) element.focus({ preventScroll: true }) })}
        onCloseAutoFocus={event => { event.preventDefault(); anchor.isConnected && anchor.focus({ preventScroll: true }) }}>
        <For each={props.engines}>{engine => engine.standing === "here"
          ? <DropdownMenu.Item class={MENU_ITEM} data-engine={engine.id}
              onSelect={() => props.pick(engine.id)}>{engine.name}</DropdownMenu.Item>
          : <DropdownMenu.Item class={`${MENU_ITEM} max-w-sm data-[disabled]:cursor-default data-[disabled]:text-muted data-[disabled]:hover:bg-transparent`} disabled
              data-testid={TESTID.agentEngineMissing} data-engine={engine.id}>
              <EngineAbsence id={engine.id} missing={engine.missing} linked={false} />
            </DropdownMenu.Item>
        }</For>
      </DropdownMenu.Content>
    </DropdownMenu.Portal>
  </DropdownMenu>
}
