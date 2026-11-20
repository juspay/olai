import { UsageFailure } from "@olai/format"

import { expect, test } from "bun:test"
import { Effect } from "effect"

import { CHAT_OFF } from "../wire/members.ts"
import { OPENS_TYPE, SESSION_TYPE } from "../kinds.ts"
import type { Chat } from "../scoped.ts"
import { closeAgent, type Binding, NO_SLEEP_ON_A_NOTE, retie, setOpens, setSleeping, startAgentSession } from "./binding.ts"

const elsewhere = Effect.die(new Error("this stub chat opens conversations and nothing else"))

const chatOpening = (opens: ReadonlyArray<string>): {
  readonly chat: Chat
  readonly replaced: ReadonlyArray<
    { readonly agent: string; readonly session: string; readonly by: { readonly agent: string; readonly session: string } }
  >
} => {
  const replaced: Array<
    { readonly agent: string; readonly session: string; readonly by: { readonly agent: string; readonly session: string } }
  > = []
  let at = -1
  const chat = {
    entries: () => new Map(),
    state: () => ({
      ...CHAT_OFF,
      session: at < 0 || opens[at] === undefined
        ? null
        : { id: opens[at] as string, title: null, updatedAt: null },
    }),
    live: () => new Map(),
    overheard: () => [],
    replaced: (to: { readonly agent: string; readonly session: string }, by: { readonly agent: string; readonly session: string }) =>
      Effect.sync(() => void replaced.push({ ...to, by })),
    reread: () => {},
    send: () => elsewhere,
    attach: () => elsewhere,
    resend: () => elsewhere,
    cancel: elsewhere,
    newSession: () => Effect.sync(() => void (at += 1)),
    startAgentSession: (_node: string, agent: string, committed?: (to: { agent: string; session: string }) => Effect.Effect<void, import("@olai/format").OpFailure>) => Effect.gen(function*() {
      at += 1
      const session = opens[at]
      if (session === undefined || session === null) return yield* new UsageFailure({ reason: `${agent} opened no conversation to bind to this node` })
      if (committed !== undefined) yield* committed({ agent, session })
      return { agent, session }
    }),
    chooseAgent: () => elsewhere,
    loadSession: () => elsewhere,
    reopen: elsewhere,
    sessions: elsewhere,
    answer: () => elsewhere,
    recordRefusal: () => Effect.void,
    scope: () => elsewhere,
    start: Effect.void,
    stop: Effect.void,
    doorFor: () => ({ scopes: () => [], deliver: () => elsewhere }),
    faults: () => elsewhere,
  } as unknown as Chat
  return { chat, replaced }
}

const binding = (
  bound: { readonly engine: string; readonly session: string | null; readonly title: string } | null,
  notes: Record<string, string> = {},
): Binding & {
  readonly wrote: ReadonlyArray<{ node: string; value: string }>
  readonly removed: ReadonlyArray<string>
  readonly marked: ReadonlyArray<{ node: string; value: string }>
  readonly docs: ReadonlyArray<{ path: string; text: string; was: string }>
} => {
  const wrote: Array<{ node: string; value: string }> = []
  const removed: Array<string> = []
  const marked: Array<{ node: string; value: string }> = []
  const docs: Array<{ path: string; text: string; was: string }> = []
  return {
    wrote,
    removed,
    marked,
    docs,
    boundAt: () => bound,
    key: () => SESSION_TYPE,
    opensKey: () => OPENS_TYPE,
    exclusive: work => work,
    write: (node, value) => Effect.sync(() => void wrote.push({ node, value })),
    remove: (node) => Effect.sync(() => void removed.push(node)),
    mark: (node, value) => Effect.sync(() => void marked.push({ node, value })),
    text: (path) => Effect.sync(() => notes[path] ?? null),
    doc: (path, text, was) =>
      Effect.sync(() => {
        docs.push({ path, text, was })
        notes[path] = text
      }),
  }
}

test("a fresh session on a bound node re-points the property and records what it replaced", async () => {
  const it = chatOpening(["fake-session-2"])
  const at = binding({ engine: "claude", session: "fake-session-1", title: "a" })
  await Effect.runPromise(startAgentSession(it.chat, at, { node: "a", agent: "claude" }))
  expect(at.wrote).toEqual([{ node: "a", value: "claude:fake-session-2" }])
  expect(it.replaced).toEqual([
    { agent: "claude", session: "fake-session-1", by: { agent: "claude", session: "fake-session-2" } },
  ])
})

test("starting a session on an unbound node records no supersession", async () => {
  const it = chatOpening(["fake-session-1"])
  const at = binding({ engine: "claude", session: null, title: "a" })
  await Effect.runPromise(startAgentSession(it.chat, at, { node: "a", agent: "claude" }))
  expect(at.wrote).toEqual([{ node: "a", value: "claude:fake-session-1" }])
  expect(it.replaced).toEqual([])
})

