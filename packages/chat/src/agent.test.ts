/**
 * The things about the ACP client that can be asserted without a protocol:
 * WHICH conversation a boot opens in, what it says when the executable it
 * was pointed at will not run, and whether a leftover notification is about
 * a conversation this panel is not in.
 *
 * `OLAI_ACP_AGENT` is a path a PERSON sets, which makes it the likeliest thing
 * in this package to be wrong — a typo, a moved binary, a nix path that was
 * garbage-collected. It is also the case that reported the least: an exec
 * failure arrives after `spawn` has returned, so the `Effect.try` around the
 * spawn never saw one, and what came out the other end was our own write to a
 * pipe that had died with it (`initialize` failed: Cannot call write after a
 * stream was destroyed) with an uncaught `error` event's stack trace on stderr
 * beside it.
 *
 * Everything else this module does needs an agent on the other end, which is
 * what the e2e suite's scripted one is for.
 */

import { RequestError } from "@agentclientprotocol/sdk"
import { describe, expect, test } from "bun:test"
import { Effect } from "effect"

import { adopt, fromElsewhere, goneOf, make } from "./agent.ts"
import { CLAUDE } from "./agents/claude.ts"
import type { Stored } from "./events.ts"
import type { Memory } from "./memory.ts"

const NOWHERE = "/nonexistent/olai-test/acp-agent"

/** A boot that never reaches a session has nothing to remember, so it is given
 *  a memory that keeps nothing. Here rather than beside the real one
 *  ({@link ./memory.ts}), which no caller would have a use for. */
const REMEMBERS_NOTHING: Memory = {
  recall: Effect.succeed(null),
  remember: () => Effect.void,
}

/** The list as {@link storedFor} hands it over: newest first. */
const NEWEST: Stored = {
  id: "b",
  title: "somebody else's",
  updatedAt: "2026-08-13T10:00:00Z",
  messageCount: null,
  supersededBy: null,
}
const OLDER: Stored = {
  id: "a",
  title: "mine",
  updatedAt: "2026-07-01T09:00:00Z",
  messageCount: null,
  supersededBy: null,
}
const STORED: ReadonlyArray<Stored> = [NEWEST, OLDER]

describe("which conversation a boot opens in", () => {
  test("the one this panel was last in, however fresh the others are", () => {
    // The bug, as one line: `b` was written to more recently — a terminal
    // `claude` in this directory, a `/clear` sibling — and the panel was in
    // `a`. It comes back in `a`.
    expect(adopt("a", STORED)).toBe(OLDER)
  })

  test("the newest, when nothing was remembered", () => {
    // A directory served by an older olai, or one whose state home has been
    // cleaned out. The guess is still the best answer available.
    expect(adopt(null, STORED)).toBe(NEWEST)
  })

  test("the newest, when the remembered one is gone", () => {
    // Deleted, cleared away, or on a machine whose agent has been repointed.
    // Something has to be opened, and this is what that used to be always.
    expect(adopt("nowhere", STORED)).toBe(NEWEST)
  })

  test("nothing at all, when the directory has no conversations", () => {
    // Which is the caller's cue to start a fresh one rather than to load.
    expect(adopt("a", [])).toBeUndefined()
  })
})

describe("an agent that will not start", () => {
  test("refuses with the file it was pointed at, not with our end of the pipe", async () => {
    const agent = await Effect.runPromise(
      make({
        id: "claude",
        leg: CLAUDE,
        command: NOWHERE,
        args: [],
        cwd: process.cwd(),
        tools: () => null,
        memory: REMEMBERS_NOTHING,
        onEvent: () => {},
      }),
    )

    const outcome = await Effect.runPromise(Effect.result(agent.boot))

    expect(outcome._tag).toBe("Failure")
    const why = outcome._tag === "Failure" ? outcome.failure.why : ""
    // The command, because that is the thing a person can go and fix...
    expect(why).toContain(NOWHERE)
    // ... and the system's own reason, rather than the broken pipe that
    // followed it. `ENOENT` is what a path that is not there answers with; a
    // refusal that talked about a destroyed stream would pass neither line.
    expect(why).toContain("ENOENT")
    expect(why).not.toContain("stream was destroyed")
    // ... and it is UNREACHABLE, which is the half a caller acts on and says
    // both of the things there are to say: nothing was asked of anything —
    // because there was nothing to ask — so the message certainly did not go
    // and the row may honestly offer to send it again; and there is no agent,
    // so the panel says that rather than `ready`. It is deliberately not
    // `refused`, which is reserved for the agent itself answering no.
    expect(outcome._tag === "Failure" ? outcome.failure.gone : null).toBe("unreachable")

    await Effect.runPromise(agent.stop)
  })
})

