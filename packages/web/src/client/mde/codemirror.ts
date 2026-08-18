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

import { defaultKeymap, history, historyKeymap } from "@codemirror/commands"
import { markdown, markdownLanguage } from "@codemirror/lang-markdown"
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
 *     navigation model (`../opens.tsx` owns that).
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
  /** Turn vim mode on or off under a live editor. */
  readonly vim: (on: boolean) => void
  readonly destroy: () => void
}

export const mount = (
  host: HTMLElement,
  said: {
    readonly doc: string
    readonly vim: boolean
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

  const view = new EditorView({
    parent: host,
    state: EditorState.create({
      doc: said.doc,
      extensions: [
        history(),
        keymap.of([...defaultKeymap, ...historyKeymap]),
        markdown({ base: markdownLanguage }),
        EditorView.lineWrapping,
        // Prose, so the browser's own spellcheck is wanted — CodeMirror turns
        // it off by default, which is right for code and wrong for a note.
        EditorView.contentAttributes.of({ spellcheck: "true", ...said.attributes }),
        livePreview,
        tagPills,
        vimming.of(said.vim ? vim() : []),
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
          if (update.docChanged && !echoing) said.typed(update.state.doc.toString())
        }),
      ],
    }),
  })

  return {
    write: (text) => {
      if (text === view.state.doc.toString()) return
      echoing = true
      try {
        view.dispatch({ changes: { from: 0, to: view.state.doc.length, insert: text } })
      } finally {
        echoing = false
      }
    },
    focus: (at) => {
      view.focus()
      const to = Math.min(at ?? view.state.selection.main.head, view.state.doc.length)
      view.dispatch({ selection: { anchor: to } })
    },
    vim: (on) => {
      view.dispatch({ effects: vimming.reconfigure(on ? vim() : []) })
    },
    destroy: () => view.destroy(),
  }
}
