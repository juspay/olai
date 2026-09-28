/**
 * What this browser is set to, in one place — a calm settings pane.
 *
 * Nearly everything on it is CLIENT-LOCAL (`docs/architecture/overview.md`): a
 * pick is stored in this browser, carried to its other tabs by the `storage`
 * event, and never sent. One quiet line at the foot says so, once.
 *
 * THE PANEL KNOWS NO ROW AND NO HEADING. Each owning plugin contributes its
 * rows to `preferences.sections` with the heading they belong under and a
 * place (`./index.ts`'s `Section`); the panel sorts by place and draws one
 * heading per distinct name, at its first contribution. A contributor switched
 * off withdraws its entry, and a heading left with no entries is gone with it.
 * A contribution whose body draws no row (a provider that has nothing to offer
 * yet) leaves its heading hidden by CSS rather than drawn over nothing.
 *
 * The layout values (`olai-plugin-layout`'s prefs) are stored the same way and
 * are deliberately NOT here: a sidebar width is set by dragging the sidebar,
 * and a second control for something that already has one is redundancy.
 */
import { TESTID } from "olai-plugin-preferences/testids"
import type { Contribution } from "@olai/plugin-api"
import { createMemo, For } from "solid-js"

import { type Anchor, styleOf } from "@olai/web/client/anchor.ts"
import { PANEL_BOX } from "@olai/web/client/readout.ts"
import type { Section } from "./index.ts"

/** Headings in the order of their first contribution, each with its entries —
 *  derived from what the contributions declare and nothing else. */
const grouped = (entries: ReadonlyArray<Contribution<Section>>): ReadonlyArray<{
  readonly group: string
  readonly entries: ReadonlyArray<Contribution<Section>>
}> => {
  const sorted = [...entries].sort((a, b) => a.value.order - b.value.order)
  const groups = new Map<string, Array<Contribution<Section>>>()
  for (const entry of sorted) {
    const held = groups.get(entry.value.group)
    if (held === undefined) groups.set(entry.value.group, [entry])
    else held.push(entry)
  }
  return [...groups].map(([group, entries]) => ({ group, entries }))
}

export function Panel(props: {
  readonly sections: () => ReadonlyArray<Contribution<Section>>
  /** Where to sit, in viewport pixels — see `@olai/web/client/anchor.ts`. */
  readonly at: Anchor
  /** Register this surface with the click-away, since it is portalled. */
  readonly inside: (el: HTMLElement | undefined) => void
}) {
  const groups = createMemo(() => grouped(props.sections()))
  const names = createMemo(() => groups().map((group) => group.group), undefined, {
    equals: (a, b) => a.length === b.length && a.every((name, i) => name === b[i]),
  })
  const entriesOf = (group: string) => groups().find((held) => held.group === group)?.entries ?? []

  return (
    <section
      ref={props.inside}
      class={`${PANEL_BOX} gap-5`}
      style={styleOf(props.at)}
      // Focusable, never in the tab order: opening puts the caret here so a
      // keyboard is standing IN the panel, and Tab from here is the first control.
      tabindex="-1"
      data-testid={TESTID.prefsPanel}
      aria-label="Preferences"
    >
      <For each={names()}>
        {(group) => (
          <section
            class="[&:not(:has([data-pref]))]:hidden"
            aria-label={group}
            data-testid={TESTID.prefsGroup}
            data-group={group}
          >
            <h3 class="mb-1 text-label font-medium text-muted">{group}</h3>
            <div class="divide-y divide-rule/40">
              <For each={entriesOf(group)}>{(entry) => entry.value.body()}</For>
            </div>
          </section>
        )}
      </For>

      <p class="text-label text-muted" data-testid={TESTID.prefsScope}>
        Saved in this browser only.
      </p>
    </section>
  )
}
