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
 * one footer line became A SCOPE LINE PER RUN — adjacent groups of one scope
 * share one, and the line belongs to the RUN rather than to its last group, so
 * a group whose body drew no row cannot take it down with it. A row written for
 * everyone must not sit under a line that says this browser's, and the ordering
 * makes that a consequence rather than a promise: browser-local groups draw
 * first, shared ones after.
 *
 * THE PANEL KNOWS NO ROW. Its fixed headings are this package's own table
 * (`./index.ts`'s `HEADINGS`); its plugin headings arrive with the
 * contributions that name them. Each owning plugin contributes its rows to
 * `preferences.sections` naming a heading, a place among that heading's rows,
 * and the scope its values are kept in — the groups and the runs are
 * `./groups.ts`'s, and what is here is the drawing. A contributor switched off
 * withdraws its entry, and a heading left with no entries is not drawn.
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
import { type Group, groupsOf, type Run, runsOf, SCOPE_WORDS } from "./groups.ts"

export function Panel(props: {
  readonly sections: () => ReadonlyArray<Contribution<Section>>
  /** Where to sit, in viewport pixels, as a READER — see
   *  `@olai/web/client/anchor.ts` and `olai-plugin-layout`'s `BarDoor`: a
   *  re-measure moves this panel, and rebuilding it would take the caret out of
   *  whatever a person is typing into (`Control.tsx` keeps a draft in the
   *  mounted control). */
  readonly at: () => Anchor
  /** Register this surface with the click-away, since it is portalled. */
  readonly inside: (el: HTMLElement | undefined) => void
}) {
  /** WHAT THE PANEL DRAWS: the runs the contributions make, each of them
   *  groups of one scope and the line that closes them. Both readings are this
   *  package's own and both are pure (`./groups.ts`) — what is left here is the
   *  drawing. */
  const runs = createMemo(() => runsOf(groupsOf(props.sections())))

  return (
    <section
      ref={props.inside}
      class={`${PANEL_BOX} gap-3 max-md:!py-3 md:gap-5`}
      style={styleOf(props.at())}
      // Focusable, never in the tab order: opening puts the caret here so a
      // keyboard is standing IN the panel, and Tab from here is the first control.
      tabindex="-1"
      data-testid={TESTID.prefsPanel}
      aria-label="Preferences"
    >
      {/* A RUN IS THE UNIT, and the line is the run's: the container that closes
          a run holds the line AND the groups it closes. That is what keeps a
          group whose body drew no row from taking the line with it — the group
          hides itself (`:not(:has([data-pref]))`), and a run all of whose groups
          hid hides with them.

          AND BOTH ARE ITERATED BY KEY, because `groupsOf` builds fresh objects
          every time the contributions move and `For` keys by identity: a list of
          objects would tear down every run and every group on any change, and
          with them every mounted body — the draft in `Control.tsx` belongs to
          the MOUNTED control, so a typist would lose the text and the caret
          because somebody switched an unrelated plugin off in another tab. A
          run's key is its scope and a group's is the key `data-group` carries
          (every other run and group is that one's identity in the panel); the
          objects are looked up fresh on every read, so the DOM is kept and the
          current words and rows are the ones drawn. */}
      <For each={runs().map((run) => run.scope)}>
        {(scope) => {
          const run = (): Run => runs().find((one) => one.scope === scope)!
          return (
            <div
              class="flex flex-col gap-3 md:gap-5 [&:not(:has([data-pref]))]:hidden"
              data-testid={TESTID.prefsRun}
              data-scope={scope}
            >
              <For each={run().groups.map((group) => group.key)}>
                {(key) => {
                  const group = (): Group => run().groups.find((one) => one.key === key)!
                  return (
                    <section
                      class="[&:not(:has([data-pref]))]:hidden"
                      aria-label={group().label()}
                      data-testid={TESTID.prefsGroup}
                      data-group={key}
                    >
                      <h3 class="mb-1 text-label font-medium text-muted">{group().label()}</h3>
                      <div class="divide-y divide-rule/40">
                        {/* ...AND THE ENTRIES THEMSELVES need no key of their own:
                            they are the renderer's own contribution objects, and
                            `Locations.read` returns STABLE identities across
                            revisions ("a change elsewhere must not recreate an
                            editor which still owns the same location"), so a
                            contribution still contributed keeps its row and its
                            body is not called again. */}
                        <For each={group().entries}>{(entry) => entry.value.body()}</For>
                      </div>
                    </section>
                  )
                }}
              </For>
              <p class="text-label text-muted" data-testid={TESTID.prefsScope} data-scope={scope}>
                {SCOPE_WORDS[scope]}
              </p>
            </div>
          )
        }}
      </For>
    </section>
  )
}