test("a fresh session that comes back as the same conversation supersedes nothing", async () => {
  const it = chatOpening(["fake-session-1"])
  const at = binding({ engine: "claude", session: "fake-session-1", title: "a" })
  await Effect.runPromise(startAgentSession(it.chat, at, { node: "a", agent: "claude" }))
  expect(it.replaced).toEqual([])
})

test("a fresh session on another engine re-points the property and records the codex pair", async () => {
  const it = chatOpening(["fake-session-2"])
  const at = binding({ engine: "claude", session: "fake-session-1", title: "a" })
  await Effect.runPromise(startAgentSession(it.chat, at, { node: "a", agent: "codex" }))
  expect(at.wrote).toEqual([{ node: "a", value: "codex:fake-session-2" }])
  expect(it.replaced).toEqual([
    { agent: "claude", session: "fake-session-1", by: { agent: "codex", session: "fake-session-2" } },
  ])
})

test("an open that produced no conversation refuses, and writes no property", async () => {
  const it = chatOpening([])
  const at = binding(null)
  const said = await Effect.runPromise(
    Effect.flip(startAgentSession(it.chat, at, { node: "a", agent: "claude" })),
  )
  expect(said.reason).toContain("opened no conversation")
  expect(at.wrote).toEqual([])
})

test("closing a bound node takes the binding property off and supersedes nothing", async () => {
  const at = binding({ engine: "claude", session: "fake-session-1", title: "a" })
  await Effect.runPromise(closeAgent(at, { node: "a" }))
  expect(at.removed).toEqual(["a"])
  expect(at.wrote).toEqual([])
})

test("closing an unbound node refuses, and nothing is written", async () => {
  const at = binding(null)
  const said = await Effect.runPromise(Effect.flip(closeAgent(at, { node: "a" })))
  expect(said.reason).toBe("no chat is tied to `a` to close")
  expect(at.removed).toEqual([])
  expect(at.wrote).toEqual([])
})

for (const changed of [false, true]) {
  test(`an auth-refused first start ${changed ? "cannot overwrite a later binding" : "commits its real session after sign-in"}`, async () => {
    const it = chatOpening([])
    let current: ReturnType<Binding["boundAt"]> = null
    const writes: string[] = []
    let finish: ((to: { agent: string; session: string }) => Effect.Effect<void, import("@olai/format").OpFailure>) | undefined
    const at: Binding = {
      ...binding(null),
      boundAt: () => current,
      write: (_node, value) => Effect.sync(() => {
        writes.push(value)
        const [engine, session] = value.split(":")
        current = { engine: engine!, session: session ?? null, title: "node" }
      }),
    }
    const pending: Chat = { ...it.chat, startAgentSession: (_node, _agent, committed) => Effect.sync(() => {
      finish = committed
      return null
    }) }
    expect(await Effect.runPromise(startAgentSession(pending, at, { node: "a", agent: "codex" }))).toBeNull()
    expect(writes).toEqual(["codex"])
    if (changed) current = { engine: "claude", session: "elsewhere", title: "node" }
    const result = await Effect.runPromise(Effect.result(finish!({ agent: "codex", session: "opened" })))
    expect(result._tag).toBe(changed ? "Failure" : "Success")
    expect(writes).toEqual(changed ? ["codex"] : ["codex", "codex:opened"])
  })
}

test("the sleeping mark is written as `on`, and taken off by removing the key", async () => {
  const at = binding({ engine: "claude", session: "s1", title: "a" })
  await Effect.runPromise(setSleeping(at, { node: "a", on: true }))
  await Effect.runPromise(setSleeping(at, { node: "a", on: false }))
  expect(at.marked).toEqual([{ node: "a", value: "on" }, { node: "a", value: "" }])
  expect(at.wrote).toEqual([])
})

test("marking a node that is not an agent refuses, and writes nothing", async () => {
  const at = binding(null)
  const said = await Effect.runPromise(Effect.flip(setSleeping(at, { node: "a", on: true })))
  expect(said.reason).toContain("no node agent")
  expect(at.marked).toEqual([])
})

test("closing a NOTE's chat takes both of its keys off and leaves the prose alone", async () => {
  const at = binding({ engine: "claude", session: "sess-1", title: "plan" }, {
    "notes/plan.md": "---\nchat-agent-session: claude:sess-1\nchat-opens: beside\ntopic: kitchen\n---\n\n# Plan\n",
  })
  await Effect.runPromise(closeAgent(at, { node: "/notes/plan.md" }))
  expect(at.removed).toEqual([])
  expect(at.docs).toHaveLength(1)
  expect(at.docs[0]?.path).toBe("notes/plan.md")
  expect(at.docs[0]?.text).toBe("---\ntopic: kitchen\n---\n\n# Plan\n")
  expect(at.docs[0]?.was).toContain("chat-agent-session: claude:sess-1")
})

