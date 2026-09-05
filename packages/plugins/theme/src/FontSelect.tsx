/**
 * The named typefaces, as a select: every option is a face, and picking one
 * puts it in force.
 *
 * A select rather than a strip of chips, because twenty names never fit the
 * way the colour chips do, and because this is the control Workflowy's
 * list is. The panel STAYS OPEN on a pick — a face is judged by looking at
 * the page it sets, and shutting the surface after every change would make
 * comparing two of them a matter of reopening it.
 *
 * Options are NOT previewed in their own face. A native `<option>` styled
 * with `font-family` would make the browser fetch every hosted file the
 * moment the panel opened. The closed select wears the face in force, and
 * the page itself is the specimen.
 *
 * Persistence, the storage event and the boot script are untouched by any of
 * that: this file only draws.
 */

import { For } from "solid-js"

import { FONT_GROUPS, typefaceNamed } from "@olai/fonts"
import type { Appearance } from "./index.ts"
import { TESTID } from "@olai/web/client/testids.ts"

export function FontSelect(props: { readonly state: Appearance }) {
  return (
    <select
      class="max-w-full rounded border border-rule bg-paper px-2 py-1.5 text-sm text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
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
