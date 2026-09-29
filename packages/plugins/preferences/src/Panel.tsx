/**
 * What this browser is set to, in one place — a calm settings pane.
 *
 * Nearly everything on it is CLIENT-LOCAL (`docs/architecture/overview.md`): a
 * pick is stored in this browser, carried to its other tabs by the `storage`
 * event, and never sent. One quiet line at the foot says so, once.
 *
 * AND THE REST IS NOT — a plugin may mark a config schema leaf as a preference
 * (`@olai/plugin-api/configuration`'s `preference`), and its rows are drawn
 * here too, under a heading named after the plugin. Those rows are the serve's:
 * they live in `_olai/Settings.olai` for everybody using this directory. So the
 * one footer line became a SCOPE LINE PER GROUP — the words of the run of
 * groups it closes — because a row written for everyone must not sit under a
 * line that says this browser's. The ordering makes that a consequence rather
 * than a promise: fixed headings draw first (browser-local), plugin headings
 * after (shared), so the browser-only line always sits above every shared row.
 * Adjacent groups of one scope share one line.
 *
 * THE PANEL KNOWS NO ROW. Its fixed headings are this package's own table
 * (`./index.ts`'s `HEADINGS`), drawn in that order; its plugin headings arrive
 * with the contributions that name them. Each owning plugin contributes its
 * rows to `preferences.sections` naming a heading and a place among that
 * heading's rows. A contributor switched off withdraws its entry, and a heading
 * left with no entries is not drawn.
 * A contribution whose body draws no row (a provider that has nothing to offer
 * yet) leaves its heading hidden by CSS rather than drawn over nothing.
 *
 * The layout values (`olai-plugin-layout`'s prefs) are stored the same way and
 * are deliberately NOT here: a sidebar width is set by dragging the sidebar,
 * and a second control for something that already has one is redundancy.
 */
import { TESTID } from "olai-plugin-preferences/testids"
import type { Contribution } from "@olai/plugin-api"
import { createMemo, For, Show } from "solid-js"

import { type Anchor, styleOf } from "@olai/web/client/anchor.ts"
import { PANEL_BOX } from "@olai/web/client/readout.ts"
import { HEADINGS, SCOPE_WORDS, type Section, type Scope } from "./index.ts"

/** One group as the panel draws it: what it is called, what it is keyed by,
 *  whose choices it holds, and the entries under it in order. */
interface Group {
  readonly key: string
  readonly label: string
  readonly scope: Scope
  readonly entries: ReadonlyArray<Contribution<Section>>
}

export function Panel(props: {
  readonly sections: () => ReadonlyArray<Contribution<Section>>
  /** Where to sit, in viewport pixels — see `@olai/web/client/anchor.ts`. */
  readonly at: Anchor
  /** Register this surface with the click-away, since it is portalled. */
  readonly inside: (el: HTMLElement | undefined) => void
}) {
  /** THE GROUPS, IN DRAW ORDER: the table's own headings first, in table
   *  order, then one heading per plugin that named one, sorted by its label.
   *  A heading with no entries is not a group. */
  const groups = createMemo((): ReadonlyArray<Group> => {
    const all = props.sections()
    const fixed: Group[] = HEADINGS
      .map((heading) => ({
        key: heading.key as string,
        label: heading.label,
        scope: "browser" as const,
        entries: all
          .filter((entry) => entry.value.heading === heading.key)
          .sort((a, b) => a.value.order - b.value.order),
      }))
      .filter((group) => group.entries.length > 0)
    // Plugin headings, filed by the plugin they name: two contributions may
    // share one heading, and a heading's words come from its own label.
    const named = new Map<string, { label: string; entries: Contribution<Section>[] }>()
    for (const entry of all) {
      const heading = entry.value.heading
      if (typeof heading === "string") continue
      const bucket = named.get(heading.plugin) ?? { label: heading.label, entries: [] }
      bucket.entries.push(entry)
      named.set(heading.plugin, bucket)
    }
    const plugins: Group[] = [...named]
      .map(([plugin, bucket]) => ({
        key: plugin,
        label: bucket.label,
        scope: "shared" as const,
        entries: bucket.entries.slice().sort((a, b) => a.value.order - b.value.order),
      }))
      .filter((group) => group.entries.length > 0)
      .sort((a, b) => a.label.localeCompare(b.label))
    return [...fixed, ...plugins]
  })

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
      <For each={groups()}>
        {(group, index) => (
          <section
            class="[&:not(:has([data-pref]))]:hidden"
            aria-label={group.label}
            data-testid={TESTID.prefsGroup}
            data-group={group.key}
          >
            <h3 class="mb-1 text-label font-medium text-muted">{group.label}</h3>
            <div class="divide-y divide-rule/40">
              <For each={group.entries}>{(entry) => entry.value.body()}</For>
            </div>
            {/* ONE LINE PER RUN OF ONE SCOPE, not per group and not one for
                the whole panel: adjacent groups of a scope share the line, and
                the browser-only line can never sit above a shared row because
                every shared heading draws after every fixed one. It sits
                INSIDE the group so a group that drew no row (hidden by CSS)
                takes its line with it. */}
            <Show when={index() === groups().length - 1 || groups()[index() + 1]!.scope !== group.scope}>
              <p class="mt-1 text-label text-muted" data-testid={TESTID.prefsScope} data-scope={group.scope}>
                {SCOPE_WORDS[group.scope]}
              </p>
            </Show>
          </section>
        )}
      </For>
    </section>
  )
}