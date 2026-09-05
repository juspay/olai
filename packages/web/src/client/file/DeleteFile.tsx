/**
 * DELETE THIS FILE — the second verb in this app that destroys, and
 * `trash/EmptyTrash.tsx`'s twin one unit over.
 *
 * THE SAME SHAPE ON PURPOSE, with the same three states — offered, asking,
 * working — behind the same `../confirming.ts`, because the two verbs make a
 * person the same promise (nothing puts it back) at two units, and a pair of
 * confirms that differed in their mechanics would be two answers to "how does
 * this app ask before a write that destroys". What differs is the QUESTION,
 * and it is `./delete.ts`'s: a file's name IS its path, and the sentence
 * names it rather than counting anything.
 *
 * THE SUBJECT IS THE FILE THE DOOR DREW, and the door is the caller's:
 * DocumentPage draws this beside its Edit control, OutlinePage beside the
 * Start control an emptied outline offers — an outline DRAWN with records
 * has no delete affordance at all, because the refusal it would reach for is
 * the verb's most common answer and a control that teaches one refusal does
 * not belong in the chrome. The planner is still the only gate: the words a
 * person sees when the write refuses are the ops layer's own, said line and
 * all.
 *
 * THE LINE LIVES ON THE DOOR'S OWN PAGE, which is what makes "where does
 * what went wrong go" a non-question — the person asked ON the page, so the
 * sentence appears ON it, beside the control they pressed (`../said.tsx`'s
 * own rule). One placement the twin does not have is THIS one's write's own
 * success: a landed delete unmounts the page itself, and that absence is the
 * said — there is nothing to remark on about a file that is no longer there,
 * and the line stays alive exactly as long as there is still a file to mean
 * something about.
 */
import { Match, Show, Switch } from "solid-js"

import { TESTID } from "../testids.ts"
import { ALARM_PILL, QUIET_PILL } from "../pill.ts"
import { createConfirming } from "../confirming.ts"
import { deleteQuestion } from "./delete.ts"
import { applying } from "../writes.ts"
import { SaidLine } from "../SaidLine.tsx"
import { createSaying } from "../saying.ts"
import { useUndo } from "../edit/undoing.ts"

export function DeleteFile(props: { readonly file: string }) {
  const { said, say } = createSaying()
  const undo = useUndo()
  const confirm = createConfirming(() => props.file)

  const remove = async () => {
    confirm.begin()
    // NO INVERSE: `emptyTrash`'s argument, read for the unit one over — a
    // file is not a record, and where the trash's records are pile-shaped,
    // this write is the file itself. What could put it back is git, through
    // the same commit door this write takes, so the undo stack is handed
    // nothing and the question is where the certainty lives.
    const answer = await applying({ verb: "fileDelete", file: props.file }, undo.record)
    confirm.done()
    say(answer)
  }

  return (
    <>
      <Switch>
        <Match when={confirm.where() === "asking"}>
          <p
            class="m-0 min-w-0 flex-1 basis-full [overflow-wrap:anywhere] text-sm text-ink sm:basis-auto"
            data-testid={TESTID.fileDeleteConfirm}
          >
            {deleteQuestion(props.file)}
          </p>
          {/* The ALARM half — the one that does the thing — and the quiet
              one beside it is the way out, which is the pairing every
              confirm in this app wears (`../pill.ts`). */}
          <button
            type="button"
            class={`${ALARM_PILL} cursor-pointer`}
            data-testid={TESTID.fileDeleteVerb}
            onClick={() => void remove()}
          >
            Delete file
          </button>
          <button
            type="button"
            class={`${QUIET_PILL} cursor-pointer`}
            data-testid={TESTID.fileDeleteCancel}
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
            data-testid={TESTID.fileDeleteVerb}
            disabled={confirm.where() === "working"}
            onClick={() => confirm.ask()}
          >
            Delete…
          </button>
        </Match>
      </Switch>
      {/* The line this verb says, in the states that still have a FILE to
          draw it under: a refusal is the ops layer's own sentence, and a
          landed delete unmounts the page with the file — which is why this
          is Show-guarded on nothing but the line itself rather than placed
          outside a Show over the page's body, the way the twin puts its line
          outside the pile's. The door module argues the rest. */}
      <Show when={said()}>
        {(line) => (
          <SaidLine said={line()} class="text-sm" testid={TESTID.fileDeleteSaid} />
        )}
      </Show>
    </>
  )
}