describe("what a failure says about whether the message went", () => {
  // The distinction this whole feature rests on, at the one place it is
  // decided: the SDK gives an error RESPONSE its own class and rejects with a
  // plain `Error` for everything else, so "did anything answer" is a question
  // about the rejection rather than about the sentence in it.

  test("an error response is the agent answering: refused", () => {
    // What `refuse steering` produces, and what an agent with no such method
    // produces: a JSON-RPC error frame, matched back to the request waiting on
    // it. Nothing took the message.
    expect(goneOf(new RequestError(-32000, "this turn cannot be steered"))).toBe("refused")
  })

  test("a connection that died is not an answer: unanswered", () => {
    // Every pending request is rejected with this when the pipe goes. The
    // request may have been read before it went — that is exactly the doubt
    // this value carries.
    expect(goneOf(new Error("ACP connection closed"))).toBe("unanswered")
  })

  test("anything else reads as unanswered, which is the safe direction", () => {
    // An unrecognised rejection offers a person nothing, rather than offering
    // a retry that could duplicate a message the agent already has.
    expect(goneOf("something nobody has seen before")).toBe("unanswered")
  })

  test("nothing read off a rejection is ever `unreachable`", () => {
    // The claim that makes `refused` mean ONE thing, which is what the panel's
    // second face is drawn out of: `unreachable` is minted where there was
    // nothing to reject at all — no process, no session, a pipe that would not
    // take a write — so a value read off a REJECTION cannot be it, and a
    // caller asking "is there still an agent" can read `refused` as "yes, it
    // just spoke" rather than having to know where in the module it stands.
    for (
      const cause of [
        new RequestError(-32603, "internal error"),
        new Error("ACP connection closed"),
        "something nobody has seen before",
        null,
      ]
    ) {
      expect(goneOf(cause)).not.toBe("unreachable")
    }
  })
})

describe("whose session a leftover notification is about", () => {
  // The hole: `elsewhere` used to require a current session to refuse a
  // mismatch, so the window between leaving one conversation and entering
  // the next — `session === null` — let a forwarded `init` (or a chunk of
  // the last turn) land on the next roster and the next transcript.

  const closed = new Set(["old"])

  test("a leftover from a conversation we left is from elsewhere, even in none", () => {
    // THE PIN. `session` is null for the whole of a new/load, including
    // after the next roster has been announced. A named leftover has to be
    // recognised by having been left, not by failing to match a current id
    // we do not have yet.
    expect(fromElsewhere("old", null, closed)).toBe(true)
  })

  test("a leftover is from elsewhere once we are in the next conversation too", () => {
    expect(fromElsewhere("old", "new", closed)).toBe(true)
  })

  test("the conversation we are in is not from elsewhere", () => {
    expect(fromElsewhere("new", "new", closed)).toBe(false)
  })

  test("a load's replay is not from elsewhere: we are in none, and it is not closed", () => {
    // Replay names the conversation before `entered` records it. Refusing
    // every named message while `session` is null would draw a load as empty.
    expect(fromElsewhere("loading", null, closed)).toBe(false)
  })

  test("an unnamed notification is not a mismatch", () => {
    // Absence is a shape we have not seen. Dropping one would go quiet about
    // a `/model` for the life of a conversation.
    expect(fromElsewhere(undefined, null, closed)).toBe(false)
    expect(fromElsewhere(undefined, "new", closed)).toBe(false)
  })

  test("a different conversation than the one we are in is from elsewhere", () => {
    expect(fromElsewhere("other", "new", new Set())).toBe(true)
  })
})
