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
 * THE TAG is per CONVERSATION and not per question, and that is the multi-
 * window discipline the framework's seam asks for (`@kolu/surface-app/notify`):
 * two tabs of the same olai both fire, and the OS REPLACES a same-tag banner
 * rather than stacking a second one. Per question it would stack — one panel,
 * one "the agent is waiting on you", and a pile of them is noise. What is
 * durable here is the badge, which is a count and says so.
 */

import type { ChatState } from "@olai/surface"

import type { Asked } from "./asked.ts"
import { previewText } from "../last.ts"

/**
 * What clicking the banner asks for: this conversation, at whatever it is
 * waiting on.
 *
 * A struct with one word in it rather than a bare string, because it is what
 * the framework hands BACK through the worker, from a banner that may be older
 * than the tab reading it: {@link askedFor} is the gate that keeps a
 * pre-upgrade shape — or the `{}` a degraded worker substitutes — from being
 * mis-routed as this one.
 *
 * It does NOT name a question, and that is a decision rather than an omission.
 * A press means "the agent is waiting on me, take me there", and what is
 * waiting is a fact the panel has when the press lands and the banner did not
 * necessarily have when it was raised — a question can be answered in another
 * tab in between, and a banner raised over a shut panel never knew which row it
 * was about at all. So the panel answers with what is waiting NOW, which is
 * both simpler and more often right than a row id from five minutes ago.
 */
export interface AskClick {
  readonly kind: "ask"
}

/** Read a click envelope the worker relayed, or `undefined` for anything that
 *  is not one of ours. Handed to `createNotify` as its validator, so a stale
 *  or empty payload is dropped loudly rather than routed. */
export const askedFor = (data: unknown): AskClick | undefined => {
  if (typeof data !== "object" || data === null) return undefined
  return (data as { kind?: unknown }).kind === "ask" ? { kind: "ask" } : undefined
}

/** A banner, as the seam takes it. */
export interface Notice {
  /** The dedup key — same tag, same banner replaced. Per conversation. */
  readonly tag: string
  readonly title: string
  readonly body: string
  readonly data: AskClick
}

/** How much of the question's first line a banner is given. Two lines of a
 *  notification on every platform that draws one; past this the OS truncates
 *  and the choice of where stops being ours. */
const LINE = 140

/** The name a conversation with no name of its own goes by. The agent titles a
 *  session a turn or two in, so a question asked in the first turn is exactly
 *  the case — and "olai" is what the OS is already labelling the banner with,
 *  so the line reads as the app rather than as an empty box. */
const UNNAMED = "olai"

/** The question's opening line, collapsed and clamped — or `undefined` where
 *  there are no words at all. `previewText` is the pill's clamp (`../last.ts`),
 *  reused rather than respelled: what "as much as a small face can draw" means
 *  is one decision. Exported for the unit test, which is where the blank-line
 *  and clamp cases read as themselves rather than as a banner's second line. */
export const firstLine = (text: string): string | undefined => {
  for (const line of text.split("\n")) {
    const said = previewText(line, LINE)
    if (said !== "") return said
  }
  return undefined
}

/** What to say about a conversation that is waiting on somebody. */
export const noticeOf = (
  state: Pick<ChatState, "session" | "asking">,
  asked: Asked | undefined,
): Notice => ({
  tag: `olai:awaiting:${state.session?.id ?? ""}`,
  title: state.session?.title ?? UNNAMED,
  body: bodyOf(state.asking, asked),
  data: { kind: "ask" },
})

/** The line under the name. The question if we have it, the plain fact if we
 *  do not — and the OTHERS counted in either case, because a person deciding
 *  whether to get up is owed the size of what is waiting. */
const bodyOf = (asking: number, asked: Asked | undefined): string => {
  const others = Math.max(0, asking - 1)
  const more = others === 0 ? "" : others === 1 ? " (and 1 more)" : ` (and ${others} more)`
  const line = asked === undefined ? undefined : firstLine(asked.text)
  return line === undefined
    ? `is waiting on your answer${more}`
    : `${line}${more}`
}
