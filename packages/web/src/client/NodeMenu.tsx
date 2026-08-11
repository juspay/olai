/**
 * The `•••` hover menu to the left of a row's collapse triangle.
 *
 * Workflowy's gutter control: on row hover it appears left of the triangle.
 * This file is the MENU — open, close, portal, list of verbs. What those
 * verbs ARE is the caller's catalog (`nodeMenuActions` below for the outline
 * tree): presentation and the list of things a client can do are two concerns,
 * and a third write-path action later should not reshape the panel.
 *
 * Opens on click (and Enter/Space when focused). Closes on Escape, outside
 * click, or picking an item. The menu body is portaled so a row's overflow or
 * opacity cannot clip or dim it.
 */

import { createSignal, For, onCleanup, Show } from "solid-js"
import { Portal } from "solid-js/web"

import { hrefOf } from "./routes.ts"
import { TESTID } from "./testids.ts"
import { HOVER_CELL, HOVER_REVEAL } from "./touch.ts"
import type { View } from "./view.ts"

export interface MenuAction {
  readonly id: string
  readonly label: string
  readonly run: () => void | Promise<void>
}

/**
 * The read-only verbs a tree row's menu currently offers. One table, so the
 * panel never has to know about zoom routes or fold keys, and a future write
 * action is another entry here rather than a branch inside the component.
 */
export const nodeMenuActions = (args: {
  readonly id: string
  readonly placeKey: string
  readonly hasChildren: boolean
  readonly collapsed: boolean
  readonly foldable: ReadonlyArray<string>
  readonly view: View
}): ReadonlyArray<MenuAction> => {
  const items: MenuAction[] = [
    {
      id: "zoom",
      label: "Zoom in",
      run: () => {
        location.assign(hrefOf({ kind: "node", id: args.id }))
      },
    },
  ]
  if (args.hasChildren) {
    items.push({
      id: args.collapsed ? "expand" : "collapse",
      label: args.collapsed ? "Expand" : "Collapse",
      run: () => args.view.toggle(args.placeKey),
    })
    items.push(
      {
        id: "expand-all",
        label: "Expand all",
        run: () => args.view.expandKeys(args.foldable),
      },
      {
        id: "collapse-all",
        label: "Collapse all",
        run: () => args.view.collapseKeys(args.foldable),
      },
    )
  }
  items.push({
    id: "copy-link",
    label: "Copy link to node",
    run: async () => {
      const url = new URL(hrefOf({ kind: "node", id: args.id }), location.href).href
      try {
        await navigator.clipboard.writeText(url)
      } catch {
        // Clipboard can refuse (insecure context, denied permission). No toast
        // surface yet; the action still ran.
      }
    },
  })
  return items
}

export function NodeMenu(props: {
  readonly actions: ReadonlyArray<MenuAction>
}) {
  const [open, setOpen] = createSignal(false)
  let trigger: HTMLButtonElement | undefined

  const close = (): void => {
    setOpen(false)
  }

  const pick = async (action: MenuAction): Promise<void> => {
    close()
    await action.run()
  }

  return (
    <>
      <button
        ref={trigger}
        type="button"
        class={`${HOVER_CELL} ${HOVER_REVEAL} cursor-pointer border-0 bg-transparent p-0 text-[0.65rem] leading-none tracking-[0.05em] text-muted hover:text-ink`}
        data-testid={TESTID.nodeMenu}
        aria-haspopup="menu"
        aria-expanded={open()}
        aria-label="node menu"
        title="node menu"
        onClick={(event) => {
          event.stopPropagation()
          setOpen((was) => !was)
        }}
        onKeyDown={(event) => {
          if (event.key === "Escape" && open()) {
            event.stopPropagation()
            close()
          }
        }}
      >
        •••
      </button>
      <Show when={open()}>
        <MenuPanel
          anchor={trigger}
          actions={props.actions}
          onPick={pick}
          onClose={close}
        />
      </Show>
    </>
  )
}

function MenuPanel(props: {
  readonly anchor: HTMLButtonElement | undefined
  readonly actions: ReadonlyArray<MenuAction>
  readonly onPick: (action: MenuAction) => void | Promise<void>
  readonly onClose: () => void
}) {
  const box = props.anchor?.getBoundingClientRect()
  const left = box?.left ?? 0
  const top = (box?.bottom ?? 0) + 2

  const onDoc = (event: MouseEvent): void => {
    const target = event.target
    if (!(target instanceof Node)) return
    if (props.anchor?.contains(target)) return
    const menu = document.querySelector(`[data-testid="${TESTID.nodeMenuPanel}"]`)
    if (menu?.contains(target)) return
    props.onClose()
  }

  const onKey = (event: KeyboardEvent): void => {
    if (event.key === "Escape") props.onClose()
  }

  document.addEventListener("mousedown", onDoc, true)
  document.addEventListener("keydown", onKey, true)
  onCleanup(() => {
    document.removeEventListener("mousedown", onDoc, true)
    document.removeEventListener("keydown", onKey, true)
  })

  return (
    <Portal>
      <ul
        role="menu"
        data-testid={TESTID.nodeMenuPanel}
        class="fixed z-40 m-0 min-w-[10.5rem] list-none rounded border border-rule bg-paper py-1 text-sm text-ink shadow-md"
        style={{ left: `${left}px`, top: `${top}px` }}
      >
        <For each={props.actions}>
          {(action) => (
            <li role="none">
              <button
                type="button"
                role="menuitem"
                class="block w-full cursor-pointer border-0 bg-transparent px-3 py-1.5 text-left text-ink hover:bg-rule"
                data-testid={TESTID.nodeMenuItem}
                data-action={action.id}
                onClick={() => void props.onPick(action)}
              >
                {action.label}
              </button>
            </li>
          )}
        </For>
      </ul>
    </Portal>
  )
}
