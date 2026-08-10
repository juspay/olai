/**
 * A node's note.
 *
 * `desc` is markdown, stored verbatim. How much of it is drawn is a property
 * of the READING, not of the note: the page's density switch (./view.ts) and
 * whether this place has been opened. On the node's own zoomed page the note
 * is always full — it is the body of the page — and that is `{ kind: "full" }`
 * from the caller rather than a second rule here.
 *
 * Under first-line density the two shapes REPLACE each other: closed is one
 * plain truncated line (the control); open is the full note alone (click it
 * to fold). Drawing the preview above the body stacked the first line twice.
 * Full density draws the markdown with no control; hidden draws nothing.
 *
 * `from` is the outline the note is written in, which is what a relative
 * picture in it is relative to.
 */

import { createMemo, Match, Switch } from "solid-js"

import { Markdown } from "./markdown/Markdown.tsx"
import { plainLine } from "./note/preview.ts"
import { TESTID } from "./testids.ts"

/** How this note is drawn. A sum so open and closed first-line are two
 *  variants rather than a preview that stays when the body opens. */
export type NoteShape =
  | { readonly kind: "full"; readonly class?: string }
  | {
    readonly kind: "first-line"
    readonly open: boolean
    readonly onToggle: () => void
  }
  | { readonly kind: "hidden" }

export function Note(props: {
  readonly desc: string
  readonly from: string
  readonly shape: NoteShape
}) {
  // Memoised so the line is not re-scanned on every open/close of a SIBLING
  // note — only when this note's text changes.
  const line = createMemo(() => plainLine(props.desc))

  return (
    <Switch>
      <Match when={props.shape.kind === "hidden" ? true : undefined}>
        {null}
      </Match>

      <Match when={props.shape.kind === "full" ? props.shape : undefined}>
        {(shape) => (
          <Markdown
            source={props.desc}
            from={props.from}
            class={shape().class}
            testid={TESTID.desc}
          />
        )}
      </Match>

      {/* Closed first-line: the preview IS the control. */}
      <Match
        when={props.shape.kind === "first-line" && !props.shape.open
          ? props.shape
          : undefined}
      >
        {(shape) => (
          <button
            type="button"
            class="mt-1 mb-2 block w-full max-w-full cursor-pointer truncate border-0 bg-transparent p-0 text-left text-[0.9375rem] text-muted"
            data-testid={TESTID.desc}
            data-preview="true"
            data-open="false"
            aria-expanded={false}
            title="show the full note"
            onClick={() => shape().onToggle()}
          >
            {line()}
          </button>
        )}
      </Match>

      {/* Open first-line: full note alone — no preview stacked above it. The
          body is the toggle surface so one click folds it back. */}
      <Match
        when={props.shape.kind === "first-line" && props.shape.open
          ? props.shape
          : undefined}
      >
        {(shape) => (
          <div
            class="mt-1 mb-2 cursor-pointer text-[0.9375rem] text-muted"
            data-testid={TESTID.desc}
            data-preview="false"
            data-open="true"
            role="button"
            tabindex={0}
            aria-expanded={true}
            title="fold the note back"
            onClick={() => shape().onToggle()}
            onKeyDown={(event) => {
              if (event.key === "Enter" || event.key === " ") {
                event.preventDefault()
                shape().onToggle()
              }
            }}
          >
            <Markdown source={props.desc} from={props.from} />
          </div>
        )}
      </Match>
    </Switch>
  )
}
