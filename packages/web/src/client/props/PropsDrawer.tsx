/**
 * A node's facts, under its note: the ones it carries in fields of its own,
 * then the ones somebody put there — one `key value` line each.
 *
 * Workflowy-flavoured and quiet on purpose (docs/brainstorming/properties.md):
 * facts worth reading at a glance are not worth a panel, a table or a heading.
 * The key is set in the mono face at the size the app uses for machine-ish
 * text, the value in the reading face, so a column of them scans as "name,
 * value" without a rule between them.
 *
 * ## When it is drawn, which is not the same in the two places
 *
 * On a ROW: only when the node carries a custom property. A tree is a column of
 * titles, and an `id` line under every bullet in the vault would double the
 * height of every row to say something nobody asked to see — the design's own
 * word for this drawer is "hidden until the node has properties", and that
 * still decides whether it appears.
 *
 * On the node's own PAGE: always. A zoomed node is a page ABOUT that node, the
 * facts are what the page is for, and the id in particular is what every tool
 * call and every `((` reference takes — until now readable nowhere on screen.
 *
 * ## Read-only above, writable below
 *
 * The system lines carry `data-system`, and they are drawn exactly like the
 * others: same grid, same type. Nothing here greys them out, because they are
 * not disabled versions of anything — they are facts, drawn where facts are.
 * What says they cannot be typed over is the `•••` menu, which offers `Edit`
 * and `Remove` for the custom keys and nothing for these (./drawer.ts).
 */

import type { RegularNode } from "@olai/format"
import { createMemo, For, Show } from "solid-js"

import { customEntries, drawerEntries, isLink } from "./drawer.ts"
import { TESTID } from "../testids.ts"

export function PropsDrawer(props: {
  /** The regular node being shown — for a mirror, the node it stands for,
   *  since a placement carries no properties of its own. */
  readonly node: RegularNode
  /** Draw the node's own facts even when nobody has added a property: what a
   *  page about one node does, and what a row in a tree does not. */
  readonly always?: boolean
}) {
  const entries = createMemo(() =>
    props.always === true || customEntries(props.node).length > 0
      ? drawerEntries(props.node)
      : []
  )

  return (
    <Show when={entries().length > 0}>
      {/* A two-column grid rather than rows: the values line up under each
          other whatever the keys are called, which is what makes a column of
          them readable at all. `max-content` on the key column with a floor, so
          one long key does not push every value off the line. */}
      <dl
        class="mt-1 mb-1 grid grid-cols-[minmax(4rem,max-content)_1fr] items-baseline gap-x-4 gap-y-0.5"
        data-testid={TESTID.props}
      >
        <For each={entries()}>
          {(entry) => (
            <div
              class="contents"
              data-testid={TESTID.prop}
              data-key={entry.key}
              data-system={entry.system ? "true" : undefined}
            >
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
