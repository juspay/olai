import { TESTID } from "olai-plugin-trash/testids"
import { Match,Show,Switch } from "solid-js"

import { createConfirming } from "@olai/web/client/confirming.ts"
import { ALARM_PILL,QUIET_PILL } from "@olai/web/client/pill.ts"
import { SaidLine } from "@olai/web/client/SaidLine.tsx"
import { createSaying } from "@olai/web/client/saying.ts"

import { applying } from "./writes.ts"
import { useTrashUndo as useUndo } from "./history.ts"
import { emptyQuestion } from "./question.ts"

export function EmptyTrash(props: {
  readonly going: number
}) {
  const undo = useUndo()
  const { said, say } = createSaying()

  const going = () => props.going

  const confirm = createConfirming(going)

  const empty = async () => {
    confirm.begin()
    const answer = await applying({ verb: "emptyTrash", was: going() }, undo.record)
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
                class="m-0 flex-1 text-body text-ink"
                data-testid={TESTID.trashEmptyConfirm}
              >
                {emptyQuestion(going())}
              </p>
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
      <Show when={said()}>
        {(line) => (
          <SaidLine
            said={line()}
            class="m-0 mt-2 text-body"
            testid={TESTID.trashPageSaid}
          />
        )}
      </Show>
    </>
  )
}
