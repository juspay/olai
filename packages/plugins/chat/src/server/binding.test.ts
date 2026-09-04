/**
 * THE TWO GESTURES THAT BIND A NODE TO A CONVERSATION — the orders, and the one
 * refusal.
 *
 * ## Where these came from and what changed
 *
 * They were `@olai/server`'s `runtime.test.ts`, driven through a bound surface
 * against a real store: the case pressed `surface/chat/assignSession` and then
 * read the `.olai` file off the disk. Both halves of that were the composition
 * root's while the composition root composed the gesture — and it does not, any
 * more. What survives is every claim, held one layer in: the ORDER, the
 * lineage, and the refusal.
 *
 * The property write is a door now ({@link ../../../plugin-api/src/services.ts}'s
 * `Ops.prop`), so the durable half is a recorded call rather than a file read.
 * That is not a weaker claim about ordering — the cases below assert what was
 * written AND that nothing was written where the gesture refused, which is what
 * the disk read was there to say.
 */

import { expect, test } from "bun:test"
import { Effect } from "effect"

import { CHAT_OFF } from "../wire/members.ts"
import { SESSION_TYPE } from "../kinds.ts"
import type { Chat } from "../scoped.ts"
import { assignSession, type Binding, startAgentSession } from "./binding.ts"

/** Every member no gesture here reaches. A DEATH rather than a refusal: a case
 *  that called one would be asking about something this module does not own,
 *  and a refusal it could catch would let it. */
const elsewhere = Effect.die(new Error("this stub chat opens conversations and nothing else"))

/**
 * A CHAT THAT DOES NOTHING BUT OPEN CONVERSATIONS.
 *
 * `opens` is the ids `newSession` and `startAgentSession` walk through, in
 * order — which is how a real agent answers: the verb hands back nothing and the
 * STATE is where every reader learns which conversation appeared.
 */
const chatOpening = (opens: ReadonlyArray<string>): {
  readonly chat: Chat
  readonly assigned: ReadonlyArray<
    { readonly node: string | null; readonly agent: string; readonly session: string }
  >
  readonly replaced: ReadonlyArray<
    { readonly agent: string; readonly session: string; readonly by: string }
  >
} => {
  const assigned: Array<
    { readonly node: string | null; readonly agent: string; readonly session: string }
  > = []
  const replaced: Array<
    { readonly agent: string; readonly session: string; readonly by: string }
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
    assigned: (to: { readonly agent: string; readonly session: string }) =>
      Effect.sync(() => void assigned.push({ node: null, ...to })),
    assignedTo: (
      node: string,
      to: { readonly agent: string; readonly session: string },
    ) => Effect.sync(() => void assigned.push({ node, ...to })),
    replaced: (to: { readonly agent: string; readonly session: string }, by: string) =>
      Effect.sync(() => void replaced.push({ ...to, by })),
    reread: () => {},
    send: () => elsewhere,
    attach: () => elsewhere,
    resend: () => elsewhere,
    cancel: elsewhere,
    newSession: () => Effect.sync(() => void (at += 1)),
    startAgentSession: () => Effect.sync(() => void (at += 1)),
    chooseAgent: () => elsewhere,
    loadSession: () => elsewhere,
    reopen: elsewhere,
    sessions: elsewhere,
    answer: () => elsewhere,
    recordRefusal: () => Effect.void,
    scope: () => elsewhere,
    start: Effect.void,
    stop: Effect.void,
    doorFor: () => ({ scopes: () => [], ringing: () => [], deliver: () => elsewhere }),
    faults: () => elsewhere,
  } as unknown as Chat
  return { chat, assigned, replaced }
}

/** The two readings a binding reaches, as a recorder: what the vault says this
 *  node is bound to, and every property write that landed. */
const binding = (
  bound: { readonly engine: string; readonly session: string | null; readonly title: string } | null,
): Binding & { readonly wrote: ReadonlyArray<{ node: string; value: string }> } => {
  const wrote: Array<{ node: string; value: string }> = []
  return {
    wrote,
    boundAt: () => bound,
    // The key the roster would resolve on a vault that has declared nothing —
    // the word this kind claims (`../kinds.ts`). It is spent by the refusal
    // below and by nothing else, which is why this stub records no key.
    key: () => SESSION_TYPE,
    write: (node, value) => Effect.sync(() => void wrote.push({ node, value })),
  }
}

/**
 * ASSIGNING A CHAT is one property and one mark, in that order.
 *
 * The order is the guarantee: the property IS the assignment, so a mark written
 * before a write that then failed would be a session believing it had been
 * assigned to a node that never claimed it. And the mark is what the session is
 * taught by on its next message — the distillation order rather than the
 * standing law — which is the whole reason this is a verb at all rather than an
 * `edit.apply` from a browser.
 */
