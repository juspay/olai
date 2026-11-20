import { useShown } from "olai-plugin-navigation/routing"
import { DropdownMenu } from "@kobalte/core/dropdown-menu"
import { createEffect, createMemo, For, onCleanup, Show } from "solid-js"
import { MENU_ITEM, MENU_PANEL } from "@olai/ui-primitives/menu.ts"
import { LAYER } from "@olai/web/client/layer.ts"
import { topmostWhileOpen } from "@olai/web/client/topmost.ts"
import type { AgentChoice } from "../../wire.ts"
import { TESTID } from "../../testids.ts"
import { pluginsDoor } from "../plugins-door.ts"

export default function EngineMenu(props: {
  readonly layer?: typeof LAYER.row | typeof LAYER.over
  readonly anchor: HTMLElement
  readonly engines: ReadonlyArray<AgentChoice>
  readonly pick: (engine: string) => void
  readonly close: () => void
}) {
  const shown = useShown()
  const layer = createMemo(() => props.layer ?? LAYER.row)
  const anchor = createMemo(() => props.anchor)
  const portal = document.createElement("div")
  createEffect(() => { portal.className = `fixed left-0 top-0 ${layer()}` })
  document.body.append(portal)
  onCleanup(() => portal.remove())
  const topmost = topmostWhileOpen(shown)
  const here = () => props.engines.filter(engine => engine.standing === "here")
  const explains = () => props.engines.find(engine => engine.standing === "not-here")?.id ?? "chat"
  return <DropdownMenu open={shown()} modal={false} placement="bottom-start" gutter={2}
    getAnchorRect={() => anchor().getBoundingClientRect()}
    onOpenChange={open => { if (!open && topmost()) props.close() }}>
    <DropdownMenu.Portal mount={portal}>
      <DropdownMenu.Content class={`${MENU_PANEL} ${layer()}`} aria-label="Choose an agent"
        data-testid={TESTID.agentEngineMenu}
        ref={element => queueMicrotask(() => { if (shown() && element.isConnected) element.focus({ preventScroll: true }) })}
        // Kobalte hands focus back to its trigger as the menu unmounts, by which
        // time the enclosing `Show` may have withdrawn it.
        onCloseAutoFocus={event => { event.preventDefault(); shown() && anchor().isConnected && anchor().focus({ preventScroll: true }) }}>
        <Show when={here().length > 0} fallback={<>
          <p class="m-0 px-3 py-1.5 text-muted" data-testid={TESTID.agentEngineNone}>No agent is set up</p>
          <Show when={pluginsDoor()}>{door =>
            <DropdownMenu.Item class={MENU_ITEM} data-action="open-plugins"
              onSelect={() => { const open = door().open; const id = explains(); props.close(); open(id) }}>Open plugins</DropdownMenu.Item>
          }</Show>
        </>}>
          <For each={here()}>{engine =>
            <DropdownMenu.Item class={MENU_ITEM} data-engine={engine.id}
              onSelect={() => props.pick(engine.id)}>{engine.name}</DropdownMenu.Item>
          }</For>
        </Show>
      </DropdownMenu.Content>
    </DropdownMenu.Portal>
  </DropdownMenu>
}
