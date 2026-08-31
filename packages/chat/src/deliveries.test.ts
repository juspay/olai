/**
 * The three arms a plugin's sentence can take into a conversation, driven
 * through the real thing.
 *
 * `turns.test.ts` and `transcript.test.ts` are pure value tests because their
 * rules are values. These are not: which arm a body takes is decided under two
 * semaphores, against a live subprocess, at a turn boundary — so the assertions
 * here run a real agent over a fixture script the way `lifecycle.test.ts` does,
 * and read the rows the panel would draw.
 *
 * ## THE ONE THAT MATTERS MOST
 *
 * "a doorbell does not spend the interruption a person has not spent", below.
 * `begin` withdraws steering from a conversation FOREVER the first time a
 * prompt goes out alongside a running turn — the pinned adapter hangs a steered
 * turn in any session that has once queued one — and `chat.ts` states the cost
 * verbatim: after one message queued, this conversation has no interruption for
 * the rest of its life. A machine spending that on somebody's behalf, silently
 * and permanently, is the defect this whole shape exists to make unreachable,
 * and it is unreachable BY CONSTRUCTION rather than by care: the `turns.busy`
 * re-read sits inside the same permit `turns.open` is only ever called under.
 * The test is what says the construction is still there.
 *
 * Its twin lives in `lifecycle.test.ts` — a person's own mid-turn message DOES
 * withdraw it — because an assertion that a bit stayed `true` is worth only as
 * much as the proof that something can turn it `false`.
 */

import { afterEach, beforeEach, describe, expect, test } from "bun:test"
import type { UserEntry } from "@olai/surface"
import { Effect } from "effect"
import { mkdtempSync, rmSync } from "node:fs"
import { tmpdir } from "node:os"
import { join } from "node:path"

import { OPENCODE } from "./agents/opencode.ts"
import type { Leg } from "./agents/leg.ts"
import type { Installed } from "./agents/roster.ts"
import { type Chat, make as makeChat } from "./chat.ts"
import { SLOTS } from "./deliveries.ts"
import type { Scoped, Scopes } from "./scopes.ts"
import { MemoryFailure } from "./memory.ts"

const FIXTURE = join(import.meta.dirname, "fixtures", "doorbell-agent.ts")

/**
 * opencode's leg with STEERING ADVERTISED, and nothing else changed.
 *
 * The latch this file is mostly about is only readable through
 * `Talking.steers`, which is `advertises.steers && !queuedHere` — so an agent
 * that offers no interruption makes the assertion vacuous whichever way the
 * latch goes. Nothing here ever steers (`send`'s flag is `false` and a doorbell
 * has no gesture behind it), so the method below is never called: what the leg
 * supplies is the ADVERTISEMENT, which is the input the panel draws its control
 * from.
 */
const STEERS: Leg = {
  ...OPENCODE,
  steering: {
    method: "_session/steering",
    meta: undefined,
    timeout: "30 seconds",
    taken: () => true,
    advertised: () => true,
  },
}

const ROW: Installed = {
  id: "opencode",
  name: "opencode",
  adapter: { command: process.execPath, args: [FIXTURE] },
  leg: STEERS,
}

/** A body the fixture answers immediately — anything that is not `wait:<ms>`. */
const RANG = "olai · kolu · one terminal waiting · 14:32"
const KOLU = "kolu"

let cwd = ""
const wasState = process.env["XDG_STATE_HOME"]

beforeEach(() => {
  cwd = mkdtempSync(join(tmpdir(), "olai-doorbell-"))
  process.env["XDG_STATE_HOME"] = cwd
})

afterEach(() => {
  if (wasState === undefined) delete process.env["XDG_STATE_HOME"]
  else process.env["XDG_STATE_HOME"] = wasState
  rmSync(cwd, { recursive: true, force: true })
})

const run = <A, E>(effect: Effect.Effect<A, E>): Promise<A> => Effect.runPromise(effect)

