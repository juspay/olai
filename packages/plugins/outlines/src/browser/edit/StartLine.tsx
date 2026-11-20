import { TESTID } from "olai-plugin-outlines/testids"
import type { Anchor } from "@olai/surface"
import { Show } from "solid-js"


import { besideOf, sameBeside } from "./draft.ts"
import { useEditor } from "./editing.tsx"
import { Ghosts } from "./Ghosts.tsx"

export function StartLine(props: {
  readonly at: Anchor
  readonly label: string
}) {
  const editor = useEditor()
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
