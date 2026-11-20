import type { TitleDrawing } from "./title.ts"
import { waitingFace } from "./waiting.ts"

export function TitleHtml(props: {
  readonly drawing: TitleDrawing
  readonly class?: string
  readonly classList?: Record<string, boolean>
}) {
  const face = () => waitingFace(props.drawing.waiting)
  return (
    <span
      class={`olai-md olai-md-inline ${props.class ?? ""}`}
      classList={props.classList}
      data-markdown={face().mark}
      aria-busy={face().busy}
      innerHTML={props.drawing.html}
    />
  )
}
