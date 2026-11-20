/**
 * A row written for everyone must not sit under a line that says this
 * browser's, and the ordering makes that a consequence rather than a promise:
 * browser-local groups draw first, shared ones after.
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
  readonly at: () => Anchor
  readonly inside: (el: HTMLElement | undefined) => void
}) {
  const runs = createMemo(() => runsOf(groupsOf(props.sections())))

  return (
    <section
      ref={props.inside}
      class={`${PANEL_BOX} gap-3 max-md:!py-3 md:gap-5`}
      style={styleOf(props.at())}
      tabindex="-1"
      data-testid={TESTID.prefsPanel}
      aria-label="Preferences"
    >
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
