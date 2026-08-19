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
 * IT DOES NOT FADE, which is why it is not `../saying.ts`'s. That receptacle is
 * for a remark beside a control somebody pressed — six seconds and gone. This
 * line is the reason a RUN STOPPED, and the rows it stopped over are still
 * picked and still on screen: a sentence that took itself away while the reader
 * was looking at what it was about would be the silent failure the whole thing
 * exists to prevent. What clears it is the next gesture over the pick.
 *
 * The second is **Move to Trash**, which is the only bulk verb with no key. The
 * human's 2026-08-11 ruling still stands — there is no delete key in this app —
 * and putting a branch away behind a chord that also has to be pressed with
 * rows picked would be exactly the key that ruling is about. So it is a button,
 * behind the same second step the `•••` menu's own archive is behind, naming
 * the same blast radius (`../menu/verbs.ts`).
 *
 * That second step is `../confirming.ts`'s now rather than this file's, and
 * the move is `../saying.ts`'s precedent: the rule a confirm here keeps —
 * that an armed question does not outlive the thing it is about — was found
 * as a bug on THIS bar and then written a second time for the Trash's
 * `Empty trash`. What differs between the two is only which value counts as
 * "the thing it is about", which is the argument.
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

import { createMemo, type JSX, Match, Show, Switch } from "solid-js"

import { createConfirming } from "../confirming.ts"
import { useDerived } from "../derived.tsx"
import { LAYER } from "../layer.ts"
import { QUIET_PILL } from "../pill.ts"
import { TESTID } from "../testids.ts"
import { under } from "../menu/subtree.ts"
import type { TestId } from "../testids.ts"
import { trashQuestion } from "../trash/question.ts"
import { archivable } from "./bulk.ts"
import { useSelection } from "./selection.ts"

/** One of the bar's verbs. The quiet pill every small action in this app wears
 *  (`../pill.ts`), spelled once here because three of them sit side by side and
 *  three copies of the same four attributes is three chances for one to drift. */
function Pill(props: {
  readonly testid: TestId
  readonly onPress: () => void
  readonly children: JSX.Element
}) {
  return (
    <button
      type="button"
      class={`${QUIET_PILL} cursor-pointer`}
      data-testid={props.testid}
      onClick={() => props.onPress()}
    >
      {props.children}
    </button>
  )
}

export function SelectionBar() {
  const selection = useSelection()
  const derived = useDerived()

  const rows = () => selection.rows()

  /**
   * The question is about THESE rows, so it does not outlive them
   * (`../confirming.ts`, which is where that rule and the review that found it
   * are written down, and which the Trash's own `Empty trash` keeps too).
   *
   * The SUBJECT is the pick's IDENTITY rather than its size, because swapping
   * one row for another is a different question about a different subtree —
   * which is exactly why the watched value is the caller's to choose.
   */
  const confirm = createConfirming(() => rows().map((row) => row.key).join(" "))

  /** How many rows hang UNDER the picked ones. Asked of the SET rather than of
   *  the tree, for the reason the `•••` menu's own confirm asks it there — a
   *  page hiding what is done is drawing fewer rows than the write moves
   *  (`../menu/subtree.ts`). */
  const hanging = createMemo(() => {
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
    confirm.drop()
    selection.run("trash")
  }

  return (
    <Show when={rows().length > 0 || selection.said() !== null}>
      <div
        // `LAYER.chrome` — it COVERS the page, which is the same claim the
        // line ⌘Z draws makes, and for the same reason: a reader who has
        // picked rows is looking at what the bar says about them
        // (`../layer.ts`).
        class={`pointer-events-none fixed inset-x-0 bottom-4 ${LAYER.chrome} flex justify-center px-4`}
        data-testid={TESTID.selectionBar}
        data-rows={String(rows().length)}
      >
        <div class="pointer-events-auto flex max-w-xl flex-col gap-1 rounded border border-rule bg-panel px-3 py-2 text-[0.8125rem] leading-snug shadow-sm">
          <Show when={rows().length > 0}>
            <div class="flex flex-wrap items-center gap-3">
              <span class="text-muted" data-testid={TESTID.selectionCount}>
                {rows().length === 1 ? "1 row picked" : `${rows().length} rows picked`}
              </span>
              {/* Three states of one verb, side by side rather than nested:
                  not offered, offered, asking. */}
              <Switch>
                <Match when={!archivable(rows())}>
                  <span class="text-muted" data-testid={TESTID.selectionNote}>
                    a placement is in the pick — retire it from its own ••• menu
                  </span>
                </Match>
                <Match when={confirm.where() === "asking"}>
                  <span data-testid={TESTID.selectionConfirm}>
                    {trashQuestion({ kind: "rows", count: rows().length }, hanging())}
                  </span>
                  <Pill testid={TESTID.selectionTrash} onPress={trash}>
                    Move to Trash
                  </Pill>
                  <Pill testid={TESTID.selectionCancel} onPress={() => confirm.drop()}>
                    Cancel
                  </Pill>
                </Match>
                <Match when={true}>
                  <Pill testid={TESTID.selectionTrash} onPress={() => confirm.ask()}>
                    Move to Trash
                  </Pill>
                </Match>
              </Switch>
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
                // The row's own idiom (`../menu/MenuSaid.tsx`): a refusal
                // interrupts what a screen reader is saying, a remark waits
                // its turn.
                role={said().tone === "alarm" ? "alert" : "status"}
                aria-live={said().tone === "alarm" ? "assertive" : "polite"}
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
