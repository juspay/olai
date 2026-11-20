import { MARK_BOX } from "@olai/ui-primitives/mark.ts"
import { Show } from "solid-js"
import { Dynamic } from "solid-js/web"
import { useAgents } from "./answered.tsx"
import type { Row } from "./roster.ts"
import { TESTID } from "../../testids.ts"

export function ChatName(props: { readonly row: Row; readonly class?: string }) {
  const agents = useAgents()
  const named = () => agents.named(props.row)
  return <>
    <Show when={named().mark}>{mark => <span class={`${MARK_BOX} text-muted`} data-testid={TESTID.chatFileMark}><Dynamic component={mark()} /></span>}</Show>
    <span class={props.class ?? "min-w-0 flex-1 truncate"} data-testid={TESTID.chatName}>{named().name}</span>
  </>
}

