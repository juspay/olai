/**
 * A document, being written: the page's edit mode.
 *
 * WHAT IS EDITED IS THE SOURCE. Everywhere in this app what you type is the
 * source (docs/editing.md), and a document is the biggest instance of that
 * rather than an exception to it. What changed with md-live-preview-editor is
 * only what the caret SEES: the markers hide while it is elsewhere, a heading
 * is drawn at the size it will be, and the bytes on disk are the bytes you
 * typed, because nothing between this editor and the file parses the markdown
 * into a model of its own (`../mde/codemirror.ts` argues the whole of it).
 *
 * THE MODE IS DECLARED — Edit turns the rendered body into its source — and
 * that half of the old ruling stands: the body is rendered markdown full of
 * links a reader is entitled to follow, so a click that went to a caret would
 * delete the reading surface to save a press.
 *
 * LEAVING IT IS NO LONGER A VERB, and that half is superseded. The human ruled
 * AUTOSAVE on 2026-08-18: there is no Save, no Cancel, and no dirty flag. What
 * is in the editor is written on a pause and when the caret leaves
 * (`../edit/autosave.ts` holds the rule and the number), so Done is a way back
 * to reading rather than a way to commit — it flushes and closes, and closing
 * it another way (Escape, the route changing) writes the same text through the
 * same door. The concern the old ruling raised against a timer — that a
 * document mid-edit is often half a sentence — is answered by the debounce
 * being IDLE-keyed: it fires when somebody has stopped, not on a schedule.
 * What it buys is that a file cannot be lost by walking away from it, which is
 * the failure a Save verb has and this does not.
 *
 * THE DRAFT IS NOT A CLAIM ABOUT THE FILE — the client's one standing rule.
 * While this editor is open the file on disk goes on being served, an external
 * edit reaches the rendered page in every OTHER tab, and this tab's draft sits
 * untouched over it. What keeps that honest is `was`: every write sends what
 * this editor LAST SAVED, so a file that moved refuses the write in the ops
 * layer's own words, the draft is kept, and nothing anyone typed — here or in
 * vim — is silently lost. The refusal then has two doors out, and both are the
 * person's: re-derive (copy what you need, leave, reopen), or OVERWRITE, an
 * explicit second verb that sends no `was` and means exactly what it says. The
 * drift is also said BEFORE the refusal can happen — a line appears the moment
 * the served text stops matching what this editor last wrote — so save-time is
 * never the first anyone hears of a conflict.
 */

import { debounce } from "@solid-primitives/scheduled"
import { createMemo, createSignal, onCleanup, Show } from "solid-js"

import { AUTOSAVE_IDLE } from "../edit/autosave.ts"
import { keyHandler } from "../keying.ts"
import { serial } from "../edit/queue.ts"
import { useUndo } from "../edit/undoing.ts"
import { Mde } from "../mde/Mde.tsx"
import { Refused } from "../Refused.tsx"
import { TESTID } from "../testids.ts"
import { applying } from "../writes.ts"

