import { TESTID } from "olai-plugin-files/testids"
import { Match,Show,Switch } from "solid-js"

import { createConfirming } from "@olai/web/client/confirming.ts"
import { deleteQuestion } from "olai-plugin-files/file/delete.ts"
import { ALARM_PILL,QUIET_PILL } from "@olai/web/client/pill.ts"
import { SaidLine } from "@olai/web/client/SaidLine.tsx"
import { createSaying } from "@olai/web/client/saying.ts"

import { applying } from "../writes.ts"

export function DeleteFile(props: { readonly file: string }) {
  const { said, say } = createSaying()
  const confirm = createConfirming(() => props.file)

  const remove = async () => {
    confirm.begin()
    const answer = await applying({ verb: "fileDelete", file: props.file }, () => {})
    confirm.done()
    say(answer)
  }

  return (
    <>
      <Switch>
        <Match when={confirm.where() === "asking"}>
          <p
            class="m-0 min-w-0 flex-1 basis-full [overflow-wrap:anywhere] text-body text-ink sm:basis-auto"
            data-testid={TESTID.fileDeleteConfirm}
          >
            {deleteQuestion(props.file)}
          </p>
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
      <Show when={said()}>
        {(line) => (
          <SaidLine said={line()} class="text-body" testid={TESTID.fileDeleteSaid} />
        )}
      </Show>
    </>
  )
}
