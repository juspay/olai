/**
 * The dial, pinned against a fake Spaces: auth header, postMessage body,
 * thread reply, updateMessage, agentProgress.
 */

import { expect, test } from "bun:test"

import { makeClient } from "./client.ts"
import { listen } from "./testlib/fake-spaces.ts"

test("postMessage sends Bearer auth, channelId, markdownText; omits conversationId on the opener", async () => {
  const spaces = await listen()
  try {
    const client = makeClient(spaces.url, "jwt-token", undefined)
    const result = await client.postMessage({
      channelId: "ch-team",
      markdownText: "Lane dispatched: **x**",
    })
    expect(result.ok).toBe(true)
    if (result.ok) {
      expect(result.posted.conversationId).toBe("conv-1")
      expect(result.posted.messageId).toBe("msg-1")
    }
    expect(spaces.requests).toHaveLength(1)
    const req = spaces.requests[0]
    expect(req?.method).toBe("POST")
    expect(req?.path).toBe("/api/apps/chat/postMessage")
    expect(req?.authorization).toBe("Bearer jwt-token")
    expect(req?.body).toEqual({
      channelId: "ch-team",
      markdownText: "Lane dispatched: **x**",
    })
  } finally {
    spaces.close()
  }
})

test("a thread reply carries conversationId", async () => {
  const spaces = await listen()
  try {
    const client = makeClient(spaces.url, "jwt-token", undefined)
    await client.postMessage({
      channelId: "ch-team",
      markdownText: "later",
      conversationId: "conv-held",
    })
    expect(spaces.requests[0]?.body).toEqual({
      channelId: "ch-team",
      markdownText: "later",
      conversationId: "conv-held",
    })
  } finally {
    spaces.close()
  }
})

test("updateMessage edits in place by messageId and carries channelId", async () => {
  const spaces = await listen()
  try {
    const client = makeClient(spaces.url, "jwt-token", undefined)
    await client.updateMessage({
      messageId: "msg-9",
      markdownText: "CI settled green",
      channelId: "ch-team",
    })
    expect(spaces.requests[0]?.path).toBe("/api/apps/chat/updateMessage")
    expect(spaces.requests[0]?.authorization).toBe("Bearer jwt-token")
    expect(spaces.requests[0]?.body).toEqual({
      messageId: "msg-9",
      markdownText: "CI settled green",
      channelId: "ch-team",
    })
  } finally {
    spaces.close()
  }
})

test("updateMessage without channel context is 400, matching the real refine", async () => {
  const spaces = await listen()
  try {
    const client = makeClient(spaces.url, "jwt-token", undefined)
    const result = await client.updateMessage({
      messageId: "msg-9",
      markdownText: "CI settled green",
      channelId: "",
    })
    expect(result.ok).toBe(false)
    if (!result.ok) {
      expect(result.refused.status).toBe(400)
      expect(result.refused.why).toContain("Validation error")
    }
  } finally {
    spaces.close()
  }
})

test("postMessage without markdownText is 400", async () => {
  const spaces = await listen()
  try {
    const client = makeClient(spaces.url, "jwt-token", undefined)
    const result = await client.postMessage({ channelId: "ch-team", markdownText: "" })
    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.refused.status).toBe(400)
  } finally {
    spaces.close()
  }
})

test("updateMessage without messageId is 400", async () => {
  const spaces = await listen()
  try {
    const client = makeClient(spaces.url, "jwt-token", undefined)
    const result = await client.updateMessage({
      messageId: "",
      markdownText: "x",
      channelId: "ch-team",
    })
    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.refused.status).toBe(400)
  } finally {
    spaces.close()
  }
})

test("agentProgress without conversationId is 400", async () => {
  const spaces = await listen()
  try {
    const client = makeClient(spaces.url, "jwt-token", undefined)
    const result = await client.agentProgress({
      conversationId: "",
      channelId: "ch-team",
      status: "working",
    })
    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.refused.status).toBe(400)
  } finally {
    spaces.close()
  }
})

test("an unknown channel is 404 Channel not found", async () => {
  const spaces = await listen()
  try {
    const client = makeClient(spaces.url, "jwt-token", undefined)
    const result = await client.postMessage({
      channelId: "no-such-channel",
      markdownText: "Lane dispatched: **x**",
    })
    expect(result.ok).toBe(false)
    if (!result.ok) {
      expect(result.refused.status).toBe(404)
      expect(result.refused.why).toContain("Channel not found")
    }
  } finally {
    spaces.close()
  }
})

test("a closed Spaces is a refusal, not an unhandled rejection", async () => {
  const spaces = await listen()
  const url = spaces.url
  spaces.close()
  const client = makeClient(url, "jwt-token", undefined)
  const result = await client.postMessage({ channelId: "ch", markdownText: "x" })
  expect(result.ok).toBe(false)
  if (!result.ok) {
    expect(result.refused.status).toBe(0)
    expect(result.refused.why.length).toBeGreaterThan(0)
  }
})

test("agentProgress is ephemeral working/done with the app token", async () => {
  const spaces = await listen()
  try {
    const client = makeClient(spaces.url, "jwt-token", undefined)
    await client.agentProgress({
      conversationId: "conv-1",
      channelId: "ch-team",
      status: "working",
      sessionId: "s-1",
    })
    expect(spaces.requests[0]?.path).toBe("/api/apps/chat/agentProgress")
    expect(spaces.requests[0]?.authorization).toBe("Bearer jwt-token")
    expect(spaces.requests[0]?.body).toEqual({
      conversationId: "conv-1",
      channelId: "ch-team",
      status: "working",
      agentSlug: "olai",
      sessionId: "s-1",
    })
  } finally {
    spaces.close()
  }
})

test("a 401 is a refused post, not a thrown error", async () => {
  const spaces = await listen()
  try {
    const client = makeClient(spaces.url, "jwt-token", undefined)
    spaces.failNext(401, "Authentication failed")
    const result = await client.postMessage({ channelId: "ch", markdownText: "x" })
    expect(result.ok).toBe(false)
    if (!result.ok) {
      expect(result.refused.status).toBe(401)
      expect(result.refused.why).toContain("Authentication failed")
    }
  } finally {
    spaces.close()
  }
})
