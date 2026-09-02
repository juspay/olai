/**
 * The server half, driven through a fake Spaces and a fake watching bus —
 * never the human's live instance.
 *
 * ## It mounts the plugin rather than calling a function
 *
 * `serve(services)` was a function this file called with a blob of doubles, and
 * the half handed back a `revision` hook, an `unloaded` hook and a `link()` for
 * the bench to read. None of those exists: the half is a Cordis plugin, so the
 * bench builds a CONTEXT with double services on it, mounts the plugin, emits
 * `vault/revision` and reads the pill off the cell the browser reads.
 *
 * What that buys is that the cases drive the path a serve drives. The old shape
 * could pass with a `revision` hook nothing called and an `unloaded` that tore
 * down the wrong things — which it did: `unloaded` stopped the watching
 * subscription and every mirror, and `unloaded` means the STORE has never
 * published, not that this plugin is going away.
 */

import { mkdtempSync } from "node:fs"
import { tmpdir } from "node:os"
import { join } from "node:path"

import { readingOf, setOf } from "@olai/format/testlib"
import type { ConversationSeen, Deliveries, PluginHeld } from "@olai/plugin-api"
import type { SpacesLink } from "./wire.ts"
import {
  Clock,
  DeliveryDoors,
  Env,
  Held,
  Log,
  type Registered,
  Surfaces,
  Vault,
  Watchers,
} from "@olai/plugin-api/services"
import { expect, test } from "bun:test"
import { Context } from "cordis"

import * as spaces from "./server.ts"
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

const memoryHeld = (): PluginHeld => {
  let record: Record<string, unknown> | null = null
  return {
    load: () => record,
    save: (value) => {
      record = value
    },
  }
}

/** What one case hands the services — the same fields the old `Services` blob
 *  carried, now as the config the composition root gives each service. */
interface Doubles {
  readonly env: Record<string, string | undefined>
  readonly served: string
  readonly now: () => string
  readonly warn?: (line: string) => void
  readonly deliver?: Deliveries["deliver"]
  readonly dial?: unknown
  readonly held?: PluginHeld
}

/**
 * ONE MOUNTED PLUGIN, on a context this case owns — what a serve does, with
 * doubles behind the services rather than a machine behind them.
 *
 * `emit` is the composition root's end of the watching bus: `ctx.watching.saw`,
 * which is what `@olai/server`'s `runtime.ts` calls off a transcript frame. The
 * subscription the plugin makes is an effect on its own fiber, so a case that
 * disposes the fiber stops the bus without this harness doing anything.
 */
const mounted = async (doubles: Doubles) => {
  const ctx = new Context()
  await ctx.plugin(Env, { vars: doubles.env, dials: { "xyne-spaces": doubles.dial } })
  await ctx.plugin(Clock, { now: doubles.now })
  await ctx.plugin(Log, { say: () => {}, warn: doubles.warn ?? (() => {}) })
  await ctx.plugin(Vault, { served: doubles.served })
  await ctx.plugin(DeliveryDoors, {
    doorFor: () => ({ scopes: () => [], deliver: doubles.deliver ?? (() => {}) }),
  })
  await ctx.plugin(Held, { doorFor: () => doubles.held ?? memoryHeld() })
  await ctx.plugin(Watchers)
  await ctx.plugin(Surfaces)
  const fiber = ctx.plugin(spaces)
  await fiber.await()
  const sibling = (): Registered => {
    const one = ctx.surfaces.composed()[0]
    if (one === undefined) throw new Error("the spaces plugin registered no sibling")
    return one
  }
  return {
    ctx,
    fiber,
    /** The pill, read off the CELL the browser reads — one reading, so a case
     *  cannot pass while what a person sees is wrong. */
    link: (): SpacesLink => {
      const deps = sibling().deps as {
        cells: { link: { store: { get: () => SpacesLink } } }
      }
      return deps.cells.link.store.get()
    },
    /** A published revision, the way the composition root emits one. The
     *  DEFAULT is the bound board every case but one wants; a case that is
     *  about the bind going away hands its own. */
    revision: (snapshot?: unknown): void => {
      if (snapshot !== undefined) {
        ctx.vault.published(snapshot)
        return
      }
      const reading = readingOf(setOf({
        "board.olai": rec("orch", {
          "agent-session": "claude:s-1",
          "xyne-channel": "ch-team",
        }),
      }))
      ctx.vault.published({
        value: { set: reading.set, derived: reading.derived },
        changed: ["board.olai"],
        removed: [],
      })
    },
    /** ...and one conversation event, the way it pushes one. */
    emit: (event: ConversationSeen): void => {
      ctx.watching.saw(event)
    },
  }
}

