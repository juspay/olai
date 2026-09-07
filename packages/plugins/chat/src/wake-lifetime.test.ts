import { definePlugin, mountPlugin, openPlugins, Offers, Deliveries } from "@olai/plugin-api/services"
import { deliveryProvision } from "./server/deliveries.ts"
import { afterEach, beforeEach, expect, test } from "bun:test"
import { Deferred, Effect } from "effect"
import type { NodeAgent } from "@olai/format"
import type { Wake } from "@olai/plugin-api/services"
import { mkdtempSync, rmSync, symlinkSync } from "node:fs"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { QUEUES } from "./agents/legs.testlib.ts"
import { ephemeralLocalState, type ChatLocalState, MemoryFailure } from "./local.ts"
import { make } from "./scoped.ts"
import { forLocalState, ROWS, type Scopes } from "./scopes.ts"
import { faultedIn } from "./server/doorbell.ts"

const run = <A, E>(work: Effect.Effect<A, E>) => Effect.runPromise(work)
const until = async (ready: () => boolean) => {
  for (let i = 0; i < 400; i++) {
    if (ready()) return
    await run(Effect.sleep("20 millis"))
  }
  throw new Error("conversation did not reach the expected state")
}
let cwd: string
beforeEach(() => { cwd = mkdtempSync(join(tmpdir(), "olai-wake-lifetime-")) })
afterEach(() => { rmSync(cwd, { recursive: true, force: true }) })
const TO = { agent: "alpha", session: "one-session" }
const NODE: NodeAgent = { id: "one", file: "Work.olai", title: "one", engine: "alpha", session: TO.session, memory: 2 }
const WAKE: Wake = {
  subject: "activity", from: "files", waiting: { one: "one", many: "many" }, kinds: ["outline"],
  faults: { gone: "obsolete missing-file warning", unwatchable: "wrong kind" },
}
const bench = async (options: {
  scoping?: Scopes
  local?: ChatLocalState
  blockStartup?: boolean
  command?: () => string
  wake?: () => Wake | undefined
  ticket?: () => void
} = {}) => {
  const entered = await run(Deferred.make<void>())
  const release = await run(Deferred.make<void>())
  const scoping = options.scoping ?? await run(forLocalState(options.local ?? ephemeralLocalState()))
  let nodes = [NODE]
  const chat = await run(make({
    cwd, scoping, fork: Effect.runFork,
    roster: () => [{ id: "alpha", name: "alpha", adapter: {
      command: options.command?.() ?? process.execPath, args: [join(import.meta.dirname, "fixtures/doorbell-agent.ts")],
    }, leg: QUEUES, prompt: { kind: "first-turn" } }],
    engines: () => ["alpha"], tools: () => null,
    wake: options.wake ?? ((plugin) => plugin !== "agenda" ? WAKE : undefined),
    nodes: () => nodes, nodeAt: (id) => nodes.find((node) => node.id === id) ?? null,
    seatableAt: () => true,
    nearestAt: (id, candidates) => candidates.has(id) ? id : null,
    agentAt: ({ agent, session }) => nodes.find((node) => node.engine === agent && node.session === session) ?? null,
    ticket: () => { options.ticket?.(); return { bearer: "", release: () => {} } },
    probes: () => Effect.gen(function*() {
      yield* Deferred.succeed(entered, undefined)
      if (options.blockStartup) yield* Deferred.await(release)
      return []
    }),
    onState: () => {}, onTranscript: () => {},
  }))
  return {
    chat, scoping, entered,
    release: () => run(Deferred.succeed(release, undefined)),
    unassign: () => { nodes = []; chat.reread() },
    recipient: (plugin = "kolu") => chat.doorFor(plugin).scopes()[0]!,
    text: () => JSON.stringify([...chat.entries().values()]),
  }
}

