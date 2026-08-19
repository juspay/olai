/**
 * The Trash's one destructive verb, and the question in front of it.
 *
 * **WHY IT IS A COMPONENT OF ITS OWN.** It is three states of one control —
 * offered, asking, working — plus a line for what the write said, and it hangs
 * off the PAGE rather than off a row. Folding that into `./TrashPage.tsx` would
 * have put a small state machine in the middle of a file whose whole subject is
 * drawing a pile, and this app's rule is folder hierarchy over monoliths
 * (HACKING.md). It is also the shape `../select/SelectionBar.tsx` already has
 * for the same question at a different scale — a verb that swaps itself for a
 * sentence and two pills — so the two read alike on purpose.
 *
 * **THE COUNT IS THE POINT.** What the question names is every record in every
 * archive the directory holds, asked of the SET
 * ({@link ../derived.tsx}'s indexes), never of the rows this page happens to be
 * drawing. Those two differ for two independent reasons here, and both would
 * understate the write: a filter narrows what is drawn (`../filter/`), and a
 * mirror in an archive draws children that are not records of it. The lesson is
 * `parity-archive`'s, whose confirm learned it first (`../menu/subtree.ts`).
 *
 * **THE VERB IS NOT DRAWN OVER AN EMPTY TRASH**, and it is not taken away by a
 * filter either — those are the same rule read twice. Whether there is anything
 * to delete is a fact about the archives; whether a query matched any of it is
 * a fact about the query, and the page already keeps that division for its
 * "The Trash is empty." sentence (`./TrashPage.tsx`).
 *
 * **WHAT IT SENDS IS ONE EDIT.** `emptyTrash` carries nothing at all: which
 * archives there are and which hold anything is read where the write is judged
 * (`@olai/server`'s `edit.ts`), so this control cannot empty a stale list. The
 * refusal — an archive something still points into, an archive that would not
 * parse — comes back in the ops layer's own words and lands in the line below,
 * verbatim, like every other refusal a person meets in this app.
 */

import { createEffect, createMemo, createSignal, Match, Show, Switch } from "solid-js"
import { nodesOf } from "@olai/format"

import { useDerived } from "../derived.tsx"
import { SaidLine } from "../edit/SaidLine.tsx"
import { useUndo } from "../edit/undoing.ts"
import { ALARM_PILL, QUIET_PILL } from "../pill.ts"
import { createSaying } from "../saying.ts"
import { TESTID } from "../testids.ts"
import { applying } from "../writes.ts"
import { emptyQuestion } from "./question.ts"

export function EmptyTrash(props: {
  /** Every archive the directory holds, in path order — the page's own list
   *  (`../page.ts`), including the ones holding nothing, because what this
   *  counts is the SET and not what survived a filter. */
  readonly files: ReadonlyArray<string>
}) {
  const derived = useDerived()
  const undo = useUndo()
  const { said, say } = createSaying()
  const [asking, setAsking] = createSignal(false)
  const [working, setWorking] = createSignal(false)

  /** How many records go — every record in every archive. Zero is what takes
   *  the control off the page entirely. */
  const going = createMemo(() => {
    const indexes = derived()
    if (indexes === undefined) return 0
    return props.files.reduce((count, file) => count + nodesOf(indexes, file).length, 0)
  })

  /**
   * The question is about the trash AS IT IS, so it does not outlive it.
   *
   * `../select/SelectionBar.tsx` learned this the hard way and the trap is the
   * same one: a confirm armed against one count, left standing while another
   * tab (or the agent) archives something, is a person agreeing to a sentence
   * that has stopped being true. So the count is watched, and any change to it
   * puts the question away rather than silently re-wording it.
   */
  createEffect(() => {
    going()
    setAsking(false)
  })

  const empty = async () => {
    setAsking(false)
    setWorking(true)
    // The answer, handed straight through: a refusal is the ops layer's own
    // sentence and a landed write may have a nudge, and `say` reads
    // `undefined` as "nothing to report" rather than as a sentence.
    const answer = await applying({ verb: "emptyTrash" }, undo.record)
    setWorking(false)
    say(answer)
  }

  return (
    <>
      <Show when={going() > 0}>
        <div class="mt-3 flex flex-wrap items-center gap-2">
          <Switch>
            <Match when={asking()}>
              <p
                class="m-0 flex-1 text-sm text-ink"
                data-testid={TESTID.trashEmptyConfirm}
              >
                {emptyQuestion(going())}
              </p>
              <button
                type="button"
                class={`${ALARM_PILL} cursor-pointer`}
                data-testid={TESTID.trashEmptyVerb}
                data-rows={String(going())}
                disabled={working()}
                onClick={() => void empty()}
              >
                Empty trash
              </button>
              <button
                type="button"
                class={`${QUIET_PILL} cursor-pointer`}
                data-testid={TESTID.trashEmptyCancel}
                onClick={() => setAsking(false)}
              >
                Cancel
              </button>
            </Match>
            <Match when={true}>
              <button
                type="button"
                class={`${QUIET_PILL} cursor-pointer`}
                data-testid={TESTID.trashEmptyVerb}
                data-rows={String(going())}
                disabled={working()}
                onClick={() => setAsking(true)}
              >
                Empty trash
              </button>
            </Match>
          </Switch>
        </div>
      </Show>
      {/* OUTSIDE the `Show` above, and that is the bug this placement fixes
          rather than a stray brace: the write that SUCCEEDS takes the count to
          zero, so a line nested under the control would be unmounted by the
          very write it is reporting on. A refusal leaves the count where it was
          and would have survived — which is exactly the asymmetry that hides a
          missing message until the day something has one to say. */}
      <Show when={said()}>
        {(line) => (
          <SaidLine
            said={line()}
            class="m-0 mt-2 text-sm"
            testid={TESTID.trashPageSaid}
          />
        )}
      </Show>
    </>
  )
}