/** Poll until it is true, or give up loudly — the shape `lifecycle.test.ts`
 *  waits for a log line with, which is the only honest way to wait on a
 *  subprocess that answers when it answers. */
const until = async (what: string, ready: () => boolean, ms = 8_000): Promise<void> => {
  const deadline = Date.now() + ms
  while (Date.now() < deadline) {
    if (ready()) return
    await Effect.runPromise(Effect.sleep("20 millis"))
  }
  throw new Error(`waited ${ms}ms for ${what} and it never happened`)
}

/** A scope table that is only ever read — what the strip's count is projected
 *  over. Writing one is `scopes.test.ts`'s subject. */
const scoping = (rows: ReadonlyArray<Scoped>): Scopes => ({
  rows: () => rows,
  set: () => Effect.succeed([]),
})

const SCOPED = scoping([{
  agent: "opencode",
  session: "sess-1",
  plugin: KOLU,
  file: "Fleet.olai",
  at: "2026-08-31T09:00:00.000Z",
}])

/** The machine-marked rows, in the order the transcript holds them. */
const rung = (chat: Chat): ReadonlyArray<UserEntry> =>
  [...chat.entries().values()].flatMap((entry) =>
    entry.kind === "user" && entry.rang !== undefined ? [entry] : []
  )

/** Open a panel over the fixture. `start: false` leaves it with no conversation
 *  at all, which is the third arm's whole premise. */
const panel = async (
  options: { readonly scoping?: Scopes; readonly start?: boolean } = {},
): Promise<Chat> => {
  const chat = await run(makeChat({
    roster: [ROW],
    cwd,
    tools: () => null,
    scoping: options.scoping ?? null,
    onState: () => {},
    onTranscript: () => {},
  }))
  if (options.start !== false) {
    await run(chat.start)
    await until("the conversation to open", () => chat.state().session !== null)
  }
  return chat
}

/** WHICH conversation the panel is in, as a delivery is addressed. */
const open = (chat: Chat) => ({ agent: "opencode", session: chat.state().session?.id ?? "" })

/** Send something the fixture holds, and WAIT UNTIL THE TURN IS RUNNING.
 *
 *  The wait is the point, not politeness: `send` returns once the prompt is on
 *  the wire, and `begin` forks the fiber that flips `turns.busy`. A delivery
 *  made in that gap finds an idle agent and is handed over as a turn of its
 *  OWN — which is correct behaviour and the wrong precondition for every test
 *  below, each of which is about what happens to a body that arrives while a
 *  turn is already running. */
const holding = async (chat: Chat): Promise<void> => {
  await run(chat.send("wait:900", [], []))
  await until("the turn to be running", () => chat.state().status === "thinking")
}

const closing = async (chat: Chat, body: () => Promise<void>): Promise<void> => {
  try {
    await body()
  } finally {
    await run(chat.stop)
    await Effect.runPromise(Effect.sleep("40 millis"))
  }
}

describe("an idle agent", () => {
  test("takes a doorbell's words as a turn of their own, marked", async () => {
    const chat = await panel()
    await closing(chat, async () => {
      await run(chat.deliverTo(open(chat), RANG, KOLU))
      await until("the machine's row", () => rung(chat).length === 1)
      const row = rung(chat)[0]
      expect(row?.text).toBe(RANG)
      // The MARK is the plugin's name and core stamped it — a plugin never
      // supplies its own, or it could sign another's.
      expect(row?.rang).toBe(KOLU)
      // ... and it is not waiting behind anything, which is the visible half of
      // "a doorbell never arrives alongside a running turn".
      expect(row?.queued).toBeUndefined()
    })
  }, 20_000)
})

