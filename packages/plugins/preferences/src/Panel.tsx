/**
 * What this browser is set to, in one place — a calm settings pane.
 *
 * Nearly everything on it is CLIENT-LOCAL (`docs/architecture/overview.md`): a
 * pick is stored in this browser, carried to its other tabs by the `storage`
 * event, and never sent. One quiet line at the foot says so, once.
 *
 * THE PANEL KNOWS NO ROW. Its headings are this package's own table
 * (`./index.ts`'s `HEADINGS`), drawn in that order; each owning plugin
 * contributes its rows to `preferences.sections` naming a heading's key and a
 * place among that heading's rows. A contributor switched off withdraws its
 * entry, and a heading left with no entries is not drawn.
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
import { type Heading, HEADINGS, type Section } from "./index.ts"

export function Panel(props: {
  readonly sections: () => ReadonlyArray<Contribution<Section>>
  /** Where to sit, in viewport pixels — see `@olai/web/client/anchor.ts`. */
  readonly at: Anchor
  /** Register this surface with the click-away, since it is portalled. */
  readonly inside: (el: HTMLElement | undefined) => void
}) {
  const entriesOf = (heading: Heading) =>
    props.sections().filter((entry) => entry.value.heading === heading).sort((a, b) => a.value.order - b.value.order)
  // The table's own entries, so `For` keeps a heading's DOM while it stays shown.
  const shown = createMemo(() => HEADINGS.filter((heading) => entriesOf(heading.key).length > 0))

  return (
    <section
      ref={props.inside}
      class={`${PANEL_BOX} gap-3 max-md:!py-3 md:gap-5`}
      style={styleOf(props.at)}
      // Focusable, never in the tab order: opening puts the caret here so a
      // keyboard is standing IN the panel, and Tab from here is the first control.
      tabindex="-1"
      data-testid={TESTID.prefsPanel}
      aria-label="Preferences"
    >
      <For each={shown()}>
        {(heading) => (
          <section
            class="[&:not(:has([data-pref]))]:hidden"
            aria-label={heading.label}
            data-testid={TESTID.prefsGroup}
            data-group={heading.key}
          >
            <h3 class="mb-1 text-label font-medium text-muted">{heading.label}</h3>
            <div class="divide-y divide-rule/40">
              <For each={entriesOf(heading.key)}>{(entry) => entry.value.body()}</For>
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
