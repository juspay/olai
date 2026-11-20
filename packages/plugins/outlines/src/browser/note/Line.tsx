import { TESTID as IDS_MARKDOWN_UI } from "@olai/markdown-ui/testids.ts"
import { TESTID as IDS_OUTLINES } from "olai-plugin-outlines/testids"
import { Index } from "solid-js"

import { offsetAt, widthIn } from "../edit/point.ts"
import { HIT_CLASS, type Run } from "@olai/markdown-ui/lit.ts"

import { ROW_NOTE } from "@olai/ui-primitives/touch.ts"
import { Tip } from "@olai/web/client/Tip.tsx"

// Keyboard and assistive-technology activation reaches a click handler as a
// synthesized `click` whose `detail` and `clientX` are both 0.
const fromKeyboard = (event: MouseEvent): boolean => event.detail === 0

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
          if (fromKeyboard(event)) {
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