describe("an agent mid-turn", () => {
  test("HOLDS the words, and no row exists yet", async () => {
    const chat = await panel({ scoping: SCOPED })
    await closing(chat, async () => {
      await holding(chat)
      await run(chat.deliverTo(open(chat), RANG, KOLU))
      // Nothing is in the conversation, which is the whole difference from a
      // mid-turn hand-off: the words are not at the agent and the transcript
      // does not pretend they are.
      expect(rung(chat)).toEqual([])
      // ... and the strip says one is waiting, because the alternative to
      // holding words out of sight is not dropping them, it is showing them.
      expect(chat.state().wake).toEqual([{ name: KOLU, file: "Fleet.olai", waiting: 1 }])
      await until("the turn boundary to let it in", () => rung(chat).length === 1)
      expect(chat.state().wake).toEqual([{ name: KOLU, file: "Fleet.olai", waiting: 0 }])
    })
  }, 20_000)

  test("lets in ONE row, the bodies joined by a blank line in arrival order", async () => {
    const chat = await panel()
    await closing(chat, async () => {
      await holding(chat)
      await run(chat.deliverTo(open(chat), "first", KOLU))
      await run(chat.deliverTo(open(chat), "second", KOLU))
      await run(chat.deliverTo(open(chat), "third", KOLU))
      await until("the turn boundary", () => rung(chat).length === 1)
      // Whole plugin-authored paragraphs, joined and nothing else: core adds no
      // lead-in, no count and no word of its own.
      expect(rung(chat)[0]?.text).toBe("first\n\nsecond\n\nthird")
    })
  }, 20_000)

  test("a second body under the same key REPLACES in place and keeps its position", async () => {
    const chat = await panel()
    await closing(chat, async () => {
      await holding(chat)
      await run(chat.deliverTo(open(chat), "digest v1", KOLU, { coalesce: "digest" }))
      await run(chat.deliverTo(open(chat), "a wake", KOLU))
      await run(chat.deliverTo(open(chat), "digest v2", KOLU, { coalesce: "digest" }))
      await until("the turn boundary", () => rung(chat).length === 1)
      // v2 lands where v1 was rather than at the back — which is what makes a
      // plugin's own order survive its own coalescing.
      expect(rung(chat)[0]?.text).toBe("digest v2\n\na wake")
    })
  }, 20_000)

  test("a body with no key never replaces, even one word for word the same", async () => {
    const chat = await panel()
    await closing(chat, async () => {
      await holding(chat)
      await run(chat.deliverTo(open(chat), "the same words", KOLU))
      await run(chat.deliverTo(open(chat), "the same words", KOLU))
      await until("the turn boundary", () => rung(chat).length === 1)
      expect(rung(chat)[0]?.text).toBe("the same words\n\nthe same words")
    })
  }, 20_000)

  test("the cap drops the OLDEST and keeps the rest", async () => {
    const chat = await panel()
    await closing(chat, async () => {
      await run(chat.send("wait:1500", [], []))
      for (let n = 0; n <= SLOTS; n++) {
        await run(chat.deliverTo(open(chat), `body ${n}`, KOLU))
      }
      await until("the turn boundary", () => rung(chat).length === 1)
      const text = rung(chat)[0]?.text ?? ""
      expect(text.split("\n\n").length).toBe(SLOTS)
      expect(text.startsWith("body 1\n\n")).toBe(true)
      expect(text.endsWith(`body ${SLOTS}`)).toBe(true)
    })
  }, 25_000)
})

describe("a cancel", () => {
  test("does not swallow what was held: the boundary it produces still flushes", async () => {
    // A cancel does not touch held slots and never has to: the flush fires at
    // the turn boundary a cancel produces, like any other. A person who wants
    // the doorbell to stop clears the file.
    const chat = await panel()
    await closing(chat, async () => {
      await run(chat.send("wait:8000", [], []))
      await run(chat.deliverTo(open(chat), RANG, KOLU))
      expect(rung(chat)).toEqual([])
      // `send` answers when the turn is OWNED, not when the prompt is on the
      // wire — `begin` forks and `agent.prompt` is the first line inside the
      // fork — so a cancel written straight after it can overtake its own
      // prompt at the fixture. A person cannot press a button that fast; a test
      // can, so it waits for the prompt to have gone.
      await Effect.runPromise(Effect.sleep("300 millis"))
      await run(chat.cancel)
      await until("the cancelled turn's boundary", () => rung(chat).length === 1)
      expect(rung(chat)[0]?.text).toBe(RANG)
    })
  }, 25_000)
})

