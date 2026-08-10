/**
 * Which stream a line lands on, held against the one subcommand it can break.
 *
 * `olai mcp` answers JSON-RPC frames on stdout. A log line written there is a
 * frame that is not a frame, and the client parsing it has no way to know that
 * — so "the stderr sink writes to stderr" is a protocol property, not a
 * preference, and it is asserted rather than argued.
 *
 * Through Effect's own `TestConsole` rather than a spy on the global one:
 * these loggers write through the fiber's `Console` service, which is the thing
 * `TestConsole` is for, and swapping a service beats monkey-patching a global
 * that every other test in the process shares.
 */

import { expect, test } from "bun:test"
import { Effect, Layer } from "effect"
import { TestConsole } from "effect/testing"

import { toStderr, toStdout } from "./sinks.ts"

/** Say one thing through `sink`, and answer which stream it went to. */
const written = (
  sink: Layer.Layer<never>,
): Promise<{ readonly out: ReadonlyArray<unknown>; readonly err: ReadonlyArray<unknown> }> =>
  Effect.gen(function*() {
    yield* Effect.logInfo("serving").pipe(
      Effect.annotateLogs({ url: "http://127.0.0.1:7714" }),
      Effect.provide(sink),
    )
    return { out: yield* TestConsole.logLines, err: yield* TestConsole.errorLines }
  }).pipe(Effect.provide(TestConsole.layer), Effect.runPromise)

test("the stdout sink writes logfmt on stdout", async () => {
  const { err, out } = await written(toStdout)

  expect(err).toEqual([])
  expect(out).toHaveLength(1)
  // The shape the e2e suite reads the server's address out of: one line, the
  // level as a field, and every varying value its own `key=value`.
  const line = String(out[0])
  expect(line).toContain("level=Info")
  expect(line).toContain("message=serving")
  expect(line).toContain("url=http://127.0.0.1:7714")
  expect(line).not.toContain("\n")
})

test("the stderr sink writes the same line on stderr, so stdout stays the protocol", async () => {
  const { err, out } = await written(toStderr)

  expect(out).toEqual([])
  expect(err).toHaveLength(1)
  expect(String(err[0])).toContain("message=serving")
  expect(String(err[0])).toContain("url=http://127.0.0.1:7714")
})
