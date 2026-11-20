import { TESTID as IDS_MARKDOWN_UI } from "@olai/markdown-ui/testids.ts"
import { TESTID as IDS_OUTLINES } from "olai-plugin-outlines/testids"
import { Index } from "solid-js"

import { offsetAt, widthIn } from "../edit/point.ts"
import { HIT_CLASS, type Run } from "@olai/markdown-ui/lit.ts"

import { ROW_NOTE } from "@olai/ui-primitives/touch.ts"
import { Tip } from "@olai/web/client/Tip.tsx"

export function NoteLine(props: {
  readonly runs: ReadonlyArray<Run>
  readonly hit?: boolean
  readonly onOpen?: (at: number | undefined) => void
}) {
  return (
    <Tip text="Edit note">
      <button
        type="button"
        class={`mt-0.5 mb-1 block w-full max-w-full cursor-text truncate border-0 bg-transparent p-0 text-left ${ROW_NOTE}`}
        data-testid={props.hit === true ? IDS_OUTLINES.descHit : IDS_OUTLINES.desc}
        data-preview="true"
        data-open="false"
        onClick={(event) => {
          event.stopPropagation()
          // Keyboard and screen-reader activation has no x to measure: the
          // synthesized click arrives with detail 0 and clientX 0, which
          // would measure as offset 0 and land a keyboard reader at the head
          // of a textarea instead of in the note they asked for. Their door
          // stays the old gesture — the caller's `undefined` answer.
          if (event.detail === 0) {
            props.onOpen?.(undefined)
            return
          }
          const host = event.currentTarget
          const rect = host.getBoundingClientRect()
          const at = offsetAt(
            props.runs.map((run) => run.text).join(""),
            { left: rect.left, width: rect.width },
            event.clientX,
            widthIn(host),
          )
          props.onOpen?.(at)
        }}
      >
        <Index each={props.runs}>
          {(run) => (
            run().lit
              ? <mark class={HIT_CLASS} data-testid={IDS_MARKDOWN_UI.hit}>{run().text}</mark>
              : <>{run().text}</>
          )}
        </Index>
      </button>
    </Tip>
  )
}
