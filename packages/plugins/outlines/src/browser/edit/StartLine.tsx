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
 * pending drafts a row's Enter opens, drawn by {@link Ghosts} in the same
 * place the row will appear. So there is one new-row mechanism rather than a
 * special case for the first one.
 */
import { TESTID } from "olai-plugin-outlines/testids"
import type { Anchor } from "@olai/surface"
import { Show } from "solid-js"


import { besideOf, sameBeside } from "./draft.ts"
import { useEditor } from "./editing.tsx"
import { Ghosts } from "./Ghosts.tsx"

export function StartLine(props: {
  /** Where the row this offers would go. */
  readonly at: Anchor
  /** What the button says — the page knows what is empty, this does not. */
  readonly label: string
}) {
  const editor = useEditor()
  /** The LIVE line, when it is the one this line offered — a pending, or the
   *  row it landed as while the page has not drawn that row yet
   *  (`./draft.ts`'s `ghostOf`).
   *
   * ONE QUESTION, ASKED OF ONE FACT: the SEAT the caret's line is drawn at,
   * which is what a tree row compares its own id against too (`../Tree.tsx`).
   * A start line matched its anchor instead, which meant walking a landed
   * line's placings here to re-derive the very seat the editor had already
   * worked out — a second answer to a question the editor owns, and one the
   * frame could answer differently. */
  const live = () => {
    const line = editor.live()
    if (line === null || !sameBeside(editor.where().pending, besideOf(props.at))) return undefined
    return line
  }
  const parked = () =>
    editor.ghosts().filter((g) => sameBeside(besideOf(editor.displayAt(g.at)), besideOf(props.at)))
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
      <Ghosts parked={parked()} live={live()} />
    </Show>
  )
}
