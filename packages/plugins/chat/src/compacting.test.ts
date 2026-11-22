/**
 * WHERE A CHAT'S AGENT IS TOLD TO COMPACT — what one bring-up opens an engine
 * with, given the chat's `compact-at` policy and whether the engine can be told.
 *
 * Read from inside the spawn: the fixture agent writes down the `_meta` its
 * session open carried and which variables its environment holds, so what is
 * asserted is what reached the agent rather than the arguments the panel meant
 * to pass. The engine's capability here is a made-up one in the shape every
 * engine's is (`@olai/plugin-api`'s `Registering.compacting`): a leg whose
 * open says the number, and one variable to take away. The real engine's
 * answer is its own package's bench.
 */

import { collector } from "@olai/log/testlib"
import { afterEach, beforeEach, expect, test } from "bun:test"
import { Effect, References } from "effect"
import { existsSync, mkdtempSync, readFileSync, rmSync } from "node:fs"
import { tmpdir } from "node:os"
import { join } from "node:path"

import { FORWARDS, QUEUES } from "@kolu/acp-client/testlib"
import type { Installed } from "./agents/roster.ts"
import { seated } from "./agents/roster.testlib.ts"
import { makePanel } from "./chat.ts"
import { volatile } from "./memory.ts"

const FIXTURE = join(import.meta.dirname, "fixtures", "compaction-agent.ts")

/** What a host might export that would override the number, and what the
 *  engine strips from every spawn of its own accord. */
const OVERRIDE = "OLAI_TEST_COMPACT_OVERRIDE"
const OWN = "OLAI_TEST_ENGINE_STRIPS"

let cwd = ""
let report = ""
const was = {
  state: process.env["XDG_STATE_HOME"],
  override: process.env[OVERRIDE],
  own: process.env[OWN],
}

const restore = (name: string, value: string | undefined): void => {
  if (value === undefined) delete process.env[name]
  else process.env[name] = value
}

beforeEach(() => {
  cwd = mkdtempSync(join(tmpdir(), "olai-compacting-"))
  report = join(cwd, "opened.jsonl")
  process.env["XDG_STATE_HOME"] = cwd
  process.env[OVERRIDE] = "1"
  process.env[OWN] = "1"
})

afterEach(() => {
  restore("XDG_STATE_HOME", was.state)
  restore(OVERRIDE, was.override)
  restore(OWN, was.own)
  rmSync(cwd, { recursive: true, force: true })
})

const run = <A, E>(effect: Effect.Effect<A, E>): Promise<A> =>
  Effect.runPromise(
    effect.pipe(
      Effect.provideService(References.MinimumLogLevel, "Info"),
      Effect.provide(collector().layer),
    ),
  )

const engine = (capable: boolean): Installed => ({
  id: "engine",
  name: "Engine",
  adapter: { command: process.execPath, args: [FIXTURE, report, OVERRIDE, OWN], unset: [OWN] },
  leg: QUEUES,
  prompt: { kind: "first-turn" },
  // THE CAPABILITY: the registered leg with an open that carries the number it
  // was asked for, and one variable to take away.
  ...(capable
    ? {
      compacting: (tokens: number) => ({
        leg: { ...QUEUES, rawMessages: { ...FORWARDS.rawMessages!, openMeta: { compactAt: tokens } } },
        unset: [OVERRIDE],
      }),
    }
    : {}),
})

interface Opened {
  readonly meta: unknown
  readonly seen: ReadonlyArray<string>
}

/** One bring-up — the boot's, since one engine is not a choice — and the
 *  session it opens, as the agent reported it. */
const openedWith = async (row: Installed, compactAt: number | null): Promise<Opened> => {
  const panel = await run(makePanel({
    roster: () => [seated(row)],
    cwd,
    tools: () => null,
    memory: volatile(),
    compactAt,
    onState: () => {},
    onTranscript: () => {},
  }))
  try {
    await run(panel.start)
    const deadline = Date.now() + 8_000
    while (!existsSync(report) && Date.now() < deadline) await run(Effect.sleep("20 millis"))
    const line = existsSync(report) ? readFileSync(report, "utf8").split("\n")[0] : undefined
    if (line === undefined || line === "") throw new Error("the agent never reported a session open")
    return JSON.parse(line) as Opened
  } finally {
    await run(panel.stop)
  }
}

test("an engine that can be told, with the policy on, is opened at the number without the overriding variable", async () => {
  const opened = await openedWith(engine(true), 300_000)
  expect(opened.meta).toEqual({ compactAt: 300_000 })
  // THE ENGINE'S OWN STRIP STILL HOLDS: the capability's variables are added
  // to the adapter's `unset`, not put in its place.
  expect(opened.seen).toEqual([])
})

test("the policy off opens the engine as registered, and the host's variable reaches it", async () => {
  const opened = await openedWith(engine(true), null)
  expect(opened.meta).toBeNull()
  expect(opened.seen).toEqual([OVERRIDE])
})

test("an engine that cannot be told is opened as registered with the policy on", async () => {
  const opened = await openedWith(engine(false), 200_000)
  expect(opened.meta).toBeNull()
  expect(opened.seen).toEqual([OVERRIDE])
})