test("a note the directory no longer holds refuses in words rather than writing", async () => {
  const at = binding({ engine: "claude", session: "sess-1", title: "plan" })
  const said = await Effect.runPromise(Effect.flip(closeAgent(at, { node: "/notes/gone.md" })))
  expect(said.reason).toContain("notes/gone.md")
  expect(at.docs).toEqual([])
})

test("a note whose front matter already says what the write would say is not written at all", async () => {
  const at = binding({ engine: "claude", session: "sess-1", title: "plan" }, { "notes/plan.md": "# Plan\n" })
  await Effect.runPromise(closeAgent(at, { node: "/notes/plan.md" }))
  expect(at.docs).toEqual([])
})

test("sleep is never offered on a note, whatever its tie says", async () => {
  const at = binding({ engine: "claude", session: "sess-1", title: "plan" })
  const said = await Effect.runPromise(Effect.flip(setSleeping(at, { node: "/notes/plan.md", on: true })))
  expect(said.reason).toBe(NO_SLEEP_ON_A_NOTE)
  expect(at.marked).toEqual([])
  expect(at.docs).toEqual([])
})

test("the switch writes `beside` into the front matter and leaves everything else alone", async () => {
  const at = binding({ engine: "claude", session: "sess-1", title: "plan" }, {
    "notes/plan.md": "---\nchat-agent-session: claude:sess-1\ntopic: kitchen\n---\n\n# Plan\n",
  })
  await Effect.runPromise(setOpens(at, { path: "notes/plan.md", beside: true }))
  expect(at.docs).toHaveLength(1)
  expect(at.docs[0]?.text).toBe("---\nchat-agent-session: claude:sess-1\ntopic: kitchen\nchat-opens: beside\n---\n\n# Plan\n")
})

test("the switch back writes `alone` in place", async () => {
  const at = binding({ engine: "claude", session: "sess-1", title: "plan" }, {
    "notes/plan.md": "---\nchat-agent-session: claude:sess-1\nchat-opens: beside\n---\n\n# Plan\n",
  })
  await Effect.runPromise(setOpens(at, { path: "notes/plan.md", beside: false }))
  expect(at.docs[0]?.text).toBe("---\nchat-agent-session: claude:sess-1\nchat-opens: alone\n---\n\n# Plan\n")
})

test("a note that already says it is not written again", async () => {
  const at = binding({ engine: "claude", session: "sess-1", title: "plan" }, {
    "notes/plan.md": "---\nchat-agent-session: claude:sess-1\nchat-opens: beside\n---\n\n# Plan\n",
  })
  await Effect.runPromise(setOpens(at, { path: "notes/plan.md", beside: true }))
  expect(at.docs).toEqual([])
})

test("a note with no chat on it refuses, and writes nothing", async () => {
  const at = binding(null, { "notes/plan.md": "# Plan\n" })
  const said = await Effect.runPromise(Effect.flip(setOpens(at, { path: "notes/plan.md", beside: true })))
  expect(said.reason).toContain("notes/plan.md")
  expect(at.docs).toEqual([])
})

const roster = (seatable: boolean, owner: string | null = null) => ({
  seatable: () => seatable,
  claimedBy: () => owner,
})

test("a retie writes the conversation back into the note's front matter", async () => {
  const at = binding(null, { "notes/plan.md": "---\ntopic: kitchen\n---\n\n# Plan\n" })
  await Effect.runPromise(retie(at, roster(true), { node: "/notes/plan.md", agent: "claude", session: "sess-1" }))
  expect(at.docs).toHaveLength(1)
  expect(at.docs[0]?.text).toBe("---\ntopic: kitchen\nchat-agent-session: claude:sess-1\n---\n\n# Plan\n")
  expect(at.docs[0]?.text).not.toContain("chat-opens")
})

test("a retie onto something that is not there refuses in words and writes nothing", async () => {
  const at = binding(null, { "notes/plan.md": "# Plan\n" })
  const said = await Effect.runPromise(Effect.flip(
    retie(at, roster(false), { node: "/notes/plan.md", agent: "claude", session: "sess-1" })))
  expect(said.reason).toContain("notes/plan.md")
  expect(at.docs).toEqual([])
})

test("a retie onto an item that already names a chat is refused", async () => {
  const at = binding({ engine: "claude", session: "sess-2", title: "plan" }, {
    "notes/plan.md": "---\nchat-agent-session: claude:sess-2\n---\n\n# Plan\n",
  })
  const said = await Effect.runPromise(Effect.flip(
    retie(at, roster(true), { node: "/notes/plan.md", agent: "claude", session: "sess-1" })))
  expect(said.reason).toContain("already names a chat")
  expect(at.docs).toEqual([])
})

test("a conversation another item already names is not tied twice", async () => {
  const at = binding(null, { "notes/plan.md": "# Plan\n" })
  const said = await Effect.runPromise(Effect.flip(
    retie(at, roster(true, "install"), { node: "/notes/plan.md", agent: "claude", session: "sess-1" })))
  expect(said.reason).toContain("install")
  expect(at.docs).toEqual([])
})
