import { Show } from "solid-js"
import { Dynamic } from "solid-js/web"
import { useAgents } from "./answered.tsx"
import type { Row } from "./roster.ts"
import { TESTID } from "../../testids.ts"

/** A chat as a list names it: the place's mark, where it stands for one, and
 *  its name (`./answered.tsx`'s `Named`). `class` is the name's own.
 *
 *  THE MARK IS SIZED HERE, because a kind's glyph is drawn `h-full w-full`
 *  and takes the box its caller gives it (`olai-plugin-files`' `Glyph` says
 *  the same thing from the other side). Left unsized it grew to the row's
 *  whole width and squeezed the name to nothing. */
export function ChatName(props: { readonly row: Row; readonly class?: string }) {
  const agents = useAgents()
  const named = () => agents.named(props.row)
  return <>
    <Show when={named().mark}>{mark => <span class={`${MARK_BOX} text-muted`} data-testid={TESTID.chatPlaceMark}><Dynamic component={mark()} /></span>}</Show>
    <span class={props.class ?? "min-w-0 flex-1 truncate"} data-testid={TESTID.chatName}>{named().name}</span>
  </>
}

/** The box a place's mark is drawn in, wherever a chat is named — one
 *  spelling, shared by the sidebar's rows, the panel's title and picker, and
 *  the side panel's **This page** block. */
export const MARK_BOX = "inline-flex h-3.5 w-[calc(0.875rem*18/16)] shrink-0 items-center"
