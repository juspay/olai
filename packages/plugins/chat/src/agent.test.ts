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
import { existsSync, mkdtempSync, readFileSync, rmSync } from "node:fs"
import { tmpdir } from "node:os"
import { join } from "node:path"

import { type Agent, adopt, authOf, childEnvOf, fromElsewhere, goneOf, make } from "./agent.ts"
import { SAYS_NOTHING } from "./agents/legs.testlib.ts"
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
        id: "an-agent",
        leg: SAYS_NOTHING,
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

describe("what a refusal says about a signature", () => {
  /** ACP's own code for "authenticate first" — the one number a sign-in row is
   *  drawn out of (`-32000` in the protocol's table, and the code the pinned
   *  adapters answer with from `session/new`, `session/load` and a turn
   *  alike). */
  const AUTH_REQUIRED = -32000

  test("the protocol's auth-required code is a sign-in", () => {
    expect(authOf(new RequestError(AUTH_REQUIRED, "Authentication required"))).toBe(true)
    // ... AND IT IS STILL A REFUSAL: the agent answered and the request can
    // honestly be offered again, which is what the panel's two faces are drawn
    // out of. The two readings are of one rejection and neither overrides the
    // other.
    expect(goneOf(new RequestError(AUTH_REQUIRED, "Authentication required"))).toBe("refused")
  })

  test("the code a failed sign-in answers with is NOT one", () => {
    // The pinned Codex adapter answers `authenticate` with `invalidParams` when
    // its own login did not go through. That is "the attempt failed", which the
    // sign-in row says in the agent's own words — not "you are not signed in",
    // which is what puts the chooser back on screen.
    expect(authOf(new RequestError(-32602, "Invalid params"))).toBe(false)
  })

  test("silence is not a signature either", () => {
    // A dead pipe, a deadline, something nothing has seen before: none of them
    // is an agent asking to be signed in, and a row offering a sign-in because
    // a connection died would be a row about the wrong thing.
    expect(authOf(new Error("ACP connection closed"))).toBe(false)
    expect(authOf("something nobody has seen before")).toBe(false)
    expect(authOf(null)).toBe(false)
  })
})

describe("the environment a spawned child gets", () => {
  test("the adapter's unset list is removed and everything else survives", () => {
    // The rule a remote-detecting adapter depends on: olai IS the far end of a
    // browser, so the variables that mean "somewhere else" are taken away from
    // its spawn — and taking them away may not cost anything else.
    const env = childEnvOf(
      { PATH: "/bin", SSH_CONNECTION: "10.0.0.1 1 2", KEEP: "yes" },
      { EXTRA: "1" },
      ["NO_BROWSER", "SSH_CONNECTION", "SSH_CLIENT", "SSH_TTY", "CLAUDE_CODE_REMOTE"],
    )
    expect(env).toEqual({ PATH: "/bin", KEEP: "yes", EXTRA: "1" })
  })

  test("olai's own environment is not edited", () => {
    // A removal done on `process.env` itself would outlive the spawn and change
    // every later child of this process — including the next agent's.
    const base: NodeJS.ProcessEnv = { SSH_TTY: "/dev/pts/1", PATH: "/bin" }
    childEnvOf(base, undefined, ["SSH_TTY"])
    expect(base).toEqual({ SSH_TTY: "/dev/pts/1", PATH: "/bin" })
  })

  test("an adapter that unset nothing inherits exactly what it was given", () => {
    expect(childEnvOf({ PATH: "/bin" }, undefined, undefined)).toEqual({ PATH: "/bin" })
  })
})

describe("who gets a sign-in attempt", () => {
  /** A bench agent whose handshake offers two `terminal` methods, each running
   *  the same script — which records its own spawn, the one observation that
   *  says how many PROCESSES there were. */
  const bench = async (
    body: (it: { agent: Agent; spawned: () => number }) => Promise<void>,
  ): Promise<void> => {
    const cwd = mkdtempSync(join(tmpdir(), "olai-signin-"))
    const log = join(cwd, "spawns.log")
    const agent = await Effect.runPromise(make({
      id: "auth-agent",
      leg: SAYS_NOTHING,
      command: process.execPath,
      args: [join(import.meta.dirname, "fixtures/auth-agent.ts")],
      env: {
        OLAI_TEST_LOGIN_SCRIPT: join(import.meta.dirname, "fixtures/auth-login.ts"),
        OLAI_TEST_LOGIN_LOG: log,
      },
      cwd,
      tools: () => null,
      memory: REMEMBERS_NOTHING,
      onEvent: () => {},
    }))
    try {
      await body({
        agent,
        spawned: () =>
          existsSync(log) ? readFileSync(log, "utf8").trim().split("\n").filter(Boolean).length : 0,
      })
    } finally {
      await Effect.runPromise(agent.stop)
      rmSync(cwd, { recursive: true, force: true })
    }
  }

  test("two presses in one instant take ONE attempt, and the second attaches", async () => {
    // THE RACE THE CLAIM EXISTS FOR: nothing yields between reading the slot and
    // filling it, so the second caller — another tab, the same tick — finds it
    // taken. Exercised as concurrency rather than as a sequence: pressed one
    // after the other, an attempt that has already ENDED is a new attempt, which
    // is the ordinary case and says nothing about this one.
    await bench(async ({ agent, spawned }) => {
      const outcomes = await Effect.runPromise(
        Effect.forEach([1, 2], () => agent.signIn("fake-login"), { concurrency: "unbounded" }),
      )
      expect([...outcomes].sort()).toEqual(["attached", "signed-in"])
      expect(spawned()).toBe(1)
    })
  })

  test("a different method while one is running is refused, not attached", async () => {
    // Two presses on two methods is two credential stores being written at
    // once, which is the one thing this must not do — so the second is told no
    // in words rather than quietly joining the first.
    await bench(async ({ agent, spawned }) => {
      const outcomes = await Effect.runPromise(
        Effect.forEach(
          ["fake-login", "other-login"],
          (method) => Effect.result(agent.signIn(method)),
          { concurrency: "unbounded" },
        ),
      )
      // ONE of them ran and one of them was refused, whichever order the two
      // fibers got there in — and the one that ran is a sign-in either way,
      // because `other-login` writes no command line of its own and is read
      // against this agent's argv (`methodsIn`).
      const ran = outcomes.filter((outcome) => outcome._tag === "Success")
      expect(ran).toHaveLength(1)
      expect(ran[0]?._tag === "Success" ? ran[0].success : null).toBe("signed-in")
      const refused = outcomes.filter((outcome) => outcome._tag === "Failure")
      expect(refused).toHaveLength(1)
      expect(refused[0]?._tag === "Failure" ? refused[0].failure.why : "")
        .toContain("already running")
      expect(spawned()).toBe(1)
    })
  })

  test("a method that wrote no command line runs the agent binary with its own args", async () => {
    // THE PROTOCOL'S OTHER SPELLING, and the one the pinned pi adapter actually
    // uses: a `terminal` method may carry no `_meta["terminal-auth"]` at all,
    // and the args are then "additional arguments to pass when running the
    // agent binary" — the BINARY, which is what the client spawns.
    await bench(async ({ agent, spawned }) => {
      expect(await Effect.runPromise(agent.signIn("other-login"))).toBe("signed-in")
      expect(spawned()).toBe(1)
    })
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
