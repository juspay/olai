/**
 * THE KEYSTONE, AT THE LAYER THAT IMPLEMENTS IT — a real chat, over a real
 * subprocess, with a binding record on a real disk.
 *
 * The pieces already had suites: what the record holds across a restart
 * (`./agents.test.ts`), what the words are (`./teaching.test.ts`), and which
 * row becomes a door's line (`./heard.test.ts`). What none of them could see is
 * the RULE, which lives nowhere but `./chat.ts`'s send path — the gate on
 * `row.taught`, the gate on the row's delivery mark, and the turn boundary the
 * heard line is taken at. Nothing anywhere built `make` with `Options.binding`
 * and `Options.charge`, so an inverted gate or a moved publish would have
 * greened the whole tree.
 *
 * The FIXTURE is what makes it assertable from outside: it says back the prompt
 * it was given (`./fixtures/teaching-agent.ts`), so a case reads what the agent
 * actually received rather than trusting the panel's own notice — which is
 * built from the same value and would be one half of the pair vouching for the
 * other. Both are asserted, separately, for that reason.
 *
 * The binding record is WRITTEN BY HAND into a temp state home, which is the
 * only way one is written in this phase and therefore the way a person's
 * directory actually reaches this code.
 */

import { afterEach, beforeEach, describe, expect, test } from "bun:test"
import { Effect } from "effect"
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs"
import { tmpdir } from "node:os"
import { join } from "node:path"

import type { ChatEntry, ChatState } from "@olai/surface"
import { canonical, digestOf } from "@olai/state"

import { forDirectory as bindingsIn } from "./agents.ts"
import { OPENCODE } from "./agents/opencode.ts"
import type { Installed } from "./agents/roster.ts"
import { type Chat, make as makeChat } from "./chat.ts"
import { teachingFor } from "./teaching.ts"

const FIXTURE = join(import.meta.dirname, "fixtures", "teaching-agent.ts")

/** The node agent every case here is about — the vault's own row, which is
 *  what `Options.charge` answers with (`@olai/format`'s `NodeAgent`). */
const SPACES = {
  id: "spaces",
  file: "lanes.olai",
  title: "Xyne Spaces — the org OS",
  engine: "opencode",
  memory: 14,
}

const ROW: Installed = {
  id: "opencode",
  name: "opencode",
  adapter: { command: process.execPath, args: [FIXTURE] },
  leg: OPENCODE,
}

let cwd = ""
let state = ""
const wasState = process.env["XDG_STATE_HOME"]

beforeEach(() => {
  cwd = mkdtempSync(join(tmpdir(), "olai-teaching-"))
  state = mkdtempSync(join(tmpdir(), "olai-teaching-state-"))
  process.env["XDG_STATE_HOME"] = state
})

afterEach(() => {
  if (wasState === undefined) delete process.env["XDG_STATE_HOME"]
  else process.env["XDG_STATE_HOME"] = wasState
  rmSync(cwd, { recursive: true, force: true })
  rmSync(state, { recursive: true, force: true })
})

const at = (): string => join(state, "olai", "agents", `${digestOf(canonical(cwd))}.json`)

/** The bindings a person wrote, before the serve that reads them at boot. */
const bind = (bound: ReadonlyArray<Record<string, unknown>>): void => {
  mkdirSync(join(state, "olai", "agents"), { recursive: true, mode: 0o700 })
  writeFileSync(at(), `${JSON.stringify({ cwd: canonical(cwd), bound })}\n`)
}

/** ... and the record as it stands now, which is where the two things olai
 *  writes back land. */
const record = (): ReadonlyArray<Record<string, unknown>> =>
  (JSON.parse(readFileSync(at(), "utf8")) as { bound: ReadonlyArray<Record<string, unknown>> })
    .bound

const run = <A, E>(effect: Effect.Effect<A, E>): Promise<A> => Effect.runPromise(effect)
const settle = (ms = 250) => Effect.runPromise(Effect.sleep(`${ms} millis`))

interface Seat {
  readonly chat: Chat
  /** Every row the chat published, in order — a test's transcript. */
  readonly rows: () => ReadonlyArray<ChatEntry>
  readonly state: () => ChatState
}

/**
 * A chat over the fixture agent, bound as the caller asked, opened and ready.
 *
 * `charge` answers for `spaces` and nothing else, which is the composition root's
 * own shape (`@olai/server`'s `agents.ts`): a node the SET does not declare
 * answers `null`, and then nothing is taught.
 */
