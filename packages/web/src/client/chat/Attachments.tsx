/**
 * A picture on a message, drawn two ways for one reason.
 *
 * The row carries a NAME. Whether there is anything to look at depends on
 * which tab is looking: the one that pasted it still has the Blob
 * ({@link ./previews.ts}) and draws a thumbnail; every other tab, and this one
 * after a reload, draws the name. So the chip is the base case and the picture
 * is the bonus, not the other way round — a component that assumed bytes would
 * be there would be blank in the common case.
 *
 * One component for the composer's pending strip and the transcript's row,
 * because they are the same thing at two moments: what differs is that the
 * pending one can be taken back off, which is `onRemove`.
 */

import { createMemo, For, onCleanup, Show } from "solid-js"

import { TESTID } from "../testids.ts"
import { previewOf } from "./previews.ts"

export function Attachments(props: {
  readonly names: ReadonlyArray<string>
  /** Drawn as a × when given: the composer's strip can drop one before it is
   *  sent. A row in the transcript is something that happened, and nothing
   *  about it can be taken back. */
  readonly onRemove?: (name: string) => void
}) {
  return (
    <Show when={props.names.length > 0}>
      <ul class="mb-1 flex flex-wrap gap-1" data-testid={TESTID.chatAttachments}>
        <For each={props.names}>
          {(name) => <Attachment name={name} onRemove={props.onRemove} />}
        </For>
      </ul>
    </Show>
  )
}

function Attachment(props: {
  readonly name: string
  readonly onRemove?: (name: string) => void
}) {
  /** The object URL lives exactly as long as the element that shows it — Solid
   *  disposes this memo with the row, and an unrevoked URL is a Blob the tab
   *  cannot free. */
  const source = createMemo<string | undefined>(() => {
    const blob = previewOf(props.name)
    if (blob === undefined) return undefined
    const url = URL.createObjectURL(blob)
    onCleanup(() => URL.revokeObjectURL(url))
    return url
  })

  return (
    <li
      class="flex items-center gap-1 rounded border border-rule bg-paper px-1.5 py-0.5 font-mono text-[0.6875rem] text-muted"
      data-testid={TESTID.chatAttachment}
      data-name={props.name}
    >
      <Show when={source()}>
        {(url) => (
          <img
            src={url()}
            alt={props.name}
            class="max-h-16 max-w-24 rounded object-contain"
            data-testid={TESTID.chatAttachmentPreview}
          />
        )}
      </Show>
      <span>{props.name}</span>
      <Show when={props.onRemove}>
        {(remove) => (
          <button
            type="button"
            class="text-muted hover:text-alarm"
            aria-label={`remove ${props.name}`}
            data-testid={TESTID.chatAttachmentRemove}
            onClick={() => remove()(props.name)}
          >
            ×
          </button>
        )}
      </Show>
    </li>
  )
}
