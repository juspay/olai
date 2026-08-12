/**
 * A page whose rows can be typed in.
 *
 * The editor's LIFETIME is a page, and that is the whole of what this
 * component decides. It was the app's, and the app is not a thing a draft can
 * belong to: a caret left in a row and then navigated away from would still be
 * open on a day page, whose rows are a query rather than a tree, and the
 * editor would cheerfully re-place it onto whatever it found there. Created
 * here, the draft goes away with the page it was typed on, and `useEditor`'s
 * throw becomes a real invariant — a row drawn outside an editable page has no
 * editor to reach for, rather than one that happens to be empty.
 *
 * Which pages those are is then a fact about which pages use this, and there
 * are two: an outline and a zoomed node. A day lists nodes from all over the
 * set and a document is not an outline at all, so neither draws one.
 */

import type { Row } from "@olai/format"
import { type Accessor, type JSX } from "solid-js"

import type { View } from "../view.ts"
import { createEditor, EditorProvider } from "./editing.tsx"

export function Editable(props: {
  /** What is drawn, and what is folded: the two halves of where `↑`/`↓` go and
   *  of where a row that has moved is found again. */
  readonly rows: Accessor<ReadonlyArray<Row>>
  readonly view: View
  readonly children: JSX.Element
}) {
  const editor = createEditor({
    rows: () => props.rows(),
    collapsed: () => props.view.collapsed(),
  })
  return <EditorProvider editor={editor}>{props.children}</EditorProvider>
}
