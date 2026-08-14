/**
 * What is INSIDE the open panel: the list, or the question one verb asks first
 * (`./Confirm.tsx`).
 *
 * It lives in `DropdownMenu.Content`, which Kobalte unmounts when the menu
 * shuts — so `asking` dies with the panel, and a menu closed on Escape and
 * reopened is a menu that is not still asking. That disposal is also the one
 * event in the whole primitive that fires on every close, which is why the
 * caret's way home hangs off it (`onGone`, and `./NodeMenu.tsx`'s `handBack`
 * for why Kobalte's own hook cannot be the one to do it).
 *
 * Everything here is Kobalte's `Item` and `Separator` wearing this app's own
 * classes — the library ships none — so this file is the whole of what the
 * `role="menu"` looks like, and `./NodeMenu.tsx` is the whole of how it
 * behaves. That is the seam the primitive drew: the two used to be one file
 * and had no reason left to be.
 */

import { DropdownMenu } from "@kobalte/core/dropdown-menu"
import { createSignal, For, onCleanup, Show } from "solid-js"

import { asks, type MenuAction } from "./action.ts"
import { Confirm } from "./Confirm.tsx"
import { TESTID } from "../testids.ts"

export function Panel(props: {
  readonly actions: ReadonlyArray<MenuAction>
  readonly onPick: (action: MenuAction) => void | Promise<void>
  readonly onGone: () => void
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

  return (
    <Show
      when={asking()}
      fallback={
        <For each={props.actions}>
          {(action) => (
            <>
              {/* The rule between the halves, as a `role="separator"` rather
                  than as a border on the entry below it: the same 4px above,
                  hairline, 4px below the `<li>` used to draw, and this way the
                  hover band is still exactly the entry. */}
              <Show when={action.divider}>
                <DropdownMenu.Separator class="my-1 border-t border-rule" />
              </Show>
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
                class="cursor-pointer px-3 py-1.5 text-left text-ink hover:bg-rule focus:outline-none data-[highlighted]:bg-rule"
                data-testid={TESTID.nodeMenuItem}
                data-action={action.id}
                closeOnSelect={!asks(action)}
                onSelect={() =>
                  asks(action) ? setAsking(action) : void props.onPick(action)}
              >
                {action.label}
              </DropdownMenu.Item>
            </>
          )}
        </For>
      }
    >
      {(action) => (
        <Confirm action={action()} onGo={props.onPick} onCancel={cancel} />
      )}
    </Show>
  )
}
