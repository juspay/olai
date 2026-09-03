/**
 * THE KEYSTONE, AT THE LAYER THAT IMPLEMENTS IT — a real chat, over a real
 * subprocess, with a real record on a real disk.
 *
 * The pieces already had suites: what the record holds across a restart
 * (`./sessions.test.ts`), what the words are (`./teaching.test.ts`), and which
 * row becomes a door's line (`./heard.test.ts`). What none of them could see is
 * the RULE, which lives nowhere but `./chat.ts`'s send path — the gate on
 * `taught`, the gate on the row's delivery mark, and the turn boundary the
 * heard line is taken at. Nothing anywhere built `make` with
 * `Options.overheard` and `Options.agentAt`, so an inverted gate or a moved
 * publish would have greened the whole tree.
 *
 * The FIXTURE is what makes it assertable from outside: it says back the prompt
 * it was given (`./fixtures/teaching-agent.ts`), so a case reads what the agent
 * actually received rather than trusting the panel's own notice — which is
 * built from the same value and would be one half of the pair vouching for the
 * other. Both are asserted, separately, for that reason.
 *
 * WHICH NODE AGENT A CONVERSATION IS is the VAULT's answer since the human's
 * ruling of 2026-09-02 (`@olai/format`'s `agents.ts`), and it reaches this
 * package as a thunk the composition root fills. So the cases below arrange it
 * by saying what the set says — including the one thing only a property can do,
 * which is move under an open panel.
 */

import { afterEach, beforeEach, describe, expect, test } from "bun:test"
import { Effect } from "effect"
import { chmodSync, mkdtempSync, readFileSync, rmSync } from "node:fs"
import { tmpdir } from "node:os"
import { join } from "node:path"

import type { NodeAgent } from "@olai/format"
import { canonical, digestOf } from "@olai/state"
import type { ChatEntry, ChatState } from "@olai/surface"

import { QUEUES } from "./agents/legs.testlib.ts"
import type { Installed } from "./agents/roster.ts"
import { type Chat, make as makeChat } from "./chat.ts"
import { forDirectory as sessionsIn } from "./sessions.ts"
import { teachingFor } from "./teaching.ts"

const FIXTURE = join(import.meta.dirname, "fixtures", "teaching-agent.ts")

/** The node agent every case here is about — the vault's own row, which is
 *  what `Options.agentAt` answers with (`@olai/format`'s {@link NodeAgent}). */
