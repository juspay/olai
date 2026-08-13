/**
 * An attachment on a message, drawn three ways for one reason.
 *
 * The row carries a NAME, and that is the base case: a component that assumed
 * bytes would be there would be blank in the common case, because the bytes
 * are in a tmp directory no browser can reach. What can be added to the name
 * depends on what the tab looking at it still holds ({@link ./previews.ts}),
 * and on what KIND of file it is:
 *
 *   - a picture, with its Blob → a thumbnail. What it is is what it looks
 *     like.
 *   - anything else, with its Blob → its SIZE. A PDF has no thumbnail worth
 *     drawing here, and an `<img>` pointed at one is a broken-image icon —
 *     which is a component lying about a file that uploaded perfectly. The
 *     size is the fact a name does not carry.
 *   - no Blob (another tab, or this one after a reload) → the name alone.
 *
 * One component for the composer's pending strip and the transcript's row,
 * because they are the same thing at two moments: what differs is that the
 * pending one can be taken back off, which is `onRemove`.
 */

import { isPicture } from "@olai/format"
import { createMemo, For, onCleanup, Show } from "solid-js"

import { CARD } from "../surface.ts"
import { TESTID } from "../testids.ts"
import { previewOf, sizeText } from "./previews.ts"

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
   *  cannot free. Only for a PICTURE: a URL made for a PDF would be a URL an
   *  `<img>` cannot draw. */
  const source = createMemo<string | undefined>(() => {
    const blob = previewOf(props.name)
    if (blob === undefined || !isPicture(props.name)) return undefined
    const url = URL.createObjectURL(blob)
    onCleanup(() => URL.revokeObjectURL(url))
    return url
  })

  /** What a document says instead of showing itself. `undefined` for a picture
   *  (the thumbnail is the answer) and for a file this tab never held. */
  const size = () => {
    const blob = previewOf(props.name)
    if (blob === undefined || isPicture(props.name)) return undefined
    return sizeText(blob.size)
  }

  return (
    <li
      class={`flex items-center gap-1 rounded-lg ${CARD} px-1.5 py-0.5 font-mono text-[0.6875rem] text-muted`}
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
      <Show when={size()}>
        {(bytes) => (
          <span class="text-muted/70" data-testid={TESTID.chatAttachmentSize}>
            {bytes()}
          </span>
        )}
      </Show>
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
