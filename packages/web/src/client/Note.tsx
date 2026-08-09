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

export function Note(props: { readonly desc: string; readonly class?: string }) {
  const html = createMemo(() => renderMarkdown(props.desc))
  return (
    <div
      class={`olai-note ${props.class ?? ""}`}
      data-testid={TESTID.desc}
      // Safe because the pipeline sanitises: see ./markdown.ts.
      innerHTML={html()}
    />
  )
}
