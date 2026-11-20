import { afterEach, beforeEach, describe, expect, test } from "bun:test"
import type { UserEntry } from "olai-plugin-chat/wire"
import { Effect } from "effect"
import { mkdtempSync, rmSync } from "node:fs"
import { tmpdir } from "node:os"
import { join } from "node:path"

import type { Leg } from "@kolu/acp/engine"
import { QUEUES } from "@kolu/acp-client/testlib"
import type { Installed } from "./agents/roster.ts"
import { seated } from "./agents/roster.testlib.ts"
import { makePanel as makeChat, type Panel, SLOTS } from "./chat.ts"
import { volatile } from "./memory.ts"
import type { Scoped, Scopes } from "./scopes.ts"
import { MemoryFailure } from "@kolu/acp-client"

const TELLABLE = (): boolean => true

const FIXTURE = join(import.meta.dirname, "fixtures", "doorbell-agent.ts")

const STEERS: Leg = {
  ...QUEUES,
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
  prompt: { kind: "first-turn" },
}

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

const until = async (what: string, ready: () => boolean, ms = 8_000): Promise<void> => {
  const deadline = Date.now() + ms
  while (Date.now() < deadline) {
    if (ready()) return
    await Effect.runPromise(Effect.sleep("20 millis"))
  }
  throw new Error(`waited ${ms}ms for ${what} and it never happened`)
}

const scoping = (rows: ReadonlyArray<Scoped>): Scopes => ({
  recipient: ({ agent, session, pick }) => ({ agent, session, pick, current: () => true }),
  rows: () => rows,
  set: () => Effect.succeed([]),

})

const SCOPED = scoping([{
  agent: "opencode",
  session: "sess-1",
  plugin: KOLU,
  pick: "Fleet.olai",
}])

const rung = (chat: Panel): ReadonlyArray<UserEntry> =>
  [...chat.entries().values()].flatMap((entry) =>
    entry.kind === "user" && entry.rang !== undefined ? [entry] : []
  )

const panel = async (
  options: { readonly scoping?: Scopes; readonly start?: boolean } = {},
): Promise<Panel> => {
  const chat = await run(makeChat({
    roster: () => [seated(ROW)],
    cwd,
    tools: () => null,
    memory: volatile(),
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

const open = (chat: Panel) => ({ agent: "opencode", session: chat.state().session?.id ?? "" })

const holding = async (chat: Panel): Promise<void> => {
  await run(chat.send("wait:900", [], []))
  await until("the turn to be running", () => chat.state().status === "thinking")
}

const closing = async (chat: Panel, body: () => Promise<void>): Promise<void> => {
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
      await run(chat.doorFor(KOLU).deliver(open(chat), () => RANG))
      await until("the machine's row", () => rung(chat).length === 1)
      const row = rung(chat)[0]
      expect(row?.text).toBe(RANG)
      expect(row?.rang).toBe(KOLU)
      expect(row?.queued).toBeUndefined()
    })
  }, 20_000)
})

