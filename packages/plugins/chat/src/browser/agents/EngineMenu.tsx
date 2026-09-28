/** Loaded on the first engine-choice press, with a portal owned by that menu.
 *
 * ONLY WHAT WORKS: an engine this machine cannot start is not a row here. Its
 * sentence (what to install, where) lives on the plugins panel under **Needs
 * you**, which is where a person goes to fix it. With nothing to start, the
 * menu is one quiet line and — while the inspector is up — its door. */
import { DropdownMenu } from "@kobalte/core/dropdown-menu"
import { For, onCleanup, Show } from "solid-js"
import { MENU_ITEM, MENU_PANEL } from "@olai/ui-primitives/menu.ts"
import { LAYER } from "@olai/web/client/layer.ts"
import { topmostWhileOpen } from "@olai/web/client/topmost.ts"
import type { AgentChoice } from "../../wire.ts"
import { TESTID } from "../../testids.ts"
import { pluginsDoor } from "../plugins-door.ts"

export default function EngineMenu(props: {
  /** A sidebar menu must clear its chrome; row menus keep their row layer. */
  readonly layer?: typeof LAYER.row | typeof LAYER.over
  readonly anchor: HTMLElement
  /** The standing table, in the caller's order. Only `here` rows are drawn;
   *  the first `not-here` one is the row the plugins door opens on. Fresh start
   *  puts the node's current engine first; other callers keep bundle order. */
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
  const here = () => props.engines.filter(engine => engine.standing === "here")
  /** Which row of the plugins panel explains the absence: the first engine
   *  this serve mounted and cannot start, or chat's own row when none is. */
  const explains = () => props.engines.find(engine => engine.standing === "not-here")?.id ?? "chat"
  return <DropdownMenu open modal={false} placement="bottom-start" gutter={2}
    getAnchorRect={() => anchor.getBoundingClientRect()}
    onOpenChange={open => { if (!open && topmost()) props.close() }}>
    <DropdownMenu.Portal mount={portal}>
      <DropdownMenu.Content class={`${MENU_PANEL} ${layer}`} aria-label="choose an engine"
        data-testid={TESTID.agentEngineMenu}
        ref={element => queueMicrotask(() => { if (element.isConnected) element.focus({ preventScroll: true }) })}
        onCloseAutoFocus={event => { event.preventDefault(); anchor.isConnected && anchor.focus({ preventScroll: true }) }}>
        <Show when={here().length > 0} fallback={<>
          <p class="m-0 px-3 py-1.5 text-muted" data-testid={TESTID.agentEngineNone}>No agent is set up</p>
          <Show when={pluginsDoor()}>{door =>
            <DropdownMenu.Item class={MENU_ITEM} data-action="open-plugins"
              onSelect={() => { props.close(); door().open(explains()) }}>Open plugins</DropdownMenu.Item>
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
