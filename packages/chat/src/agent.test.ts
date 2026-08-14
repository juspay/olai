/**
 * The two things about the ACP client that can be asserted without a protocol:
 * WHICH conversation a boot opens in, and what it says when the executable it
 * was pointed at will not run.
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

import { describe, expect, test } from "bun:test"
import { Effect } from "effect"

import { adopt, make } from "./agent.ts"
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
const NEWEST: Stored = { id: "b", title: "somebody else's", updatedAt: "2026-08-13T10:00:00Z" }
const OLDER: Stored = { id: "a", title: "mine", updatedAt: "2026-07-01T09:00:00Z" }
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

    await Effect.runPromise(agent.stop)
  })
})
