/**
 * What is INSIDE the open panel: the list, or the question one verb asks first
 * (`./Confirm.tsx`).
 *
 * It lives in `DropdownMenu.Content`, which Kobalte unmounts when the menu
 * shuts — so `asking` dies with the panel, and a menu closed on Escape and
 * reopened is a menu that is not still asking. That disposal is also the one
 * event in the whole primitive that fires on every close, which is why the
 * caret's way home hangs off it (`onGone`, and `./Dropdown.tsx`'s `handBack`
 * for why Kobalte's own hook cannot be the one to do it).
 *
 * Everything here is Kobalte's `Item` and `Separator` wearing this app's own
 * classes — the library ships none — so this file is the whole of what the
 * `role="menu"` looks like, and `./Dropdown.tsx` is the whole of how it
 * behaves. That is the seam the primitive drew: the two used to be one file
 * and had no reason left to be.
 */
import { MENU_ITEM, MENU_PANEL } from "@olai/ui-primitives/menu.ts"
import { TESTID } from "olai-plugin-outlines/testids"
import { DropdownMenu } from "@kobalte/core/dropdown-menu"
import { createSignal, For, onCleanup, Show } from "solid-js"
import { LAYER } from "@olai/web/client/layer.ts"

import { asks, isSub, type MenuAction, type MenuEntry, type MenuSub } from "./action.ts"
import { Confirm } from "./Confirm.tsx"
import { overlayRoot } from "../overlay.ts"

/** What the root panel listens for, handed to each submenu too: a submenu is
 *  portalled beside the panel, not inside it (`./Dropdown.tsx`). */
export interface Gestures {
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
  const [asking, setAsking] = createSignal<MenuAction | null>(null)
  onCleanup(() => props.onGone())
  /** The entries as they stand, by the verb each one is for — so cancelling
   *  below can hand the caret back to an ELEMENT rather than look one up by a
   *  selector. Rewritten as the list is redrawn, which is what makes it right
   *  after the swap back from the question. */
  const entries = new Map<string, HTMLElement>()

  /** Backing out of the question, with the caret put back where it was asked
   *  from. The confirm takes the focus when it opens (a panel that swapped its
   *  content under an unmoved focus would leave the keyboard on an element that
   *  is gone), so cancelling has to hand it back — otherwise a person who
   *  opened this menu with the keyboard is returned to the top of the document
   *  and has to walk down the whole page again. After the frame that redraws
   *  the list, because the entry being aimed at does not exist until then. */
  const cancel = (action: MenuAction): void => {
    setAsking(null)
    queueMicrotask(() => entries.get(action.id)?.focus())
  }

  /**
   * A SUBMENU — `Mark ›`, `More ›`, a plugin's choice — as Kobalte's own `Sub`,
   * so the arrows, Enter, Escape and typeahead walk into and out of it exactly
   * as they walk the list. Its content is portalled into the same overlay the
   * panel is (`../overlay.ts`), at the panel's layer. A verb inside it that
   * asks first swaps the ROOT panel for the question, which takes the submenu
   * down with the list it hung off.
   */
  const Sub = (sub: { readonly entry: MenuSub }) => (
    // `overlap`: on a phone there is no room beside the panel, so the submenu
    // may slide back over it rather than hang off the screen's edge.
    <DropdownMenu.Sub gutter={2} shift={-5} overlap>
      <DropdownMenu.SubTrigger
        ref={(el: HTMLElement) => entries.set(sub.entry.id, el)}
        class={`${MENU_ITEM} flex items-center justify-between gap-6 data-[expanded]:bg-rule`}
        data-testid={TESTID.nodeMenuItem}
        data-action={sub.entry.id}
        // Opens on its click, which a tap's ghost-eater must leave alone
        // (`./Dropdown.tsx`'s `tappedInPanel`).
        data-opens=""
      >
        <span>{sub.entry.label}</span>
        <span class="text-muted" aria-hidden="true">›</span>
      </DropdownMenu.SubTrigger>
      <DropdownMenu.Portal mount={overlayRoot()}>
        <DropdownMenu.SubContent
          class={`${MENU_PANEL} ${LAYER.row} pointer-events-auto`}
          data-testid={TESTID.nodeMenuSub}
          data-sub={sub.entry.id}
          aria-label={sub.entry.label}
          onKeyDown={props.gestures.onKeyDown}
          onPointerDown={props.gestures.onPointerDown}
          onPointerUp={props.gestures.onPointerUp}
        >
          <Entries entries={sub.entry.entries} />
        </DropdownMenu.SubContent>
      </DropdownMenu.Portal>
    </DropdownMenu.Sub>
  )

  const Entries = (list: { readonly entries: ReadonlyArray<MenuEntry> }) => (
    <For each={list.entries}>
      {(entry) => (
        <>
          {/* The rule between groups, as a `role="separator"` rather than as
              a border on the entry below it: the same 4px above, hairline,
              4px below the `<li>` used to draw, and this way the hover band
              is still exactly the entry. */}
          <Show when={entry.divider}>
            <DropdownMenu.Separator class="my-1 border-t border-rule" />
          </Show>
          {isSub(entry) ? <Sub entry={entry} /> : <Verb action={entry} />}
        </>
      )}
    </For>
  )

  const Verb = (one: { readonly action: MenuAction }) => {
    const action = one.action
    return (
              <DropdownMenu.Item
                ref={(el: HTMLElement) => entries.set(action.id, el)}
                // The classes are this app's own — Kobalte ships no styles —
                // so this is the same box the hand-rolled `<button>` was, in a
                // `role="menuitem"` this time. `data-[highlighted]` is where
                // the entry the KEYBOARD is standing on shows, in the same
                // band a pointer gets: the arrow keys are new here, and a
                // walk nobody can see is not a walk. It replaces the focus
                // ring rather than joining it (`focus:outline-none`) —
                // Chromium draws that one for pointer opens too.
                class={MENU_ITEM}
                data-testid={TESTID.nodeMenuItem}
                data-action={action.id}
                closeOnSelect={!asks(action)}
                onSelect={() =>
                  asks(action) ? setAsking(action) : void props.onPick(action)}
              >
                {action.label}
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
