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
 *
 * `olai-md-compact` is the one thing this component says about how the
 * markdown is SET rather than about what it is: a note is drawn inside the
 * app's furniture — under a node's title, in a column beside a tree — rather
 * than as a page somebody opened to read, so it takes the tighter of the two
 * spacing scales and a ceiling on its heading sizes (`markdown/scale.ts`).
 *
 * The class is named for that POSITION and not for the note, because a note is
 * not the only body in it: an attached document under a zoomed node
 * (`document/DocRef.tsx`) and an agent's reply in the drawer (`chat/Entry.tsx`)
 * say the same thing about themselves. A document on its OWN page is the one
 * that is a page, which is why the rule cannot live on `.olai-md`.
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
        class={`olai-md-compact ${props.class ?? ""}`}
      />
    </div>
  )
}