for (const replacement of [null, "Other.olai", "Work.olai"]) {
  for (const fault of [false, true]) {
    test(`${fault ? "missing-file warning" : "wake"} loses authority during startup on pick ${replacement}`, async () => {
      const it = await bench({ blockStartup: true })
      try {
        await run(it.chat.scope(TO, "kolu", "Work.olai"))
        const delivery = fault
          ? run(faultedIn(it.chat, { served: () => false, declared: new Map([["kolu", WAKE]]) }))
          : run(it.chat.doorFor("kolu").deliver(it.recipient(), () => "obsolete wake"))
        await run(Deferred.await(it.entered))
        await run(it.chat.scope(TO, "kolu", replacement))
        await it.release()
        await delivery
        await run(it.chat.loadSession(TO.agent, TO.session))
        expect(it.text()).not.toContain("obsolete")
      } finally { await it.release(); await run(it.chat.stop) }
    }, 20_000)
  }
}

for (const replacement of [null, "Other.olai", "Work.olai"]) {
  test(`recipients retained by a plugin are revoked by pick ${replacement}`, async () => {
    const it = await bench()
    try {
      await run(it.chat.loadSession(TO.agent, TO.session))
      await run(it.chat.scope(TO, "kolu", "Work.olai"))
      const old = it.recipient()
      await run(it.chat.scope(TO, "kolu", replacement))
      await run(it.chat.doorFor("kolu").deliver(old, () => "obsolete recipient"))
      await run(it.chat.doorFor("kolu").deliver(TO, () => "bare address bypass"))
      expect(it.text()).not.toContain("obsolete")
      expect(it.text()).not.toContain("bare address bypass")
      await run(it.chat.doorFor("agenda").deliver(it.chat.doorFor("agenda").scopes()[0]!, () => "delivery-only still works"))
      expect(it.text()).toContain("delivery-only still works")
    } finally { await run(it.chat.stop) }
  }, 20_000)
}

test("a choice's authority survives transfer to the unassigned panel, but not a repick", async () => {
  const it = await bench()
  try {
    await run(it.chat.scope(TO, "kolu", "Work.olai"))
    const delivery = it.chat.doorFor("kolu").deliver(it.recipient(), () => "obsolete transfer")
    it.unassign()
    await run(it.chat.scope(TO, "kolu", "Other.olai"))
    await run(delivery)
    await run(it.chat.loadSession(TO.agent, TO.session))
    expect(it.text()).not.toContain("obsolete transfer")
  } finally { await run(it.chat.stop) }
}, 20_000)

test("failed startup cannot requeue a revoked choice", async () => {
  const executable = join(cwd, "retry-agent")
  const minted = Promise.withResolvers<void>()
  const it = await bench({ ticket: minted.resolve, command: () => executable })
  try {
    await run(it.chat.scope(TO, "kolu", "Work.olai"))
    const delivery = run(it.chat.doorFor("kolu").deliver(it.recipient(), () => "obsolete retry"))
    await minted.promise
    await run(it.chat.scope(TO, "kolu", "Other.olai"))
    await it.release()
    await delivery
    symlinkSync(process.execPath, executable)
    await run(it.chat.loadSession(TO.agent, TO.session))
    expect(it.text()).not.toContain("obsolete retry")
  } finally { await run(it.chat.stop) }
}, 20_000)

test("a successful clear discards work admitted during its filesystem write", async () => {
  const stored = ephemeralLocalState()
  const writing = await run(Deferred.make<void>())
  const release = await run(Deferred.make<void>())
  let block = false
  const it = await bench({ local: {
    load: stored.load,
    save: (section, value) => Effect.gen(function*() {
      if (block) { yield* Deferred.succeed(writing, undefined); yield* Deferred.await(release) }
      yield* stored.save(section, value)
    }),
  } })
  try {
    await run(it.chat.loadSession(TO.agent, TO.session))
    await run(it.chat.scope(TO, "kolu", "Work.olai"))
    const recipient = it.recipient()
    await run(it.chat.send("wait:5000", [], []))
    block = true
    const clearing = run(it.chat.scope(TO, "kolu", null))
    await run(Deferred.await(writing))
    await run(it.chat.doorFor("kolu").deliver(recipient, () => "obsolete write-window"))
    await run(Deferred.succeed(release, undefined))
    await clearing
    await run(it.chat.cancel)
    await until(() => it.chat.state().status === "idle")
    expect(it.text()).not.toContain("obsolete write-window")
  } finally { await run(Deferred.succeed(release, undefined)); await run(it.chat.stop) }
}, 20_000)

