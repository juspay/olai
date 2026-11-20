import { Plan } from "./Plan.tsx"
import { Roster } from "./Roster.tsx"
import { Standing } from "./Standing.tsx"
import type { Chat } from "./state.ts"
import { Watching } from "./Watching.tsx"

export function Strips(props: { readonly chat: Chat }) {
  // ...AND STANDING LAST, because it is the one line the per-conversation marks
  // share: sleep first on it, the wake faces after ({@link ./Standing.tsx}
  // argues why the two are items of one bar rather than a strip each).
  return <><Plan chat={props.chat} /><Roster chat={props.chat} /><Watching chat={props.chat} /><Standing chat={props.chat} /></>
}
