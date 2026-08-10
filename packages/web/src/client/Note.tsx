/**
 * A node's note, rendered.
 *
 * The one thing this client interprets on its own: `desc` is markdown, stored
 * verbatim and rendered at view time (./markdown.ts sanitises). One component
 * so the `innerHTML` — and the reason it is safe — is written down once,
 * wherever a note appears.
 */

import { createMemo } from "solid-js"

import { renderMarkdown } from "./markdown.ts"
import { TESTID } from "./testids.ts"

export function Note(
  props: {
    readonly desc: string
    readonly class?: string
    /** Which `data-testid` this note answers to. A node's note is what the
     *  outline tests look for; an agent's finished turn is a different thing
     *  on the page, and giving it the same name would make one selector match
     *  both. The markdown, and the reason `innerHTML` is safe, stay here. */
    readonly testid?: string
  },
) {
  const html = createMemo(() => renderMarkdown(props.desc))
  return (
    <div
      class={`olai-note ${props.class ?? ""}`}
      data-testid={props.testid ?? TESTID.desc}
      // Safe because the pipeline sanitises: see ./markdown.ts.
      innerHTML={html()}
    />
  )
}