const withChat = async (body: (seat: Seat) => Promise<void>): Promise<void> => {
  const entries = new Map<string, ChatEntry>()
  let published: ChatState | null = null
  const chat = await run(makeChat({
    roster: [ROW],
    cwd,
    tools: () => null,
    binding: await run(bindingsIn(cwd)),
    charge: (node) => (node === SPACES.id ? SPACES : null),
    onState: (next) => {
      published = next
    },
    // The transcript this suite reads is the one the SERVER publishes, folded
    // exactly as the wire's collection folds it — whole rows by key, removes,
    // and the appends a streaming answer is made of. Reading `chat.entries()`
    // instead would be asking the transcript about itself; this is what a panel
    // would have drawn.
    onTranscript: (change) => {
      for (const [key, entry] of change.upserts) entries.set(key, entry)
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

/** Every notice olai has put in this conversation — the visible half of the
 *  contract, and what "exactly once" is counted over. */
const notices = (seat: Seat): ReadonlyArray<string> =>
  seat.rows().filter((row) => row.kind === "notice").map((row) => row.text)

/** ... and what the AGENT was handed, which is the other half and the one the
 *  notice must not be allowed to vouch for. */
const heard = (seat: Seat): ReadonlyArray<string> =>
  seat.rows().filter((row) => row.kind === "agent").map((row) => row.text)

const LAW = teachingFor(SPACES)[1] as string

describe("an agent-associated session is taught, once", () => {
  test("the first message carries the contract — to the AGENT and into the transcript", async () => {
    bind([{ node: "spaces", agent: "opencode", session: "sess-1" }])
    await withChat(async (seat) => {
      await run(seat.chat.send("what is blocking the connector?", [], []))
      await settle()

      // What the agent was actually given: the person's words, then olai's
      // lines under them, which is the seam every annotation rides.
      const [said] = heard(seat)
      expect(said).toContain("what is blocking the connector?")
      expect(said).toContain("This conversation is the node agent for “Xyne Spaces — the org OS”")
      expect(said).toContain(LAW)

      // ... and the same value, verbatim, where a person can read it.
      expect(notices(seat)).toEqual([teachingFor(SPACES).join("\n")])

      // ... and it is written down, so the next boot does not say it again.
      expect(record()[0]?.["taught"]).toBe(true)
    })
  }, 20_000)

  test("the second message says nothing — the rule this whole record exists for", async () => {
    bind([{ node: "spaces", agent: "opencode", session: "sess-1" }])
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

  test("a session ALREADY marked in the record is never taught at all", async () => {
    bind([{ node: "spaces", agent: "opencode", session: "sess-1", taught: true }])
    await withChat(async (seat) => {
      await run(seat.chat.send("hello", [], []))
      await settle()
      expect(notices(seat)).toEqual([])
      expect(heard(seat)[0]).not.toContain("[olai]")
    })
  }, 20_000)

  test("a FRESH session is untaught — the mark is per session, not per node", async () => {
    // Both of this node's conversations, bound. If the mark were per node the
    // second would inherit the first's, which is exactly the failure the
    // transcript-is-not-memory rule exists to prevent.
    bind([
      { node: "spaces", agent: "opencode", session: "sess-1" },
      { node: "spaces", agent: "opencode", session: "sess-2" },
    ])
    await withChat(async (seat) => {
      await run(seat.chat.send("first", [], []))
      await settle()
      expect(notices(seat)).toHaveLength(1)

      await run(seat.chat.newSession("opencode"))
      const deadline = Date.now() + 8_000
      while (Date.now() < deadline && seat.chat.state().session?.id !== "sess-2") await settle(20)
      expect(seat.chat.state().session?.id).toBe("sess-2")

      // The new conversation emptied the transcript, so this is its own first
      // notice rather than the last one still standing.
      await run(seat.chat.send("first again", [], []))
      await settle()
      expect(notices(seat)).toHaveLength(1)
      expect(heard(seat)[0]).toContain("[olai]")
      expect(record().map((row) => row["session"])).toEqual(["sess-1", "sess-2"])
      expect(record().every((row) => row["taught"] === true)).toBe(true)
    })
  }, 20_000)

  test("a conversation NO node claims is taught nothing, and nothing is written", async () => {
    bind([{ node: "spaces", agent: "opencode", session: "somebody-else" }])
    await withChat(async (seat) => {
      await run(seat.chat.send("hello", [], []))
      await settle()
      expect(notices(seat)).toEqual([])
      expect(record()[0]?.["taught"]).toBeUndefined()
    })
  }, 20_000)

  test("a node the SET does not declare teaches nothing — a binding onto a trashed row", async () => {
    // `charge` answers for `spaces` alone, which is what a composition root
    // does for a node the vault has stopped declaring. Telling an agent its
    // memory is a node that is not there is worse than telling it nothing.
    bind([{ node: "gone", agent: "opencode", session: "sess-1" }])
    await withChat(async (seat) => {
      await run(seat.chat.send("hello", [], []))
      await settle()
      expect(notices(seat)).toEqual([])
      expect(record()[0]?.["taught"]).toBeUndefined()
    })
  }, 20_000)
})

describe("what the panel and the door learn from it", () => {
  test("`bound` names the node the OPEN conversation belongs to, and follows a switch", async () => {
    bind([{ node: "spaces", agent: "opencode", session: "sess-1" }])
    await withChat(async (seat) => {
      expect(seat.state().bound).toBe("spaces")

      // A fresh conversation belongs to whoever claims IT — and nobody claims
      // `sess-2` here, so the panel belongs to nobody rather than carrying the
      // last conversation's node across.
      await run(seat.chat.newSession("opencode"))
      const deadline = Date.now() + 8_000
      while (Date.now() < deadline && seat.chat.state().session?.id !== "sess-2") await settle(20)
      expect(seat.state().bound).toBe(null)
    })
  }, 20_000)

  test("the door's line lands at the TURN BOUNDARY, with the row's own instant", async () => {
    bind([{ node: "spaces", agent: "opencode", session: "sess-1" }])
    await withChat(async (seat) => {
      expect(record()[0]?.["said"]).toBeUndefined()
      await run(seat.chat.send("what is blocking the connector?", [], []))
      await settle()

      const said = record()[0]?.["said"] as { text: string; at: string } | undefined
      // The fixture says back what it was given, so the agent's first line is
      // the person's own words — and the door's line is the AGENT's row.
      expect(said?.text).toContain("heard: what is blocking the connector?")
      // The instant is the ROW's, not the moment the turn ended: the row is in
      // the transcript with exactly that stamp on it.
      const row = seat.rows().find((one) => one.kind === "agent")
      expect(said?.at).toBe(row?.since as string)
    })
  }, 20_000)
})
