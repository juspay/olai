/**
 * One result row, wherever search is drawn.
 *
 * FOUR surfaces draw this row over the one `./nodes.ts` reading — the ⌘K
 * palette, the header's box, the `((` widget in a row's title and the edge
 * panel — and it is one component for the same reason there is one query: two
 * spellings of a row are two rows, and the day one of them learns to show a
 * mark or a date is the day they stop being the same product.
 *
 * That is not a hypothetical. The properties line below reached the palette and
 * the header box and stopped, because those two were the doors somebody was
 * thinking about — one row, drawing different things in different places, over
 * identical answers. The component was never the problem; what each door PASSES
 * is, so what a door has to pass is kept as small as it can be (see
 * {@link RowTestids}) and every door that draws a node hit passes all of it.
 *
 * ## The shape, and the bug it was cut from
 *
 * TWO STACKED LINES, both ellipsized, neither able to widen the row.
 *
 * It was one line — title on the left, place on the right — and that is a
 * layout that cannot hold somebody's prose. A node's ancestor title is a
 * sentence as often as it is a word, and a flex item's default
 * `min-width: auto` means the mono place REFUSES to shrink below its own
 * text: so the flexible half (the title) gave up its width instead, wrapping
 * to one word per line and stacking rows five and six lines tall, and when
 * even that was not enough the row pushed the panel into a SIDEWAYS scroll. A
 * popover never scrolls sideways — a reader cannot even see that there is
 * something off to the right of a floating box — so neither line may ever be
 * the thing that decides the width.
 *
 * Hence: `min-w-0` on every flexible box (the one property that lets a flex
 * child be narrower than its content), `truncate` on both lines, and the
 * width taken from the panel rather than offered to it.
 *
 * A command's `hint` is different in kind and stays inline on the first line:
 * `⌘\` is three characters by construction, so it can sit beside a title
 * without ever starving it.
 *
 * ## The third line, and why it is a line rather than a column
 *
 * A node's properties come next, when it has any — `key value` pairs, in the
 * drawer's own type vocabulary (`../props/PropsDrawer.tsx`): the key in the
 * mono face, the value in the reading face, so a pair scans as "name, value"
 * without a rule between them. Reusing that vocabulary is the point — a
 * property should look like a property wherever it is drawn, and the drawer is
 * where a reader learned what one looks like.
 *
 * What is NOT reused is the drawer's two-column GRID. That shape lines values
 * up under each other down a page, which is right for a column of facts about
 * one node and wrong here twice over: it costs a line per property in a panel
 * that shows eight rows, and a `max-content` key column is exactly the
 * refuses-to-shrink flex child the header above warns about. So the pairs run
 * INLINE on one line that truncates like the other two, and a node with six
 * properties costs the same height as a node with one.
 *
 * What separates the pairs is SPACE, not a glyph. The place line directly above
 * already separates its crumbs with a middle dot, and one character doing two
 * different jobs on two adjacent lines is a reader having to learn which is
 * which; the mono key starting each pair is the boundary, and it is one the
 * eye already reads.
 *
 * Each pair truncates on its OWN, so the line's width is shared rather than
 * eaten by whichever property happens to be first. The key survives and the
 * value gives way, which is the right half to lose: a reader who searched
 * `prop:agent=claude-opus` already knows that value — what they came for is
 * the `pr` beside it.
 *
 * The line is drawn only for a node that HAS a property — the drawer's own
 * rule on a row, for the drawer's own reason: a tree of titles must not double
 * in height to say something nobody asked to see.
 */

import { For, Show } from "solid-js"

import type { NodeProp } from "./props.ts"

