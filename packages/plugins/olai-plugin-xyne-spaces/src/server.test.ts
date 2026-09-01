/**
 * The server half, driven through a fake Spaces and a fake watching bus —
 * never the human's live instance.
 */

import { mkdtempSync } from "node:fs"
import { tmpdir } from "node:os"
import { join } from "node:path"

import { readingOf, setOf } from "@olai/format/testlib"
import { expect, test } from "bun:test"

import { serve, type ConversationSeen, type Services } from "./server.ts"
import { listen } from "./testlib/fake-spaces.ts"

const served = (): string => mkdtempSync(join(tmpdir(), "spaces-served-"))

const rec = (title: string, fields: Record<string, string>): string =>
  `{"id":${JSON.stringify(title)},"ord":"a0","title":${JSON.stringify(title)},"custom":${
    JSON.stringify(fields)
  }}`

const waitFor = async (n: () => number, want: number): Promise<void> => {
  for (let i = 0; i < 80; i++) {
    if (n() >= want) return
    await Bun.sleep(10)
  }
  throw new Error(`wanted ${want} events, got ${n()}`)
}

const bus = (): {
  readonly watching: Services["watching"]
  readonly emit: (event: ConversationSeen) => void
} => {
  const handlers = new Set<(event: ConversationSeen) => void>()
  return {
    watching: {
      subscribe: (handler) => {
        handlers.add(handler)
        return () => {
          handlers.delete(handler)
        }
      },
    },
    emit: (event) => {
      for (const handler of handlers) handler(event)
    },
  }
}

const bind = (half: ReturnType<typeof serve>): void => {
  const reading = readingOf(setOf({
    "_olai/Spaces.olai": rec("mirror", {
      channel: "ch-team",
      agent: "claude",
      session: "s-1",
    }),
  }))
  half.revision({
    value: { set: reading.set, derived: reading.derived },
    changed: ["_olai/Spaces.olai"],
    removed: [],
  })
}

test("a doorbell in the bound conversation posts; a heartbeat and this plugin's own words do not", async () => {
  const spaces = await listen()
  const { watching, emit } = bus()
  const faults: Array<string> = []
  try {
    const half = serve({
      env: { OLAI_SPACES_URL: spaces.url, OLAI_SPACES_TOKEN: "tok" },
      served: served(),
      now: () => "2026-09-01T12:00:00Z",
      say: () => {},
      warn: () => {},
      deliveries: {
        scopes: () => [],
        deliver: (_to, say) => {
          const body = say()
          if (body !== null) faults.push(body)
        },
      },
      watching,
    })
    bind(half)
    emit({
      kind: "delivered",
      id: "d-1",
      from: "kolu",
      agent: "claude",
      session: "s-1",
      body: "Lane dispatched: **odu doorbell**",
    })
    emit({
      kind: "delivered",
      id: "d-2",
      from: "kolu",
      agent: "claude",
      session: "s-1",
      body: "The kolu watcher is alive: 30 minutes with nothing to say.",
    })
    emit({
      kind: "delivered",
      id: "d-3",
      from: "xyne-spaces",
      agent: "claude",
      session: "s-1",
      body: "mirroring is down: should never echo",
    })
    await waitFor(() => spaces.requests.length, 1)
    await Bun.sleep(30)
    expect(spaces.requests).toHaveLength(1)
    expect((spaces.requests[0]?.body as { markdownText: string }).markdownText).toContain(
      "Lane dispatched",
    )
    expect(faults).toEqual([])
    half.unloaded()
  } finally {
    spaces.close()
  }
})

test("a conversation the bind does not name is not mirrored", async () => {
  const spaces = await listen()
  const { watching, emit } = bus()
  try {
    const half = serve({
      env: { OLAI_SPACES_URL: spaces.url, OLAI_SPACES_TOKEN: "tok" },
      served: served(),
      now: () => "2026-09-01T12:00:00Z",
      say: () => {},
      warn: () => {},
      deliveries: { scopes: () => [], deliver: () => {} },
      watching,
    })
    bind(half)
    emit({
      kind: "delivered",
      id: "d-1",
      from: "kolu",
      agent: "opencode",
      session: "other",
      body: "Lane dispatched: **nope**",
    })
    await Bun.sleep(40)
    expect(spaces.requests).toHaveLength(0)
    half.unloaded()
  } finally {
    spaces.close()
  }
})

test("no env is honestly absent — nothing is posted", async () => {
  const spaces = await listen()
  const { watching, emit } = bus()
  try {
    const half = serve({
      env: {},
      served: served(),
      now: () => "2026-09-01T12:00:00Z",
      say: () => {},
      warn: () => {},
      deliveries: { scopes: () => [], deliver: () => {} },
      watching,
    })
    bind(half)
    emit({
      kind: "delivered",
      id: "d-1",
      from: "kolu",
      agent: "claude",
      session: "s-1",
      body: "Lane dispatched: **x**",
    })
    await Bun.sleep(40)
    expect(spaces.requests).toHaveLength(0)
    half.unloaded()
  } finally {
    spaces.close()
  }
})

