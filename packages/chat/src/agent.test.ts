/**
 * The one thing about the ACP client that can be asserted without a protocol:
 * what it says when the executable it was pointed at will not run.
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

import { make } from "./agent.ts"

const NOWHERE = "/nonexistent/olai-test/acp-agent"

describe("an agent that will not start", () => {
  test("refuses with the file it was pointed at, not with our end of the pipe", async () => {
    const agent = await Effect.runPromise(
      make({
        command: NOWHERE,
        args: [],
        cwd: process.cwd(),
        tools: () => null,
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
