/**
 * Where a page with no rows offers one.
 *
 * Two places can be empty and both deserve a way in: an outline that holds
 * nothing (the file is there, the tree is not) and a zoomed node with nothing
 * under it. Without this the keyboard has nowhere to start — every other key
 * in the editor is pressed inside a row's editor, and a page with no rows has
 * none — so the first line would only be reachable by asking the agent.
 *
 * It is a button until it is pressed, and then it IS the editor: the same
 * pending draft any `Enter` opens, in the same place its row will appear. So
 * there is one new-row mechanism rather than a special case for the first one.
 */

import type { Anchor } from "@olai/surface"
import { Show } from "solid-js"

import { TESTID } from "../testids.ts"
import { anchorRow } from "./draft.ts"
import { useEditor } from "./editing.tsx"
import { NewRow } from "./NewRow.tsx"
import { keyHandler } from "./RowEditor.tsx"

export function StartLine(props: {
  /** Where the row this offers would go. */
  readonly at: Anchor
  /** What the button says — the page knows what is empty, this does not. */
  readonly label: string
}) {
  const editor = useEditor()
  /** The pending draft, when it is THIS one. A draft anchored `after` a row is
   *  drawn by that row (`../Tree.tsx`); the two anchors a page with no rows can
   *  offer are drawn here, which is what makes every anchor's editor appear
   *  exactly once. */
  const pending = () => {
    const draft = editor.draft()
    return draft !== null && draft.kind === "new" && draft.at.kind !== "after"
      ? draft
      : undefined
  }

  return (
    <Show
      when={pending()}
      fallback={
        <button
          type="button"
          class="cursor-text border-0 bg-transparent p-0 text-left text-muted hover:text-ink"
          data-testid={TESTID.startLine}
          onClick={() => editor.start(props.at)}
        >
          {props.label}
        </button>
      }
    >
      {(draft) => (
        <NewRow
          draft={draft()}
          caret={editor.caret()}
          onInput={editor.type}
          onKey={keyHandler("line", editor.press)}
          onBlur={() => editor.blur({ row: anchorRow(props.at), field: "new" })}
        />
      )}
    </Show>
  )
}
