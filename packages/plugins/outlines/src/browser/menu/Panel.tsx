import { createAfterGesture } from "@olai/web/client/after-gesture.ts"
import { focusMenuAfterMount, RetainedContent } from "./RetainedContent.tsx"
import { useShown } from "olai-plugin-navigation/routing"
import { PAGE_SUBJECT } from "olai-plugin-navigation/contract"
import { useHere } from "olai-plugin-navigation/routing"
import { Key } from "@solid-primitives/keyed"
import { MENU_ITEM, MENU_PANEL } from "@olai/ui-primitives/menu.ts"
import { TESTID } from "olai-plugin-outlines/testids"
import { useMenuContext } from "@kobalte/core/menu"
import { DropdownMenu } from "@kobalte/core/dropdown-menu"
import { createSignal, For, onCleanup, Show } from "solid-js"
import { LAYER } from "@olai/web/client/layer.ts"

import { asks, isSub, type MenuAction, type MenuEntry, type MenuSub } from "./action.ts"
import { Confirm } from "./Confirm.tsx"
import { overlayRoot } from "../overlay.ts"

export interface Gestures {
  readonly onFocusIn: (event: FocusEvent) => void
  readonly onKeyDown: () => void
  readonly onPointerDown: () => void
  readonly onPointerUp: (event: PointerEvent) => void
}

export function Panel(props: {
  readonly actions: ReadonlyArray<MenuEntry>
  readonly onPick: (action: MenuAction) => void | Promise<void>
  readonly onGone: () => void
  readonly gestures: Gestures
}) {
  const shown = useShown()
  const here = useHere()
  const [asking, setAsking] = createSignal<MenuAction | null>(null)
  onCleanup(() => props.onGone())
  const entries = new Map<string, HTMLElement>()

  const cancel = (action: MenuAction): void => {
    setAsking(null)
    queueMicrotask(() => entries.get(action.id)?.focus())
  }

  const Sub = (sub: { readonly entry: MenuSub }) => {
    const [open, setOpen] = createSignal(false)
    const afterGesture = createAfterGesture()
    let focusOutside = false
    let lastFocused: HTMLElement | undefined
    const [nestedMenus, setNestedMenus] = createSignal<(() => Element[])>()
    const insideChild = (target: EventTarget | null) => target instanceof Node && nestedMenus()?.().some(element => element.contains(target))
    const Surface = (surface: { readonly register: (read: () => Element[]) => () => void }) => {
      const menu = useMenuContext()
      onCleanup(surface.register(menu.nestedMenus))
      return (
        <RetainedContent draw={content => <DropdownMenu.SubContent
          {...{ [PAGE_SUBJECT]: String(here()) }}
          ref={(el: HTMLElement) => {
            // Kobalte preventDefaults its own focus of the first row, and the
            // list's deferred autofocus is a timer the next key can beat.
            const remembered = lastFocused
            focusMenuAfterMount(el, shown, () => {
              if (remembered?.isConnected) return remembered
              const active = document.activeElement
              if (active !== el && el.contains(active)) return undefined
              const first = el.querySelector('[role="menuitem"]')
              return first instanceof HTMLElement ? first : undefined
            })
          }}
          class={`${MENU_PANEL} ${LAYER.row} pointer-events-auto`}
          data-testid={TESTID.nodeMenuSub}
          data-sub={sub.entry.id}
          aria-label={sub.entry.label}
          onFocusIn={event => {
            if (event.target instanceof HTMLElement && event.target.getAttribute("role") !== "menu") lastFocused = event.target
            props.gestures.onFocusIn(event)
          }}
          onFocusOutside={event => {
            event.preventDefault()
            // Kobalte's `SubContent` closes on a focus-outside even after the
            // event has been prevented.
            focusOutside = true
            queueMicrotask(() => { focusOutside = false })
          }}
          onPointerDownOutside={event => {
            if (insideChild(event.detail.originalEvent.target)) event.preventDefault()
          }}
          onKeyDown={props.gestures.onKeyDown}
          onPointerDown={props.gestures.onPointerDown}
          onPointerUp={props.gestures.onPointerUp}
        >{content()}</DropdownMenu.SubContent>}>
          <Entries entries={sub.entry.entries} />
        </RetainedContent>
      )
    }
    return (
    <DropdownMenu.Sub gutter={2} shift={-5} overlap open={open()} onOpenChange={next => {
      if (!shown() || (!next && focusOutside)) return
      if (next) setOpen(true)
      else afterGesture(() => { if (shown() && !insideChild(document.activeElement)) setOpen(false) })
    }}>
      <DropdownMenu.SubTrigger
        ref={(el: HTMLElement) => entries.set(sub.entry.id, el)}
        class={`${MENU_ITEM} flex items-center justify-between gap-6 data-[expanded]:bg-rule`}
        data-testid={TESTID.nodeMenuItem}
        data-action={sub.entry.id}
        data-opens=""
      >
        <span>{sub.entry.label}</span>
        <span class="text-muted" aria-hidden="true">›</span>
      </DropdownMenu.SubTrigger>
      <DropdownMenu.Portal mount={overlayRoot()}>
        <Surface register={read => {
          setNestedMenus(() => read)
          return () => setNestedMenus(current => current === read ? undefined : current)
        }} />
      </DropdownMenu.Portal>
    </DropdownMenu.Sub>
    )
  }

  const Entries = (list: { readonly entries: ReadonlyArray<MenuEntry> }) => (
    <Key each={list.entries} by="id">
      {(entry) => (
        <>
          <Show when={entry().divider}>
            <DropdownMenu.Separator class="my-1 border-t border-rule" />
          </Show>
          <Show when={isSub(entry())} fallback={<Verb action={entry() as MenuAction} />}><Sub entry={entry() as MenuSub} /></Show>
        </>
      )}
    </Key>
  )

  const Verb = (one: { readonly action: MenuAction }) => {
    const action = () => one.action
    return (
              <DropdownMenu.Item
                ref={(el: HTMLElement) => entries.set(action().id, el)}
                class={MENU_ITEM}
                data-testid={TESTID.nodeMenuItem}
                data-action={action().id}
                closeOnSelect={!asks(action())}
                onSelect={() =>
                  asks(action()) ? setAsking(action()) : void props.onPick(action())}
              >
                {action().label}
              </DropdownMenu.Item>
    )
  }

  return (
    <Show when={asking()} fallback={<Entries entries={props.actions} />}>
      {(action) => (
        <Confirm action={action()} onGo={props.onPick} onCancel={cancel} />
      )}
    </Show>
  )
}
