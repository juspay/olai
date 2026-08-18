/**
 * What the editor looks like — which is, as exactly as it can be managed, what
 * the RENDERING looks like.
 *
 * That is the whole design brief of live preview and the reason this file
 * spells no colour and no size of its own. Every value below is a custom
 * property that is already in force on the page: the eleven palette tokens
 * (`../styles.css`'s `@theme`, re-answered per palette so a pick repaints the
 * editor with everything else) and the markdown type and spacing scale
 * (`../theme/scale.ts`, generated onto `.olai-md` / `.olai-md-compact`). A
 * heading being edited is therefore the same size as the heading it is about
 * to become, in the same ink, in all fifteen palettes and in both densities —
 * without a second table anybody has to keep in step.
 *
 * It is `EditorView.theme` rather than `baseTheme` deliberately: the live
 * preview plugins bring base themes of their own, with hex greys and rem
 * literals in them (`#ccc` on a blockquote's bar, `2.2rem` on an `h1`), and a
 * theme outranks a base theme. So this is where a library's idea of what
 * markdown looks like meets this app's, and this app's wins.
 *
 * WHAT IS NOT HERE is anything about the BOX the editor sits in — no border,
 * no background, no padding, no width. A note is drawn inline under a row and
 * a document in a panel, and those two boxes are the callers' own utilities
 * (`../edit/RowEditor.tsx`, `../document/DocEditor.tsx`), exactly as the
 * textarea's were.
 */

import { HighlightStyle, syntaxHighlighting } from "@codemirror/language"
import type { Extension } from "@codemirror/state"
import { EditorView } from "@codemirror/view"
import { tags } from "@lezer/highlight"

/** Inline code, and a fence's own text: the app's mono face at the scale's own
 *  fraction of whatever it interrupts. Spelled once, worn by both. */
const CODE = {
  fontFamily: "var(--font-mono)",
  fontSize: "calc(1em * var(--olai-md-of-code))",
}

/**
 * The editor's own surfaces, and the six heading steps.
 *
 * The `&` rules are the editor root: it is transparent and inherits its type,
 * because what it is drawn INSIDE has already decided both — a note takes the
 * row's muted sans, a document the page's face — and an editor that painted
 * its own background would be a box where the design says there is none.
 */
const surfaces = EditorView.theme({
  "&": {
    backgroundColor: "transparent",
    color: "inherit",
    fontFamily: "inherit",
    fontSize: "inherit",
  },
  "&.cm-focused": { outline: "none" },
  // The scroller must not hold a font of its own either, and it must not
  // scroll: both editors grow with their content — a note is two lines and
  // occasionally twenty, a document is as long as it is — and the page is the
  // one thing that scrolls (`../scroll.ts`).
  ".cm-scroller": {
    fontFamily: "inherit",
    lineHeight: "var(--olai-md-leading-body)",
    overflow: "visible",
  },
  ".cm-content": { padding: "0", caretColor: "var(--color-ink)" },
  ".cm-line": { padding: "0" },
  ".cm-cursor, .cm-dropCursor": { borderLeftColor: "var(--color-ink)" },
  // The block cursor vim draws in every mode but insert. It is the one thing
  // on the page that says which mode you are in (`./codemirror.ts` says why
  // there is no status bar), so it is drawn in the accent this app uses for
  // "here is the caret" rather than left to the library's own red.
  //
  // THE SELECTORS OUTRANK THE LIBRARY'S ON SPECIFICITY, and that is what makes
  // this an override at all. `@replit/codemirror-vim` styles the cursor from a
  // `Prec.highest` theme of its own (`.cm-fat-cursor` and
  // `&:not(.cm-focused) .cm-fat-cursor`), and ORDER cannot be relied on to
  // settle a tie: vim rides a compartment, so its style module is mounted with
  // the editor when the preference was already on and AFTER this one when it
  // is switched on under an open editor. Naming `.cm-editor` — a class the
  // root already carries — is one step of specificity and settles both cases.
  "&.cm-editor.cm-focused .cm-fat-cursor": {
    background: "color-mix(in srgb, var(--color-accent) 45%, transparent)",
    outline: "none",
  },
  "&.cm-editor:not(.cm-focused) .cm-fat-cursor": {
    background: "none",
    outline: "1px solid color-mix(in srgb, var(--color-accent) 45%, transparent)",
  },

  // ── the live preview ────────────────────────────────────────────────
  //
  // A heading LINE, sized by the same table the rendered page reads. The
  // weight pair is the scale's own argument: `h1` and `h2` are the levels a
  // reader tells apart by weight as well as by size.
  ".cm-heading": {
    fontWeight: "var(--olai-md-weight-heading)",
    lineHeight: "var(--olai-md-leading-heading)",
  },
  ".cm-heading-1": { fontSize: "var(--olai-md-h1)", fontWeight: "var(--olai-md-weight-major)" },
  ".cm-heading-2": { fontSize: "var(--olai-md-h2)", fontWeight: "var(--olai-md-weight-major)" },
  ".cm-heading-3": { fontSize: "var(--olai-md-h3)" },
  ".cm-heading-4": { fontSize: "var(--olai-md-h4)" },
  ".cm-heading-5": { fontSize: "var(--olai-md-h5)" },
  ".cm-heading-6": { fontSize: "var(--olai-md-h6)", color: "var(--color-muted)" },

  ".cm-codeblock": {
    backgroundColor: "var(--olai-md-tint)",
    ...CODE,
  },
  ".cm-blockquote-border": {
    borderLeft: "var(--olai-md-border-quote) solid var(--color-rule)",
    paddingLeft: "var(--olai-md-pad-quoteX)",
  },
  ".cm-blockquote": { color: "var(--color-muted)" },
  ".cm-list-bullet": { color: "var(--color-muted)" },
  ".cm-task-marker-checkbox": { marginRight: "var(--olai-md-pad-chipX)" },

  // A tag is TEXT here, whatever it is on a row. The page makes a tag
  // pressable wherever the pane can carry a filter (`../styles.css`), and a
  // pointer promising a filter inside an editor would be a promise about the
  // caret it is standing in.
  ".olai-tag": { cursor: "text" },
})

/**
 * The inline marks, as the highlighter sees them.
 *
 * Bold looks bold and italic looks italic — that is the point of the exercise
 * — and the MARKERS around them are toned down rather than coloured in: they
 * are hidden while the caret is elsewhere (`./codemirror.ts`), so the only
 * time anyone sees a `**` it is because they are standing in the word, and the
 * quiet ink is what keeps that from reading as a second word.
 */
const marks = HighlightStyle.define([
  { tag: tags.strong, fontWeight: "var(--olai-md-weight-major)" },
  { tag: tags.emphasis, fontStyle: "italic" },
  { tag: tags.strikethrough, textDecoration: "line-through" },
  { tag: [tags.link, tags.url], color: "var(--color-accent)" },
  { tag: tags.monospace, ...CODE },
  { tag: tags.quote, color: "var(--color-muted)" },
  { tag: [tags.processingInstruction, tags.meta, tags.contentSeparator], color: "var(--color-muted)" },
])

/** The look, whole. */
export const olaiEditorTheme: Extension = [surfaces, syntaxHighlighting(marks)]
