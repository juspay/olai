/**
 * A node's properties, under its note: one `key value` line each, and nothing
 * at all when there are none.
 *
 * Workflowy-flavoured and quiet on purpose (docs/brainstorming/properties.md):
 * the facts a node carries are worth reading at a glance and are not worth a
 * panel, a table or a heading. The key is set in the mono face at the size the
 * app already uses for machine-ish text, the value in the reading face — so a
 * column of them scans as "name, value" without a rule between them.
 *
 * HIDDEN UNTIL THERE IS SOMETHING TO SHOW, which is the whole reason it can sit
 * under every row in the tree: a vault where nobody has written a property has
 * no drawers, and one where somebody has gets three lines on the four nodes
 * they wrote them on. There is no empty state, and nothing here invites anybody
 * to start — the `•••` menu is where a property comes from.
 *
 * WHAT IT DRAWS AND IN WHAT ORDER is `./drawer.ts`, tested without a browser:
 * the keys olai does not read, in the file's own order. This is the grid.
 */

import type { RegularNode } from "@olai/format"
import { createMemo, For, Show } from "solid-js"

import { drawerEntries, isLink } from "./drawer.ts"
import { TESTID } from "../testids.ts"

export function PropsDrawer(props: {
  /** The regular node being shown — for a mirror, the node it stands for,
   *  since a placement carries no properties of its own. */
  readonly node: RegularNode
}) {
  const entries = createMemo(() => drawerEntries(props.node))

  return (
    <Show when={entries().length > 0}>
      {/* A two-column grid rather than a `<dl>` of rows: the values line up
          under each other whatever the keys are called, which is what makes a
          column of them readable at all. `max-content` on the key column with a
          floor, so one long key does not push every value off the row. */}
      <dl
        class="mt-1 mb-1 grid grid-cols-[minmax(4rem,max-content)_1fr] items-baseline gap-x-4 gap-y-0.5"
        data-testid={TESTID.props}
      >
        <For each={entries()}>
          {(entry) => (
            <div class="contents" data-testid={TESTID.prop} data-key={entry.key}>
              <dt class="truncate font-mono text-xs text-muted">{entry.key}</dt>
              <dd
                class="m-0 min-w-0 break-words text-[0.8125rem] text-ink"
                data-testid={TESTID.propValue}
              >
                <Show when={isLink(entry.value)} fallback={entry.value}>
                  {/* `noreferrer` beside `noopener` because this is somebody's
                      vault: where a link they filed goes is not the page's to
                      announce to the far end. */}
                  <a
                    class="text-accent underline decoration-accent/40 underline-offset-2 hover:decoration-current"
                    href={entry.value}
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    {entry.value}
                  </a>
                </Show>
              </dd>
            </div>
          )}
        </For>
      </dl>
    </Show>
  )
}
