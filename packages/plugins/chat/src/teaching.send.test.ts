import { afterEach, beforeEach, describe, expect, test } from "bun:test"
import { Effect } from "effect"
import { mkdtempSync, rmSync } from "node:fs"
import { tmpdir } from "node:os"
import { join } from "node:path"

import type { NodeAgent } from "@olai/format"
import type { ChatEntry, ChatState } from "olai-plugin-chat/wire"
import { QUEUES } from "@kolu/acp-client/testlib"
import type { Installed } from "./agents/roster.ts"
import { seated } from "./agents/roster.testlib.ts"
import { makePanel as makeChat, type Panel } from "./chat.ts"
import { volatile } from "./memory.ts"
import { type LocalHarness, localHarness } from "./local.testlib.ts"
import { forLocalState as sessionsIn } from "./sessions.ts"
import { lines, REMINDING, teachingFor } from "./teaching.ts"

const FIXTURE = join(import.meta.dirname, "fixtures", "teaching-agent.ts")

const SPACES: NodeAgent = {
  kind: "node",
  beside: false,
  id: "spaces",
  file: "lanes.olai",
  title: "Xyne Spaces — the org OS",
  engine: "opencode",
  session: "sess-1",
  memory: 14,
}

const ROW: Installed = {
  id: "opencode",
  name: "opencode",
  adapter: { command: process.execPath, args: [FIXTURE] },
  leg: QUEUES,
  prompt: { kind: "first-turn" },
}

let cwd = ""
let local: LocalHarness

let claimed: ReadonlyArray<NodeAgent> = []

beforeEach(() => {
  cwd = mkdtempSync(join(tmpdir(), "olai-teaching-"))
  local = localHarness()
  claimed = [SPACES]
})

afterEach(() => {
  rmSync(cwd, { recursive: true, force: true })
})

const record = (): ReadonlyArray<Record<string, unknown>> => {
  const section = local.read(cwd, "heard")
  return Array.isArray(section?.["heard"])
    ? section["heard"] as ReadonlyArray<Record<string, unknown>>
    : []
}

const overheardIn = (session: string): Record<string, unknown> | undefined =>
  record().find((row) => row["session"] === session)

const run = <A, E>(effect: Effect.Effect<A, E>): Promise<A> => Effect.runPromise(effect)
const settle = (ms = 250) => Effect.runPromise(Effect.sleep(`${ms} millis`))

interface Seat {
  readonly chat: Panel
  readonly rows: () => ReadonlyArray<ChatEntry>
  readonly state: () => ChatState
}

const withChat = async (
  body: (seat: Seat) => Promise<void>,
  remindEvery?: number,
): Promise<void> => {
  const entries = new Map<string, ChatEntry>()
  let published: ChatState | null = null
  const chat = await run(makeChat({
    roster: () => [seated(ROW)],
    cwd,
    tools: () => null,
    memory: volatile(),
    overheard: await run(sessionsIn(local.forDirectory(cwd))),
    ...(remindEvery === undefined ? {} : { remindEvery }),
    agentAt: (to) =>
      claimed.find((one) => one.engine === to.agent && one.session === to.session) ?? null,
    onState: (next) => {
      published = next
    },
    onTranscript: (change) => {
      for (const entry of change.upserts) entries.set(entry.id, entry)
      for (const key of change.removes) entries.delete(key)
      for (const piece of change.appends) {
        const row = entries.get(piece.of)
        if (row !== undefined) entries.set(piece.of, { ...row, text: row.text + piece.text })
      }
    },
  }))
  try {
    await run(chat.start)
    const deadline = Date.now() + 8_000
    while (Date.now() < deadline && chat.state().session === null) await settle(20)
    expect(chat.state().session?.id).toBe("sess-1")
    await body({
      chat,
      rows: () => [...entries.values()],
      state: () => published ?? chat.state(),
    })
  } finally {
    await run(chat.stop)
    await settle(40)
  }
}

const notices = (seat: Seat): ReadonlyArray<string> =>
  seat.rows().filter((row) => row.kind === "notice").map((row) => row.text)

const heard = (seat: Seat): ReadonlyArray<string> =>
  seat.rows().filter((row) => row.kind === "agent").map((row) => row.text)

const LAW = teachingFor(SPACES)[1] as string