test("a doorbell in the bound conversation posts; a heartbeat and this plugin's own words do not", async () => {
  const spaces = await listen()
  const faults: Array<string> = []
  try {
    const half = await mounted({
      env: { OLAI_SPACES_URL: spaces.url, OLAI_SPACES_TOKEN: "tok" },
      served: served(),
      now: () => "2026-09-01T12:00:00Z",
      deliver: (_to, say) => {
        const body = say()
        if (body !== null) faults.push(body)
      },
    })
    half.revision()
    half.emit({
      kind: "delivered",
      id: "d-1",
      from: "kolu",
      agent: "claude",
      session: "s-1",
      body: "Lane dispatched: **odu doorbell**",
    })
    half.emit({
      kind: "delivered",
      id: "d-2",
      from: "kolu",
      agent: "claude",
      session: "s-1",
      body: "The kolu watcher is alive: 30 minutes with nothing to say.",
    })
    half.emit({
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
    await half.fiber.dispose()
  } finally {
    spaces.close()
  }
})

test("a conversation the bind does not name is not mirrored", async () => {
  const spaces = await listen()
  try {
    const half = await mounted({
      env: { OLAI_SPACES_URL: spaces.url, OLAI_SPACES_TOKEN: "tok" },
      served: served(),
      now: () => "2026-09-01T12:00:00Z",
    })
    half.revision()
    half.emit({
      kind: "delivered",
      id: "d-1",
      from: "kolu",
      agent: "opencode",
      session: "other",
      body: "Lane dispatched: **nope**",
    })
    await Bun.sleep(40)
    expect(spaces.requests).toHaveLength(0)
    await half.fiber.dispose()
  } finally {
    spaces.close()
  }
})

test("no env and no bind is honestly absent — nothing is posted", async () => {
  const spaces = await listen()
  try {
    const half = await mounted({
      env: {},
      served: served(),
      now: () => "2026-09-01T12:00:00Z",
    })
    expect(half.link().status).toBe("absent")
    half.emit({
      kind: "delivered",
      id: "d-1",
      from: "kolu",
      agent: "claude",
      session: "s-1",
      body: "Lane dispatched: **x**",
    })
    await Bun.sleep(40)
    expect(spaces.requests).toHaveLength(0)
    expect(half.link().status).toBe("absent")
    await half.fiber.dispose()
  } finally {
    spaces.close()
  }
})

test("a bind without env is a fault, named, and said once into the conversation", async () => {
  const spaces = await listen()
  const faults: Array<string> = []
  try {
    const half = await mounted({
      env: {},
      served: served(),
      now: () => "2026-09-01T12:00:00Z",
      deliver: (_to, say) => {
        const body = say()
        if (body !== null) faults.push(body)
      },
    })
    half.revision()
    expect(half.link().status).toBe("fault")
    expect(half.link().why).toContain("xyne-channel")
    expect(half.link().why).toContain("board.olai")
    expect(half.link().why).toContain("OLAI_SPACES_URL, OLAI_SPACES_TOKEN")
    half.emit({
      kind: "delivered",
      id: "d-1",
      from: "kolu",
      agent: "claude",
      session: "s-1",
      body: "Lane dispatched: **x**",
    })
    await Bun.sleep(40)
    expect(spaces.requests).toHaveLength(0)
    expect(faults).toHaveLength(1)
    expect(faults[0]).toContain("xyne-channel")
    expect(faults[0]).toContain("board.olai")
    expect(faults[0]).toContain("OLAI_SPACES_URL, OLAI_SPACES_TOKEN")
    await half.fiber.dispose()
  } finally {
    spaces.close()
  }
})

test("dropping the bind without env returns the pill to absent", async () => {
  const half = await mounted({
    env: {},
    served: served(),
    now: () => "2026-09-01T12:00:00Z",
  })
  half.revision()
  expect(half.link().status).toBe("fault")
  const empty = readingOf(setOf({}))
  half.revision({
    value: { set: empty.set, derived: empty.derived },
    changed: [],
    removed: ["board.olai"],
  })
  expect(half.link().status).toBe("absent")
  await half.fiber.dispose()
})

