/**
 * THE OPEN `•••` ON A PLUGIN'S PAGE — Kobalte's `DropdownMenu`, the shared
 * panel paint, and nothing else.
 *
 * The far side of a dynamic `import()` (`./Verbs.tsx`), which is the rule this
 * tree already keeps for a menu nobody has reached for (`olai-plugin-chat`'s
 * `ChatRowPanel.tsx` argues it for ten sidebar rows). One page draws one of
 * these, so the saving is smaller here — but the primitive is tens of
 * kilobytes and the overwhelmingly common visit to this page presses the one
 * primary button and leaves.
 *
 * The same primitive, portalled and non-modal, joined to this tab's one
 * dismissal stack: a plugin's menu must dismiss the way every other menu in
 * the app does, and a lookalike built out of a `<details>` would be the one
 * that does not answer Escape while a pane is scrolling.
 */

import { DropdownMenu } from "@kobalte/core/dropdown-menu"
import { Key } from "@solid-primitives/keyed"
import { createEffect, createMemo, onCleanup } from "solid-js"
import { MENU_ITEM, MENU_PANEL } from "@olai/ui-primitives/menu.ts"
import { LAYER } from "@olai/web/client/layer.ts"
import { topmostWhileOpen } from "@olai/web/client/topmost.ts"
import { useShown } from "olai-plugin-navigation/routing"

/** One row of the menu: what it says, what a scenario calls it, and what a
 *  press runs. */
export interface MoreVerb {
  readonly id: string
  readonly label: string
  readonly testid: string
  readonly run: () => void
}

export default function MorePanel(props: {
  readonly anchor: HTMLElement
  readonly plugin: string
  readonly verbs: ReadonlyArray<MoreVerb>
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
  return (
    <DropdownMenu
      open={shown()}
      modal={false}
      placement="bottom-end"
      gutter={2}
      getAnchorRect={() => anchor().getBoundingClientRect()}
      onOpenChange={(open) => { if (!open && topmost()) props.close() }}
    >
      <DropdownMenu.Portal mount={portal}>
        <DropdownMenu.Content
          class={`${MENU_PANEL} ${LAYER.over}`}
          aria-label="More for this plugin"
          data-plugin={props.plugin}
          ref={(element) => queueMicrotask(() => { if (shown() && element.isConnected) element.focus({ preventScroll: true }) })}
          onCloseAutoFocus={(event) => { event.preventDefault(); shown() && anchor().isConnected && anchor().focus({ preventScroll: true }) }}
        >
          {/* Keyed by the verb's own word rather than by position: a menu left
              open while the plugin's state moves under it loses the entries
              that stopped applying and keeps the caret on the ones that did
              not. */}
          <Key each={props.verbs} by="id">
            {(verb) => (
              <DropdownMenu.Item
                class={MENU_ITEM}
                data-testid={verb().testid}
                data-action={verb().id}
                onSelect={() => verb().run()}
              >
                {verb().label}
              </DropdownMenu.Item>
            )}
          </Key>
        </DropdownMenu.Content>
      </DropdownMenu.Portal>
    </DropdownMenu>
  )
}