describe("an agent-associated session is taught, once", () => {
  test("the first message carries the contract — to the AGENT and into the transcript", async () => {
    await withChat(async (seat) => {
      await run(seat.chat.send("what is blocking the connector?", [], []))
      await settle()

      const [said] = heard(seat)
      expect(said).toContain("what is blocking the connector?")
      expect(said).toContain("This conversation is the node agent for “Xyne Spaces — the org OS”")
      expect(said).toContain(LAW)

      expect(notices(seat)).toEqual([teachingFor(SPACES).join("\n")])
      const kinds = seat.rows().map((row) => row.kind)
      expect(kinds.indexOf("notice")).toBeGreaterThan(kinds.indexOf("user"))
      expect(kinds.indexOf("notice")).toBeLessThan(kinds.indexOf("agent"))

      expect(overheardIn("sess-1")?.["taught"]).toBe(true)
    })
  }, 20_000)

  test("the second message says nothing — the rule this whole record exists for", async () => {
    await withChat(async (seat) => {
      await run(seat.chat.send("first", [], []))
      await settle()
      await run(seat.chat.send("second", [], []))
      await settle()

      expect(notices(seat)).toHaveLength(1)
      const [, second] = heard(seat)
      expect(second).toContain("second")
      expect(second).not.toContain("[olai]")
    })
  }, 20_000)

  test("two sends in the one tick are taught ONCE — the fork hails the send home", async () => {
    await withChat(async (seat) => {
      await Promise.all([
        run(seat.chat.send("one", [], [])),
        run(seat.chat.send("two", [], [])),
      ])
      await settle()

      expect(notices(seat)).toEqual([teachingFor(SPACES).join("\n")])
      const [one, two] = heard(seat)
      expect(one).toContain("[olai]")
      expect(two).not.toContain("[olai]")
      expect(overheardIn("sess-1")?.["taught"]).toBe(true)
    })
  }, 30_000)

  test("a session ALREADY marked in the record is never taught at all", async () => {
    const kept = await run(sessionsIn(local.forDirectory(cwd)))
    await run(kept.took({ agent: "opencode", session: "sess-1" }, true))
    await withChat(async (seat) => {
      await run(seat.chat.send("hello", [], []))
      await settle()
      expect(notices(seat)).toEqual([])
      expect(heard(seat)[0]).not.toContain("[olai]")
    })
  }, 20_000)

  test("a FRESH session is untaught — the mark is per session, not per node", async () => {
    await withChat(async (seat) => {
      await run(seat.chat.send("first", [], []))
      await settle()
      expect(notices(seat)).toHaveLength(1)

      await run(seat.chat.newSession("opencode"))
      const deadline = Date.now() + 8_000
      while (Date.now() < deadline && seat.chat.state().session?.id !== "sess-2") await settle(20)
      expect(seat.chat.state().session?.id).toBe("sess-2")

      claimed = [{ ...SPACES, session: "sess-2" }]

      await run(seat.chat.send("first again", [], []))
      await settle()
      expect(notices(seat)).toHaveLength(1)
      expect(heard(seat)[0]).toContain("[olai]")
      expect(record().map((row) => row["session"])).toEqual(["sess-1", "sess-2"])
      expect(record().every((row) => row["taught"] === true)).toBe(true)
    })
  }, 20_000)

  test("a conversation NO node claims is taught nothing, and nothing is written", async () => {
    claimed = [{ ...SPACES, session: "somebody-else" }]
    await withChat(async (seat) => {
      await run(seat.chat.send("hello", [], []))
      await settle()
      expect(notices(seat)).toEqual([])
      expect(overheardIn("sess-1")?.["taught"]).toBeUndefined()
      expect(overheardIn("sess-1")?.["taken"]).toBeUndefined()
    })
  }, 20_000)

  test("a node the SET no longer declares teaches nothing — a property on a trashed row", async () => {
    claimed = []
    await withChat(async (seat) => {
      await run(seat.chat.send("hello", [], []))
      await settle()
      expect(notices(seat)).toEqual([])
      expect(overheardIn("sess-1")?.["taught"]).toBeUndefined()
    })
  }, 20_000)
})

