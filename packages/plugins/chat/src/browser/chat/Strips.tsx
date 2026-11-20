import { Plan } from "./Plan.tsx"
import { Roster } from "./Roster.tsx"
import { Standing } from "./Standing.tsx"
import type { Chat } from "./state.ts"
import { Watching } from "./Watching.tsx"

export function Strips(props: { readonly chat: Chat }) {
  return <><Plan chat={props.chat} /><Roster chat={props.chat} /><Watching chat={props.chat} /><Standing chat={props.chat} /></>
}
