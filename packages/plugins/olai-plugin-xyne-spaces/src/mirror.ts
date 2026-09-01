/**
 * WHAT GETS POSTED, and how — digest classification, the ~500-char trim,
 * one thread per lane, CI edited in place, the queue-on-failure.
 *
 * ## Digest level (the human's ruling)
 *
 * Roughly 5–8 messages per PR, never the firehose: lane dispatched, review
 * verdict, CI result, merged, stuck/needs-human. A kolu heartbeat is not
 * one of those and is dropped. Other doorbell deliveries still post — they
 * are already rare. Orchestrator replies ALL mirror, trimmed to the cap.
 *
 * ## One thread per lane
 *
 * The lane's first digest opens a Spaces Conversation (postMessage without
 * `conversationId`). Later digests reply into it. The CI message is EDITED
 * IN PLACE on first-red → final via updateMessage, never posted twice.
 *
 * ## Failure honesty
 *
 * A refused post is said ONCE into the olai conversation (the doorbell
 * fault pattern). Digests queue and post in order on recovery. Progress
 * signals are ephemeral and are not queued.
 */

import type { SpacesClient } from "./client.ts"

export type DigestKind = "dispatched" | "review" | "ci" | "merged" | "stuck" | "note"

export interface Thread {
  readonly conversationId: string
  readonly ciMessageId: string | undefined
}

export type Outbound =
  | {
    readonly op: "post"
    readonly lane: string
    readonly kind: DigestKind
    readonly text: string
  }
  | {
    readonly op: "update"
    readonly messageId: string
    readonly text: string
  }

const HEARTBEAT = /watcher is alive/i
const DISPATCHED = /lane dispatched/i
const REVIEW = /review verdict|\bMUST\b.+\bSHOULD\b|\bNIT\b/i
const CI = /\bci\b/i
const CI_RESULT = /\bci\b.+\b(green|red|ok|failed|settled|result)\b|\b(green|red|ok|failed|settled).+\bci\b/i
const MERGED = /\bmerged\b/i
const STUCK = /waiting on a person|needs (a |your )?word|stuck|report or a block is owed|needs you/i

export const skipHeartbeat = (body: string): boolean => HEARTBEAT.test(body)

export const classify = (text: string): DigestKind => {
  if (DISPATCHED.test(text)) return "dispatched"
  if (REVIEW.test(text)) return "review"
  if (CI_RESULT.test(text) || (CI.test(text) && /\b(green|red|ok|failed|settled)\b/i.test(text))) {
    return "ci"
  }
  if (MERGED.test(text)) return "merged"
  if (STUCK.test(text)) return "stuck"
  return "note"
}

/**
 * THE LANE A DIGEST BELONGS TO — one thread per lane, so the key has to be
 * stable across the dispatched / CI / merged sequence for the same work.
 *
 * First match wins: an explicit "Lane dispatched: **title**", then a doorbell
 * essence ("the X is idle"), then the first bold span, then `"general"`.
 */
export const laneOf = (text: string): string => {
  const dispatched = /Lane dispatched:\s*(?:\*\*)?([^*\n]+?)(?:\*\*)?\s*$/im.exec(text)
  if (dispatched?.[1] !== undefined) return dispatched[1].trim()
  const bold = /\*\*(.+?)\*\*/.exec(text)
  if (bold?.[1] !== undefined) return bold[1].trim()
  return "general"
}

export const trimTo = (text: string, cap: number): string => {
  if (text.length <= cap) return text
  return `${text.slice(0, cap)}…`
}

export const faultBody = (why: string, at: string): string =>
  [
    `mirroring is down: Spaces refused a post (${why}) at ${at}.`,
    "",
    "Written by olai's spaces mirror, not by a person.",
    "",
    "Said once — not repeated per message. Digests queue here and post when the token works again; fix OLAI_SPACES_TOKEN (or the channel id in _olai/Spaces.olai) and the next post retries.",
  ].join("\n")

