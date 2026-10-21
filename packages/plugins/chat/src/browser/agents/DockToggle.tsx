/**
 * THE BAR'S DOOR to the agent panel: a glyph in the desktop header that shows
 * or hides the seat's column (`../dock.ts`), pressed while it is open.
 *
 * A `layout.tools` entry, which is what a door in the bar is — the
 * preferences gear is the other one. Drawn on a desktop only: a phone has no
 * seat, and the drawer's closet is for doors a phone can walk through.
 */
import { Show } from "solid-js"

import { ICON_BUTTON } from "@olai/web/client/readout.ts"
import type { ToolWhere } from "olai-plugin-layout/contract"

import { TESTID } from "../../testids.ts"
import { dock } from "../dock.ts"

export function DockToggle(props: { readonly where: ToolWhere }) {
  const door = () => dock()
  return (
    <Show when={props.where === "header" && door()?.desktop()}>
      <button
        type="button"
        class={`${ICON_BUTTON} !px-0 md:!w-7`}
        classList={{ "bg-ink/8 text-ink": door()?.opened() === true }}
        data-testid={TESTID.chatToggle}
        aria-pressed={door()?.opened() === true ? "true" : "false"}
        aria-label={door()?.opened() === true ? "Hide the agent panel" : "Show the agent panel"}
        title="Agent panel (⌘J)"
        onClick={() => door()?.toggle()}
      >
        <svg viewBox="0 0 16 16" class="size-4" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="1.5">
          <rect x="1.75" y="2.75" width="12.5" height="10.5" rx="1.75" />
          <path d="M9.75 2.75v10.5" />
        </svg>
      </button>
    </Show>
  )
}