export function DocEditor(props: {
  readonly file: string
  /** The text as SERVED, live — what the wire says the file holds right now,
   *  which is how this editor can see the disk move underneath it. */
  readonly served: string
  /** Leave the editor: the Done verb, and the caret's own Escape. */
  readonly onDone: () => void
}) {
  const undo = useUndo()
  /** What this editor has WRITTEN — the `was` every guarded write sends, and
   *  the baseline drift is measured against. It starts as what the editor read
   *  when it opened and advances on every write that lands, which is what
   *  makes autosave conditional rather than merely first-conditional: the
   *  second write of a session is judged against the first, not against the
   *  file as it was five minutes ago. */
  const [saved, setSaved] = createSignal(props.served)
  const [text, setText] = createSignal(props.served)
  /** The refusal, verbatim, or `null`. One mood and not two: a document write
   *  has no rollup to remark on, so there is nothing an `aside` would say here
   *  that the text on the page does not already show. */
  const [said, setSaid] = createSignal<string | null>(null)

  /** One write at a time, in the order the keystrokes came — the row editor's
   *  own rule at file size (`../edit/queue.ts`). A person types faster than a
   *  round trip, and two writes in flight over one draft are two writes
   *  derived from a state neither of them can see. */
  const enqueue = serial()

  /** The disk has moved away from what this editor last wrote: the live half
   *  of the conflict story, said while there is still time to read it calmly. */
  const drifted = createMemo(() => props.served !== saved())

  const write = async (guarded: boolean): Promise<void> => {
    const sending = text()
    // A write that would change nothing sends nothing — the draft rule, at
    // file size, and the reason idling in a document you only opened is not a
    // git commit.
    if (guarded && sending === saved()) return
    const outcome = await applying(
      {
        verb: "doc",
        file: props.file,
        text: sending,
        ...(guarded ? { was: saved() } : {}),
      },
      undo.record,
    )
    if (outcome?.tone === "alarm") {
      // Refused: the draft is kept and the reason is the ops layer's own —
      // which for this editor is nearly always the file having moved.
      setSaid(outcome.text)
      return
    }
    // Landed: this is what the file says now, so it is what the next write
    // expects to replace and what drift is measured against.
    setSaved(sending)
    setSaid(null)
  }

  /** The idle write. Scheduled by every keystroke and cancelled by every
   *  flush, so a person who keeps typing causes one write rather than one per
   *  pause. */
  const idle = debounce(() => enqueue(() => write(true)), AUTOSAVE_IDLE)

  /** Everything that is not a pause: the caret leaving, and the editor closing
   *  — including the one that closes because the reader navigated away, which
   *  is why this is also the cleanup. */
  const flush = (): void => {
    idle.clear()
    enqueue(() => write(true))
  }
  onCleanup(flush)

  return (
    <div class="flex flex-col gap-2">
      <Show when={drifted() && said() === null}>
        <p
          class="m-0 rounded border border-alarm/60 bg-paper px-3 py-1.5 text-[0.8125rem] leading-snug text-alarm"
          data-testid={TESTID.documentDrifted}
          role="status"
        >
          This document has changed on disk while you were editing. The next
          write will be refused rather than overwrite it; your text is safe
          here.
        </p>
      </Show>

      <Mde
        text={text()}
        onInput={(next) => {
          setText(next)
          // Whatever the last write said was about the text this replaces.
          setSaid(null)
          idle()
        }}
        // The registry's `doc` field: `Escape` leaves the editor, and inside a
        // vim editor it belongs to vim (`../keys.ts` says both). Nothing else
        // here is the app's — a document has no sibling to make and no note to
        // open, so `Shift+Enter` is the editor's own newline.
        onKey={keyHandler("doc", () => {
          flush()
          props.onDone()
        })}
        onBlur={(left) => {
          // An editor taken out of the document by a re-render did not lose
          // focus to a person, and a flush is right either way — but a blur
          // that IS a person's is the one moment they might walk away.
          if (left) flush()
        }}
        class="min-h-[60vh] w-full rounded border border-rule bg-panel p-3 text-sm leading-relaxed text-ink outline-none focus-within:border-accent olai-md"
        testid={TESTID.documentEditor}
        label={`the source of ${props.file}`}
      />

      <Refused said={said()} testid={TESTID.documentSaid} />

      <div class="flex items-center gap-2">
        <button
          type="button"
          class="cursor-pointer rounded border border-rule bg-panel px-3 py-1 text-[0.8125rem] font-semibold text-ink hover:bg-rule/60"
          data-testid={TESTID.documentDone}
          onClick={() => {
            flush()
            props.onDone()
          }}
        >
          Done
        </button>
        {/* The explicit second verb, and only after the refusal has been read:
            a write with no `was`, meaning exactly what it says. */}
        <Show when={said() !== null && drifted()}>
          <button
            type="button"
            class="cursor-pointer rounded border border-alarm/60 bg-transparent px-2 py-1 text-[0.8125rem] text-alarm hover:bg-alarm/10"
            data-testid={TESTID.documentOverwrite}
            onClick={() => {
              idle.clear()
              enqueue(() => write(false))
            }}
          >
            Overwrite what is there
          </button>
        </Show>
      </div>
    </div>
  )
}