const SPACES: NodeAgent = {
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
let state = ""
const wasState = process.env["XDG_STATE_HOME"]

/** THE VAULT, as this case's set answers it — mutable, because the one thing a
 *  property can do that a fixture list cannot is move while a panel is open. */
let claimed: ReadonlyArray<NodeAgent> = []

beforeEach(() => {
  cwd = mkdtempSync(join(tmpdir(), "olai-teaching-"))
  state = mkdtempSync(join(tmpdir(), "olai-teaching-state-"))
  process.env["XDG_STATE_HOME"] = state
  claimed = [SPACES]
})

afterEach(() => {
  if (wasState === undefined) delete process.env["XDG_STATE_HOME"]
  else process.env["XDG_STATE_HOME"] = wasState
  rmSync(cwd, { recursive: true, force: true })
  rmSync(state, { recursive: true, force: true })
})

const at = (): string => join(state, "olai", "heard", `${digestOf(canonical(cwd))}.json`)

/** What olai has written down about this directory's conversations — where the
 *  two facts it overhears land. Empty before it has overheard anything, which
 *  is a file that is not there at all. */
const record = (): ReadonlyArray<Record<string, unknown>> => {
  try {
    return (JSON.parse(readFileSync(at(), "utf8")) as {
      heard: ReadonlyArray<Record<string, unknown>>
    }).heard
  } catch {
    return []
  }
}

/** ... and one conversation's row of it. */
const overheardIn = (session: string): Record<string, unknown> | undefined =>
  record().find((row) => row["session"] === session)

const run = <A, E>(effect: Effect.Effect<A, E>): Promise<A> => Effect.runPromise(effect)
const settle = (ms = 250) => Effect.runPromise(Effect.sleep(`${ms} millis`))

interface Seat {
  readonly chat: Chat
  /** Every row the chat published, in order — a test's transcript. */
  readonly rows: () => ReadonlyArray<ChatEntry>
  readonly state: () => ChatState
}

/**
 * A chat over the fixture agent, opened and ready.
 *
 * `agentAt` is the composition root's own shape (`@olai/server`'s `agents.ts`):
 * the PAIR is looked up against what the set says, so a conversation no
 * property names answers `null` and nothing is taught.
 */
const withChat = async (body: (seat: Seat) => Promise<void>): Promise<void> => {
  const entries = new Map<string, ChatEntry>()
  let published: ChatState | null = null
  const chat = await run(makeChat({
    roster: [ROW],
    engines: [],
    cwd,
    tools: () => null,
    overheard: await run(sessionsIn(cwd)),
    agentAt: (to) =>
      claimed.find((one) => one.engine === to.agent && one.session === to.session) ?? null,
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
    await withChat(async (seat) => {
      await run(seat.chat.send("what is blocking the connector?", [], []))
      await settle()

      // What the agent was actually given: the person's words, then olai's
      // lines under them, which is the seam every annotation rides.
      const [said] = heard(seat)
      expect(said).toContain("what is blocking the connector?")
      expect(said).toContain("This conversation is the node agent for “Xyne Spaces — the org OS”")
      expect(said).toContain(LAW)

      // ... and the same value, verbatim, where a person can read it — in
      // this ORDER: under the message it rode, and BEFORE the agent's first
      // answer row, by CONSTRUCTION rather than by pace: the mark the notice
      // reports on is the turn fork's first act — awaited ahead of the
      // `prompt` call the answer must come back across — so on this lane no
      // answer frame can exist while the notice has not landed, and no disk
      // speed is being raced here.
      expect(notices(seat)).toEqual([teachingFor(SPACES).join("\n")])
      const kinds = seat.rows().map((row) => row.kind)
      expect(kinds.indexOf("notice")).toBeGreaterThan(kinds.indexOf("user"))
      expect(kinds.indexOf("notice")).toBeLessThan(kinds.indexOf("agent"))

      // ... and it is written down, so the next boot does not say it again.
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
    // The window a DETACHED write always was: `begin`'s fork starts the turn,
    // the send ends under it, and the second send — the same tick, the
    // ordinary reach for the box — reads `taught` on a mirror that is a
    // millisecond short of true. The RED this pinned against, played before
    // the hail existed: both prompt forks and BOTH notices up — a second
    // teaching in one conversation, the rule's own sentence. With it: the
    // first send's `send` holds until its fork's first act has landed — the
    // write, not the write's scheduling — so the answer below can only be
    // construction, not pace.
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

  test("a RESTART does not re-teach an assigned chat — the report of 2026-09-02", async () => {
    // Seen on the team deploy: an opencode conversation ASSIGNED to a node
    // agent, taught its migration contract on the message after the assign —
    // and the same `[olai] This conversation has been ASSIGNED…` preamble rode
    // the next message after a redeploy, nowhere near the session's first.
    claimed = []
    await withChat(async (seat) => {
      // A chat with a life before it had a node: no binding, so nothing is
      // taught on its way by.
      await run(seat.chat.send("before it had a node", [], []))
      await settle()
      expect(notices(seat)).toEqual([])

      // The assign gesture's two halves (`@olai/server`'s `assignSession`):
      // the property lands, and that it arrived by assignment is written down.
      claimed = [SPACES]
      await run(seat.chat.assigned({ agent: "opencode", session: "sess-1" }))

      // The next message carries the MIGRATION contract — once — and the mark
      // lands, so this whole sequence never happens again.
      await run(seat.chat.send("now that it has one", [], []))
      await settle()
      expect(notices(seat)).toEqual([teachingFor(SPACES, "assigned").join("\n")])
      expect(overheardIn("sess-1")?.["assigned"]).toBe(true)
      expect(overheardIn("sess-1")?.["taught"]).toBe(true)
    })

    // THE REDEPLOY: process down, everything rebuilt — a new record over the
    // same file, a new agent subprocess minting the same session id, and a
    // message that is nowhere near the conversation's first.
    await withChat(async (seat) => {
      await run(seat.chat.send("after the redeploy", [], []))
      await settle()
      expect(notices(seat)).toEqual([])
      const [said] = heard(seat)
      expect(said).toContain("after the redeploy")
      expect(said).not.toContain("[olai]")
    })
  }, 30_000)

  test("a teach mark the disk REFUSED ships no notice — the failure costs one LATER telling, never a second one", async () => {
    // The report of 2026-09-02, with the deploy's lost write played by a
    // record gone read-only: the assign's mark landed (it is the gesture's
    // OWN write, {@link Chat.assigned}) and the message after it was TAKEN —
    // but the teach mark write that was supposed to ride with it failed,
    // which is the one shape the incident's row can have had: `assigned`
    // written, `taught` not. The unfixed send publishes the notice anyway —
    // the write is forked BEHIND it and a failure is only logged — so the
    // pane reads a contract the disk never promised it would keep, and the
    // message after the redeploy says the whole thing again.
    await withChat(async (seat) => {
      await run(seat.chat.assigned({ agent: "opencode", session: "sess-1" }))
      expect(overheardIn("sess-1")?.["assigned"]).toBe(true)

      const dir = join(state, "olai", "heard")
      chmodSync(dir, 0o555)
      try {
        await run(seat.chat.send("now that it has one", [], []))
        await settle()
      } finally {
        chmodSync(dir, 0o755)
      }

      // The agent TOOK the message — the lines ride its prompt's TEXT, which
      // `send` assembles ahead of the write — and on the WIRE the write goes
      // first and its failure still releases the prompt: the one hinge here
      // is that nothing LANDED, and so nothing may be SHOWN. That last
      // assertion is THE RED here: the unfixed code publishes the notice
      // over a mark that did not write, and the pane has read a contract the
      // record cannot keep.
      expect(heard(seat)[0]).toContain("[olai]")
      expect(overheardIn("sess-1")?.["taught"]).toBeUndefined()
      expect(notices(seat)).toEqual([])
    })

    // THE REDEPLOY: the record carries the assign and NOT the teaching — the
    // incident's row, verbatim. The next message says the contract, once,
    // because a re-telling with a written-down REASON is not the violation
    // being filed; the violation is a pane that says it TWICE.
    await withChat(async (seat) => {
      await run(seat.chat.send("after the redeploy", [], []))
      await settle()
      expect(notices(seat)).toEqual([teachingFor(SPACES, "assigned").join("\n")])
      expect(overheardIn("sess-1")?.["taught"]).toBe(true)
    })
  }, 30_000)

  test("a session ALREADY marked in the record is never taught at all", async () => {
    const kept = await run(sessionsIn(cwd))
    await run(kept.teach({ agent: "opencode", session: "sess-1" }))
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

      // The property re-pointed at the new conversation, which is what the
      // `•••` verb writes. If the mark were per NODE this would inherit the
      // first session's — exactly the failure the transcript-is-not-memory rule
      // exists to prevent.
      claimed = [{ ...SPACES, session: "sess-2" }]

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
    // The property names another conversation entirely — which is every
    // conversation in olai but the bound ones.
    claimed = [{ ...SPACES, session: "somebody-else" }]
    await withChat(async (seat) => {
      await run(seat.chat.send("hello", [], []))
      await settle()
      expect(notices(seat)).toEqual([])
      expect(overheardIn("sess-1")?.["taught"]).toBeUndefined()
    })
  }, 20_000)

  test("a node the SET no longer declares teaches nothing — a property on a trashed row", async () => {
    // What a composition root answers once the vault has stopped declaring the
    // node: telling an agent its memory is a record that is not there is worse
    // than telling it nothing.
    claimed = []
    await withChat(async (seat) => {
      await run(seat.chat.send("hello", [], []))
      await settle()
      expect(notices(seat)).toEqual([])
      expect(overheardIn("sess-1")?.["taught"]).toBeUndefined()
    })
  }, 20_000)
})

describe("what the panel and the door learn from it", () => {
  test("`bound` names the node the OPEN conversation belongs to, and follows a switch", async () => {
    await withChat(async (seat) => {
      expect(seat.state().bound).toBe("spaces")

      // A fresh conversation belongs to whoever claims IT — and the property
      // still names `sess-1`, so the panel belongs to nobody rather than
      // carrying the last conversation's node across.
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
