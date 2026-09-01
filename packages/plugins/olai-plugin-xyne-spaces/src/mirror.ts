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
 * ## One thread per bound conversation
 *
 * The thread key is the olai `(agent, session)` pair that rides the watching
 * event. The first digest opens a Spaces Conversation (postMessage without
 * `conversationId`). Later digests reply into it. The CI message is EDITED
 * IN PLACE on first-red → final via updateMessage; a later CI still queued
 * replaces the earlier so recovery cannot post two.
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
    readonly lane: string
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
 * THE LANE A DIGEST BELONGS TO — the bound olai conversation, not a title
 * parsed out of the digest. A regex over prose the plugin does not control
 * opened a second thread the moment a later CI line carried a different bold
 * span (`**#460**` after `Lane dispatched: **X**`). The conversation pair
 * already rides the watching event; that is the unit.
 */
export const laneOf = (agent: string, session: string): string => `${agent}/${session}`

const closeOpenFence = (text: string): string => {
  const fences = text.match(/^```/gm)?.length ?? 0
  return fences % 2 === 1 ? `${text}\n\`\`\`` : text
}

/** Cap on Unicode code points, never UTF-16 code units, and close a fence
 *  the cut left open so Spaces does not render structure the orchestrator
 *  never wrote. */
export const trimTo = (text: string, cap: number): string => {
  const points = [...text]
  if (points.length <= cap) return text
  return `${closeOpenFence(points.slice(0, cap).join(""))}…`
}

export const faultBody = (why: string, at: string): string =>
  [
    `mirroring is down: Spaces refused a post (${why}) at ${at}.`,
    "",
    "Written by olai's spaces mirror, not by a person.",
    "",
    "Said once — not repeated per message. Digests queue here and post when the token works again; fix OLAI_SPACES_TOKEN (or the channel id in _olai/Spaces.olai) and the queue retries on its own.",
  ].join("\n")

export const recoveredBody = (count: number, channel: string, at: string): string =>
  `token accepted again — ${count} queued digest${count === 1 ? "" : "s"} posted to the bound channel (${channel}) at ${at}, in order.`

export interface HeldSnapshot {
  readonly channel: string
  readonly lastLane: string
  readonly threads: ReadonlyArray<readonly [string, Thread]>
  readonly queue: ReadonlyArray<Outbound>
}

export interface MirrorDeps {
  readonly client: SpacesClient
  readonly channel: string
  readonly now: () => string
  readonly deliverFault: (body: string, coalesce: "fault" | "recovered") => void
  readonly onRecovered: () => void
  readonly hold?: {
    readonly load: () => HeldSnapshot | undefined
    readonly save: (held: HeldSnapshot) => void
  }
  /** How long to wait before retrying a stuck queue. Tests pass a short beat. */
  readonly retryMs?: number
}

export interface Mirror {
  readonly postDigest: (text: string, lane: string, cap: number) => Promise<void>
  readonly postReply: (text: string, lane: string, cap: number) => Promise<void>
  readonly progress: (
    status: "working" | "done",
    sessionId: string | undefined,
  ) => Promise<void>
  readonly threads: () => ReadonlyMap<string, Thread>
  readonly queued: () => ReadonlyArray<Outbound>
  readonly faulted: () => boolean
  readonly stop: () => void
}

const QUEUE_CAP = 32

const retryable = (status: number): boolean =>
  status === 0 || status === 401 || status === 403 || status === 408 || status === 429
  || status >= 500

export const makeMirror = (deps: MirrorDeps): Mirror => {
  const threads = new Map<string, Thread>()
  const queue: Array<Outbound> = []
  let saidFault = false
  let lastLane = "general"
  let retry: ReturnType<typeof setTimeout> | undefined
  const retryMs = deps.retryMs ?? 15_000

  const loaded = deps.hold?.load()
  if (loaded !== undefined && loaded.channel === deps.channel) {
    for (const [lane, thread] of loaded.threads) threads.set(lane, thread)
    queue.push(...loaded.queue)
    lastLane = loaded.lastLane
  }

  const persist = (): void => {
    deps.hold?.save({
      channel: deps.channel,
      lastLane,
      threads: [...threads.entries()],
      queue: [...queue],
    })
  }

  const fail = (why: string): void => {
    if (saidFault) return
    saidFault = true
    deps.deliverFault(faultBody(why, deps.now()), "fault")
  }

  const succeed = (drained: number): void => {
    if (!saidFault) return
    saidFault = false
    deps.onRecovered()
    if (drained > 0) deps.deliverFault(recoveredBody(drained, deps.channel, deps.now()), "recovered")
  }

  type Verdict = "ok" | "retry" | "drop" | { readonly repost: Outbound }

  const send = async (item: Outbound): Promise<Verdict> => {
    if (item.op === "update") {
      const result = await deps.client.updateMessage({
        messageId: item.messageId,
        markdownText: item.text,
        channelId: deps.channel,
      })
      if (!result.ok) {
        fail(result.refused.why)
        if (result.refused.status === 404) {
          return {
            repost: { op: "post", lane: item.lane, kind: "ci", text: item.text },
          }
        }
        return retryable(result.refused.status) ? "retry" : "drop"
      }
      return "ok"
    }
    const thread = threads.get(item.lane)
    const result = await deps.client.postMessage({
      channelId: deps.channel,
      markdownText: item.text,
      conversationId: thread?.conversationId,
    })
    if (!result.ok) {
      fail(result.refused.why)
      return retryable(result.refused.status) ? "retry" : "drop"
    }
    threads.set(item.lane, {
      conversationId: thread?.conversationId ?? result.posted.conversationId,
      ciMessageId: item.kind === "ci" ? result.posted.messageId : thread?.ciMessageId,
    })
    lastLane = item.lane
    return "ok"
  }

  const schedule = (): void => {
    if (retry !== undefined || queue.length === 0) return
    retry = setTimeout(() => {
      retry = undefined
      void drainAndRecover()
    }, retryMs)
  }

  const drain = async (): Promise<number> => {
    let n = 0
    while (queue.length > 0) {
      const next = queue[0]
      if (next === undefined) break
      const verdict = await send(next)
      if (verdict === "retry") {
        schedule()
        return n
      }
      if (typeof verdict === "object") {
        queue[0] = verdict.repost
        persist()
        schedule()
        return n
      }
      queue.shift()
      persist()
      if (verdict === "ok") n += 1
    }
    return n
  }

  const drainAndRecover = async (): Promise<void> => {
    const drained = await drain()
    if (queue.length === 0) succeed(drained)
    persist()
  }

  const enqueue = async (item: Outbound): Promise<void> => {
    const drained = await drain()
    if (queue.length > 0) {
      while (queue.length >= QUEUE_CAP) queue.shift()
      queue.push(item)
      persist()
      schedule()
      return
    }
    const verdict = await send(item)
    if (verdict === "ok") {
      succeed(drained)
      persist()
      return
    }
    if (verdict === "drop") {
      persist()
      return
    }
    queue.push(typeof verdict === "object" ? verdict.repost : item)
    persist()
    schedule()
  }

  /** A later CI result for the same lane replaces an earlier one still queued,
   *  so recovery posts one message, not first-red and final as two. */
  const replaceQueuedCi = (lane: string, text: string): boolean => {
    const index = queue.findIndex((item) =>
      item.lane === lane && (item.op === "update" || (item.op === "post" && item.kind === "ci"))
    )
    if (index < 0) return false
    const current = queue[index]
    if (current === undefined) return false
    queue[index] = current.op === "update"
      ? { ...current, text }
      : { ...current, text }
    persist()
    return true
  }

  return {
    postDigest: async (text, lane, cap) => {
      const kind = classify(text)
      const trimmed = trimTo(text, cap)
      const thread = threads.get(lane)
      if (kind === "ci" && replaceQueuedCi(lane, trimmed)) return
      if (kind === "ci" && thread?.ciMessageId !== undefined) {
        await enqueue({ op: "update", lane, messageId: thread.ciMessageId, text: trimmed })
        return
      }
      await enqueue({ op: "post", lane, kind, text: trimmed })
    },
    postReply: async (text, lane, cap) => {
      await enqueue({ op: "post", lane, kind: classify(text), text: trimTo(text, cap) })
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
    stop: () => {
      if (retry !== undefined) {
        clearTimeout(retry)
        retry = undefined
      }
    },
  }
}
