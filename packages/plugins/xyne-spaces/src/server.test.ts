import { openTestPlugins as openPlugins } from "@olai/plugin-api/testlib"
import { mkdtempSync } from "node:fs"
import { tmpdir } from "node:os"
import { join } from "node:path"

import { readingOf, setOf } from "@olai/format/testlib"
import type { ConversationSeen, Deliveries } from "@olai/plugin-api"
import type { SpacesLink } from "./wire.ts"
import {
  definePlugin,
  Deliveries as DeliveriesDoor,
  type LocalState,
  mountPlugin,
  Offers,

  type Registered,
  standing,
  Watching,
} from "@olai/plugin-api/services"
import { expect, test } from "bun:test"
import { Effect, Scope } from "effect"

import { seatingIn } from "./seating.testlib.ts"
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

const memoryLocalState = (): LocalState => {
  let record: Record<string, unknown> | null = null
  return {
    load: Effect.sync(() => record),
    save: (value) => Effect.sync(() => void (record = value)),
    directory: Effect.fail({ _tag: "StateFailure", why: "unused here" }),
  }
}

interface Doubles {
  readonly env: Record<string, string | undefined>
  readonly served: string
  readonly now: () => string
  readonly notify?: Deliveries["notify"]
  readonly dial?: unknown
  readonly localState?: LocalState
}

const mounted = async (doubles: Doubles) => {
  const run = standing()
  const localState = doubles.localState ?? memoryLocalState()
  const plugins = await run(openPlugins({
    vars: doubles.env,
    now: doubles.now,
    served: doubles.served,
    dials: { "xyne-spaces": doubles.dial },
    localStateFor: () => localState,
  }))
  const watchers: Array<(event: ConversationSeen) => Effect.Effect<void>> = []
  await run(mountPlugin(
    plugins.host,
    definePlugin({
      name: "chat",
      needs: [Offers],
      apply: Effect.gen(function*() {
        const offers = yield* Offers
        yield* offers.own("seating", () => ({ in: seatingIn }))
        yield* offers.offer(DeliveriesDoor, () => ({
          scopes: () => [],

          deliver: () => Effect.void,
          notify: doubles.notify ?? (() => Effect.void),
        }))
        yield* offers.offer(Watching, () => ({
          subscribe: (handler) =>
            Effect.acquireRelease(
              Effect.sync(() => {
                watchers.push(handler)
              }),
              () =>
                Effect.sync(() => {
                  const at = watchers.indexOf(handler)
                  if (at >= 0) watchers.splice(at, 1)
                }),
            ),
        }))
      }),
    }),
  ))
  const plugin = await run(mountPlugin(plugins.host, spaces))
  const sibling = (): Registered => {
    const one = plugins.composed()[0]
    if (one === undefined) throw new Error("the spaces plugin registered no sibling")
    return one
  }
  return {
    link: (): SpacesLink => {
      const deps = sibling().deps as {
        cells: { link: { store: { get: () => SpacesLink } } }
      }
      return deps.cells.link.store.get()
    },
    revision: (snapshot?: unknown): Promise<void> => {
      if (snapshot !== undefined) return run(plugins.published(snapshot))
      const reading = readingOf(setOf({
        "board.olai": rec("orch", {
          "chat-agent-session": "claude:s-1",
          "xyne-channel": "ch-team",
        }),
      }))
      return run(plugins.published({
        value: { set: reading.set, derived: reading.derived },
        changed: ["board.olai"],
        removed: [],
      }))
    },
    emit: (event: ConversationSeen): Promise<void> =>
      run(Effect.forEach(watchers, (handler) => handler(event), { discard: true })),
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
      notify: (_to, say) =>
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
      notify: (_to, say) =>
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