test("a chat assigned to a bare node lands as one property, and is marked as having arrived that way", async () => {
  const it = chatOpening([])
  const at = binding(null)
  await Effect.runPromise(
    assignSession(it.chat, at, { node: "a", agent: "claude", session: "fake-stored-new" }),
  )
  // THE ENGINE AND THE SESSION AS ONE VALUE: a property naming one engine and
  // another engine's conversation would be a node agent nobody could open.
  expect(at.wrote).toEqual([{ node: "a", value: "claude:fake-stored-new" }])
  expect(it.assigned).toEqual([{ node: "a", agent: "claude", session: "fake-stored-new" }])
})

/**
 * ... AND A NODE ALREADY TALKING THROUGH ONE REFUSES, in a plain sentence.
 *
 * One agent, one current session. The browser dims such a node where somebody
 * can see it before pressing, which is a courtesy; THIS is the check, because a
 * tab decides against the frame it was drawn on and two tabs can be looking at
 * one node.
 *
 * The negative beside it is the half that matters: nothing was written, and
 * nothing was marked. A refusal that had already rewritten the property would be
 * the one outcome a person cannot undo by pressing anything.
 */
test("a node already talking through a conversation refuses, and nothing is written", async () => {
  const it = chatOpening([])
  const at = binding({ engine: "claude", session: "fake-session-1", title: "a" })
  const said = await Effect.runPromise(
    Effect.flip(
      assignSession(it.chat, at, { node: "a", agent: "claude", session: "fake-stored-new" }),
    ),
  )
  expect(said.reason).toContain("already talking through a conversation")
  expect(said.reason).toContain("one agent, one current session")
  // ...and it names the column the board actually keeps the binding in, which
  // is the roster's answer rather than a constant: "take the session off its
  // `…` property" is only actionable if the key is the one in the file.
  expect(said.reason).toContain(`\`${SESSION_TYPE}\``)
  expect(at.wrote).toEqual([])
  expect(it.assigned).toEqual([])
})

/**
 * A FRESH SESSION records what it replaced, so the conversation it replaced is
 * not orphaned.
 *
 * Nothing else records it: no `/clear` happened, so no adapter has anything to
 * say about this supersession (`../succession.ts`). Without the mark the node
 * agent's own previous conversation comes back under Unassigned, inviting
 * somebody to assign it to the node it already belonged to — which is the one
 * node that would refuse it.
 */
test("a fresh session on a bound node re-points the property and records what it replaced", async () => {
  const it = chatOpening(["fake-session-2"])
  const at = binding({ engine: "claude", session: "fake-session-1", title: "a" })
  await Effect.runPromise(startAgentSession(it.chat, at, { node: "a", agent: "claude" }))
  expect(at.wrote).toEqual([{ node: "a", value: "claude:fake-session-2" }])
  expect(it.replaced).toEqual([
    { agent: "claude", session: "fake-session-1", by: "fake-session-2" },
  ])
})

/** ... and a node that had no session replaced nothing, which is every press of
 *  the `•••` verb this gesture was written for. */
test("starting a session on an unbound node records no supersession", async () => {
  const it = chatOpening(["fake-session-1"])
  const at = binding({ engine: "claude", session: null, title: "a" })
  await Effect.runPromise(startAgentSession(it.chat, at, { node: "a", agent: "claude" }))
  expect(at.wrote).toEqual([{ node: "a", value: "claude:fake-session-1" }])
  expect(it.replaced).toEqual([])
})

/** ... and neither does an agent that answers with the conversation the node was
 *  already in, which is what the scripted agent does on every open: a session
 *  must not be recorded as having superseded itself. */
test("a fresh session that comes back as the same conversation supersedes nothing", async () => {
  const it = chatOpening(["fake-session-1"])
  const at = binding({ engine: "claude", session: "fake-session-1", title: "a" })
  await Effect.runPromise(startAgentSession(it.chat, at, { node: "a", agent: "claude" }))
  expect(it.replaced).toEqual([])
})

/** AN OPEN THAT LANDED ON NO CONVERSATION WRITES NOTHING, which is the arm the
 *  order exists for: the property is written after `newSession` has resolved, so
 *  an agent that failed to start leaves no key naming a session nobody opened. */
test("an open that produced no conversation refuses, and writes no property", async () => {
  const it = chatOpening([])
  const at = binding(null)
  const said = await Effect.runPromise(
    Effect.flip(startAgentSession(it.chat, at, { node: "a", agent: "claude" })),
  )
  expect(said.reason).toContain("opened no conversation")
  expect(at.wrote).toEqual([])
})
