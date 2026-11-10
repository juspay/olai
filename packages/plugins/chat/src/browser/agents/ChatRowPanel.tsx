/**
 * THE OPEN MENU on a Chats row — Kobalte's `DropdownMenu`, the shared panel
 * paint, and nothing else.
 *
 * It is the far side of a dynamic `import()` (`./ChatRowMenu.tsx`) for the
 * reason the engine picker next door is: `@kobalte/core`'s `DropdownMenu` is
 * tens of kilobytes, the sidebar draws up to ten of these rows, and a shut
 * menu that nobody has reached for must cost neither bytes nor per-row signals.
 *
 * SAME PRIMITIVE AS THE `•••` ON AN OUTLINE ROW: Kobalte's menu, the shared
 * `MENU_PANEL`/`MENU_ITEM` paint, portalled, non-modal, joined to this tab's
 * one dismissal stack (`topmost.ts`). What it is NOT is a second copy of
 * outlines' own menu component — that one is the far side of outlines' chunk,
 * reached through outlines' row catalog, and a plugin reaching into another
 * plugin's browser tree is a cycle rather than reuse. The verbs it draws are
 * chat's own, in chat's own words (`../verbs.tsx`'s `chatVerbs`), which is the
 * thing that must not be duplicated and is not.
 */

import { DropdownMenu } from "@kobalte/core/dropdown-menu"
import { createEffect, createMemo, For, onCleanup } from "solid-js"
import { MENU_ITEM, MENU_PANEL } from "@olai/ui-primitives/menu.ts"
import { LAYER } from "@olai/web/client/layer.ts"
import { topmostWhileOpen } from "@olai/web/client/topmost.ts"
import { useShown } from "olai-plugin-navigation/routing"
import type { RowVerb } from "olai-plugin-outlines/slots"
import { TESTID } from "../../testids.ts"

export default function ChatRowPanel(props: {
  readonly anchor: HTMLElement
  /** The agent this menu hangs off, so a scenario names one row's panel. */
  readonly node: string
  readonly verbs: ReadonlyArray<RowVerb>
  readonly pick: (verb: RowVerb) => void
  readonly close: () => void
}) {
  const shown = useShown()
  // Kobalte restores focus after the enclosing Show has withdrawn the menu.
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
        <For each={props.verbs}>{verb =>
          <DropdownMenu.Item class={MENU_ITEM} data-testid={TESTID.chatRowMenuItem} data-action={verb.id}
            onSelect={() => props.pick(verb)}>{verb.label}</DropdownMenu.Item>
        }</For>
      </DropdownMenu.Content>
    </DropdownMenu.Portal>
  </DropdownMenu>
}
