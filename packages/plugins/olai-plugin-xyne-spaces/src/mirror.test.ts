import { expect, test } from "bun:test"

import { makeClient } from "./client.ts"
import {
  classify,
  laneOf,
  makeMirror,
  QUEUE_CAP,
  skipHeartbeat,
  trimTo,
  type MirrorDeps,
} from "./mirror.ts"
import { listen } from "./testlib/fake-spaces.ts"

const LANE = laneOf("claude", "s-1")

const mirrorOf = (
  client: ReturnType<typeof makeClient>,
  over: Partial<MirrorDeps> = {},
) =>
  makeMirror({
    client,
    channel: "ch-team",
    now: () => "2026-09-01T12:00:00Z",
    deliverFault: () => {},
    onRecovered: () => {},
    ...over,
  })

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

test("laneOf is the conversation pair, not a bold span in the digest", () => {
  expect(laneOf("claude", "s-1")).toBe("claude/s-1")
  expect(laneOf("opencode", "other")).toBe("opencode/other")
})

test("trimTo caps on code points and closes an open fence", () => {
  expect(trimTo("short", 500)).toBe("short")
  expect(trimTo("abcdefghij", 5)).toBe("abcde…")
  expect(trimTo("👍👍👍", 2)).toBe("👍👍…")
  expect(trimTo("before\n```js\nconst x = 1", 80)).toBe("before\n```js\nconst x = 1")
  const cut = trimTo("```js\nconst x = 1\nmore than the cap of this fence body xxx", 20)
  expect(cut.endsWith("…")).toBe(true)
  expect(cut).toContain("```")
  expect((cut.match(/^```/gm) ?? []).length % 2).toBe(0)
})

test("the first digest for a conversation opens a thread; later ones reply into it", async () => {
  const spaces = await listen()
  try {
    const client = makeClient(spaces.url, "test-token", undefined)
    const faults: Array<string> = []
    const mirror = mirrorOf(client, { deliverFault: (body) => faults.push(body) })
    await mirror.postDigest("Lane dispatched: **odu doorbell**", LANE, 500)
    await mirror.postDigest("CI settled red on **#460**", LANE, 500)
    expect(spaces.requests).toHaveLength(2)
    const first = spaces.requests[0]?.body as Record<string, unknown>
    const second = spaces.requests[1]?.body as Record<string, unknown>
    expect(spaces.requests[0]?.path).toBe("/api/apps/chat/postMessage")
    expect(first.conversationId).toBeUndefined()
    expect(second.conversationId).toBe("conv-1")
    expect(faults).toEqual([])
    mirror.stop()
  } finally {
    spaces.close()
  }
})

test("a CI digest is posted once, then edited in place, with channelId on the edit", async () => {
  const spaces = await listen()
  try {
    const client = makeClient(spaces.url, "test-token", undefined)
    const mirror = mirrorOf(client)
    await mirror.postDigest("Lane dispatched: **odu doorbell**", LANE, 500)
    await mirror.postDigest("CI settled red on #97 — odu doorbell", LANE, 500)
    await mirror.postDigest("CI settled green on #97 — odu doorbell", LANE, 500)
    expect(spaces.requests.map((r) => r.path)).toEqual([
      "/api/apps/chat/postMessage",
      "/api/apps/chat/postMessage",
      "/api/apps/chat/updateMessage",
    ])
    const update = spaces.requests[2]?.body as Record<string, unknown>
    expect(update.messageId).toBe("msg-2")
    expect(update.channelId).toBe("ch-team")
    expect(update.markdownText).toContain("green")
    mirror.stop()
  } finally {
    spaces.close()
  }
})

test("CI while faulted coalesces to one post on recovery, not two", async () => {
  const spaces = await listen()
  try {
    const client = makeClient(spaces.url, "test-token", undefined)
    const mirror = mirrorOf(client)
    spaces.down(401, "Authentication failed")
    await mirror.postDigest("CI settled red on #97", LANE, 500)
    await mirror.postDigest("CI settled green on #97", LANE, 500)
    expect(mirror.queued()).toHaveLength(1)
    expect((mirror.queued()[0] as { text: string }).text).toContain("green")
    spaces.up()
    await mirror.postDigest("Lane dispatched: **next**", LANE, 500)
    const posts = spaces.requests.filter((r) => r.path === "/api/apps/chat/postMessage")
    const recovered = posts.filter((r) =>
      typeof (r.body as { markdownText?: string }).markdownText === "string"
      && ((r.body as { markdownText: string }).markdownText.includes("CI settled")
        || (r.body as { markdownText: string }).markdownText.includes("Lane dispatched"))
    )
    const ciPosts = posts.filter((r) =>
      (r.body as { markdownText: string }).markdownText.includes("CI settled")
    )
    expect(ciPosts.length).toBe(2) // one refused while down, one posted on recovery
    expect(recovered.at(-2)?.body).toEqual(expect.objectContaining({
      markdownText: expect.stringContaining("green"),
    }))
    mirror.stop()
  } finally {
    spaces.close()
  }
})

test("a refused post is said once; digests queue and post in order on recovery", async () => {
  const spaces = await listen()
  try {
    const client = makeClient(spaces.url, "test-token", undefined)
    const faults: Array<string> = []
    const mirror = mirrorOf(client, {
      now: () => "2026-09-01T16:41:00Z",
      deliverFault: (body) => faults.push(body),
    })
    spaces.down(401, "Authentication failed")
    await mirror.postDigest("Lane dispatched: **first**", LANE, 500)
    await mirror.postDigest("Lane dispatched: **second**", LANE, 500)
    expect(mirror.queued()).toHaveLength(2)
    expect(faults).toHaveLength(1)
    expect(faults[0]).toContain("Authentication failed")
    expect(faults[0]).toContain("Said once")
    spaces.up()
    await mirror.postDigest("Lane dispatched: **third**", LANE, 500)
    expect(mirror.queued()).toHaveLength(0)
    expect(mirror.faulted()).toBe(false)
    expect(faults).toHaveLength(2)
    expect(faults[1]).toContain("2 queued")
    expect(faults[1]).not.toContain("3 queued")
    const posts = spaces.requests.filter((r) => r.path === "/api/apps/chat/postMessage")
    expect(posts).toHaveLength(5)
    expect((posts[2]?.body as { markdownText: string }).markdownText).toContain("first")
    expect((posts[3]?.body as { markdownText: string }).markdownText).toContain("second")
    expect((posts[4]?.body as { markdownText: string }).markdownText).toContain("third")
    mirror.stop()
  } finally {
    spaces.close()
  }
})

test("the queue retries on its own, without waiting for the next digest", async () => {
  const spaces = await listen()
  try {
    const client = makeClient(spaces.url, "test-token", undefined)
    const faults: Array<string> = []
    const mirror = mirrorOf(client, {
      deliverFault: (body) => faults.push(body),
      retryMs: 20,
    })
    spaces.down(401, "Authentication failed")
    await mirror.postDigest("Lane dispatched: **only**", LANE, 500)
    expect(mirror.queued()).toHaveLength(1)
    spaces.up()
    await Bun.sleep(80)
    expect(mirror.queued()).toHaveLength(0)
    expect(mirror.faulted()).toBe(false)
    expect(faults.some((body) => body.includes("queued"))).toBe(true)
    mirror.stop()
  } finally {
    spaces.close()
  }
})

test("a typo'd channel 404 keeps retrying with the fault said", async () => {
  const spaces = await listen()
  try {
    const client = makeClient(spaces.url, "test-token", undefined)
    const faults: Array<string> = []
    const mirror = mirrorOf(client, {
      channel: "no-such-channel",
      deliverFault: (body) => faults.push(body),
      retryMs: 20,
    })
    await mirror.postDigest("Lane dispatched: **typo**", LANE, 500)
    expect(mirror.queued()).toHaveLength(1)
    expect(mirror.faulted()).toBe(true)
    expect(faults[0]).toContain("Channel not found")
    await Bun.sleep(50)
    expect(mirror.queued()).toHaveLength(1)
    mirror.stop()
  } finally {
    spaces.close()
  }
})

test("a dead thread is forgotten and the digest re-opens one, without a fault", async () => {
  const spaces = await listen()
  try {
    const client = makeClient(spaces.url, "test-token", undefined)
    const faults: Array<string> = []
    const mirror = mirrorOf(client, { deliverFault: (body) => faults.push(body) })
    await mirror.postDigest("Lane dispatched: **first**", LANE, 500)
    const id = mirror.threads().get(LANE)?.conversationId
    expect(id).toBeDefined()
    spaces.dropConversation(id ?? "")
    await mirror.postDigest("Lane dispatched: **second**", LANE, 500)
    expect(faults).toEqual([])
    expect(mirror.threads().get(LANE)?.conversationId).not.toBe(id)
    const posts = spaces.requests.filter((r) => r.path === "/api/apps/chat/postMessage")
    expect(posts).toHaveLength(3)
    expect((posts[2]?.body as { conversationId?: string }).conversationId).toBeUndefined()
    mirror.stop()
  } finally {
    spaces.close()
  }
})

test("overflow of the cap drops the oldest and says so", async () => {
  const spaces = await listen()
  try {
    const client = makeClient(spaces.url, "test-token", undefined)
    const faults: Array<string> = []
    let snapshot: Parameters<NonNullable<MirrorDeps["hold"]>["save"]>[0] | undefined
    const hold = {
      load: () => snapshot,
      save: (held: NonNullable<typeof snapshot>) => {
        snapshot = held
      },
    }
    const mirror = mirrorOf(client, { hold, deliverFault: (body) => faults.push(body) })
    spaces.down(401, "Authentication failed")
    for (let i = 0; i < QUEUE_CAP + 3; i++) {
      await mirror.postDigest(`Lane dispatched: **n${i}**`, LANE, 500)
    }
    expect(mirror.queued()).toHaveLength(QUEUE_CAP)
    expect(faults.some((body) => body.includes("dropped 3") && body.includes(`${QUEUE_CAP}`))).toBe(
      true,
    )
    expect((mirror.queued()[0] as { text: string }).text).toContain("n3")
    expect(snapshot?.droppedTotal).toBe(3)
    mirror.stop()
    const again = mirrorOf(client, { hold, deliverFault: (body) => faults.push(body) })
    await again.postDigest("Lane dispatched: **n-extra**", LANE, 500)
    expect(snapshot?.droppedTotal).toBe(4)
    expect(faults.some((body) => body.includes("dropped 4"))).toBe(true)
    again.stop()
  } finally {
    spaces.close()
  }
})

test("a retry timer defers while a drain is in flight and does not double-post", async () => {
  const spaces = await listen()
  try {
    const client = makeClient(spaces.url, "test-token", undefined)
    const mirror = mirrorOf(client, { retryMs: 25 })
    spaces.down(401, "Authentication failed")
    await mirror.postDigest("Lane dispatched: **A**", LANE, 500)
    await mirror.postDigest("Lane dispatched: **B**", LANE, 500)
    expect(mirror.queued()).toHaveLength(2)
    spaces.slow(70)
    spaces.up()
    const before = spaces.requests.length
    for (let i = 0; i < 80; i++) {
      if (spaces.requests.length > before) break
      await Bun.sleep(5)
    }
    expect(spaces.requests.length).toBeGreaterThan(before)
    await mirror.postDigest("Lane dispatched: **C**", LANE, 500)
    for (let i = 0; i < 80; i++) {
      if (mirror.queued().length === 0) break
      await Bun.sleep(20)
    }
    const after = spaces.requests.slice(before)
      .filter((r) => r.path === "/api/apps/chat/postMessage")
      .map((r) => (r.body as { markdownText: string }).markdownText)
    expect(after.filter((text) => text.includes("**A**")).length).toBe(1)
    expect(after.filter((text) => text.includes("**B**")).length).toBe(1)
    expect(after.filter((text) => text.includes("**C**")).length).toBe(1)
    expect(mirror.queued()).toHaveLength(0)
    mirror.stop()
  } finally {
    spaces.close()
  }
})

test("drain does not double-post when two callers overlap on the await", async () => {
  const spaces = await listen()
  try {
    const client = makeClient(spaces.url, "test-token", undefined)
    const mirror = mirrorOf(client, { retryMs: 60_000 })
    spaces.down(401, "Authentication failed")
    await mirror.postDigest("Lane dispatched: **A**", LANE, 500)
    await mirror.postDigest("Lane dispatched: **B**", LANE, 500)
    spaces.slow(40)
    spaces.up()
    const before = spaces.requests.length
    await Promise.all([
      mirror.postDigest("Lane dispatched: **C**", LANE, 500),
      mirror.postDigest("Lane dispatched: **D**", LANE, 500),
    ])
    const after = spaces.requests.slice(before)
      .filter((r) => r.path === "/api/apps/chat/postMessage")
      .map((r) => (r.body as { markdownText: string }).markdownText)
    expect(after.filter((text) => text.includes("**A**")).length).toBe(1)
    expect(after.filter((text) => text.includes("**B**")).length).toBe(1)
    expect(after.filter((text) => text.includes("**C**")).length).toBe(1)
    expect(after.filter((text) => text.includes("**D**")).length).toBe(1)
    expect(mirror.queued()).toHaveLength(0)
    mirror.stop()
  } finally {
    spaces.close()
  }
})

test("a 4xx other than auth drops the head so the rest of the queue is not wedged", async () => {
  const spaces = await listen()
  try {
    const client = makeClient(spaces.url, "test-token", undefined)
    const mirror = mirrorOf(client)
    spaces.failNext(400, "Bad Request")
    await mirror.postDigest("Lane dispatched: **poison**", LANE, 500)
    await mirror.postDigest("Lane dispatched: **after**", LANE, 500)
    expect(mirror.queued()).toHaveLength(0)
    const posts = spaces.requests.filter((r) => r.path === "/api/apps/chat/postMessage")
    expect(posts.some((r) => (r.body as { markdownText: string }).markdownText.includes("after"))).toBe(true)
    mirror.stop()
  } finally {
    spaces.close()
  }
})

test("orchestrator replies post trimmed; agentProgress rides the last thread", async () => {
  const spaces = await listen()
  try {
    const client = makeClient(spaces.url, "test-token", undefined)
    const mirror = mirrorOf(client)
    await mirror.postDigest("Lane dispatched: **odu doorbell**", LANE, 500)
    await mirror.postReply("x".repeat(600), LANE, 500)
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
    mirror.stop()
  } finally {
    spaces.close()
  }
})

test("threads and queue survive a restart from the hold", async () => {
  const spaces = await listen()
  try {
    const client = makeClient(spaces.url, "test-token", undefined)
    let snapshot: Parameters<NonNullable<MirrorDeps["hold"]>["save"]>[0] | undefined
    const hold = {
      load: () => snapshot,
      save: (held: NonNullable<typeof snapshot>) => {
        snapshot = held
      },
    }
    const first = mirrorOf(client, { hold })
    spaces.down(401, "Authentication failed")
    await first.postDigest("Lane dispatched: **held**", LANE, 500)
    first.stop()
    expect(snapshot?.queue).toHaveLength(1)
    expect(snapshot?.droppedTotal).toBe(0)
    spaces.up()
    const second = mirrorOf(client, { hold })
    expect(second.queued()).toHaveLength(1)
    await second.postDigest("Lane dispatched: **after restart**", LANE, 500)
    expect(second.queued()).toHaveLength(0)
    const posts = spaces.requests.filter((r) => r.path === "/api/apps/chat/postMessage")
    expect(posts.some((r) => (r.body as { markdownText: string }).markdownText.includes("held"))).toBe(true)
    expect(
      posts.some((r) => (r.body as { markdownText: string }).markdownText.includes("after restart")),
    ).toBe(true)
    second.stop()
  } finally {
    spaces.close()
  }
})