/**
 * The handles ONE door gives this row's three lines.
 *
 * One value rather than three props, because they were three props that had to
 * agree: a door passing `props` and forgetting `propTestid` drew a line no test
 * could reach, and a door passing the testid without the data drew nothing at
 * all. Neither mistake is possible now — a caller names its row and the lines
 * come with it — and the four doors stopped repeating a near-constant triple
 * that differed only by suffix.
 *
 * Still LITERAL ids rather than a prefix this file derives, which is the trade
 * the other direction and deliberately kept: `../testids.ts` is a registry a
 * reader greps, and `${prefix}-place` would put half of every id in code where
 * searching for `header-search-item-place` finds nothing.
 */
export interface RowTestids {
  readonly row: string
  readonly place: string
  /** Absent for a door whose rows are not node hits — a tag completion has no
   *  properties, so there is nothing to name. */
  readonly prop?: string
}


export function Result(props: {
  readonly label: string
  /** A chord or a word, inline at the right of the first line. */
  readonly hint?: string
  /** Where the node lives — the second line. See `../palette/items.ts` for
   *  why it is written nearest-ancestor-first. */
  readonly place?: string
  /** The node's properties — the third line, matched ones first. Empty (or
   *  absent) for a node carrying none, which draws no line at all. See
   *  `./props.ts` for the order. */
  readonly props?: ReadonlyArray<NodeProp>
  readonly active: boolean
  /** What this door calls the row and its lines. */
  readonly testids: RowTestids
  /** Identifies the row to a test and to nothing else. */
  readonly id?: string
  readonly onSelect: () => void
  readonly onHover: () => void
}) {
  return (
    <button
      type="button"
      class={`flex w-full min-w-0 flex-col rounded px-3 py-2 text-left text-sm ${
        props.active ? "bg-rule text-ink" : "text-ink hover:bg-rule/60"
      }`}
      data-testid={props.testids.row}
      data-id={props.id}
      data-active={props.active ? "true" : "false"}
      onMouseEnter={() => props.onHover()}
      // The press must not move the caret. The header's box keeps its results
      // up only while it holds focus, so a plain click would blur the input,
      // shut the panel and land the click on nothing. Preventing the default
      // on mousedown keeps focus where it is and still lets `click` fire.
      onMouseDown={(event) => event.preventDefault()}
      onClick={() => props.onSelect()}
    >
      <span class="flex w-full min-w-0 items-baseline gap-3">
        <span class="min-w-0 flex-1 truncate">{props.label}</span>
        <Show when={props.hint}>
          {(hint) => (
            <span class="shrink-0 font-mono text-[0.6875rem] text-muted">
              {hint()}
            </span>
          )}
        </Show>
      </span>
      <Show when={props.place}>
        {(place) => (
          <span
            class="w-full min-w-0 truncate font-mono text-[0.6875rem] text-muted"
            data-testid={props.testids.place}
          >
            {place()}
          </span>
        )}
      </Show>
      <Show when={(props.props ?? []).length > 0}>
        {/* One line, truncated like the two above it, so six properties cost
            what one does and neither this nor the panel ever widens. */}
        <span class="flex w-full min-w-0 gap-4 truncate text-[0.6875rem]">
          <For each={props.props}>
            {(prop) => (
              <span
                class="min-w-0 truncate"
                data-testid={props.testids.prop}
                data-key={prop.key}
                data-matched={prop.matched ? "true" : undefined}
              >
                {/* The drawer's pairing: mono key, reading-face value. A
                    MATCHED key is drawn in the reading ink instead of the
                    muted one — the row's answer to "why is this here."

                    That is a LUMINANCE step (`text-ink` against `text-muted`),
                    not a change of weight and not a hue: it reads for somebody
                    who cannot separate two colours, and does not for somebody
                    who cannot separate two greys. Which is why it is the second
                    signal rather than the only one — ORDER is the first, and it
                    survives everything, including a line ellipsized down to its
                    first pair (`./props.ts` puts the matched keys in front). */}
                <span
                  class={`font-mono ${prop.matched ? "text-ink" : "text-muted"}`}
                >
                  {prop.key}
                </span>{" "}
                <span class="text-muted">{prop.value}</span>
              </span>
            )}
          </For>
        </span>
      </Show>
    </button>
  )
}
