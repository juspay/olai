import { expect, test } from "bun:test"

import { makeClient } from "./client.ts"
import {
  classify,
  laneOf,
  makeMirror,
  skipHeartbeat,
  trimTo,
} from "./mirror.ts"
import { listen } from "./testlib/fake-spaces.ts"

test("classify names the digest kinds the human ruled", () => {
  expect(classify("Lane dispatched: **CI joins the conversation**")).toBe("dispatched")
  expect(classify("Review verdict: 2 MUST, 4 SHOULD, 1 NIT")).toBe("review")
  expect(classify("CI settled green on #97")).toBe("ci")
  expect(classify("PR #456 merged. author 2h 10m · review 40m")).toBe("merged")
  expect(classify("One terminal claimed by lanes.olai is waiting on a person, and the step that claims it is doing — a report or a block is owed:")).toBe("stuck")
  expect(classify("the odu#97 CI watcher is idle: it has finished, or it needs you.")).toBe("stuck")
  expect(classify("an ordinary orchestrator paragraph")).toBe("note")
})

test("a kolu heartbeat is not a digest", () => {
  expect(skipHeartbeat(
    "The kolu watcher is alive: 30 minutes with nothing to say about the 4 terminals lanes.olai claims.",
  )).toBe(true)
  expect(skipHeartbeat("Lane dispatched: foo")).toBe(false)
})

test("laneOf reads the dispatched title, else the first bold, else general", () => {
  expect(laneOf("Lane dispatched: **CI joins the conversation**")).toBe("CI joins the conversation")
  expect(laneOf("Review verdict on **CI joins the conversation**: 1 MUST")).toBe(
    "CI joins the conversation",
  )
  expect(laneOf("an unattributed note")).toBe("general")
})

test("trimTo caps at N characters and ellipsises", () => {
  expect(trimTo("short", 500)).toBe("short")
  expect(trimTo("abcdefghij", 5)).toBe("abcde…")
})

test("the first digest for a lane opens a thread; later ones reply into it", async () => {
  const spaces = await listen()
  try {
    const client = makeClient(spaces.url, "test-token", undefined)
    const faults: Array<string> = []
    const mirror = makeMirror({
      client,
      channel: "ch-team",
      now: () => "2026-09-01T12:00:00Z",
      deliverFault: (body) => faults.push(body),
    })
    await mirror.postDigest("Lane dispatched: **odu doorbell**")
    await mirror.postDigest("the odu doorbell author is idle: it needs you.")
    expect(spaces.requests).toHaveLength(2)
    const first = spaces.requests[0]?.body as Record<string, unknown>
    const second = spaces.requests[1]?.body as Record<string, unknown>
    expect(spaces.requests[0]?.path).toBe("/api/apps/chat/postMessage")
    expect(spaces.requests[0]?.authorization).toBe("Bearer test-token")
    expect(first.channelId).toBe("ch-team")
    expect(first.markdownText).toContain("Lane dispatched")
    expect(first.conversationId).toBeUndefined()
    expect(second.conversationId).toBe("conv-1")
    expect(faults).toEqual([])
  } finally {
    spaces.close()
  }
})

test("a CI digest is posted once, then edited in place", async () => {
  const spaces = await listen()
  try {
    const client = makeClient(spaces.url, "test-token", undefined)
    const mirror = makeMirror({
      client,
      channel: "ch-team",
      now: () => "2026-09-01T12:00:00Z",
      deliverFault: () => {},
    })
    await mirror.postDigest("Lane dispatched: **odu doorbell**")
    await mirror.postDigest("CI settled red on #97 — odu doorbell")
    await mirror.postDigest("CI settled green on #97 — odu doorbell")
    expect(spaces.requests.map((r) => r.path)).toEqual([
      "/api/apps/chat/postMessage",
      "/api/apps/chat/postMessage",
      "/api/apps/chat/updateMessage",
    ])
    const update = spaces.requests[2]?.body as Record<string, unknown>
    expect(update.messageId).toBe("msg-2")
    expect(update.markdownText).toContain("green")
  } finally {
    spaces.close()
  }
})

test("a refused post is said once; digests queue and post in order on recovery", async () => {
  const spaces = await listen()
  try {
    const client = makeClient(spaces.url, "test-token", undefined)
    const faults: Array<string> = []
    const mirror = makeMirror({
      client,
      channel: "ch-team",
      now: () => "2026-09-01T16:41:00Z",
      deliverFault: (body) => faults.push(body),
    })
    spaces.down(401, "Authentication failed")
    await mirror.postDigest("Lane dispatched: **first**")
    await mirror.postDigest("Lane dispatched: **second**")
    expect(mirror.queued()).toHaveLength(2)
    expect(faults).toHaveLength(1)
    expect(faults[0]).toContain("Authentication failed")
    expect(faults[0]).toContain("Said once")
    spaces.up()
    await mirror.postDigest("Lane dispatched: **third**")
    expect(mirror.queued()).toHaveLength(0)
    expect(mirror.faulted()).toBe(false)
    expect(faults).toHaveLength(2)
    expect(faults[1]).toContain("3 queued")
    const posts = spaces.requests.filter((r) => r.path === "/api/apps/chat/postMessage")
    // two refused while down, then the three in order once the token works
    expect(posts).toHaveLength(5)
    expect((posts[2]?.body as { markdownText: string }).markdownText).toContain("first")
    expect((posts[3]?.body as { markdownText: string }).markdownText).toContain("second")
    expect((posts[4]?.body as { markdownText: string }).markdownText).toContain("third")
  } finally {
    spaces.close()
  }
})

test("orchestrator replies post trimmed; agentProgress rides the last thread", async () => {
  const spaces = await listen()
  try {
    const client = makeClient(spaces.url, "test-token", undefined)
    const mirror = makeMirror({
      client,
      channel: "ch-team",
      now: () => "2026-09-01T12:00:00Z",
      deliverFault: () => {},
    })
    await mirror.postDigest("Lane dispatched: **odu doorbell**")
    await mirror.postReply("x".repeat(600), 500)
    await mirror.progress("working", "s-1")
    await mirror.progress("done", "s-1")
    const reply = spaces.requests[1]?.body as Record<string, unknown>
    expect(typeof reply.markdownText).toBe("string")
    expect((reply.markdownText as string).length).toBe(501)
    expect((reply.markdownText as string).endsWith("…")).toBe(true)
    expect(spaces.requests[2]?.path).toBe("/api/apps/chat/agentProgress")
    const progress = spaces.requests[2]?.body as Record<string, unknown>
    expect(progress.status).toBe("working")
    expect(progress.conversationId).toBe("conv-1")
    expect(progress.sessionId).toBe("s-1")
    expect(progress.agentSlug).toBe("olai")
    expect(spaces.requests[3]?.body).toMatchObject({ status: "done" })
  } finally {
    spaces.close()
  }
})
