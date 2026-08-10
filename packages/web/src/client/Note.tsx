/**
 * A node's note.
 *
 * `desc` is markdown, stored verbatim. How much of it is drawn is a property
 * of the READING, not of the note: the page's density switch (./view.ts) and
 * whether this place has been opened. On the node's own zoomed page the note
 * is always full — it is the body of the page — and that is `{ kind: "full" }`
 * from the caller rather than a second rule here.
 *
 * Under first-line density the first plain line is the control: one click
 * opens the full note under it, another click folds it back. Full density
 * draws the markdown with no control.
 *
 * `from` is the outline the note is written in, which is what a relative
 * picture in it is relative to.
 */

import { createMemo, Show } from "solid-js"

import { Markdown } from "./markdown/Markdown.tsx"
import { plainLine } from "./note/preview.ts"
import { TESTID } from "./testids.ts"

/** How this note is drawn. A sum: always-full, or first-line with open state. */
export type NoteShape =
  | { readonly kind: "full"; readonly class?: string }
  | {
    readonly kind: "first-line"
    readonly open: boolean
    readonly onToggle: () => void
  }

export function Note(props: {
  readonly desc: string
  readonly from: string
  readonly shape: NoteShape
}) {
  // Memoised so the line is not re-scanned on every open/close of a SIBLING
  // note — only when this note's text changes.
  const line = createMemo(() => plainLine(props.desc))
  const firstLine = createMemo(() => props.shape.kind === "first-line")
  const open = createMemo(() =>
    props.shape.kind === "first-line" ? props.shape.open : true
  )

  return (
    <div
      class={props.shape.kind === "full"
        ? (props.shape.class ?? "")
        : "mt-1 mb-2"}
      data-testid={TESTID.desc}
      data-preview={firstLine() ? "true" : undefined}
      data-open={firstLine() ? String(open()) : undefined}
    >
      {/* The first line is the toggle under first-line density — always drawn,
          so open and closed are one control rather than two surfaces. */}
      <Show when={firstLine()}>
        <button
          type="button"
          class="block w-full max-w-full cursor-pointer truncate border-0 bg-transparent p-0 text-left text-[0.9375rem] text-muted"
          aria-expanded={open()}
          title={open() ? "fold the note back" : "show the full note"}
          onClick={() => {
            const shape = props.shape
            if (shape.kind === "first-line") shape.onToggle()
          }}
        >
          {line()}
        </button>
      </Show>

      {/* Full density draws only the body. First-line density draws it under
          the control when open — same markdown pipeline either way. */}
      <Show when={open()}>
        <Markdown
          source={props.desc}
          from={props.from}
          class={firstLine() ? "mt-1 text-[0.9375rem] text-muted" : undefined}
        />
      </Show>
    </div>
  )
}