export const recoveredBody = (count: number, channel: string, at: string): string =>
  `token accepted again — ${count} queued digest${count === 1 ? "" : "s"} posted to the bound channel (${channel}) at ${at}, in order.`

export interface MirrorDeps {
  readonly client: SpacesClient
  readonly channel: string
  readonly now: () => string
  readonly deliverFault: (body: string) => void
}

export interface Mirror {
  readonly postDigest: (text: string) => Promise<void>
  readonly postReply: (text: string, cap: number) => Promise<void>
  readonly progress: (
    status: "working" | "done",
    sessionId: string | undefined,
  ) => Promise<void>
  readonly threads: () => ReadonlyMap<string, Thread>
  readonly queued: () => ReadonlyArray<Outbound>
  readonly faulted: () => boolean
}

export const makeMirror = (deps: MirrorDeps): Mirror => {
  const threads = new Map<string, Thread>()
  const queue: Array<Outbound> = []
  let saidFault = false
  let lastLane = "general"

  const laneFor = (text: string): string => {
    const lane = laneOf(text)
    return lane === "general" && lastLane !== "general" ? lastLane : lane
  }

  const fail = (why: string): void => {
    if (saidFault) return
    saidFault = true
    deps.deliverFault(faultBody(why, deps.now()))
  }

  const succeed = (drained: number): void => {
    if (!saidFault) return
    saidFault = false
    if (drained > 0) deps.deliverFault(recoveredBody(drained, deps.channel, deps.now()))
  }

  const send = async (item: Outbound): Promise<boolean> => {
    if (item.op === "update") {
      const result = await deps.client.updateMessage({
        messageId: item.messageId,
        markdownText: item.text,
      })
      if (!result.ok) {
        fail(result.refused.why)
        return false
      }
      return true
    }
    const thread = threads.get(item.lane)
    const result = await deps.client.postMessage({
      channelId: deps.channel,
      markdownText: item.text,
      conversationId: thread?.conversationId,
    })
    if (!result.ok) {
      fail(result.refused.why)
      return false
    }
    threads.set(item.lane, {
      conversationId: thread?.conversationId ?? result.posted.conversationId,
      ciMessageId: item.kind === "ci" ? result.posted.messageId : thread?.ciMessageId,
    })
    lastLane = item.lane
    return true
  }

  const drain = async (): Promise<number> => {
    let n = 0
    while (queue.length > 0) {
      const next = queue[0]
      if (next === undefined) break
      const ok = await send(next)
      if (!ok) return n
      queue.shift()
      n += 1
    }
    return n
  }

  const enqueue = async (item: Outbound): Promise<void> => {
    const drained = await drain()
    if (queue.length > 0) {
      queue.push(item)
      return
    }
    const ok = await send(item)
    if (ok) succeed(drained + 1)
    else queue.push(item)
  }

  return {
    postDigest: async (text) => {
      const kind = classify(text)
      const lane = laneFor(text)
      const thread = threads.get(lane)
      if (kind === "ci" && thread?.ciMessageId !== undefined) {
        await enqueue({ op: "update", messageId: thread.ciMessageId, text })
        return
      }
      await enqueue({ op: "post", lane, kind, text })
    },
    postReply: async (text, cap) => {
      const trimmed = trimTo(text, cap)
      const kind = classify(text)
      const lane = laneFor(text)
      await enqueue({ op: "post", lane, kind, text: trimmed })
    },
    progress: async (status, sessionId) => {
      const thread = threads.get(lastLane)
      if (thread === undefined) return
      const result = await deps.client.agentProgress({
        conversationId: thread.conversationId,
        channelId: deps.channel,
        status,
        sessionId,
      })
      if (!result.ok) fail(result.refused.why)
    },
    threads: () => threads,
    queued: () => queue,
    faulted: () => saidFault,
  }
}
