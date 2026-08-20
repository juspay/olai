/**
 * A node's properties, as a RUN: dim `key value` pairs on one wrapping line,
 * dot-separated, reading like a byline under a headline.
 *
 * It was a two-column grid until the quiet outline, and the grid was the
 * problem: a `dl` with a key column and a value column is a table, a table
 * under every open row turns an outline into a spreadsheet, and the ruling is
 * that there is nothing table-shaped in this view (human). What a reader wants
 * from three facts is to read them, which is a sentence — so they are set as
 * one, in the size the app uses for machine-ish text, with the keys in the mono
 * face and the values in the reading face so `stage review · pr 208` scans as
 * pairs without a rule between them.
 *
 * The separator rides at the END of each pair rather than between them, so a run
 * that wraps never starts a line with a dot.
 *
 * ## When it is drawn, which is not the same in the two places
 *
 * On a ROW: in the OPEN STATE, and only the CUSTOM properties. Both halves
 * moved with the quiet outline. A tree is a column of titles — properties under
 * every folded row is the clutter the fold exists to remove — and the node's own
 * facts are already on screen elsewhere when you are looking at a row: the mark
 * is the glyph, the date is the badge, the id is where the bullet goes. Two
 * spellings of one fact under one title is the thing this drawer must not be.
 *
 * On the node's own PAGE: always, and whole. A zoomed node is a page ABOUT that
 * node, the facts are what the page is for, and the id in particular is what
 * every tool call and every `((` reference takes.
 *
 * ## Read-only above, writable below
 *
 * The system lines carry `data-system`, and they are drawn exactly like the
 * others: same run, same type. Nothing here greys them out, because they are
 * not disabled versions of anything — they are facts, drawn where facts are.
 * What says they cannot be typed over is the `•••` menu, which offers `Edit`
 * and `Remove` for the custom keys and nothing for these (./drawer.ts).
 */

import type { RegularNode } from "@olai/format"
import { Key } from "@solid-primitives/keyed"
import { createMemo, Show } from "solid-js"

import { customEntries, drawerEntries, type Entry, isLink } from "./drawer.ts"
import { TESTID } from "../testids.ts"

export function PropsDrawer(props: {
  /** The regular node being shown — for a mirror, the node it stands for,
   *  since a placement carries no properties of its own. */
  readonly node: RegularNode
  /** Draw the node's own facts as well: what a page about one node does, and
   *  what a row in a tree does not. */
  readonly always?: boolean
}) {
  const entries = createMemo(() =>
    props.always === true ? drawerEntries(props.node) : customEntries(props.node)
  )

  return (
    <Show when={entries().length > 0}>
      {/* One line that wraps, not a grid. `items-baseline` because the keys are
          set in the mono face and the values are not, and two faces centred
          against each other sit on two baselines. */}
      <div
        class="mt-0.5 mb-1 flex flex-wrap items-baseline gap-x-2 text-[0.8125rem] leading-snug text-muted"
        data-testid={TESTID.props}
      >
        {/* `<Key>`, not `<For>`: `customEntries` mints fresh entries from a
            node that is itself a fresh object on every frame the page
            publishes (docs/brainstorming/reactivity-after-the-flip.md §2), so
            a `<For>` comparing by reference rebuilt every chip of every open
            row on every keystroke committed anywhere on the page. */}
        <Key each={entries()} by={keyOf}>
          {(entry, index) => (
            <span
              class="inline-flex min-w-0 max-w-full items-baseline gap-1"
              data-testid={TESTID.prop}
              data-key={entry().key}
              data-system={entry().system ? "true" : undefined}
            >
              <span class="shrink-0 font-mono text-xs">{entry().key}</span>
              <span class="min-w-0 break-words" data-testid={TESTID.propValue}>
                <Show when={isLink(entry().value)} fallback={entry().value}>
                  {/* A link in the run is DIM like everything beside it and
                      takes the accent under the pointer — the tags' own rule,
                      one line down (`../styles.css`). It used to be accent ink
                      on sight, which on a node carrying a `pr` made the URL the
                      loudest thing in the open state.

                      `noreferrer` beside `noopener` because this is somebody's
                      vault: where a link they filed goes is not the page's to
                      announce to the far end. */}
                  <a
                    class="underline decoration-rule underline-offset-2 hover:text-accent hover:decoration-current"
                    href={entry().value}
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    {entry().value}
                  </a>
                </Show>
              </span>
              {/* The dot belongs to the pair BEFORE it, so a wrapped run never
                  opens a line with a separator. Decorative, and said so. */}
              <Show when={index() < entries().length - 1}>
                <span class="shrink-0 text-rule" aria-hidden="true">
                  ·
                </span>
              </Show>
            </span>
          )}
        </Key>
      </div>
    </Show>
  )
}

/**
 * WHAT IDENTIFIES A CHIP, for the key above.
 *
 * The NAMESPACE and then the key, because `custom` is open all the way
 * (`@olai/format`'s custom.ts): nothing stops a node from carrying a custom
 * `date`, and on a page drawing both halves that would be one key over two
 * chips — one element handed to the framework twice, which is a crash rather
 * than a wrong draw (`../edges/named.ts` argues it where it first bit). Within
 * each half the keys are a map's own and unique by construction.
 */
const keyOf = (entry: Entry): string =>
  `${entry.system ? "system" : "custom"}:${entry.key}`
