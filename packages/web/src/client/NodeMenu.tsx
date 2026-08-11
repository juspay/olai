/**
 * The `•••` hover menu to the left of a row's collapse triangle.
 *
 * Workflowy's gutter control: on row hover it appears left of the triangle,
 * and it only carries actions the client can already perform. olai's web
 * client has no write path yet, so the menu is Zoom / Expand / Collapse /
 * Expand all / Collapse all / Copy link — structured so a future mark-done or
 * date edit can slot in without reshaping the component.
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

export function NodeMenu(props: {
  readonly id: string
  /** Place key — what fold/expand names in the reading. */
  readonly placeKey: string
  readonly hasChildren: boolean
  readonly collapsed: boolean
  /** Keys of every foldable place under this row, including itself. Empty
   *  when the row is a leaf. Used by expand/collapse all. */
  readonly foldable: ReadonlyArray<string>
  readonly view: View
}) {
  const [open, setOpen] = createSignal(false)
  let trigger: HTMLButtonElement | undefined

  const close = (): void => {
    setOpen(false)
  }

  const actions = (): ReadonlyArray<MenuAction> => {
    const items: MenuAction[] = [
      {
        id: "zoom",
        label: "Zoom in",
        run: () => {
          // A real navigation: the bullet already does this, and the menu
          // offers the same without inventing a second address.
          location.assign(hrefOf({ kind: "node", id: props.id }))
        },
      },
    ]
    if (props.hasChildren) {
      items.push({
        id: props.collapsed ? "expand" : "collapse",
        label: props.collapsed ? "Expand" : "Collapse",
        run: () => props.view.toggle(props.placeKey),
      })
      if (props.foldable.length > 1 || props.hasChildren) {
        items.push(
          {
            id: "expand-all",
            label: "Expand all",
            run: () => props.view.expandKeys(props.foldable),
          },
          {
            id: "collapse-all",
            label: "Collapse all",
            run: () => props.view.collapseKeys(props.foldable),
          },
        )
      }
    }
    items.push({
      id: "copy-link",
      label: "Copy link to node",
      run: async () => {
        const url = new URL(hrefOf({ kind: "node", id: props.id }), location.href).href
        try {
          await navigator.clipboard.writeText(url)
        } catch {
          // Clipboard can refuse (insecure context, denied permission). The
          // action still "ran"; there is no toast surface yet.
        }
      },
    })
    return items
  }

  const pick = async (action: MenuAction): Promise<void> => {
    close()
    await action.run()
  }

  return (
    <span class="relative contents">
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
          actions={actions()}
          onPick={pick}
          onClose={close}
        />
      </Show>
    </span>
  )
}

function MenuPanel(props: {
  readonly anchor: HTMLButtonElement | undefined
  readonly actions: ReadonlyArray<MenuAction>
  readonly onPick: (action: MenuAction) => void | Promise<void>
  readonly onClose: () => void
}) {
  const at = (): { left: number; top: number } => {
    const box = props.anchor?.getBoundingClientRect()
    if (box === undefined) return { left: 0, top: 0 }
    return { left: box.left, top: box.bottom + 2 }
  }

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

  // Capture-phase so a click that also collapses a row still closes us.
  document.addEventListener("mousedown", onDoc, true)
  document.addEventListener("keydown", onKey, true)
  onCleanup(() => {
    document.removeEventListener("mousedown", onDoc, true)
    document.removeEventListener("keydown", onKey, true)
  })

  const spot = at()

  return (
    <Portal>
      <ul
        role="menu"
        data-testid={TESTID.nodeMenuPanel}
        class="fixed z-40 m-0 min-w-[10.5rem] list-none rounded border border-rule bg-paper py-1 text-sm text-ink shadow-md"
        style={{ left: `${spot.left}px`, top: `${spot.top}px` }}
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
