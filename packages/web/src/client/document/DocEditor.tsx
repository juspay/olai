/**
 * A document, being written: the page's edit mode.
 *
 * WHAT IS EDITED IS THE SOURCE. Everywhere in this app what you type is the
 * source and the rendering comes back the moment you leave (docs/editing.md),
 * and a document is the biggest instance of that trade rather than an
 * exception to it: a textarea holding the file verbatim is honest about what a
 * `.md` is, and a structured editor over it is a different product (the
 * kitchen-sink WYSIWYG this item's scope rules out).
 *
 * THE MODE IS DECLARED, WHICH IS WHY LEAVING IT IS TOO. A note's editor is
 * entered by a click and left by clicking away, and commits on blur, because
 * one line is a small claim. A document's is entered by a verb — Edit — so it
 * is left by one: Save commits (⌘Enter is its chord, on the editor's own
 * element, the row editors' rule), Cancel abandons (Escape, likewise), and a
 * stray click elsewhere does neither, because a whole file written on a blur
 * nobody meant is a write nobody asked for. There is no idle commit for the
 * same reason at the other end: a document mid-edit is often half a sentence,
 * and a timer that committed it would publish the half to every open tab.
 *
 * THE DRAFT IS NOT A CLAIM ABOUT THE FILE — the client's one standing rule.
 * While this editor is open the file on disk goes on being served, an
 * external edit reaches the rendered page in every OTHER tab, and this tab's
 * draft sits untouched over it. What keeps that honest is `was`: the commit
 * sends what this editor READ, so a file that moved refuses the write in the
 * ops layer's own words, the draft is kept, and nothing anyone typed —
 * here or in vim — is silently lost. The refusal then has two doors out, and
 * both are the person's: re-derive (copy what you need, Cancel, reopen), or
 * OVERWRITE, an explicit second verb that sends no `was` and means exactly
 * what it says. The drift is also said BEFORE the refusal can happen — a line
 * appears the moment the served text stops matching what this editor read —
 * so save-time is never the first anyone hears of a conflict.
 */

import { createMemo, onMount, Show } from "solid-js"

import { useUndo } from "../edit/undoing.ts"
import { Refused } from "../Refused.tsx"
import { TESTID } from "../testids.ts"
import { applying } from "../writes.ts"
import type { DocumentDraft } from "./drafts.ts"

export function DocEditor(props: {
  readonly file: string
  /** The text as SERVED, live — what the wire says the file holds right now,
   *  which is how this editor can see the disk move underneath it. */
  readonly served: string
  /** Leave the editor, whichever door: a commit that landed, or a Cancel. */
  readonly onDone: (draft: DocumentDraft) => void
  readonly draft: DocumentDraft
}) {
  const undo = useUndo()
  /** What this editor READ when it opened — the `was` every guarded commit
   *  sends, and the baseline drift is measured against. */
  const draft = props.draft
  const { base, text, setText, said, setSaid, busy, setBusy } = draft
  /** The refusal, verbatim, or `null`. One mood and not two: a document write
   *  has no rollup to remark on, so there is nothing an `aside` would say here
   *  that leaving the editor does not already show. */
  /** One write in flight at a time: Save pressed twice is one write, not a
   *  race between two. */

  /** The disk has moved since this editor read it: the live half of the
   *  conflict story, said while there is still time to read it calmly. */
  const drifted = createMemo(() => props.served !== base)

  const commit = async (guarded: boolean): Promise<void> => {
    if (busy()) return
    // Nothing changed: leaving is the whole of what Save means, and a write
    // that would change nothing sends nothing — the draft rule, at file size.
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
        // Refused: the draft is kept and the reason is the ops layer's own —
        // which for this editor is nearly always the file having moved.
        setSaid(outcome.text)
        return
      }
      // Landed. A document write has no rollup to remark, so there is nothing
      // an `aside` would say that leaving does not show.
      props.onDone(draft)
    } finally {
      setBusy(false)
    }
  }

  let editor: HTMLTextAreaElement | undefined
  onMount(() => editor?.focus())

  return (
    <div class="flex flex-col gap-2">
      <Show when={drifted() && said() === null}>
        <p
          class="m-0 rounded border border-alarm/60 bg-paper px-3 py-1.5 text-[0.8125rem] leading-snug text-alarm"
          data-testid={TESTID.documentDrifted}
          role="status"
        >
          This document has changed on disk while you were editing. Saving will
          be refused rather than overwrite it; your text is safe here.
        </p>
      </Show>

      <textarea
        ref={editor}
        class="min-h-[60vh] w-full resize-y rounded border border-rule bg-panel p-3 font-mono text-sm leading-relaxed text-ink outline-none focus:border-accent"
        data-testid={TESTID.documentEditor}
        aria-label={`the source of ${props.file}`}
        spellcheck={false}
        value={text()}
        onInput={(event) => {
          setText(event.currentTarget.value)
          // Whatever the last write said was about the text this replaces.
          setSaid(null)
        }}
        onKeyDown={(event) => {
          // The row editors' rule: bare keys and their chords are matched on
          // the editor's own element, never on the window.
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
          class="cursor-pointer rounded border border-rule bg-panel px-3 py-1 text-[0.8125rem] font-semibold text-ink hover:bg-rule/60"
          data-testid={TESTID.documentSave}
          onClick={() => void commit(true)}
        >
          Save
        </button>
        <button
          type="button"
          class="cursor-pointer rounded border-0 bg-transparent px-2 py-1 text-[0.8125rem] text-muted hover:text-ink"
          data-testid={TESTID.documentCancel}
          onClick={() => props.onDone(draft)}
        >
          Cancel
        </button>
        {/* The explicit second verb, and only after the refusal has been read:
            a write with no `was`, meaning exactly what it says. */}
        <Show when={said() !== null && drifted()}>
          <button
            type="button"
            class="cursor-pointer rounded border border-alarm/60 bg-transparent px-2 py-1 text-[0.8125rem] text-alarm hover:bg-alarm/10"
            data-testid={TESTID.documentOverwrite}
            onClick={() => void commit(false)}
          >
            Overwrite what is there
          </button>
        </Show>
      </div>
    </div>
  )
}
