/**
 * The markdown editor itself: CodeMirror 6, assembled.
 *
 * THE SOURCE IS THE DOCUMENT MODEL, and everything else here follows from it.
 * What this editor holds is the markdown string the file holds, character for
 * character; the rich text is a RENDERING LAID OVER IT — decorations that hide
 * a `**` while the caret is elsewhere and draw the word in bold, a line class
 * that sizes a heading, a widget that draws a task's box. Nothing parses the
 * text into a tree of its own and writes it back, which is the one thing that
 * would break the format's own law (docs/editing.md, `../markdown/render.ts`):
 * a serializer normalises bytes nobody touched — `_em_` becomes `*em*`, a list
 * reflows, an escape is dropped — and under autosave that churn lands on every
 * pause, as phantom diffs in the audit trail and spurious conflicts with an
 * agent writing the same file. With source-as-model there is no serializer, so
 * fidelity is not a property this code has to defend; it is the absence of a
 * step.
 *
 * THE LIVE PREVIEW IS A DEPENDENCY, and that is the ruling rather than the
 * accident: dependencies are not the cost, handrolled code is. So the
 * caret-aware marker hiding — the whole Obsidian/Typora behaviour — is
 * `@retronav/ixora`'s, à la carte, and what this file owns is the list.
 *
 * `ink-mde` was the first choice and was tried first (2026-08-18). Its
 * rendering is what its own README calls "hybrid plain-text": markers are
 * COLOURED, never hidden, and version 0.34.0 carries no caret-aware decoration
 * at all — nothing in it reads `selectionSet`. That is precisely the rendering
 * the ruling rules against, so the ruling's own fallback applies: the marker
 * hiding, the heading sizing, the bullets and the task boxes come from ixora's
 * plugins, over `@codemirror/lang-markdown`'s GFM grammar. Same document model
 * either way, which is why switching later would lose nothing.
 *
 * WHAT IS OURS IS GLUE, and it is four things: the `#tag` pill (./tags.ts,
 * which delegates every boundary to the format), the theme (./theme.ts, which
 * spells no colour of its own), the keys this app has already claimed
 * (../keys.ts, asked here rather than re-matched), and vim behind a
 * preference.
 *
 * ## The keys
 *
 * One handler, at the highest precedence, handing the raw event to the app's
 * own registry — so the editing keys mean here exactly what they mean in the
 * title input beside it, and the registry stays the one file where a key's
 * meaning is decided. What it does NOT claim, CodeMirror gets: `Enter` is a
 * newline, `Tab` moves focus out (the platform's, deliberately unclaimed), and
 * ⌘Z is the editor's own history rather than the app's undo stack — a draft is
 * not an op, which is the same split `../keys.ts` already made for the
 * textarea this replaces.
 *
 * ## Vim
 *
 * A compartment, so the preference can be toggled under a live editor without
 * remounting one. There is no status bar: the library offers one and a strip
 * saying `--NORMAL--` under a two-line note is furniture a row cannot afford —
 * the block cursor says the mode, and ./theme.ts draws it in ink.
 *
 * ESCAPE IS VIM'S while it is on, and that is said in `../keys.ts` rather than
 * guarded here: the handler below asks the registry, and the registry asks
 * whether this editor is a vim editor.
 */

import { defaultKeymap, history, historyKeymap, insertNewline } from "@codemirror/commands"
import { markdown, markdownLanguage } from "@codemirror/lang-markdown"
import { forceParsing, syntaxTree } from "@codemirror/language"
import { Compartment, EditorState, type Extension, Prec } from "@codemirror/state"
import { EditorView, keymap } from "@codemirror/view"
import { vim } from "@replit/codemirror-vim"
import {
  blockquote,
  codeblock,
  headings,
  headingSlugField,
  hideMarks,
  lists,
} from "@retronav/ixora"

import { linkPills } from "./links.ts"
import { separatorOf } from "./separator.ts"
import { tagPills } from "./tags.ts"
import { olaiEditorTheme } from "./theme.ts"

