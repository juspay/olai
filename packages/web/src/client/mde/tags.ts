/**
 * `#tags` inside the editor, drawn as the row draws them.
 *
 * The editor and the page must agree about what a tag IS, and this file is
 * how: WHERE a tag starts and stops is `titleParts` from `@olai/format` — the
 * same walk `../markdown/tags.ts` asks for the pill under a title and the
 * search index asks for its tag facet — so the alphabet is declared once, in
 * the format, and neither the renderer nor the caret re-derives it. What is
 * here is the CodeMirror end of that one decision: which characters of the
 * document those parts land on, and the class they wear.
 *
 * THE CLASS IS THE PAGE'S OWN (`TAG_CLASS`), imported rather than retyped.
 * Typing `#design` into a note and reading it back are the same words in the
 * same ink, which is the whole promise of live preview — a second spelling of
 * the pill here would be the drift this app writes tests to prevent, visible
 * as a tag that changes colour the moment you put the caret in it.
 *
 * TWO HALVES, and the split is the usual one: {@link tagsIn} is a fact about a
 * STRING and is unit-tested as one; the plugin under it is what walks the
 * visible lines and hands those facts to CodeMirror. Nothing here is caret-
 * aware, and that is deliberate — a tag is drawn AS WRITTEN, sigil and all
 * (`../markdown/tags.ts` says why), so there is no marker to hide and nothing
 * about the selection to ask.
 */

import { mayHoldTag, tagText, titleParts } from "@olai/format"
import { syntaxTree } from "@codemirror/language"
import { RangeSetBuilder } from "@codemirror/state"
import { Decoration, type DecorationSet, type EditorView, ViewPlugin, type ViewUpdate } from "@codemirror/view"

import { TAG_CLASS } from "../markdown/tags.ts"
import { TESTID } from "../testids.ts"

/** Where a tag sits in one line of text, and what it says — offsets INTO THE
 *  LINE, since that is what a caller holding a `Line` can add its own `from`
 *  to. */
export interface TagSpan {
  readonly from: number
  readonly to: number
  /** The tag as written, sigil and all — what the row draws and what a filter
   *  would match. */
  readonly written: string
}

/**
 * The tags in one line, by offset.
 *
 * It walks {@link titleParts} and MEASURES rather than searching: a part list
 * rejoins to the string it came from (the format says so, and carries each
 * tag's sigil for exactly that reason), so running the offsets up as the parts
 * go past is the same arithmetic the format already did, read back. A second
 * regex here would be the alphabet declared twice.
 *
 * Guarded by the format's own cheap negative first, exactly as the two
 * renderings in `../markdown/tags.ts` are: this is asked per LINE, per
 * keystroke, and most lines hold no sigil at all.
 */
export const tagsIn = (text: string): ReadonlyArray<TagSpan> => {
  if (!mayHoldTag(text)) return []
  const spans: Array<TagSpan> = []
  let at = 0
  for (const part of titleParts(text)) {
    const written = part.kind === "tag" ? tagText(part) : part.text
    if (part.kind === "tag") spans.push({ from: at, to: at + written.length, written })
    at += written.length
  }
  return spans
}

/**
 * Where a `#…` is not a tag, and it is the rendering's own list read one layer
 * down: code is code, and a URL's fragment is part of the address.
 *
 * `../markdown/tags.ts` skips the `code` and `a` SUBTREES of the tree it walks;
 * the same question here is asked of the syntax tree the editor already keeps,
 * because that is what knows a `#` is inside a fence rather than in a sentence.
 */
const NOT_A_TAG = new Set([
  "InlineCode",
  "CodeText",
  "CodeMark",
  "FencedCode",
  "CodeBlock",
  "URL",
  "LinkMark",
])

/** Whether the character at `at` is inside one of those. Walks up from the
 *  innermost node, since a `CodeText` is a child of a `FencedCode` and either
 *  answer is the same "leave it alone". */
const sheltered = (view: EditorView, at: number): boolean => {
  let node = syntaxTree(view.state).resolveInner(at, 1)
  for (;;) {
    if (NOT_A_TAG.has(node.name)) return true
    const above = node.parent
    if (above === null) return false
    node = above
  }
}

/**
 * The pill, as a decoration: the page's own class, and the page's own name for
 * it.
 *
 * WHAT IT DELIBERATELY DOES NOT CARRY is `data-tag`. That attribute is what
 * makes a pill PRESSABLE — the delegated listener in `../filter/tag.ts` reads
 * it and narrows the page — and a press inside an editor is a caret being put
 * somewhere, not a filter being run. So the tag looks exactly like the tag on
 * the row and behaves like the text it is, which is the honest reading of both
 * facts at once.
 */
const TAG_MARK = Decoration.mark({
  class: TAG_CLASS,
  attributes: { "data-testid": TESTID.tag },
})

/** Every tag on screen, as decorations. Visible ranges only — a document is
 *  longer than a viewport, and CodeMirror redraws this whenever that stops
 *  being true. */
const tagDecorations = (view: EditorView): DecorationSet => {
  const marks = new RangeSetBuilder<Decoration>()
  for (const { from, to } of view.visibleRanges) {
    for (let at = from; at <= to;) {
      const line = view.state.doc.lineAt(at)
      for (const span of tagsIn(line.text)) {
        const starts = line.from + span.from
        if (!sheltered(view, starts)) marks.add(starts, line.from + span.to, TAG_MARK)
      }
      at = line.to + 1
    }
  }
  return marks.finish()
}

/** The pills, kept in step with the document. */
export const tagPills = ViewPlugin.fromClass(
  class {
    decorations: DecorationSet

    constructor(view: EditorView) {
      this.decorations = tagDecorations(view)
    }

    update(update: ViewUpdate): void {
      // No `selectionSet`: nothing here is caret-aware (see the header), so a
      // caret moving over a tag redraws nothing.
      if (update.docChanged || update.viewportChanged) {
        this.decorations = tagDecorations(update.view)
      }
    }
  },
  { decorations: (plugin) => plugin.decorations },
)
