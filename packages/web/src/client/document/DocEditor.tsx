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
 * ## Why THIS surface is not the one the reader was already looking at
 *
 * A note is (`../edit/RowEditor.tsx`): a row's open note IS this editor,
 * mounted readonly, and a click makes it writable in place — one surface, two
 * modes, no jump (human, 2026-08-18). A document is the one place that ruling
 * lands differently, and the reason is a list rather than a preference:
 *
 *   - **its CONTENTS** (`./Toc.tsx`) is derived from the heading tree the
 *     markdown pipeline reports while rendering (`markdown/outline.ts`), on
 *     the same memo the body draws from;
 *   - **its `#fragment` anchors** are real element ids minted by that
 *     pipeline (`markdown/anchors.ts`) — which is what makes a link into a
 *     heading work at all: from the contents, from another document, and from
 *     a `.html` preview (`features/documents.feature`,
 *     `features/html_previews.feature`);
 *   - **its footnotes**, **its tables**, **its `/media/`-resolved images**
 *     and **its highlighted fences** are that pipeline's output too, and the
 *     live-preview extensions draw none of the five: a table is pipe text in
 *     the editor, an image is its source, a footnote is a bracket.
 *
 * A note loses nothing to that list, and it is measured rather than assumed:
 * across the 282 notes in this repository's own outlines there is not one
 * table, image, footnote or heading. A document is where they all live.
 *
 * So the editor takes this surface when Edit is pressed, and the rendering
 * holds it the rest of the time. What would change the answer is the editor
 * growing those five — the contents could then come off the editor's own
 * heading field (`headingSlugField`), and this page would become the same
 * two-mode surface a note already is.
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
import { SaidLine } from "../edit/SaidLine.tsx"
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

  /** What the last guarded write PUT ON THE WIRE, which is not the same thing
   *  as what landed: a write that was refused leaves this holding the text the
   *  server said no to. Sending it again would earn the same refusal, and
   *  leaving the editor asks three times over (the blur, the verb, the
   *  unmount) — so a re-send of an identical payload is skipped rather than
   *  paid for three times. Cleared by a write that lands, since after that the
   *  baseline itself answers. */
  let sent: string | null = null

  const write = async (guarded: boolean): Promise<void> => {
    const sending = text()
    // A write that would change nothing sends nothing — the draft rule, at
    // file size, and the reason idling in a document you only opened is not a
    // git commit. The second test is the same rule about a write that already
    // went: OVERWRITE is deliberately exempt from both, because it is a person
    // saying "send it anyway".
    if (guarded && (sending === saved() || sending === sent)) return
    if (guarded) sent = sending
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
    sent = null
  }

  /** The idle write. Scheduled by every keystroke and cancelled by every
   *  flush, so a person who keeps typing causes one write rather than one per
   *  pause. */
  const idle = debounce(() => enqueue(() => write(true)), AUTOSAVE_IDLE)

  /**
   * Write now rather than on the pause: the caret leaving, the Done verb, and
   * the editor closing because the reader navigated away — which is why this
   * is also the cleanup.
   *
   * `guarded` is what the OVERWRITE verb turns off, and it is a parameter
   * rather than a second copy of these two lines: cancelling the pending idle
   * write and queueing one now is the same act whichever verb asked.
   */
  const flush = (guarded = true): void => {
    idle.clear()
    enqueue(() => write(guarded))
  }
  onCleanup(() => flush())

  return (
    <div class="flex flex-col gap-2">
      {/* The drift line is a SAID LINE like every other thing this client says
          about a write (`../edit/SaidLine.tsx`), and in the alarm mood: it is
          not advice about something that landed, it is the reason the next
          write will not. Drawn through the same component so its tone is a
          `data-tone` fact a scenario can read — spelled by hand here, it was
          the one line in this file whose mood nothing could check. */}
      <Show when={drifted() && said() === null}>
        <SaidLine
          said={{
            tone: "alarm",
            text: "This document has changed on disk while you were editing. " +
              "The next write will be refused rather than overwrite it; your " +
              "text is safe here.",
          }}
          class="m-0 rounded border border-alarm/60 bg-paper px-3 py-1.5 text-[0.8125rem] leading-snug"
          testid={TESTID.documentDrifted}
        />
      </Show>

      <Mde
        text={text()}
        // ALWAYS WRITING, and that is this page's own answer to the one-surface
        // ruling rather than an oversight — the header says which surface keeps
        // its rendering and why.
        writing

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
            onClick={() => flush(false)}
          >
            Overwrite what is there
          </button>
        </Show>
      </div>
    </div>
  )
}