/**
 * The live preview, à la carte.
 *
 * `hideMarks` is the one this whole item is about — emphasis, strong, inline
 * code and strikethrough lose their markers unless the caret is inside them.
 * The other four are the same idea applied to what a marker means block by
 * block: a heading's `#`, a fence's ```` ``` ````, a quote's `>` and a list's
 * `-` (drawn as a bullet, with a task's `[ ]` as a box you can press).
 *
 * TWO OF THE LIBRARY'S PLUGINS ARE DELIBERATELY NOT HERE, and both are the
 * "incremental richness" the ruling allows:
 *
 *   - `image()` renders a picture inline. A note is drawn inside a tree row,
 *     and a remote image arriving mid-keystroke reflows the row under the
 *     caret; it also fetches from an editor, which is a decision about privacy
 *     this app has not made anywhere else.
 *   - `links()` replaces a URL with a 🔗 anchor that opens in a new tab. The
 *     emoji is not this app's typography and the `target` is not its
 *     navigation model. Links are drawn by ./links.ts instead, which hides the
 *     same markers and puts the app's OWN address on a real `<a>` — a page a
 *     reader navigates from needs its links to work, and this is the surface a
 *     document is now read on.
 *
 * Tables and nested lists get no special drawing either: they are still their
 * own source, still verbatim, still rendered the moment the editor closes.
 */
const livePreview: Extension = [
  headingSlugField,
  headings(),
  hideMarks(),
  lists(),
  blockquote(),
  codeblock(),
]

/** Which extensions the vim preference swaps. */
const vimming = new Compartment()

/**
 * ...and which the MODE swaps.
 *
 * The surface is one editor in two modes rather than two surfaces that replace
 * each other (human, on sight of the first shape): READING is what a person
 * looking at a note sees — the same decorations, the same type, no caret and
 * nothing to type into — and WRITING is the same view with the caret in it.
 * Because it is one `EditorView` reconfigured rather than a rendering swapped
 * for an editor, there is nothing to re-lay-out between the two: the words do
 * not move when you click into them.
 *
 * BOTH halves are set together and both are load-bearing. `editable` is what
 * takes `contenteditable` off the content — so a reader cannot type, and the
 * browser draws no caret — and `readOnly` is what makes the STATE refuse a
 * change, so a command or an extension cannot write through the back door.
 */
const writing = new Compartment()

/** The lezer-markdown names for a heading, both spellings. */
const HEADING = /^(ATXHeading[1-6]|SetextHeading[12])$/

/** How long a jump may spend parsing the rest of the file, in milliseconds. */
const PARSE_BUDGET = 100

/**
 * Where the Nth heading of the document starts, or `undefined`.
 *
 * THE GRAMMAR ANSWERS, rather than a regular expression over the lines: a `#`
 * at the start of a line inside a fenced code block is not a heading, and a
 * setext heading is not a `#` at all. The parser this editor already runs
 * knows both, and a second opinion about what a heading is would be a second
 * answer to the question the drawing above is already asking.
 *
 * PARSED ON DEMAND. CodeMirror parses what it is about to show, so a heading
 * far down a long file is in a region no tree has reached; forcing the parse
 * is what a jump into it costs, and it is bounded — a file too big to finish
 * in the budget leaves its reader where they are rather than freezing the tab.
 */
const headingAt = (view: EditorView, index: number): number | undefined => {
  forceParsing(view, view.state.doc.length, PARSE_BUDGET)
  let seen = -1
  let at: number | undefined
  syntaxTree(view.state).iterate({
    enter: (node) => {
      if (!HEADING.test(node.name)) return true
      seen += 1
      if (seen === index) at = node.from
      // Nothing inside a heading is a heading, and the walk is over the whole
      // file: not descending is the difference between reading the headings
      // and reading every word under them.
      return false
    },
  })
  return at
}

