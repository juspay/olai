/**
 * A node's note, as full markdown.
 *
 * Used in two places that mean the same thing: the subject's body on a zoomed
 * page (always), and a tree/day row that is open (click or tap). The collapsed
 * shape is not here — that is a plain-text clamped line under the title
 * (`NodeBody.tsx` + `note/preview.ts`).
 *
 * On a row, `data-open="true"` and `data-preview="false"` mark the expanded
 * body so a scenario can tell it from the clamped preview without reading
 * class names.
 */

import { Markdown } from "./markdown/Markdown.tsx"
import { TESTID } from "./testids.ts"

export function Note(props: {
  readonly desc: string
  readonly from: string
  readonly class?: string
  /** Row expansion (not the zoomed subject): mark the body as open. */
  readonly open?: boolean
}) {
  return (
    <div
      data-testid={TESTID.desc}
      data-preview={props.open === true ? "false" : undefined}
      data-open={props.open === true ? "true" : undefined}
    >
      <Markdown
        source={props.desc}
        from={props.from}
        class={props.class}
      />
    </div>
  )
}
