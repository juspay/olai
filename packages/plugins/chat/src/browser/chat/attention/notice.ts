/**
 * WHAT the banner says, and what a press of it means — both as plain values,
 * so the sentence a person reads on their lock screen can be asserted without
 * an operating system.
 *
 * The ruling asked for two things in it: the conversation NAMED, and the first
 * line of what it wants. They are the two halves of "should I get up" — which
 * chat this is, and what it is stuck on — and neither is worth much without
 * the other.
 *
 * **The first line, not the question flattened.** An agent's question is
 * written as prose and its first line is the question; the lines under it are
 * the reasons, the file paths, the options spelled out. A banner is two lines
 * wide wherever it is drawn, so what the OS would truncate is chosen here
 * instead, at the boundary the writer intended.
 *
 * **What the panel could not see, it does not invent.** The pending question's
 * words come from the open panel's own snapshot ({@link ./asked.ts}), which is
 * empty while the panel is minimized — no transcript subscription, by design
 * (`../last.ts` argues it for the pill). Then the banner says the conversation
 * and that it is waiting, which is the honest sentence, rather than a stale
 * question from the last time the panel was open.
 *
 * THE TAG is per CONVERSATION and not per question, which is the multi-window
 * discipline the seam asks for (`../../notify.ts`): two tabs of the same olai
 * both fire, and the OS REPLACES a same-tag notification rather than stacking
 * a second one. Per question it would stack — one panel, one "the agent is
 * waiting on you", and a pile of them is noise. What is durable here is the
 * badge, which is a count and says so.
 */

import type { ChatState } from "olai-plugin-chat/wire"
import type { Notice } from "@olai/web/client/notify.ts"
import type { Asked } from "./asked.ts"
import { previewText } from "../last.ts"

/** How much of the question's first line a banner is given. Two lines of a
 *  notification on every platform that draws one; past this the OS truncates
 *  and the choice of where stops being ours. */
const LINE = 140

/** The name a conversation with no name of its own goes by. The agent titles a
 *  session a turn or two in, so a question asked in the first turn is exactly
 *  the case — and the app's own word is what the OS is already labelling the
 *  banner with. Which word THAT is has crossed with the install now: an
 *  installed app's banners wear its manifest's `name`, so the caller hands
 *  the deployment's word in, and this bare `olai` is only what it says until
 *  the server has said. */
const UNNAMED = "olai"

/**
 * The question's opening line, collapsed and clamped — or `undefined` where
 * there are no words at all.
 *
 * `openingLine` and NOT `firstLine`, which `@olai/format` already exports and
 * this client already draws documents with (`document/DocRef.tsx`): that one
 * strips frontmatter and heading marks and answers `""`, so two of the name in
 * one client is a name a reader resolves wrongly.
 *
 * SCANNED rather than split, which is the format's own reason one file over: a
 * `split` allocates every line of a long question to throw all but one away.
 * `previewText` is the pill's clamp (`../last.ts`), reused rather than
 * respelled — what "as much as a small face can draw" means is one decision.
 *
 * Exported for the unit test, which is where the blank-line and clamp cases
 * read as themselves rather than as a banner's second line.
 */
export const openingLine = (text: string): string | undefined => {
  let from = 0
  while (from <= text.length) {
    const end = text.indexOf("\n", from)
    const said = previewText(text.slice(from, end === -1 ? undefined : end), LINE)
    if (said !== "") return said
    if (end === -1) return undefined
    from = end + 1
  }
  return undefined
}

/** What to say about a conversation that is waiting on somebody.
 *
 * `called` is what this DEPLOYMENT is called (`../../named.ts`'s signal) —
 * an unanswered conversation is named after the app, and which app this is
 * carries the box since `app.get` crossed: an installed window's banner is
 * labelled `olai [machine]` by the OS, and the line under it should agree. */
export const noticeOf = (
  state: Pick<ChatState, "session" | "asking">,
  asked: Asked | undefined,
  called?: string,
): Notice => ({
  tag: `olai:awaiting:${state.session?.id ?? ""}`,
  title: state.session?.title ?? called ?? UNNAMED,
  body: bodyOf(state.asking, asked),
  data: { kind: "ask" },
})

/** The line under the name. The question if we have it, the plain fact if we
 *  do not — and the OTHERS counted in either case, because a person deciding
 *  whether to get up is owed the size of what is waiting. */
const bodyOf = (asking: number, asked: Asked | undefined): string => {
  const others = Math.max(0, asking - 1)
  const more = others === 0 ? "" : ` (and ${others} more)`
  const line = asked === undefined ? undefined : openingLine(asked.text)
  return line === undefined
    ? `is waiting on your answer${more}`
    : `${line}${more}`
}