/**
 * How far below the top of the page a jump must land — the stylesheet's
 * `scroll-padding-top` (the header's own height), in pixels, plus a hair.
 *
 * The hair is measured rather than tasteful: CodeMirror scrolls to a LINE
 * BLOCK, whose top is a couple of pixels above the letters in it, so a margin
 * of exactly the bar's height leaves the heading three pixels behind the bar.
 * A jump that lands a little under is right; one that lands behind is the
 * defect (`features/the_header_sticks.feature` measures both).
 */
const scrollPadding = (): number => {
  const said = getComputedStyle(document.documentElement).scrollPaddingTop
  const pixels = Number.parseFloat(said)
  return (Number.isFinite(pixels) ? pixels : 0) + 8
}

const mode = (on: boolean): Extension => [
  EditorView.editable.of(on),
  EditorState.readOnly.of(!on),
]

/**
 * WHERE THE CARET PARKS WHILE NOBODY IS TYPING — the end of the text.
 *
 * A state always has a selection, and the live-preview plugins hide a marker
 * unless the caret is in it (a heading's `#` is skipped for the whole LINE the
 * caret is on). So a reading surface whose selection sat at 0 would draw its
 * first line's `#` at every reader, and one left where the writer stopped
 * would keep showing the markers of the line they stopped on. Parking at the
 * end answers both, and it costs what it costs: a document whose last line is
 * not blank shows THAT line's markers while reading. Nearly every `.md` ends
 * with a newline, so nearly every one parks on an empty line — and this app
 * may not add one to a file that does not, which is the verbatim law.
 */
const parked = (state: EditorState): number => state.doc.length

/**
 * A mounted editor, as the surface around it needs it — four verbs, and every
 * one of them is something a CALLER does to an editor rather than something
 * CodeMirror does.
 *
 * There is deliberately no `doc()` and no `caret()`: what the editor holds is
 * what the caller last heard through `typed`, and where the caret is is the
 * editor's own business between one `focus` and the next. Both existed for a
 * while and neither was ever read — an accessor nobody calls is a second
 * answer to a question that already has one, waiting for the two to disagree.
 */
export interface Mounted {
  /** Put text in it that did NOT come from typing — an external write, or a
   *  draft the app replaced. Silent: the change notifies nothing, because the
   *  caller is the one who already knows. */
  readonly write: (text: string) => void
  /** Take the caret: `at` for a chosen offset, absent for wherever it already
   *  is (which for a fresh editor is the end of the text). */
  readonly focus: (at?: number) => void
  /** Reading, or writing. One view either way — see {@link writing}. */
  readonly mode: (on: boolean) => void
  /** Put a `data-` fact on the editable element after the fact — which the
   *  mode needs, since it changes without the view being rebuilt and the
   *  attributes were written when it was. */
  readonly mark: (name: string, value: string) => void
  /** Which character is under a point on screen, or `undefined` for a point
   *  that is not over the text. What a click on a READING surface answers with,
   *  so the caret can arrive where the reader put their finger rather than at
   *  the end of the note. */
  readonly at: (x: number, y: number) => number | undefined
  /**
   * Scroll the Nth heading of the document to the top — what a contents line
   * and an incoming `#fragment` both ask for, now that what is on the page is
   * an editor rather than a rendering full of anchors.
   *
   * BY ORDINAL, which is the only name the two sides share. The page's
   * headings are the markdown pipeline's (`../markdown/render.ts` mints the
   * ids a fragment says); the editor's are its grammar's. Neither can read the
   * other's, and both walk the same text in the same order, so "the third
   * heading" is a fact they agree on where a slug would be two spellings of
   * one name waiting to disagree.
   *
   * `false` for a document that has no such heading — which is what a browser
   * does with a fragment naming no id: the reader stays where they are rather
   * than being sent somewhere arbitrary.
   */
  readonly reveal: (index: number) => boolean
  /** Turn vim mode on or off under a live editor. */
  readonly vim: (on: boolean) => void
  readonly destroy: () => void
}

