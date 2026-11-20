import type { TitleDrawing } from "./title.ts"
import { busyMark, waitingMark } from "./waiting.ts"

export function TitleHtml(props: {
  readonly drawing: TitleDrawing
  readonly class?: string
  readonly classList?: Record<string, boolean>
}) {
  return (
    <span
      class={`olai-md olai-md-inline ${props.class ?? ""}`}
      classList={props.classList}
      data-markdown={waitingMark(props.drawing.waiting)}
      aria-busy={busyMark(props.drawing.waiting)}
      innerHTML={props.drawing.html}
    />
  )
}
