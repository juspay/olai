/**
 * A node's note.
 *
 * `desc` is markdown, stored verbatim. How much of it is drawn is a property
 * of the READING, not of the note: the page's density switch (./view.ts) and
 * whether this place has been unfolded. On the node's own zoomed page the
 * note is always full — it is the body of the page — and that is
 * `{ kind: "full" }` from the caller rather than a second rule here.
 *
 * One shape prop rather than mode+open flags: full, a preview that may be
 * open, or hidden are three states, not two independent knobs. A fourth
 * thing a note can do is not added three times.
 *
 * `from` is the outline the note is written in, which is what a relative
 * picture in it is relative to.
 */

import { createMemo, Show } from "solid-js"

import { Markdown } from "./markdown/Markdown.tsx"
import { plainLine } from "./note/preview.ts"
import { TESTID } from "./testids.ts"

/** How this note is drawn. A sum, so "preview and open" is one variant rather
 *  than two fields that only make sense together. */
export type NoteShape =
  | { readonly kind: "full"; readonly class?: string }
  | {
    readonly kind: "preview"
    readonly open: boolean
    readonly onToggle: () => void
  }
  | { readonly kind: "hidden" }

/** What the component actually mounts — markdown body, or the preview line.
 *  Derived so a density click re-decides without the caller re-spelling the
 *  three-way. */
type Drawn =
  | { readonly form: "markdown"; readonly class: string | undefined }
  | { readonly form: "preview"; readonly onToggle: () => void }

export function Note(props: {
  readonly desc: string
  readonly from: string
  readonly shape: NoteShape
}) {
  const drawn = createMemo((): Drawn | undefined => {
    const shape = props.shape
    if (shape.kind === "hidden") return undefined
    if (shape.kind === "full") {
      return { form: "markdown", class: shape.class }
    }
    if (shape.open) {
      return { form: "markdown", class: "mt-1 mb-2 text-[0.9375rem] text-muted" }
    }
    return { form: "preview", onToggle: shape.onToggle }
  })

  return (
    <Show when={drawn()}>
      {(draw) => (
        <Show
          when={draw().form === "preview" ? draw() : undefined}
          fallback={
            <Markdown
              source={props.desc}
              from={props.from}
              class={(() => {
                const d = draw()
                return d.form === "markdown" ? d.class : undefined
              })()}
              testid={TESTID.desc}
            />
          }
        >
          {(preview) => (
            <button
              type="button"
              class="mt-1 block w-full max-w-full cursor-pointer truncate border-0 bg-transparent p-0 text-left text-[0.9375rem] text-muted"
              data-testid={TESTID.desc}
              data-preview="true"
              title="show the full note"
              onClick={() => {
                const d = preview()
                if (d.form === "preview") d.onToggle()
              }}
            >
              {plainLine(props.desc)}
            </button>
          )}
        </Show>
      )}
    </Show>
  )
}
