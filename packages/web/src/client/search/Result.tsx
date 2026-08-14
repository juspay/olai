/**
 * One result row, wherever search is drawn.
 *
 * Two doors draw results — the ⌘K palette and the header's box — and this is
 * the row both of them draw, for the same reason `./nodes.ts` is the one
 * query: two spellings of a row are two rows, and the day one of them learns
 * to show a mark or a date is the day they stop being the same product.
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
 */

import { Show } from "solid-js"

export function Result(props: {
  readonly label: string
  /** A chord or a word, inline at the right of the first line. */
  readonly hint?: string
  /** Where the node lives — the second line. See `../palette/items.ts` for
   *  why it is written nearest-ancestor-first. */
  readonly place?: string
  readonly active: boolean
  readonly testid: string
  readonly placeTestid: string
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
      data-testid={props.testid}
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
            data-testid={props.placeTestid}
          >
            {place()}
          </span>
        )}
      </Show>
    </button>
  )
}
