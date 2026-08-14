/**
 * What is picked, and the one verb the keyboard cannot ask for.
 *
 * A multi-selection has no caret, so it has no row to draw a refusal under —
 * and every bulk gesture is several writes that can be refused halfway. That is
 * the first thing this bar exists for: a line the ops layer's own words land
 * on, in the same two moods every other write surface has (`../writes.ts`).
 * `UndoSaid` cannot be it: that is the undo stack's line, pinned over the page,
 * and two sources sharing one box would show a reader the wrong sentence about
 * the wrong thing.
 *
 * The second is **Move to Trash**, which is the only bulk verb with no key. The
 * human's 2026-08-11 ruling still stands — there is no delete key in this app —
 * and putting a branch away behind a chord that also has to be pressed with
 * rows picked would be exactly the key that ruling is about. So it is a button,
 * behind the same second step the `•••` menu's own archive is behind, naming
 * the same blast radius (`../menu/verbs.ts`).
 *
 * Everything else a selection answers to is a KEY and is not drawn here
 * (`../keys.ts` is the list, and ⌘K's Keyboard shortcuts is where a person
 * reads it). A row of buttons duplicating `Tab`, `Ctrl+Enter` and the arrows
 * would be a second place for each of them to be described, and a second thing
 * to keep in step with what the keys actually do.
 *
 * A PLACEMENT IN THE PICK IS SAID OUT LOUD rather than skipped. The node a
 * mirror shows lives somewhere else, so archiving from a placement would put
 * away a subtree nobody is looking at — the argument the `•••` menu already
 * makes by not offering the verb on a mirror at all. What that costs here is a
 * sentence instead of a button, which is the honest half of the trade: a Trash
 * that quietly took three of four rows is the silent failure HACKING's error
 * rule is about.
 */

import { createMemo, createSignal, Show } from "solid-js"

import { useDerived } from "../derived.tsx"
import { QUIET_PILL } from "../pill.ts"
import { TESTID } from "../testids.ts"
import { under } from "../menu/subtree.ts"
import { archiveQuestion } from "../trash/question.ts"
import { archivable } from "./bulk.ts"
import { useSelection } from "./selection.ts"

export function SelectionBar() {
  const selection = useSelection()
  const derived = useDerived()
  const [asking, setAsking] = createSignal(false)

  const rows = () => selection.rows()
  /** How many rows hang UNDER the picked ones. Asked of the SET rather than of
   *  the tree, for the reason the `•••` menu's own confirm asks it there — a
   *  page hiding what is done is drawing fewer rows than the write moves
   *  (`../menu/subtree.ts`). */
  const beneath = createMemo(() => {
    const indexes = derived()
    if (indexes === undefined) return 0
    return rows().reduce(
      (count, row) => count + (row.kind === "node" ? under(indexes, row.shows.node.id) : 0),
      0,
    )
  })

  /** The pick is NOT cleared here, and that is the bug this line replaced: the
   *  run is queued, so a `clear()` beside it empties the pick before the step
   *  it was queued for reads it, and the gesture writes nothing at all. What
   *  empties it is the archive landing — a row that has gone to the Trash is a
   *  place that is no longer drawn, and a pick drops what it cannot find again
   *  (`./selection.ts`). */
  const trash = () => {
    setAsking(false)
    selection.run("archive")
  }

  return (
    <Show when={rows().length > 0 || selection.said() !== null}>
      <div
        class="pointer-events-none fixed inset-x-0 bottom-4 z-40 flex justify-center px-4"
        data-testid={TESTID.selectionBar}
        data-rows={String(rows().length)}
      >
        <div class="pointer-events-auto flex max-w-xl flex-col gap-1 rounded border border-rule bg-panel px-3 py-2 text-[0.8125rem] leading-snug shadow-sm">
          <Show when={rows().length > 0}>
            <div class="flex flex-wrap items-center gap-3">
              <span class="text-muted" data-testid={TESTID.selectionCount}>
                {rows().length === 1 ? "1 row picked" : `${rows().length} rows picked`}
              </span>
              <Show
                when={archivable(rows())}
                fallback={
                  <span class="text-muted" data-testid={TESTID.selectionNote}>
                    a placement is in the pick — retire it from its own ••• menu
                  </span>
                }
              >
                <Show
                  when={asking()}
                  fallback={
                    <button
                      type="button"
                      class={`${QUIET_PILL} cursor-pointer`}
                      data-testid={TESTID.selectionTrash}
                      onClick={() => setAsking(true)}
                    >
                      Move to Trash
                    </button>
                  }
                >
                  <span data-testid={TESTID.selectionConfirm}>
                    {archiveQuestion({ kind: "rows", count: rows().length }, beneath())}
                  </span>
                  <button
                    type="button"
                    class={`${QUIET_PILL} cursor-pointer`}
                    data-testid={TESTID.selectionTrash}
                    onClick={trash}
                  >
                    Move to Trash
                  </button>
                  <button
                    type="button"
                    class={`${QUIET_PILL} cursor-pointer`}
                    data-testid={TESTID.selectionCancel}
                    onClick={() => setAsking(false)}
                  >
                    Cancel
                  </button>
                </Show>
              </Show>
              <span class="text-muted">Escape clears</span>
            </div>
          </Show>
          <Show when={selection.said()}>
            {(said) => (
              <p
                class="m-0"
                classList={{
                  "text-alarm": said().tone === "alarm",
                  "text-muted": said().tone === "aside",
                }}
                data-testid={TESTID.selectionSaid}
                data-tone={said().tone}
                role={said().tone === "alarm" ? "alert" : "status"}
              >
                {said().text}
              </p>
            )}
          </Show>
        </div>
      </div>
    </Show>
  )
}
