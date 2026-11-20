import { TESTID } from "olai-plugin-markdown/testids"
import { createMemo, onMount, Show } from "solid-js"

import { useHistory } from "../history.ts"
import { Refused } from "@olai/web/client/Refused.tsx"

import { applying } from "../writes.ts"
import type { DocumentDraft } from "./drafts.ts"

export function DocEditor(props: {
  readonly file: string
  readonly served: string
  readonly onDone: (draft: DocumentDraft) => void
  readonly onNudge: (text: string | null) => void
  readonly draft: DocumentDraft
}) {
  const undo = useHistory()
  const draft = props.draft
  const { base, text, setText, said, setSaid, busy, setBusy } = draft
  const drifted = createMemo(() => props.served !== base)

  const commit = async (guarded: boolean): Promise<void> => {
    if (busy()) return
    if (guarded && text() === base) {
      props.onDone(draft)
      return
    }
    setBusy(true)
    try {
      const outcome = await applying(
        {
          verb: "doc",
          file: props.file,
          text: text(),
          ...(guarded ? { was: base } : {}),
        },
        undo.record,
      )
      if (outcome?.tone === "alarm") {
        setSaid(outcome.text)
        return
      }
      props.onNudge(outcome?.tone === "aside" ? outcome.text : null)
      props.onDone(draft)
    } finally {
      setBusy(false)
    }
  }

  let editor: HTMLTextAreaElement | undefined
  onMount(() => {
    // By then the user may already be typing the next filename (or another
    // field); mounting this editor must not redirect their next key into the
    // document instead.
    if (document.activeElement?.matches("input, textarea, [contenteditable=true]")) return
    editor?.focus()
  })

  return (
    <div class="flex flex-col gap-2">
      <Show when={drifted() && said() === null}>
        <p
          class="m-0 rounded-control border border-alarm/60 bg-paper px-3 py-1.5 text-body leading-snug text-alarm"
          data-testid={TESTID.documentDrifted}
          role="status"
        >
          This file changed while you were editing. Your text is safe here, and
          Save won't overwrite the change.
        </p>
      </Show>

      <textarea
        ref={editor}
        class="min-h-[60vh] w-full resize-y rounded-control border border-rule bg-panel p-3 font-mono text-body leading-relaxed text-ink outline-none focus:border-accent"
        data-testid={TESTID.documentEditor}
        aria-label={`Edit ${props.file}`}
        spellcheck={false}
        value={text()}
        onInput={(event) => {
          setText(event.currentTarget.value)
          setSaid(null)
        }}
        onKeyDown={(event) => {
          if (event.key === "Enter" && (event.metaKey || event.ctrlKey)) {
            event.preventDefault()
            void commit(true)
          }
          if (event.key === "Escape") {
            event.preventDefault()
            props.onDone(draft)
          }
        }}
      />

      <Refused said={said()} testid={TESTID.documentSaid} />

      <div class="flex items-center gap-2">
        <button
          type="button"
          class="cursor-pointer rounded-control border border-rule bg-panel px-3 py-1 text-body font-semibold text-ink hover:bg-rule/60"
          data-testid={TESTID.documentSave}
          onClick={() => void commit(true)}
        >
          Save
        </button>
        <button
          type="button"
          class="cursor-pointer rounded-control border-0 bg-transparent px-2 py-1 text-body text-muted hover:text-ink"
          data-testid={TESTID.documentCancel}
          onClick={() => props.onDone(draft)}
        >
          Cancel
        </button>
        <Show when={said() !== null && drifted()}>
          <button
            type="button"
            class="cursor-pointer rounded-control border border-alarm/60 bg-transparent px-2 py-1 text-body text-alarm hover:bg-alarm/10"
            data-testid={TESTID.documentOverwrite}
            onClick={() => void commit(false)}
          >
            Overwrite anyway
          </button>
        </Show>
      </div>
    </div>
  )
}
