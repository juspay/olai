/**
 * The server half, driven through a fake Spaces and a fake watching bus —
 * never the human's live instance.
 *
 * ## It mounts the plugin rather than calling a function
 *
 * `serve(services)` was a function this file called with a blob of doubles, and
 * the half handed back a `revision` hook, an `unloaded` hook and a `link()` for
 * the bench to read. None of those exists: the half is a plugin, so the bench
 * opens a RUNTIME with double services on it, mounts the plugin, rings
 * `plugins.published(…)` and reads the pill off the cell the browser reads.
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
import { mountPlugin, openPlugins, type Registered, standing } from "@olai/plugin-api/services"
import { expect, test } from "bun:test"
import { Effect, Scope } from "effect"

import spaces from "./server.ts"
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
  readonly deliver?: Deliveries["deliver"]
  readonly dial?: unknown
  readonly held?: PluginHeld
}

/**
 * ONE MOUNTED PLUGIN, on a runtime this case owns — what a serve does, with
 * doubles behind the services rather than a machine behind them.
 *
 * `emit` is the composition root's end of the watching bus (`plugins.saw`),
 * which is what `@olai/server`'s `runtime.ts` rings off a transcript frame. The
 * subscription the plugin makes is a finalizer on its own scope, so a case that
 * disposes the plugin stops the bus without this harness doing anything.
 *
 * ## The Effects are run at the EDGE, and the cases stay promises
 *
 * `openPlugins` and the two doors are Effects; a case is an ordinary `async`
 * test. So the harness holds one scope for the whole case and runs each door as
 * a promise — which is also what makes a case AWAIT a revision, and that is the
 * honest shape rather than a convenience: the root awaits every plugin's
 * re-derivation before the statement that published it returns.
 */
const mounted = async (doubles: Doubles) => {
  const run = standing()
  const held = doubles.held ?? memoryHeld()
  const plugins = await run(openPlugins({
    vars: doubles.env,
    now: doubles.now,
    served: doubles.served,
    dials: { "xyne-spaces": doubles.dial },
    doorFor: () => ({
      scopes: () => [],
      ringing: () => [],
      deliver: doubles.deliver ?? (() => Effect.void),
    }),
    heldFor: () => held,
  }))
  const plugin = await run(mountPlugin(plugins.host, spaces))
  const sibling = (): Registered => {
    const one = plugins.composed()[0]
    if (one === undefined) throw new Error("the spaces plugin registered no sibling")
    return one
  }
  return {
    /** The pill, read off the CELL the browser reads — one reading, so a case
     *  cannot pass while what a person sees is wrong. */
    link: (): SpacesLink => {
      const deps = sibling().deps as {
        cells: { link: { store: { get: () => SpacesLink } } }
      }
      return deps.cells.link.store.get()
    },
    /** A published revision, the way the composition root rings one. The DEFAULT
     *  is the bound board every case but one wants; a case that is about the bind
     *  going away hands its own. */
    revision: (snapshot?: unknown): Promise<void> => {
      if (snapshot !== undefined) return run(plugins.published(snapshot))
      const reading = readingOf(setOf({
        "board.olai": rec("orch", {
          "agent-session": "claude:s-1",
          "xyne-channel": "ch-team",
        }),
      }))
      return run(plugins.published({
        value: { set: reading.set, derived: reading.derived },
        changed: ["board.olai"],
        removed: [],
      }))
    },
    /** ...and one conversation event, the way it pushes one. */
    emit: (event: ConversationSeen): Promise<void> => run(plugins.saw(event)),
    /** ...and the plugin going away, which is what every case ends with: the
     *  mirrors stop, the subscription comes off the bus, and the sibling leaves
     *  the table. */
    dispose: (): Promise<void> => run(plugin.dispose),
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
      deliver: (_to, say) =>
        Effect.sync(() => {
          const body = say()
          if (body !== null) faults.push(body)
        }),
    })
    await half.revision()
    await half.emit({
      kind: "delivered",
      id: "d-1",
      from: "kolu",
      agent: "claude",
      session: "s-1",
      body: "Lane dispatched: **odu doorbell**",
    })
    await half.emit({
      kind: "delivered",
      id: "d-2",
      from: "kolu",
      agent: "claude",
      session: "s-1",
      body: "The kolu watcher is alive: 30 minutes with nothing to say.",
    })
    await half.emit({
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
    await half.dispose()
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
    await half.revision()
    await half.emit({
      kind: "delivered",
      id: "d-1",
      from: "kolu",
      agent: "opencode",
      session: "other",
      body: "Lane dispatched: **nope**",
    })
    await Bun.sleep(40)
    expect(spaces.requests).toHaveLength(0)
    await half.dispose()
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
    await half.emit({
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
    await half.dispose()
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
      deliver: (_to, say) =>
        Effect.sync(() => {
          const body = say()
          if (body !== null) faults.push(body)
        }),
    })
    await half.revision()
    expect(half.link().status).toBe("fault")
    expect(half.link().why).toContain("xyne-channel")
    expect(half.link().why).toContain("board.olai")
    expect(half.link().why).toContain("OLAI_SPACES_URL, OLAI_SPACES_TOKEN")
    await half.emit({
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
    await half.dispose()
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
  await half.revision()
  expect(half.link().status).toBe("fault")
  const empty = readingOf(setOf({}))
  await half.revision({
    value: { set: empty.set, derived: empty.derived },
    changed: [],
    removed: ["board.olai"],
  })
  expect(half.link().status).toBe("absent")
  await half.dispose()
})
