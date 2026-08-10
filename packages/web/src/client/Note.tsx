/**
 * A node's note, rendered.
 *
 * `desc` is markdown, stored verbatim and interpreted at view time by the same
 * pipeline a whole document goes through (./markdown/) — a note and a document
 * are the same language read out of the same directory, and the note is simply
 * the one that fits on the row.
 *
 * `from` is the outline the note is written in, which is what a relative
 * picture in it is relative to.
 */

import { Markdown } from "./markdown/Markdown.tsx"
import { TESTID } from "./testids.ts"

export function Note(props: {
  readonly desc: string
  readonly from: string
  readonly class?: string
}) {
  return (
    <Markdown
      source={props.desc}
      from={props.from}
      class={props.class}
      testid={TESTID.desc}
    />
  )
}