describe("a conversation nobody is in", () => {
  test("holds the words until somebody opens it, and they arrive as its first message", async () => {
    const chat = await panel({ start: false })
    await closing(chat, async () => {
      // The panel has no agent bound and no conversation open. The fixture
      // mints `sess-1` for the first `session/new`, which is what the boot
      // below asks for.
      await run(chat.deliverTo({ agent: "opencode", session: "sess-1" }, RANG, KOLU))
      expect(rung(chat)).toEqual([])
      await run(chat.start)
      await until("the boot's conversation", () => chat.state().session !== null)
      await until("the held words", () => rung(chat).length === 1)
      expect(rung(chat)[0]?.text).toBe(RANG)
    })
  }, 25_000)

  test("a body for ANOTHER conversation re-arms, and the next session flushes it", async () => {
    const chat = await panel()
    await closing(chat, async () => {
      expect(chat.state().session?.id).toBe("sess-1")
      // Addressed to a conversation that does not exist yet: this panel's
      // agent, and the session its NEXT `+ new` will mint.
      await run(chat.deliverTo({ agent: "opencode", session: "sess-2" }, RANG, KOLU))
      expect(rung(chat)).toEqual([])
      await run(chat.newSession("opencode"))
      await until("the new conversation", () => chat.state().session?.id === "sess-2")
      await until("the held words", () => rung(chat).length === 1)
      expect(rung(chat)[0]?.text).toBe(RANG)
    })
  }, 25_000)

  test("a body for another AGENT's conversation is never let in here", async () => {
    const chat = await panel()
    await closing(chat, async () => {
      // Same session id, wrong agent — which means nothing at all, and is why
      // a conversation is the pair.
      await run(chat.deliverTo({ agent: "claude", session: "sess-1" }, RANG, KOLU))
      await Effect.runPromise(Effect.sleep("300 millis"))
      expect(rung(chat)).toEqual([])
    })
  }, 20_000)
})


