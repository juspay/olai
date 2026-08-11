/**
 * The `•••` hover menu to the left of a row's collapse triangle.
 *
 * Presentation only: open, close, list of verbs. What those verbs ARE is the
 * caller's catalog (`nodeMenuActions`) — a third write-path action later is
 * another entry there, not a branch here.
 *
 * The panel is `absolute top-full` inside a positioned root — the same idiom
 * as `theme/Picker.tsx` and `chat/SlashMenu.tsx` — so it scrolls with its
 * anchor and never lands below the fold as a detached `fixed` box would.
 * Drawn only on pointer devices (`MENU_REVEAL`); a phone keeps the triangle
 * and spends the width on the title.
 */

import { createSignal, For, onCleanup, onMount, Show } from "solid-js"

import { hrefOf, type Route } from "./routes.ts"
import { TESTID } from "./testids.ts"
import { HOVER_CELL, MENU_REVEAL } from "./touch.ts"
import type { View } from "./view.ts"

export interface MenuAction {
  readonly id: string
  readonly label: string
  readonly run: () => void | Promise<void>
}

/**
 * The read-only verbs a tree row's menu currently offers. One table, so the
 * panel never has to know about zoom routes or fold keys. `go` is the SPA
 * navigator — never `location.assign`, which tears down the wire and the
 * reading.
 */
export const nodeMenuActions = (args: {
  readonly id: string
  readonly placeKey: string
  readonly hasChildren: boolean
  readonly collapsed: boolean
  readonly foldable: ReadonlyArray<string>
  readonly view: View
  /** Same-document navigation — the bullet's verb, not a full reload. */
  readonly go: (route: Route) => void
}): ReadonlyArray<MenuAction> => {
  const items: MenuAction[] = [
    {
      id: "zoom",
      label: "Zoom in",
      run: () => args.go({ kind: "node", id: args.id }),
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
        // Clipboard can refuse (insecure context, denied permission).
      }
    },
  })
  return items
}

export function NodeMenu(props: {
  readonly actions: ReadonlyArray<MenuAction>
}) {
  const [open, setOpen] = createSignal(false)
  let root: HTMLDivElement | undefined

  const close = (): void => {
    setOpen(false)
  }

  const pick = async (action: MenuAction): Promise<void> => {
    close()
    await action.run()
  }

  return (
    // Positioned root for the absolute panel. Hidden entirely below md so a
    // phone spends no gutter width on the menu (triangle stays).
    <div class="relative hidden shrink-0 md:block" ref={root}>
      <button
        type="button"
        class={`${HOVER_CELL} ${MENU_REVEAL} cursor-pointer border-0 bg-transparent p-0 text-[0.65rem] leading-none tracking-[0.05em] text-muted hover:text-ink`}
        data-testid={TESTID.nodeMenu}
        aria-haspopup="true"
        aria-expanded={open()}
        aria-label="node menu"
        title="node menu"
        onClick={(event) => {
          event.stopPropagation()
          setOpen((was) => !was)
        }}
      >
        •••
      </button>
      <Show when={open()}>
        <MenuPanel
          root={() => root}
          actions={props.actions}
          onPick={pick}
          onClose={close}
        />
      </Show>
    </div>
  )
}

function MenuPanel(props: {
  readonly root: () => HTMLDivElement | undefined
  readonly actions: ReadonlyArray<MenuAction>
  readonly onPick: (action: MenuAction) => void | Promise<void>
  readonly onClose: () => void
}) {
  onMount(() => {
    const onPointer = (event: PointerEvent): void => {
      const target = event.target
      if (!(target instanceof Node)) return
      if (props.root()?.contains(target)) return
      props.onClose()
    }
    const onKey = (event: KeyboardEvent): void => {
      if (event.key === "Escape") props.onClose()
    }
    // pointerdown, capture — same as theme/Picker and note/expand.
    document.addEventListener("pointerdown", onPointer, true)
    document.addEventListener("keydown", onKey)
    onCleanup(() => {
      document.removeEventListener("pointerdown", onPointer, true)
      document.removeEventListener("keydown", onKey)
    })
  })

  // Plain list, not role=menu: we do not implement roving focus / arrow keys.
  // A labelled group of buttons matches what is actually here.
  return (
    <ul
      data-testid={TESTID.nodeMenuPanel}
      aria-label="node actions"
      class="absolute left-0 top-full z-20 m-0 mt-0.5 min-w-[10.5rem] list-none rounded border border-rule bg-paper py-1 text-sm text-ink shadow-md"
    >
      <For each={props.actions}>
        {(action) => (
          <li>
            <button
              type="button"
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
  )
}
