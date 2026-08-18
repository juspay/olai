/**
 * A LINK, in the surface a document is read in.
 *
 * The live-preview plugins this editor is assembled from draw emphasis,
 * headings, lists, quotes and fences, and they leave a link exactly as it is
 * written: `[the ferry](../notes/ferry.md)`, brackets, parentheses, path and
 * all. That is right for a note under a row and wrong for the surface a
 * DOCUMENT is read on, because a `.md` page is the one place a reader
 * navigates FROM — a vault is a web of relative links, and md-live-preview-editor
 * took away the rendering that used to make them clickable.
 *
 * So this puts them back, and it is glue in the strict sense: the two rules it
 * needs are somewhere else already.
 *
 *   - WHERE A WRITTEN LINK LANDS is `../routes.ts`'s `documentHref` — the same
 *     function the rendering rewrites its `<a href>` with, so a link cannot
 *     mean one thing rendered and another thing live.
 *   - WHAT HAPPENS ON THE CLICK is nobody's here: the decoration draws a real
 *     `<a>` with a real href, and the pane this surface is inside already turns
 *     a press on one into a route (`../pane/PageView.tsx`, `../router.tsx`'s
 *     `followed`). An external `http:` link is left to the browser exactly as
 *     the rendering leaves it.
 *
 * THE MARKERS HIDE LIKE EVERY OTHER MARKER, which is the whole rule of this
 * editor said once more: with the caret outside the link, the `[`, `]`, the
 * URL and the title are not on screen and what is left reads as prose; put the
 * caret inside and the source is all there, to edit like any other text. A
 * reading surface has no caret at all, so a reader simply sees links.
 *
 * THE ANCHOR IS READING'S ONLY, and that is the one asymmetry. While somebody
 * is WRITING, a click has to put the caret where they pressed — an anchor
 * would swallow it and navigate away from an unsaved draft — so the link keeps
 * its look (the marks stay hidden) and stops being a target.
 */

import { syntaxTree } from "@codemirror/language"
import { type EditorState, RangeSetBuilder } from "@codemirror/state"
import {
  Decoration,
  type DecorationSet,
  EditorView,
  ViewPlugin,
  type ViewUpdate,
} from "@codemirror/view"

import { documentHref } from "../routes.ts"

/** The class a drawn link wears. Spelled here and painted in ./theme.ts, which
 *  is where every colour this editor uses is decided. */
export const LINK_CLASS = "olai-mde-link"

/** Hidden, not deleted: the source is untouched and the bytes are the file's —
 *  what changes is what is drawn. */
const HIDDEN = Decoration.replace({})

/**
 * Every link of the visible text, as decorations.
 *
 * `from` is the document being drawn, because a relative path means "beside
 * THIS file" and nothing can work that out from the text alone.
 */
const linksIn = (view: EditorView, from: string): DecorationSet => {
  const builder = new RangeSetBuilder<Decoration>()
  const reading = view.state.readOnly
  for (const range of view.visibleRanges) {
    syntaxTree(view.state).iterate({
      from: range.from,
      to: range.to,
      enter: (node) => {
        if (node.name !== "Link") return true
        // A READING surface has no caret — the selection sits at the top of
        // the document because a state must have one — so nothing there is
        // "the link the caret is in".
        const inside = !reading && caretIn(view.state, node.from, node.to)
        const link = node.node
        const marks = link.getChildren("LinkMark")
        const url = link.getChild("URL")
        const title = link.getChild("LinkTitle")
        // A link this editor cannot read as `[text](url)` is left alone
        // entirely — a reference link, an autolink, something the grammar
        // called a Link for a reason of its own. Drawing half of one would be
        // worse than drawing none.
        if (url === null || marks.length < 4) return false
        if (!inside) {
          builder.add(marks[0]!.from, marks[0]!.to, HIDDEN)
        }
        const text = { from: marks[0]!.to, to: marks[1]!.from }
        const written = view.state.sliceDoc(url.from, url.to)
        if (reading && text.to > text.from) {
          builder.add(
            text.from,
            text.to,
            Decoration.mark({
              tagName: "a",
              class: LINK_CLASS,
              attributes: { href: documentHref(from, written) ?? written },
            }),
          )
        }
        if (!inside) {
          // Everything after the link's text: `](`, the URL, the title, `)`.
          const tail = title === null ? url.to : title.to
          builder.add(marks[1]!.from, Math.max(tail, marks[1]!.to), HIDDEN)
          const closing = marks[marks.length - 1]!
          if (closing.from >= tail) builder.add(closing.from, closing.to, HIDDEN)
        }
        return false
      },
    })
  }
  return builder.finish()
}

/** Whether any cursor is in this range — the rule every marker in this editor
 *  hides by (`@retronav/ixora` spells the same test for its own). */
const caretIn = (state: EditorState, from: number, to: number): boolean =>
  state.selection.ranges.some((range) => range.from <= to && range.to >= from)

/** The plugin, bound to the file it is drawing — a relative link is relative to
 *  something, and only the caller knows what. */
export const linkPills = (from: string) =>
  ViewPlugin.fromClass(
    class {
      decorations: DecorationSet
      constructor(view: EditorView) {
        this.decorations = linksIn(view, from)
      }
      update(update: ViewUpdate) {
        if (
          update.docChanged || update.viewportChanged || update.selectionSet ||
          update.startState.readOnly !== update.state.readOnly
        ) {
          this.decorations = linksIn(update.view, from)
        }
      }
    },
    { decorations: (value) => value.decorations },
  )
