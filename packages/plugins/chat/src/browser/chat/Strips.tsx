/**
 * What a conversation has STANDING — its plan, its tools, what it still has
 * out, and what may ring it — as one block, because where that block goes is
 * one decision.
 *
 * Each strip argues for itself that it is "above the scroll and never carried
 * away by it" ({@link ./Roster.tsx}, {@link ./Watching.tsx}). In a fold that is
 * true of wherever they are drawn: the transcript is the only thing that
 * scrolls. On a node page it was not — the pane is the scroll there, and
 * strips drawn above the transcript left with the memory above them, so a
 * reader at the newest line could not see that three agents were still out.
 * The page draws this in its pinned head instead (`../agents/Page.tsx`).
 */

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
