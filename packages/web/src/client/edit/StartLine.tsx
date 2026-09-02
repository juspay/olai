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
import { Key } from "@solid-primitives/keyed"
import { Show } from "solid-js"

import { TESTID } from "../testids.ts"
import { sameAnchor } from "./draft.ts"
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
  /** The pending draft, when it is the one this line offered. Compared against
   *  the anchor rather than its KIND: a draft anchored `after` a row is drawn
   *  by that row (`../Tree.tsx`), and saying which anchor is ours states the
   *  half of that rule this component owns instead of implying it. */
  const live = () => {
    const draft = editor.draft()
    return draft !== null && draft.kind === "new" && sameAnchor(draft.at, props.at)
      ? draft
      : undefined
  }
  const parked = () => editor.ghosts().filter((g) => sameAnchor(g.at, props.at))
  const any = () => live() !== undefined || parked().length > 0

  return (
    <Show
      when={any()}
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
      <Key each={parked()} by="slot">
        {(draft) => (
          <NewRow
            draft={draft()}
            active={false}
            onActivate={() => editor.resume(draft().slot)}
            onInput={editor.type}
            onKey={keyHandler("line", editor.press)}
            onBlur={(left) => editor.blur({ row: draft().slot, field: "new" }, left)}
          />
        )}
      </Key>
      <Show when={live()}>
        {(draft) => (
          <NewRow
            draft={draft()}
            onInput={editor.type}
            onKey={keyHandler("line", editor.press)}
            onBlur={(left) => editor.blur({ row: draft().slot, field: "new" }, left)}
          />
        )}
      </Show>
    </Show>
  )
}
