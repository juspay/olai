/**
 * A document, read and written: the page's ONE surface.
 *
 * WHAT IS EDITED IS THE SOURCE. Everywhere in this app what you type is the
 * source (docs/editing.md), and a document is the biggest instance of that
 * rather than an exception to it. What changed with md-live-preview-editor is
 * only what the caret SEES: the markers hide while it is elsewhere, a heading
 * is drawn at the size it will be, and the bytes on disk are the bytes you
 * typed, because nothing between this editor and the file parses the markdown
 * into a model of its own (`../mde/codemirror.ts` argues the whole of it).
 *
 * ## One surface, two modes — and no verb between them
 *
 * Ruled by the human, twice: this page IS the editor, mounted READING. There
 * is no Edit control and no Done control, because there is nothing to switch —
 * a click in the prose puts the caret at the character clicked, `Escape` (or
 * looking somewhere else) gives it back, and the same `EditorView` draws both
 * states. Nothing is swapped for anything, so nothing moves.
 *
 * THE RENDERING IS GONE FROM THIS PAGE, and that is the cost the ruling
 * accepted rather than an oversight. `markdown/render.ts` still draws a note's
 * `desc`, a day, a chat reply, a node's page and a `doc` reference — this is
 * the one surface it lost, and what it took with it is exactly what the
 * live-preview extensions do not draw:
 *
 *   - **tables** are pipe text, **footnotes** are brackets, and a **fenced
 *     block** is its own source with no syntax colouring inside it;
 *   - **an image** is its `![](…)` — no fetch from an editor, and no
 *     `/media/` resolution;
 *   - **a link is not clickable** while reading: it is the text somebody
 *     typed, and clicking it puts the caret in it;
 *   - **there are no `#fragment` anchors**, because there are no minted
 *     elements to carry ids.
 *
 * The last one had two callers and both are answered here rather than lost:
 * the CONTENTS (./Toc.tsx) and an address that names a heading. Both now ask
 * the editor to scroll to the Nth heading (`../mde/Mde.tsx`'s `Surface`), and
 * the ordinal is the one name the markdown pipeline's headings and the
 * editor's grammar can both spell.
 *
 * Everything else on that list is a DEFERRAL, in the PR's own words: the way
 * back is the editor learning to draw them (a table widget, an image widget
 * resolving `/media/`, a click on a link that navigates), not this page
 * keeping a second rendering it swaps to.
 *
 * ## Autosave
 *
 * There is no Save, no Cancel, and no dirty flag. What is in the editor is
 * written on a pause and when the caret leaves (`../edit/autosave.ts` holds
 * the rule and the number). The concern a Save verb answers — that a document
 * mid-edit is often half a sentence — is answered by the debounce being
 * IDLE-keyed: it fires when somebody has stopped, not on a schedule. What it
 * buys is that a file cannot be lost by walking away from it.
 *
 * THE DRAFT IS NOT A CLAIM ABOUT THE FILE — the client's one standing rule.
 * While somebody is writing, the file on disk goes on being served, an
 * external edit reaches every OTHER tab, and this tab's draft sits untouched
 * over it. What keeps that honest is `was`: every write sends what this editor
 * LAST SAVED, so a file that moved refuses the write in the ops layer's own
 * words, the draft is kept, and nothing anyone typed — here or in vim — is
 * silently lost. The refusal has two doors out, and both are the person's:
 * re-derive (copy what you need, leave, reopen), or OVERWRITE, an explicit
 * second verb that sends no `was` and means exactly what it says. The drift is
 * also said BEFORE the refusal can happen, so save-time is never the first
 * anyone hears of a conflict.
 *
 * AND A READER FOLLOWS THE DISK. The surface is on screen from the moment the
 * body arrives, which it never was when this was a mode somebody entered — so
 * a document nobody is typing in re-reads itself when the file moves, exactly
 * as the rendering it replaces did, and its baseline moves with it. Without
 * that, an agent writing a file somebody merely has OPEN would raise a
 * conflict against a text nobody edited: the false self-conflict, and the
 * reason this is a rule rather than a nicety. It happens only while there is
 * nothing to lose — not writing, nothing unsaved, no refusal standing — which
 * is what makes it a re-read rather than a draft being taken away.
 */

import { debounce } from "@solid-primitives/scheduled"
import { createEffect, createMemo, createSignal, on, onCleanup, Show } from "solid-js"

import { AUTOSAVE_IDLE } from "../edit/autosave.ts"
import { serial } from "../edit/queue.ts"
import { SaidLine } from "../edit/SaidLine.tsx"
import { useUndo } from "../edit/undoing.ts"
import { keyHandler } from "../keying.ts"
import { markdownReady } from "../markdown/chunk.ts"
import { Markdown } from "../markdown/Markdown.tsx"
import { landingId, outlineOf } from "../markdown/render.ts"
import { Mde, type Surface } from "../mde/Mde.tsx"
import { Refused } from "../Refused.tsx"
import { useHere, useRouter } from "../router.tsx"
import { TESTID } from "../testids.ts"
import { applying } from "../writes.ts"
import { useDocument } from "./documents.tsx"
import type { Reading } from "./faces.tsx"
import { consumeMinted } from "./minted.ts"
import { Toc } from "./Toc.tsx"

