import { servedDirectory } from "../vault.ts"
import { createSignal,Show } from "solid-js"

import { meantAt } from "olai-plugin-files/completing"
import { composing } from "@olai/web/client/composition.ts"
import { Refused } from "@olai/web/client/Refused.tsx"
import type { Making } from "olai-plugin-files/making"

const newDraft = () => ({
  open: createSignal(false),
  path: createSignal(""),
  said: createSignal<string | null>(null),
  sending: createSignal(false),
  revision: 0,
})

const drafts = new Map<Making["of"], ReturnType<typeof newDraft>>()
const draftOf = (of: Making["of"]) => {
  const draft = drafts.get(of) ?? newDraft()
  drafts.set(of, draft)
  return draft
}

export const openNewFile = (of: Making["of"]): void => {
  draftOf(of).open[1](true)
}

export function NewFile(props: {
  readonly making: Making
  readonly create: (file: string) => Promise<string | null>
}) {
  const draft = draftOf(props.making.of)
  const [open, setOpen] = draft.open
  const [path, setPath] = draft.path
  const [said, setSaid] = draft.said
  const [sending, setSending] = draft.sending

  const close = (): void => {
    draft.revision++
    setOpen(false)
    setPath("")
    setSaid(null)
  }

  const send = async (): Promise<void> => {
    if (sending()) return
    const claims = servedDirectory()?.claims()
    if (claims === undefined) return
    const meant = meantAt(claims, props.making.of, path())
    if (meant === null) return
    if ("refused" in meant) {
      setSaid(meant.refused)
      return
    }
    setSending(true)
    const submitted = draft.revision
    try {
      const refused = await props.create(meant.file)
      if (draft.revision !== submitted) return
      if (refused === null) close()
      else setSaid(refused)
    } finally {
      setSending(false)
    }
  }

  return (
    <Show when={open()}>
      <div class="mb-1 px-1">
        <input
          type="text"
          class="w-full rounded-control border border-rule bg-panel px-2 py-1 text-body text-ink outline-none focus:border-accent"
          data-testid={props.making.testids.path}
          aria-label={props.making.aria}
          aria-busy={sending()}
          placeholder={props.making.placeholder}
          // iOS shifts the first letter of an empty box, so `garden.olai`
          // would arrive as `Garden.olai` on disk.
          enterkeyhint="done"
          autocorrect="off"
          autocapitalize="none"
          spellcheck={false}
          value={path()}
          ref={(box) => queueMicrotask(() => box.focus())}
          onClick={(event) => event.stopPropagation()}
          onInput={(event) => {
            draft.revision++
            setPath(event.currentTarget.value)
            setSaid(null)
          }}
          onKeyDown={(event) => {
            if (event.key === "Enter") {
              event.preventDefault()
              // Confirming an IME candidate (Japanese, Chinese, Korean) is a
              // `keydown` whose `key` reads `Enter`.
              if (composing(event)) return
              void send()
            }
            if (event.key === "Escape") {
              event.preventDefault()
              close()
            }
          }}
        />
        <div class="mt-1">
          <Show when={sending()}><span role="status" class="text-label text-muted">Creating…</span></Show>
          <Refused said={said()} testid={props.making.testids.said} compact />
        </div>
      </div>
    </Show>
  )
}

export function clearNewFileMemory():void { drafts.clear() }
