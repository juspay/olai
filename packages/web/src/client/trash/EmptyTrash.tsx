/**
 * The Trash's one destructive verb, and the question in front of it.
 *
 * **WHY IT IS A COMPONENT OF ITS OWN.** It is three states of one control —
 * offered, asking, working — plus a line for what the write said, and it hangs
 * off the PAGE rather than off a row. Folding that into `./TrashPage.tsx` would
 * have put a small state machine in the middle of a file whose whole subject is
 * drawing a pile, and this app's rule is folder hierarchy over monoliths
 * (HACKING.md). The three states, and the rule that an armed question does not
 * outlive its subject, are NOT this file's either — they are
 * `../confirming.ts`'s, shared with `../select/SelectionBar.tsx`, which is
 * where that rule was found as a bug. What is left here is the layout and the
 * write, which is the division `../saying.ts` already keeps for the line
 * underneath.
 *
 * **THE COUNT IS THE POINT**, and it is not this file's arithmetic:
 * `./counting.ts` answers it over the SET, and carries the argument for why the
 * rows on screen are not an answer. What this component owns is only WHEN to
 * ask — which is every frame, through the live indexes, so a pile that arrives
 * while somebody is reading the question puts the question away rather than
 * silently re-wording it.
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

import { createMemo, Match, Show, Switch } from "solid-js"

import { createConfirming } from "../confirming.ts"
import { useDerived } from "../derived.tsx"
import { SaidLine } from "../edit/SaidLine.tsx"
import { useUndo } from "../edit/undoing.ts"
import { ALARM_PILL, QUIET_PILL } from "../pill.ts"
import { createSaying } from "../saying.ts"
import { TESTID } from "../testids.ts"
import { applying } from "../writes.ts"
import { inTrash } from "./counting.ts"
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

  /** How many records go — {@link ./counting.ts}, which is where the argument
   *  for asking the SET rather than the page lives, and where it is tested.
   *  Zero is what takes the control off the page entirely. */
  const going = createMemo(() => {
    const indexes = derived()
    return indexes === undefined ? 0 : inTrash(indexes, props.files)
  })

  /** The question, and the rule that it does not outlive what it is about
   *  (`../confirming.ts`, which is where that trap is written down). The
   *  SUBJECT here is the count: a confirm armed against five rows and left
   *  standing while another tab — or the agent — archives a sixth is a person
   *  agreeing to a sentence that has stopped being true. */
  const confirm = createConfirming(going)

  const empty = async () => {
    confirm.begin()
    // The answer, handed straight through: a refusal is the ops layer's own
    // sentence and a landed write may have a nudge, and `say` reads
    // `undefined` as "nothing to report" rather than as a sentence.
    const answer = await applying({ verb: "emptyTrash" }, undo.record)
    confirm.done()
    say(answer)
  }

  return (
    <>
      <Show when={going() > 0}>
        <div class="mt-3 flex flex-wrap items-center gap-2">
          <Switch>
            <Match when={confirm.where() === "asking"}>
              <p
                class="m-0 flex-1 text-sm text-ink"
                data-testid={TESTID.trashEmptyConfirm}
              >
                {emptyQuestion(going())}
              </p>
              {/* The ALARM half — the one that does the thing — and the quiet
                  one beside it is the way out, which is the pairing every
                  confirm in this app wears (`../pill.ts`). */}
              <button
                type="button"
                class={`${ALARM_PILL} cursor-pointer`}
                data-testid={TESTID.trashEmptyVerb}
                onClick={() => void empty()}
              >
                Empty trash
              </button>
              <button
                type="button"
                class={`${QUIET_PILL} cursor-pointer`}
                data-testid={TESTID.trashEmptyCancel}
                onClick={() => confirm.drop()}
              >
                Cancel
              </button>
            </Match>
            {/* Offered, and — while the write is in flight — the same pill,
                inert. Drawn rather than taken away, because a control that
                vanished under the hand that pressed it reads as a page that
                lost the gesture. */}
            <Match when={true}>
              <button
                type="button"
                class={`${QUIET_PILL} cursor-pointer`}
                data-testid={TESTID.trashEmptyVerb}
                disabled={confirm.where() === "working"}
                onClick={() => confirm.ask()}
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
