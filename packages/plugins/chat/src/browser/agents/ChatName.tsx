import { MARK_BOX } from "@olai/ui-primitives/mark.ts"
import { Show } from "solid-js"
import { Dynamic } from "solid-js/web"
import { useAgents } from "./answered.tsx"
import type { Row } from "./roster.ts"
import { TESTID } from "../../testids.ts"

/** A chat as a list names it: a note's kind mark and its name, a node's title
 *  (`./answered.tsx`'s `Named`). `class` is the name's own.
 *
 *  THE MARK IS SIZED HERE, because a kind's glyph is drawn `h-full w-full`
 *  and takes the box its caller gives it (`olai-plugin-files`' `Glyph` says
 *  the same thing from the other side). Left unsized it grew to the row's
 *  whole width and squeezed the name to nothing. */
export function ChatName(props: { readonly row: Row; readonly class?: string }) {
  const agents = useAgents()
  const named = () => agents.named(props.row)
  return <>
    <Show when={named().mark}>{mark => <span class={`${MARK_BOX} text-muted`} data-testid={TESTID.chatFileMark}><Dynamic component={mark()} /></span>}</Show>
    <span class={props.class ?? "min-w-0 flex-1 truncate"} data-testid={TESTID.chatName}>{named().name}</span>
  </>
}