test("the 33rd pick refreshes another panel and physically removes its evicted inbox", async () => {
  const scoping = await run(forLocalState(ephemeralLocalState()))
  let checks = 0
  const it = await bench({ scoping: { ...scoping, recipient: (row) => {
    const recipient = scoping.recipient(row)
    return { ...recipient, current: () => { checks++; return recipient.current() } }
  } } })
  try {
    await run(it.chat.loadSession(TO.agent, TO.session))
    await run(it.chat.scope(TO, "kolu", "Work.olai"))
    for (let i = 1; i < ROWS; i++) {
      await run(it.chat.scope({ agent: "alpha", session: `other-${i}` }, "kolu", "Work.olai"))
    }
    await run(it.chat.send("wait:5000", [], []))
    await run(it.chat.doorFor("kolu").deliver(it.recipient(), () => "evicted inbox"))
    expect(it.chat.state().wake[0]?.waiting).toBe(1)
    // This write goes through root; the active node panel owns the oldest inbox.
    await run(it.chat.scope({ agent: "alpha", session: "thirty-three" }, "kolu", "Other.olai"))
    expect(it.chat.state().wake).toEqual([])
    checks = 0
    await run(it.chat.cancel)
    await until(() => it.chat.state().status === "idle")
    expect(it.text()).not.toContain("evicted inbox")
    // A retained but unauthorized thunk is still a retained inbox. Require its
    // eager removal, independently of the final authorization safety net.
    expect(checks).toBe(0)
  } finally { await run(it.chat.stop) }
}, 20_000)

test("a refused choice write preserves authority, while fault marking and healing do not replace it", async () => {
  const stored = ephemeralLocalState()
  let fail = false
  const scoping = await run(forLocalState({ load: stored.load, save: (section, value) =>
    fail ? Effect.fail(new MemoryFailure({ why: "read-only" })) : stored.save(section, value),
  }))
  await run(scoping.set(TO, "kolu", "Work.olai"))
  const recipient = scoping.recipient(scoping.rows()[0]!)
  const allowed = recipient.current
  expect({ ...recipient }.current()).toBe(true)
  await run(scoping.faults(() => "gone", () => true))
  expect(allowed()).toBe(true)
  await run(scoping.faults(() => null, () => true))
  expect(allowed()).toBe(true)
  fail = true
  expect((await run(Effect.result(scoping.set(TO, "kolu", null))))._tag).toBe("Failure")
  expect(allowed()).toBe(true)
  fail = false
  await run(scoping.set(TO, "kolu", "Work.olai"))
  expect(allowed()).toBe(false)
})


