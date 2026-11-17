import { Show } from "solid-js"
import { Dynamic } from "solid-js/web"
import { useAgents } from "./answered.tsx"
import type { Row } from "./roster.ts"
import { TESTID } from "../../testids.ts"

/** A chat as a list names it: the place's mark, where it stands for one, and
 *  its name (`./answered.tsx`'s `Named`). `class` is the name's own. */
export function ChatName(props: { readonly row: Row; readonly class?: string }) {
  const agents = useAgents()
  const named = () => agents.named(props.row)
  return <>
    <Show when={named().mark}>{mark => <span class="inline-flex shrink-0 text-muted" data-testid={TESTID.chatPlaceMark}><Dynamic component={mark()} /></span>}</Show>
    <span class={props.class ?? "min-w-0 flex-1 truncate"} data-testid={TESTID.chatName}>{named().name}</span>
  </>
}