export const mount = (
  host: HTMLElement,
  said: {
    readonly doc: string
    /** WHICH FILE this text is, which only matters for what a relative link in
     *  it means: `../notes/ferry.md` is beside the file, not beside the
     *  reader (./links.ts). */
    readonly from: string
    readonly vim: boolean
    /** Whether this surface starts as a caret or as a rendering. */
    readonly writing: boolean
    /** What is in the editor now, on every change a person made. */
    readonly typed: (text: string) => void
    /** A key, handed to `../keys.ts` by whoever mounted this. Returning is not
     *  how it says it took the key — `preventDefault` is, exactly as it is in
     *  the title input. */
    readonly key: (event: KeyboardEvent) => void
    /** The caret left. `left` is whether the editor is still IN the document,
     *  because an editor removed by a re-render did not lose focus to a
     *  person. */
    readonly blurred: (left: boolean) => void
    /**
     * What to write on the EDITABLE element — the accessible name a document's
     * editor needs, and the two marks this app names an editor by.
     *
     * They go on the editable thing rather than on the box around it, and that
     * is not a detail: it is what makes the textarea and this one answer to the
     * same selector AND to the same question about focus. A mark on the
     * wrapper would name an element that can never hold a caret, so anything
     * asking "is the caret in the editor" would have to know which face is on
     * screen.
     */
    readonly attributes: Record<string, string>
  },
): Mounted => {
  /** A write this code made rather than a person: `typed` is not called for
   *  it. One flag rather than a transaction annotation, because the whole of
   *  its life is the dispatch two lines below it. */
  let echoing = false

  /**
   * The text this editor and its caller last agreed on — the string that went
   * out through `typed`, or came in through `write`.
   *
   * It is kept because the ordinary loop is a ROUND TRIP: what is typed goes
   * out, the caller stores it, and it comes straight back as the same string,
   * so `write` has to decide whether anything changed. Asking the document
   * (`view.state.doc.toString()`) serialises the whole file to answer, on
   * every keystroke, about a string that is usually the very object that just
   * left — where this comparison is a pointer.
   */
  let agreed = said.doc

  /** The line ending this document is written with, if it is written with one
   *  — see {@link separatorOf}. Read once, from the text as it arrived, and
   *  used at BOTH ends: the state splits on it, and every string this handle
   *  emits is joined with it. */
  const separator = separatorOf(said.doc)

  /** The document as text, in ITS OWN line endings. `doc.toString()` is the
   *  obvious call and the wrong one — it joins with `"\n"` whatever the state
   *  was told to split on. */
  const emit = (): string =>
    view.state.doc.sliceString(0, view.state.doc.length, separator ?? "\n")

  const view = new EditorView({
    parent: host,
    state: EditorState.create({
      doc: said.doc,
      extensions: [
        ...(separator === undefined ? [] : [EditorState.lineSeparator.of(separator)]),
        history(),
        // ENTER IS A NEWLINE AND NOTHING ELSE, above every other map.
        //
        // `insertNewlineAndIndent` — what `defaultKeymap` binds — asks the
        // language what the next line should start with, and a markdown
        // language answers with the indentation of the list item you were in.
        // That is a character nobody typed, written into a file whose whole
        // law is that it holds what was typed. The textarea this face replaces
        // inserts a bare newline; so does this, so the two write by the same
        // rules.
        Prec.high(keymap.of([{ key: "Enter", run: insertNewline }])),
        keymap.of([...defaultKeymap, ...historyKeymap]),
        // AND THE GRAMMAR BRINGS NO COMMANDS. `@codemirror/lang-markdown`
        // defaults `addKeymap: true`, which installs `Prec.high` bindings of
        // its own: Enter runs `insertNewlineContinueMarkup` — a new `- ` at
        // the end of a list item, and `renumberList`, which rewrites the OTHER
        // items' numbers — and Backspace runs `deleteMarkupBackward`. It also
        // defaults `pasteURLAsLink: true`, which turns a pasted URL over a
        // selection into `[text](url)`.
        //
        // Every one of those is the "list reflow" this file's header rules out,
        // arriving as a command rather than as a serializer: bytes the person
        // did not type, which the next autosave would commit as though they
        // had. The convenience is real and it is not this app's to invent; a
        // list continued by hand is a list the file says was continued by hand.
        markdown({ base: markdownLanguage, addKeymap: false, pasteURLAsLink: false }),
        EditorView.lineWrapping,
        // Prose, so the browser's own spellcheck is wanted — CodeMirror turns
        // it off by default, which is right for code and wrong for a note.
        EditorView.contentAttributes.of({ spellcheck: "true", ...said.attributes }),
        livePreview,
        linkPills(said.from),
        tagPills,
        vimming.of(said.vim ? vim() : []),
        writing.of(mode(said.writing)),
        // LAST, and at the highest precedence: the two libraries above bring
        // themes of their own with hex greys and a red block cursor in them,
        // and vim's is itself `Prec.highest`. A theme's rules land in the
        // stylesheet in extension order at equal precedence, so this is what
        // it takes for the editor to be painted in this app's tokens rather
        // than in somebody's default (./theme.ts spells none of them itself).
        Prec.highest(olaiEditorTheme),
        // FIRST, above vim's own handler and above every keymap: the app's
        // keys are the app's, and what it declines falls through to both.
        Prec.highest(
          EditorView.domEventHandlers({
            keydown: (event) => {
              said.key(event)
              return event.defaultPrevented
            },
            blur: (_event, blurred) => {
              said.blurred(blurred.contentDOM.isConnected)
              return false
            },
          }),
        ),
        EditorView.updateListener.of((update) => {
          if (!update.docChanged || echoing) return
          agreed = emit()
          said.typed(agreed)
        }),
      ],
    }),
  })

  // A surface that opens READING parks its caret (see {@link parked}); one
  // that opens writing is about to be handed a real offset by whoever mounted
  // it. AFTER the state exists rather than in it, because the position is the
  // DOCUMENT's own length and the document is not the string that was handed
  // in: a file split on `\r\n` counts each break as one character, so the
  // string's length is off the end of it (and CodeMirror says so, loudly).
  if (!said.writing) view.dispatch({ selection: { anchor: parked(view.state) } })

  return {
    write: (text) => {
      if (text === agreed) return
      agreed = text
      echoing = true
      try {
        view.dispatch({ changes: { from: 0, to: view.state.doc.length, insert: text } })
      } finally {
        echoing = false
      }
    },
    focus: (at) => {
      view.focus()
      const main = view.state.selection.main
      const to = Math.min(at ?? main.head, view.state.doc.length)
      // A transaction only when it MOVES something. Taking the caret back after
      // an op that redrew the row asks for wherever it already is, and a
      // dispatch for that builds a whole new state, runs every field and
      // listener, and redraws the selection layer to change nothing.
      if (to === main.head && main.empty) return
      view.dispatch({ selection: { anchor: to } })
    },
    reveal: (index) => {
      const at = headingAt(view, index)
      if (at === undefined) return false
      // UNDER THE BAR, not behind it. A browser landing on a fragment obeys
      // `scroll-padding-top` (../styles.css sets it to the header's height);
      // CodeMirror computes the scroll itself and cannot, so the page's own
      // declaration is read back and handed over as the margin. Read here
      // rather than kept as a number, because the one place that decides how
      // tall the header is, is the stylesheet.
      view.dispatch({
        effects: EditorView.scrollIntoView(at, { y: "start", yMargin: scrollPadding() }),
      })
      return true
    },
    vim: (on) => {
      view.dispatch({ effects: vimming.reconfigure(on ? vim() : []) })
    },
    mode: (on) => {
      view.dispatch({
        effects: writing.reconfigure(mode(on)),
        // Giving the caret back parks it, in the same transaction: a reading
        // surface that kept the writer's last position would go on showing the
        // markers of the line they stopped on.
        ...(on ? {} : { selection: { anchor: parked(view.state) } }),
      })
    },
    mark: (name, value) => view.contentDOM.setAttribute(name, value),
    at: (x, y) => view.posAtCoords({ x, y }) ?? undefined,
    destroy: () => view.destroy(),
  }
}