describe("... and told, once, what the row that opened it wants it to know", () => {
  const PREAMBLE = lines([
    "You are building the plugin in plugins/timer.",
    "Write server.ts first, then browser.tsx.",
  ])

  test("the preamble rides the first message, UNDER the contract and in the same notice", async () => {
    await withChat(async (seat) => {
      await run(seat.chat.send("make a start", [], [], false, PREAMBLE))
      await settle()

      const [said] = heard(seat)
      expect(said).toContain("make a start")
      expect(said).toContain(LAW)
      expect(said).toContain(PREAMBLE[0] as string)
      expect(said?.indexOf(LAW)).toBeLessThan(said?.indexOf(PREAMBLE[0] as string) ?? -1)

      expect(notices(seat)).toEqual([[...teachingFor(SPACES), ...PREAMBLE].join("\n")])
      expect(overheardIn("sess-1")?.["taught"]).toBe(true)
    })
  }, 20_000)

  test("and NEVER twice — a caller that passes it again says nothing again", async () => {
    await withChat(async (seat) => {
      await run(seat.chat.send("make a start", [], [], false, PREAMBLE))
      await settle()
      await run(seat.chat.send("carry on", [], [], false, PREAMBLE))
      await settle()

      expect(notices(seat)).toHaveLength(1)
      const [, second] = heard(seat)
      expect(second).toContain("carry on")
      expect(second).not.toContain("[olai]")
    })
  }, 20_000)

  test("a conversation no node claims hears neither the contract nor the preamble", async () => {
    claimed = []
    await withChat(async (seat) => {
      await run(seat.chat.send("make a start", [], [], false, PREAMBLE))
      await settle()
      expect(notices(seat)).toEqual([])
      expect(heard(seat)[0]).not.toContain("[olai]")
    })
  }, 20_000)
})

describe("... and reminded, every Nth message after", () => {
  const say = async (seat: Seat, ...words: ReadonlyArray<string>): Promise<void> => {
    for (const one of words) {
      await run(seat.chat.send(one, [], []))
      await settle()
    }
  }

  test("the Nth message carries the reminder — to the agent and as a notice — and the ones around it do not", async () => {
    await withChat(async (seat) => {
      await say(seat, "one", "two", "three", "four")
      expect(notices(seat)).toEqual([teachingFor(SPACES).join("\n"), REMINDING.join("\n")])
      const [one, two, three, four] = heard(seat)
      expect(one).toContain(LAW)
      expect(two).not.toContain("[olai]")
      expect(three).toContain(`three\n\n${REMINDING.join("\n")}`)
      expect(four).not.toContain("[olai]")
      const rows = seat.rows()
      const third = rows.findIndex((row) => row.kind === "user" && row.text === "three")
      expect(rows.slice(third + 1).find((row) => row.kind === "notice")?.text).toBe(REMINDING.join("\n"))
      expect(overheardIn("sess-1")?.["taken"]).toBe(4)
    }, 3)
  }, 30_000)

  test("a restart neither resets the count nor counts a message twice", async () => {
    await withChat(async (seat) => {
      await say(seat, "one", "two")
      expect(notices(seat)).toHaveLength(1)
    }, 3)
    await withChat(async (seat) => {
      await say(seat, "three")
      expect(notices(seat)).toEqual([REMINDING.join("\n")])
      expect(heard(seat)[0]).toContain(REMINDING.join("\n"))
    }, 3)
  }, 30_000)

  test("`0` never reminds — and still counts, so turning it back on lands where it would have", async () => {
    await withChat(async (seat) => {
      await say(seat, "one", "two", "three")
      expect(notices(seat)).toEqual([teachingFor(SPACES).join("\n")])
      for (const said of heard(seat).slice(1)) expect(said).not.toContain("[olai]")
      expect(overheardIn("sess-1")?.["taken"]).toBe(3)
    }, 0)
  }, 30_000)
})

describe("what the panel and the door learn from it", () => {
  test("`bound` names the node the OPEN conversation belongs to, and follows a switch", async () => {
    await withChat(async (seat) => {
      expect(seat.state().bound).toBe("spaces")

      await run(seat.chat.newSession("opencode"))
      const deadline = Date.now() + 8_000
      while (Date.now() < deadline && seat.chat.state().session?.id !== "sess-2") await settle(20)
      expect(seat.state().bound).toBe(null)
    })
  }, 20_000)

  test("the door's line lands at the TURN BOUNDARY, with the row's own instant", async () => {
    await withChat(async (seat) => {
      expect(overheardIn("sess-1")?.["said"]).toBeUndefined()
      await run(seat.chat.send("what is blocking the connector?", [], []))
      await settle()

      const said = overheardIn("sess-1")?.["said"] as { text: string; at: string } | undefined
      expect(said?.text).toContain("heard: what is blocking the connector?")
      const row = seat.rows().find((one) => one.kind === "agent")
      expect(said?.at).toBe(row?.since as string)
    })
  }, 20_000)
})