describe("an agent mid-turn", () => {
  test("HOLDS the words, and no row exists yet", async () => {
    const chat = await panel({ scoping: SCOPED })
    await closing(chat, async () => {
      await holding(chat)
      await run(chat.doorFor(KOLU).deliver(open(chat), () => RANG))
      expect(rung(chat)).toEqual([])
      expect(chat.state().wake).toEqual([{ name: KOLU, pick: "Fleet.olai", waiting: 1 }])
      await until("the turn boundary to let it in", () => rung(chat).length === 1)
      expect(chat.state().wake).toEqual([{ name: KOLU, pick: "Fleet.olai", waiting: 0 }])
    })
  }, 20_000)

  test("... and a plugin that is going away takes its own back", async () => {
    const chat = await panel({ scoping: SCOPED })
    await closing(chat, async () => {
      await holding(chat)
      await run(chat.doorFor(KOLU).deliver(open(chat), () => RANG))
      expect(chat.state().wake).toEqual([{ name: KOLU, pick: "Fleet.olai", waiting: 1 }])
      await run(chat.doorFor(KOLU).withdraw(open(chat)))
      await until("the strip to let the count go", () =>
        chat.state().wake.every((row) => row.waiting === 0))
      expect(chat.state().wake).toEqual([{ name: KOLU, pick: "Fleet.olai", waiting: 0 }])
      await until("the turn to end", () => chat.state().status !== "thinking")
      expect(rung(chat)).toEqual([])
    })
  }, 20_000)

  test("lets in ONE row, the bodies joined by a blank line in arrival order", async () => {
    const chat = await panel()
    await closing(chat, async () => {
      await holding(chat)
      await run(chat.doorFor(KOLU).deliver(open(chat), () => "first"))
      await run(chat.doorFor(KOLU).deliver(open(chat), () => "second"))
      await run(chat.doorFor(KOLU).deliver(open(chat), () => "third"))
      await until("the turn boundary", () => rung(chat).length === 1)
      expect(rung(chat)[0]?.text).toBe("first\n\nsecond\n\nthird")
    })
  }, 20_000)

  test("a second body under the same key REPLACES in place and keeps its position", async () => {
    const chat = await panel()
    await closing(chat, async () => {
      await holding(chat)
      await run(chat.doorFor(KOLU).deliver(open(chat), () => "digest v1", { coalesce: "digest" }))
      await run(chat.doorFor(KOLU).deliver(open(chat), () => "a wake"))
      await run(chat.doorFor(KOLU).deliver(open(chat), () => "digest v2", { coalesce: "digest" }))
      await until("the turn boundary", () => rung(chat).length === 1)
      expect(rung(chat)[0]?.text).toBe("digest v2\n\na wake")
    })
  }, 20_000)

  test("a body with no key never replaces, even one word for word the same", async () => {
    const chat = await panel()
    await closing(chat, async () => {
      await holding(chat)
      await run(chat.doorFor(KOLU).deliver(open(chat), () => "the same words"))
      await run(chat.doorFor(KOLU).deliver(open(chat), () => "the same words"))
      await until("the turn boundary", () => rung(chat).length === 1)
      expect(rung(chat)[0]?.text).toBe("the same words\n\nthe same words")
    })
  }, 20_000)

  test("the cap drops the OLDEST and keeps the rest", async () => {
    const chat = await panel()
    await closing(chat, async () => {
      await run(chat.send("wait:1500", [], []))
      for (let n = 0; n <= SLOTS; n++) {
        await run(chat.doorFor(KOLU).deliver(open(chat), () => `body ${n}`))
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
    const chat = await panel()
    await closing(chat, async () => {
      await run(chat.send("wait:8000", [], []))
      await run(chat.doorFor(KOLU).deliver(open(chat), () => RANG))
      expect(rung(chat)).toEqual([])
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
      await run(chat.doorFor(KOLU).deliver({ agent: "opencode", session: "sess-1" }, () => RANG))
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
      await run(chat.doorFor(KOLU).deliver({ agent: "opencode", session: "sess-2" }, () => RANG))
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
      await run(chat.doorFor(KOLU).deliver({ agent: "claude", session: "sess-1" }, () => RANG))
      await Effect.runPromise(Effect.sleep("300 millis"))
      expect(rung(chat)).toEqual([])
    })
  }, 20_000)
})

describe("a body that waited", () => {

  test("a HELD offer never asks for the words, so nothing can count a delivery that did not land", async () => {
    const chat = await panel()
    await closing(chat, async () => {
      await holding(chat)
      let asked = 0
      await run(chat.doorFor(KOLU).deliver(open(chat), () => {
        asked++
        return "the words"
      }))
      expect(rung(chat)).toEqual([])
      expect(asked).toBe(0)
      await until("the turn boundary to let it in", () => rung(chat).length === 1)
      expect(asked).toBe(1)
      expect(rung(chat)[0]?.text).toBe("the words")
    })
  }, 20_000)

  test("... and a conversation nobody is in is not asked either, until somebody opens it", async () => {
    const chat = await panel({ start: false })
    await closing(chat, async () => {
      let asked = 0
      await run(chat.doorFor(KOLU).deliver({ agent: "opencode", session: "sess-1" }, () => {
        asked++
        return RANG
      }))
      expect(asked).toBe(0)
      await run(chat.start)
      await until("the conversation to open and take it", () => rung(chat).length === 1)
      expect(asked).toBe(1)
    })
  }, 20_000)
  test("is composed at the moment it goes in, not when it was drafted", async () => {
    const chat = await panel()
    await closing(chat, async () => {
      await holding(chat)
      let world = "two terminals are waiting"
      await run(chat.doorFor(KOLU).deliver(open(chat), () => world))
      world = "one terminal is waiting"
      await until("the turn boundary to let it in", () => rung(chat).length === 1)
      expect(rung(chat)[0]?.text).toBe("one terminal is waiting")
    })
  }, 20_000)

  test("and a subject that has entirely gone drops the whole message", async () => {
    const chat = await panel()
    await closing(chat, async () => {
      await holding(chat)
      let gone = false
      await run(chat.doorFor(KOLU).deliver(open(chat), () => gone ? null : "still true"))
      expect(chat.state().wake).toEqual([])
      gone = true
      await run(chat.send("say:done", [], []))
      await until("the second turn to finish", () => chat.state().status === "idle")
      expect(rung(chat)).toEqual([])
    })
  }, 20_000)

  test("... and only the ones that have gone drop, where several were coalescing", async () => {
    const chat = await panel()
    await closing(chat, async () => {
      await holding(chat)
      let settled = false
      await run(chat.doorFor(KOLU).deliver(open(chat), () => settled ? null : "the settled one"))
      await run(chat.doorFor(KOLU).deliver(open(chat), () => "the standing one"))
      settled = true
      await until("the turn boundary", () => rung(chat).length === 1)
      expect(rung(chat)[0]?.text).toBe("the standing one")
    })
  }, 20_000)

  test("a settled batch does not strand the NEXT plugin's behind it", async () => {
    const chat = await panel()
    await closing(chat, async () => {
      await holding(chat)
      let settled = false
      await run(chat.doorFor(KOLU).deliver(open(chat), () => settled ? null : "kolu's"))
      await run(chat.doorFor("odu").deliver(open(chat), () => "somebody else's"))
      settled = true
      await until("the turn boundary", () => rung(chat).length === 1)
      expect(rung(chat)[0]?.text).toBe("somebody else's")
      expect(rung(chat)[0]?.rang).toBe("odu")
    })
  }, 20_000)
})

const movable = (): Scopes => {
  let rows: ReadonlyArray<Scoped> = [{
    agent: "opencode",
    session: "sess-1",
    plugin: KOLU,
    pick: "Fleet.olai",
  }]
  return {
    recipient: ({ agent, session, pick }) => ({ agent, session, pick, current: () => true }),
  rows: () => rows,
    set: (to, plugin, pick) =>
      Effect.sync(() => {
        const without = rows.filter((row) =>
          !(row.agent === to.agent && row.session === to.session && row.plugin === plugin)
        )
        rows = pick === null
          ? without
          : [...without, { ...to, plugin, pick }]
        return without.filter((row) => !rows.includes(row))
      }),

  }
}

describe("a doorbell somebody turned off", () => {
  test("takes back what it is still holding, rather than letting it in later", async () => {
    const chat = await panel({ scoping: movable() })
    await closing(chat, async () => {
      await holding(chat)
      await run(chat.doorFor(KOLU).deliver(open(chat), () => RANG))
      expect(chat.state().wake).toEqual([{ name: KOLU, pick: "Fleet.olai", waiting: 1 }])
      await run(chat.scope(open(chat), KOLU, null))
      expect(chat.state().wake).toEqual([])
      await run(chat.send("say:done", [], []))
      await until("the second turn to finish", () => chat.state().status === "idle")
      expect(rung(chat)).toEqual([])
    })
  }, 20_000)

  test("takes back only its OWN, because one conversation may have two", async () => {
    const chat = await panel({ scoping: movable() })
    await closing(chat, async () => {
      await holding(chat)
      await run(chat.doorFor(KOLU).deliver(open(chat), () => "kolu's"))
      await run(chat.doorFor("odu").deliver(open(chat), () => "somebody else's"))
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
      await run(chat.doorFor(KOLU).deliver(open(chat), () => RANG))
      await run(chat.scope(open(chat), KOLU, "Other.olai"))
      expect(chat.state().wake).toEqual([{ name: KOLU, pick: "Other.olai", waiting: 0 }])
      await run(chat.send("say:done", [], []))
      await until("the second turn to finish", () => chat.state().status === "idle")
      expect(rung(chat)).toEqual([])
    })
  }, 20_000)

  test("a refused write leaves the pick where the person was told it stayed", async () => {
    let rows: ReadonlyArray<Scoped> = []
    const refusing: Scopes = {
      recipient: ({ agent, session, pick }) => ({ agent, session, pick, current: () => true }),
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
      await until("the handshake", () => talking()?.steers === true)

      await run(chat.send("wait:1200", [], []))
      await run(chat.doorFor(KOLU).deliver(open(chat), () => RANG))

      expect(rung(chat)).toEqual([])
      expect(talking()?.steers).toBe(true)

      await until("the turn boundary", () => rung(chat).length === 1)
      expect(talking()?.steers).toBe(true)
      expect(rung(chat)[0]?.queued).toBeUndefined()
    })
  }, 25_000)
})