/**
 * The document face: what a `.md` page draws, from the body it asks for.
 *
 * It asks for its own body, like every other face (./faces.tsx): the page
 * above it holds nothing. NOTHING UNTIL THE BODY IS HERE, and no placeholder —
 * a "reading…" line under a heading that is already drawn would be a spinner
 * for one frame, and an empty editor would be a document that says nothing
 * where one says something.
 */
export function DocEditor(props: Reading) {
  const served = useDocument(() => props.file)
  return (
    <Show when={served()}>
      {/* The inner component is created ONCE, when the body arrives, and
          everything it decides then — the baseline every write is judged
          against, whether this document was just minted — is a decision about
          THIS file: the page above is keyed on the path (./DocumentPage.tsx). */}
      {(body) => <Written file={props.file} served={body().text} />}
    </Show>
  )
}

function Written(props: {
  readonly file: string
  /** The text as SERVED, live — what the wire says the file holds right now,
   *  which is how this surface can see the disk move underneath it. */
  readonly served: string
}) {
  const router = useRouter()
  const here = useHere()
  const undo = useUndo()
  /** What this editor has WRITTEN — the `was` every guarded write sends, and
   *  the baseline drift is measured against. It starts as what the surface
   *  read when it opened and advances on every write that lands, which is what
   *  makes autosave conditional rather than merely first-conditional: the
   *  second write of a session is judged against the first, not against the
   *  file as it was five minutes ago. */
  const [saved, setSaved] = createSignal(props.served)
  const [text, setText] = createSignal(props.served)
  /** The refusal, verbatim, or `null`. One mood and not two: a document write
   *  has no rollup to remark on, so there is nothing an `aside` would say here
   *  that the text on the page does not already show. */
  const [said, setSaid] = createSignal<string | null>(null)
  /** Whether the caret is in it. A document that was MINTED a moment ago (the
   *  sidebar's path box, a bare calendar day) opens writing — that is
   *  ./minted.ts's one-shot — since an empty page you have to click into is
   *  not what "start writing" means. */
  const [writing, setWriting] = createSignal(consumeMinted(props.file))
  /** The mounted preview, while there is one: what a jump to a heading is
   *  asked of, since the surface has no anchors to jump to. */
  const [surface, setSurface] = createSignal<Surface | undefined>(undefined)

  /** One write at a time, in the order the keystrokes came — the row editor's
   *  own rule at file size (`../edit/queue.ts`). A person types faster than a
   *  round trip, and two writes in flight over one draft are two writes
   *  derived from a state neither of them can see. */
  const enqueue = serial()

  /** The disk has moved away from what this editor last wrote: the live half
   *  of the conflict story, said while there is still time to read it calmly. */
  const drifted = createMemo(() => props.served !== saved())

  /** Nothing would be lost by re-reading the file: the caret is elsewhere, the
   *  text is what was last written, and no refusal is standing. */
  const idleReader = (): boolean =>
    !writing() && said() === null && text() === saved()

  // A READER FOLLOWS THE DISK — see the header. The rendering this replaced
  // did it for free by being a function of the served text; a stateful editor
  // has to be told.
  createEffect(on(() => props.served, (next) => {
    if (!idleReader() || next === text()) return
    setText(next)
    setSaved(next)
  }, { defer: true }))

  /** The headings of the file, as the contents draws them.
   *
   *  From the SERVED text rather than from the draft: rendering the whole
   *  document to hast is what asking costs, and asking per keystroke would
   *  charge a reader's typing for a list they are not looking at. What is on
   *  disk is at most one pause behind what is on screen (`../edit/autosave.ts`),
   *  and empty until the markdown chunk lands, for the same reason the reading
   *  face is: there is nothing to make a contents out of until something has
   *  read the headings. */
  const headings = createMemo(() =>
    markdownReady() ? outlineOf(props.served, props.file) : [],
  )

  /**
   * Land on the heading an address named — the contents' own jump, and an
   * incoming `#fragment` from another page.
   *
   * BY ORDINAL through the editor when there is one, because the surface mints
   * no ids (`../mde/codemirror.ts`'s `reveal`); by the browser's own scroll
   * into the rendering when there is not. Returns whether it went anywhere, so
   * a contents line can let the browser have the click it would otherwise
   * spend.
   */
  const land = (id: string): boolean => {
    const index = headings().findIndex((heading) => heading.id === id)
    if (index < 0) return false
    return surface()?.reveal(index) ?? false
  }

  // THE ADDRESS, once there is something to land in.
  //
  // The id in the address is the heading's own (`#beds`) and the id in the page
  // is that inside this block's namespace (`../markdown/render.ts` mints it,
  // and `landingId` is the one translation between them) — so a browser cannot
  // do this for us even where the anchors exist: it would look for `beds`, find
  // nothing, and leave the reader at the top of a document they were sent into
  // the middle of.
  //
  // AN EFFECT rather than a call, because everything it needs arrives on its
  // own schedule: the markdown chunk (`markdownReady`, through `headings`), the
  // editor's own chunk (`surface`), and the text itself, which a file that
  // moved on disk can replace under an open page. Re-running is harmless — the
  // same heading is scrolled to where it already is.
  createEffect(() => {
    const at = router.landing()
    if (at === undefined || at.index !== here()) return
    const id = landingId(text(), props.file, at.at)
    if (land(id)) return
    // No editor: the reading fallback below is the page's own rendering, with
    // real anchors in it. ON THE NEXT FRAME, which was measured rather than
    // reasoned: scrolling inside the effect lands on the element's position
    // BEFORE the layout around it has settled — the contents above appears in
    // the same update — and the reader ends up short of the heading they asked
    // for.
    if (surface() !== undefined || !markdownReady()) return
    const frame = requestAnimationFrame(() => {
      // Two panes of the SAME file mint the same heading ids. Look under THIS
      // pane's root, not the first copy in document order.
      const root = document.querySelector(
        `[data-testid="${TESTID.pane}"][data-pane="${String(here())}"]`,
      )
      root?.querySelector(`#${CSS.escape(id)}`)?.scrollIntoView({ block: "start" })
    })
    onCleanup(() => cancelAnimationFrame(frame))
  })

  /** What the last guarded write PUT ON THE WIRE, which is not the same thing
   *  as what landed: a write that was refused leaves this holding the text the
   *  server said no to. Sending it again would earn the same refusal, and
   *  leaving the editor asks twice over (the blur, the unmount) — so a re-send
   *  of an identical payload is skipped rather than paid for twice. Cleared by
   *  a write that lands, since after that the baseline itself answers. */
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
   * Write now rather than on the pause: the caret leaving, `Escape`, and the
   * page closing because the reader navigated away — which is why this is also
   * the cleanup.
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

  /** Give the caret back: what `Escape` and a click elsewhere both mean. The
   *  text goes now rather than on the pause, because the person has stopped. */
  const done = (): void => {
    flush()
    setWriting(false)
  }

  return (
    <div class="flex flex-col gap-2">
      {/* The drift line is a SAID LINE like every other thing this client says
          about a write (`../edit/SaidLine.tsx`), and in the alarm mood: it is
          not advice about something that landed, it is the reason the next
          write will not. Drawn through the same component so its tone is a
          `data-tone` fact a scenario can read. */}
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

      <Toc
        file={props.file}
        headings={headings()}
        // The contents scrolls the SURFACE as well as changing the address:
        // there is no anchor for the browser to land on while the editor is
        // what the page draws — see `land`.
        onGo={(heading) => {
          land(heading.id)
        }}
      />

      <Mde
        text={text()}
        from={props.file}
        writing={writing()}
        onEdit={() => setWriting(true)}
        onInput={(next) => {
          setText(next)
          // Whatever the last write said was about the text this replaces.
          setSaid(null)
          idle()
        }}
        // The registry's `doc` field: `Escape` gives the caret back, and inside
        // a vim editor it belongs to vim (`../keys.ts` says both). Nothing else
        // here is the app's — a document has no sibling to make and no note to
        // open, so `Shift+Enter` is the editor's own newline.
        onKey={keyHandler("doc", done)}
        onBlur={(left) => {
          // An editor taken out of the page by a re-render did not lose focus
          // to a person; one that did is somebody looking somewhere else, and
          // the surface goes back to reading with the text on its way to disk.
          if (left) done()
        }}
        onSurface={setSurface}
        // What a reader sees while the editor's chunk is in the air: the page's
        // own rendering of this same markdown, which is what this page drew
        // before there was an editor to be (`../mde/Mde.tsx` argues the faces).
        // ...and it is NOT named `documentBody` a second time: the box around
        // it already is, whichever face is inside (`boxTestid` below), so one
        // question about the document's body has one answer on screen.
        reading={<Markdown source={text()} from={props.file} />}
        class="min-h-[60vh] w-full rounded border border-transparent p-3 text-sm leading-relaxed text-ink outline-none focus-within:border-accent olai-md"
        testid={TESTID.documentEditor}
        boxTestid={TESTID.documentBody}
        label={`the source of ${props.file}`}
      />

      <Refused said={said()} testid={TESTID.documentSaid} />

      {/* The explicit second verb, and only after the refusal has been read: a
          write with no `was`, meaning exactly what it says. */}
      <Show when={said() !== null && drifted()}>
        <div>
          <button
            type="button"
            class="cursor-pointer rounded border border-alarm/60 bg-transparent px-2 py-1 text-[0.8125rem] text-alarm hover:bg-alarm/10"
            data-testid={TESTID.documentOverwrite}
            onClick={() => flush(false)}
          >
            Overwrite what is there
          </button>
        </div>
      </Show>
    </div>
  )
}