test("Cordis disposal revokes queued work, retained recipients and fresh calls through the old service", async () => {
  const it = await bench()
  try {
    await run(it.chat.loadSession(TO.agent, TO.session))
    await run(it.chat.scope(TO, "kolu", "Work.olai"))
    await run(Effect.scoped(Effect.gen(function*() {
      const { host } = yield* openPlugins({})
      yield* mountPlugin(host, definePlugin({ name: "chat", needs: [Offers], apply: Effect.gen(function*() {
        yield* (yield* Offers).offer(Deliveries, deliveryProvision(() => it.chat, () => new Map([["kolu", WAKE]])))
      }) }))
      const doors: Deliveries[] = []
      const plugin = definePlugin({ name: "kolu", needs: [Deliveries], apply: Effect.gen(function*() {
        doors.push(yield* Deliveries)
      }) })
      const mounted = yield* mountPlugin(host, plugin)
      const old = doors[0]!
      const recipient = old.scopes()[0]!
      yield* it.chat.send("wait:5000", [], [])
      yield* old.deliver(recipient, () => "obsolete queued activation")
      expect(it.chat.state().wake[0]?.waiting).toBe(1)
      yield* mounted.dispose
      yield* mountPlugin(host, plugin)
      const fresh = doors[1]!
      expect(old.scopes()).toEqual([])
      expect(old.ringing("Work.olai", "one")).toEqual([])
      expect(recipient.current()).toBe(false)
      expect(fresh.scopes()[0]?.file).toBe("Work.olai")
      yield* old.deliver(fresh.scopes()[0]!, () => "obsolete service")
      yield* old.notify(TO, () => "obsolete addressed service")
      yield* fresh.deliver(recipient, () => "obsolete recipient in new activation")
      yield* fresh.notify(TO, () => "obsolete wake bypass")
      yield* it.chat.cancel
    })))
    await until(() => it.chat.state().status === "idle")
    expect(it.text()).not.toContain("obsolete")
  } finally { await run(it.chat.stop) }
}, 20_000)

test("a wake declaration leaving and returning revokes a queued missing-file warning", async () => {
  let activation: Wake | undefined = WAKE
  const it = await bench({ wake: () => activation })
  try {
    await run(it.chat.loadSession(TO.agent, TO.session))
    await run(it.chat.scope(TO, "kolu", "Work.olai"))
    await run(it.chat.send("wait:5000", [], []))
    await run(faultedIn(it.chat, { served: () => false, declared: new Map([["kolu", WAKE]]) }))
    expect(it.chat.state().wake[0]?.waiting).toBe(1)
    activation = undefined
    activation = { ...WAKE }
    await run(it.chat.cancel)
    await until(() => it.chat.state().status === "idle")
    expect(it.text()).not.toContain("obsolete")
    expect(it.scoping.rows()[0]?.file).toBe("Work.olai")
  } finally { await run(it.chat.stop) }
}, 20_000)


test("delivery-only addressed notices work and expire with their consumer", async () => {
  const it = await bench()
  try {
    await run(it.chat.loadSession(TO.agent, TO.session))
    await run(Effect.scoped(Effect.gen(function*() {
      const { host } = yield* openPlugins({})
      yield* mountPlugin(host, definePlugin({ name: "chat", needs: [Offers], apply: Effect.gen(function*() {
        yield* (yield* Offers).offer(Deliveries, deliveryProvision(() => it.chat, () => new Map()))
      }) }))
      let door!: Deliveries
      const mounted = yield* mountPlugin(host, definePlugin({ name: "agenda", needs: [Deliveries], apply: Effect.gen(function*() {
        door = yield* Deliveries
      }) }))
      yield* door.notify(TO, () => "addressed notice delivered")
      expect(it.text()).toContain("addressed notice delivered")
      yield* Effect.promise(() => until(() => it.chat.state().status === "idle"))
      yield* it.chat.send("wait:5000", [], [])
      yield* door.notify(TO, () => "obsolete addressed notice")
      yield* mounted.dispose
      yield* door.notify(TO, () => "obsolete disposed call")
      yield* it.chat.cancel
    })))
    await until(() => it.chat.state().status === "idle")
    expect(it.text()).not.toContain("obsolete")
  } finally { await run(it.chat.stop) }
}, 20_000)


test("registering a selectable wake revokes recipients issued before its declaration", async () => {
  let activation: Wake | undefined
  const it = await bench({ wake: () => activation })
  try {
    const recipient = it.recipient()
    expect(recipient.current()).toBe(true)
    activation = WAKE
    expect(recipient.current()).toBe(false)
    expect(it.chat.doorFor("kolu").scopes()).toEqual([])
    await run(it.chat.doorFor("kolu").deliver(recipient, () => "before the picker existed"))
    expect(it.chat.live().size).toBe(0)
  } finally { await run(it.chat.stop) }
})
