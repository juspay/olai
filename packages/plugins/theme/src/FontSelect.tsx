import { TESTID } from "olai-plugin-theme/testids"
import { For } from "solid-js"

import { FONT_GROUPS, typefaceNamed } from "@olai/fonts"
import type { Appearance } from "./index.ts"


export function FontSelect(props: { readonly state: Appearance }) {
  return (
    <select
      class="min-h-11 max-w-[12rem] rounded-control border border-rule bg-paper px-2 text-body text-ink md:min-h-0 md:py-1"
      style={{ "font-family": props.state.font.current().sans }}
      data-testid={TESTID.fontSelect}
      value={props.state.font.current().name}
      aria-label="Font"
      onChange={(event) => {
        const face = typefaceNamed(event.currentTarget.value)
        if (face !== undefined) props.state.font.pick(face)
      }}
    >
      <For each={FONT_GROUPS}>
        {(group) => (
          <optgroup label={group.label}>
            <For each={group.faces}>
              {(face) => <option value={face.name}>{face.label}</option>}
            </For>
          </optgroup>
        )}
      </For>
    </select>
  )
}