describe("a doorbell somebody turned off", () => {
  /** A scope table that really moves, which is what a CLEAR needs: the read-only
   *  {@link scoping} above cannot stop answering, and the point of this arm is
   *  what happens when it does. */
  const movable = (): Scopes => {
    let rows: ReadonlyArray<Scoped> = [{
      agent: "opencode",
      session: "sess-1",
      plugin: KOLU,
      file: "Fleet.olai",
      at: "2026-08-31T09:00:00.000Z",
    }]
    return {
      rows: () => rows,
      set: (to, plugin, file) =>
        Effect.sync(() => {
          const without = rows.filter((row) =>
            !(row.agent === to.agent && row.session === to.session && row.plugin === plugin)
          )
          rows = file === null
            ? without
            : [...without, { ...to, plugin, file, at: "2026-08-31T09:01:00.000Z" }]
          // The rows this write removed and did not put back — the real store
          // answers with these so a caller can take back what their doorbells
          // were holding.
          return without.filter((row) => !rows.includes(row))
        }),
    }
  }

  test("takes back what it is still holding, rather than letting it in later", async () => {
    const chat = await panel({ scoping: movable() })
    await closing(chat, async () => {
      await holding(chat)
      await run(chat.deliverTo(open(chat), RANG, KOLU))
      expect(chat.state().wake).toEqual([{ name: KOLU, file: "Fleet.olai", waiting: 1 }])
      // The gesture, made on seeing that count — the clear and the count are
      // drawn on one line, so this is the ordinary way to press it and not a
      // contrived race.
      await run(chat.scope(open(chat), KOLU, null))
      expect(chat.state().wake).toEqual([])
      // The turn ends, which is the boundary that would have let it in.
      await run(chat.send("say:done", [], []))
      await until("the second turn to finish", () => chat.state().status === "idle")
      // ... and nothing arrived. A strip that says `off` while a sentence it
      // disowns is still on its way in would be words held where a person
      // cannot see them, which is the one thing this panel refuses.
      expect(rung(chat)).toEqual([])
    })
  }, 20_000)

  test("takes back only its OWN, because one conversation may have two", async () => {
    const chat = await panel({ scoping: movable() })
    await closing(chat, async () => {
      await holding(chat)
      await run(chat.deliverTo(open(chat), "kolu's", KOLU))
      await run(chat.deliverTo(open(chat), "somebody else's", "odu"))
      await run(chat.scope(open(chat), KOLU, null))
      await until("the turn boundary", () => rung(chat).length === 1)
      expect(rung(chat)[0]?.text).toBe("somebody else's")
      expect(rung(chat)[0]?.rang).toBe("odu")
    })
  }, 20_000)

  test("takes back what it holds when the pick MOVES, not only when it is cleared", async () => {
    const chat = await panel({ scoping: movable() })
    await closing(chat, async () => {
      await holding(chat)
      await run(chat.deliverTo(open(chat), RANG, KOLU))
      // The same gesture as a clear, one option along in the picker. The body
      // names the file it was derived from, so it would land under a control
      // saying it watches a different one — and the plugin does not re-derive
      // it, because the terminals it named need not be claimed in the new file.
      await run(chat.scope(open(chat), KOLU, "Other.olai"))
      expect(chat.state().wake).toEqual([{ name: KOLU, file: "Other.olai", waiting: 0 }])
      await run(chat.send("say:done", [], []))
      await until("the second turn to finish", () => chat.state().status === "idle")
      expect(rung(chat)).toEqual([])
    })
  }, 20_000)

  test("a refused write leaves the pick where the person was told it stayed", async () => {
    // The record is the authority: a write that fails is a pick that did not
    // stick, and the MIRROR is what the plugin reads — so a mirror that moved
    // under a refused write would be a doorbell ringing for a row the strip
    // never said was on.
    let rows: ReadonlyArray<Scoped> = []
    const refusing: Scopes = {
      rows: () => rows,
      set: () => Effect.fail(new MemoryFailure({ why: "the state home is read-only" })),
    }
    const chat = await panel({ scoping: refusing })
    await closing(chat, async () => {
      const outcome = await Effect.runPromise(Effect.result(chat.scope(open(chat), KOLU, "Fleet.olai")))
      expect(outcome._tag).toBe("Failure")
      expect(rows).toEqual([])
      expect(chat.state().wake).toEqual([])
    })
  }, 20_000)
})

describe("the interruption a person has not spent", () => {
  test("a doorbell does not spend it, and its words wait for the turn to end", async () => {
    const chat = await panel()
    await closing(chat, async () => {
      const talking = () => {
        const who = chat.state().talking
        return who !== null && who.kind === "agent" ? who : null
      }
      // The control is on offer: this agent advertises the gesture and nothing
      // has queued in this conversation.
      await until("the handshake", () => talking()?.steers === true)

      await run(chat.send("wait:1200", [], []))
      await run(chat.deliverTo(open(chat), RANG, KOLU))

      // BOTH HALVES, and they are one fact seen twice. The words are not in the
      // conversation — so they did not go out alongside the running turn — and
      // the interruption is still on offer, which is what going out alongside
      // it would have taken away for the rest of this conversation's life.
      expect(rung(chat)).toEqual([])
      expect(talking()?.steers).toBe(true)

      await until("the turn boundary", () => rung(chat).length === 1)
      // ... and it is still on offer after the words have landed, because what
      // let them in was a turn that had ended.
      expect(talking()?.steers).toBe(true)
      expect(rung(chat)[0]?.queued).toBeUndefined()
    })
  }, 25_000)
})
