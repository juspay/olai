import { isAttachmentPicture as isPicture } from "@olai/surface"
import { createMemo, For, onCleanup, Show } from "solid-js"

import { TESTID } from "../../testids.ts"
import { useConversationUI } from "./ui.tsx"
import { sizeText } from "./previews.ts"

export function Attachments(props: {
  readonly names: ReadonlyArray<string>
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
  const ui = useConversationUI()
  const previewOf = (name: string) => ui.previews.previewOf(name, ui.uploadScope.value())
  const source = createMemo<string | undefined>(() => {
    const blob = previewOf(props.name)
    if (blob === undefined || !isPicture(props.name)) return undefined
    const url = URL.createObjectURL(blob)
    onCleanup(() => URL.revokeObjectURL(url))
    return url
  })

  const size = () => {
    const blob = previewOf(props.name)
    if (blob === undefined || isPicture(props.name)) return undefined
    return sizeText(blob.size)
  }

  return (
    <li
      class="flex items-center gap-1 rounded-control border border-rule bg-paper px-1.5 py-0.5 text-caption text-muted"
      data-testid={TESTID.chatAttachment}
      data-name={props.name}
    >
      <Show when={source()}>
        {(url) => (
          <img
            src={url()}
            alt={props.name}
            loading="lazy"
            decoding="async"
            class="max-h-16 max-w-24 rounded-control object-contain"
            data-testid={TESTID.chatAttachmentPreview}
          />
        )}
      </Show>
      <span>{props.name}</span>
      <Show when={size()}>
        {(bytes) => (
          <span class="text-muted/80" data-testid={TESTID.chatAttachmentSize}>
            {bytes()}
          </span>
        )}
      </Show>
      <Show when={props.onRemove}>
        {(remove) => (
          <button
            type="button"
            class="text-muted hover:text-alarm"
            aria-label={`Remove ${props.name}`}
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
