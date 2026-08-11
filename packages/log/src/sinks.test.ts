/**
 * Which stream a line lands on, and which face it wears.
 *
 * `olai mcp` answers JSON-RPC frames on stdout. A log line written there is a
 * frame that is not a frame, and the client parsing it has no way to know that
 * — so "the stderr sink writes to stderr" is a protocol property, not a
 * preference, and it is asserted rather than argued.
 *
 * The face is a second contract: non-TTY (and `OLAI_LOG=logfmt`) is logfmt
 * **byte-identical** to Effect's `formatLogFmt`, because the testlib decoder
 * and every agent that greps a line depend on that shape. Pretty is only for
 * a human TTY — and `OLAI_LOG=pretty` can force it even when nothing is a TTY,
 * which is what the override test proves.
 *
 * Through Effect's own `TestConsole` rather than a spy on the global one:
 * these loggers write through the fiber's `Console` service, which is the thing
 * `TestConsole` is for, and swapping a service beats monkey-patching a global
 * that every other test in the process shares.
 */

import { expect, test } from "bun:test"
import { Effect, Layer, Logger } from "effect"
import { TestConsole } from "effect/testing"

import { colorsFor, formatFor, toStderr, toStdout } from "./sinks.ts"

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

/** Force `OLAI_LOG` for the duration of `body`, then restore. */
const withOlaiLog = async <A>(
  value: string | undefined,
  body: () => Promise<A>,
): Promise<A> => {
  const prev = process.env["OLAI_LOG"]
  if (value === undefined) delete process.env["OLAI_LOG"]
  else process.env["OLAI_LOG"] = value
  try {
    return await body()
  } finally {
    if (prev === undefined) delete process.env["OLAI_LOG"]
    else process.env["OLAI_LOG"] = prev
  }
}

/**
 * One log event through `sink`, with a parallel `formatLogFmt` collector on
 * the same event (mergeWithExisting). Same timestamp, same fiber, so the two
 * strings can be compared for byte identity.
 */
const writtenWithExpected = (
  sink: Layer.Layer<never>,
): Promise<{
  readonly out: ReadonlyArray<unknown>
  readonly err: ReadonlyArray<unknown>
  readonly expected: string
}> => {
  const collected: Array<string> = []
  const collector = Logger.map(Logger.formatLogFmt, (text) => {
    collected.push(text)
  })
  return Effect.gen(function*() {
    yield* Effect.logInfo("serving").pipe(
      Effect.annotateLogs({ url: "http://127.0.0.1:7714" }),
      // Outer provide builds first; mergeWithExisting then adds the collector
      // beside the sink's loggers so both see the same Options.
      Effect.provide(Logger.layer([collector], { mergeWithExisting: true })),
      Effect.provide(sink),
    )
    return {
      out: yield* TestConsole.logLines,
      err: yield* TestConsole.errorLines,
      expected: collected[0]!,
    }
  }).pipe(Effect.provide(TestConsole.layer), Effect.runPromise)
}

test("the stdout sink writes logfmt on stdout", async () => {
  await withOlaiLog("logfmt", async () => {
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
})

test("the stderr sink writes the same line on stderr, so stdout stays the protocol", async () => {
  await withOlaiLog("logfmt", async () => {
    const { err, out } = await written(toStderr)

    expect(out).toEqual([])
    expect(err).toHaveLength(1)
    expect(String(err[0])).toContain("message=serving")
    expect(String(err[0])).toContain("url=http://127.0.0.1:7714")
  })
})

// The contract agents and the testlib decoder hold: when nothing is a TTY (or
// OLAI_LOG forces logfmt), the bytes are exactly Effect's formatLogFmt — not
// "looks like logfmt", the same string on the same event.
test("non-TTY (OLAI_LOG=logfmt) is byte-identical to formatLogFmt", async () => {
  await withOlaiLog("logfmt", async () => {
    const stdout = await writtenWithExpected(toStdout)
    expect(stdout.err).toEqual([])
    expect(String(stdout.out[0])).toBe(stdout.expected)

    const stderr = await writtenWithExpected(toStderr)
    expect(stderr.out).toEqual([])
    expect(String(stderr.err[0])).toBe(stderr.expected)
  })
})

test("OLAI_LOG=pretty forces pretty even when the stream is not a TTY", async () => {
  // process.stdout under bun test is typically not a TTY; if it is, the
  // override is still the thing under test — pretty must win either way.
  expect(formatFor({ isTTY: false })).toBe("logfmt")

  await withOlaiLog("pretty", async () => {
    expect(formatFor({ isTTY: false })).toBe("pretty")
    expect(formatFor({ isTTY: true })).toBe("pretty")

    const { out } = await written(toStdout)
    // Pretty is message-first, local time in brackets — not logfmt's
    // `timestamp=… level=Info message=…` field order. One line at least
    // carries the message; none is a bare logfmt line.
    const joined = out.map(String).join("\n")
    expect(joined).toContain("serving")
    expect(joined).not.toMatch(/^timestamp=\S+ level=Info /m)
    // Coloured level is uppercased in pretty; logfmt uses Effect's title case.
    expect(joined).toMatch(/INFO/)
  })
})

// The load-bearing new wiring: pretty on toStderr must still leave stdout
// empty. If LogToStderr were dropped, pretty would land on stdout and corrupt
// the JSON-RPC stream on `olai mcp`, with every logfmt-only test still green.
test("OLAI_LOG=pretty on toStderr keeps stdout empty (the protocol stream)", async () => {
  await withOlaiLog("pretty", async () => {
    const { err, out } = await written(toStderr)

    expect(out).toEqual([])
    expect(err.length).toBeGreaterThan(0)
    const joined = err.map(String).join("\n")
    expect(joined).toContain("serving")
    expect(joined).not.toMatch(/^timestamp=\S+ level=Info /m)
    expect(joined).toMatch(/INFO/)
  })
})

test("OLAI_LOG=logfmt forces logfmt even when the stream is a TTY", () => {
  const prev = process.env["OLAI_LOG"]
  process.env["OLAI_LOG"] = "logfmt"
  try {
    expect(formatFor({ isTTY: true })).toBe("logfmt")
  } finally {
    if (prev === undefined) delete process.env["OLAI_LOG"]
    else process.env["OLAI_LOG"] = prev
  }
})

test("without OLAI_LOG, a TTY is pretty and a pipe is logfmt", () => {
  const prev = process.env["OLAI_LOG"]
  delete process.env["OLAI_LOG"]
  try {
    expect(formatFor({ isTTY: true })).toBe("pretty")
    expect(formatFor({ isTTY: false })).toBe("logfmt")
    expect(formatFor({})).toBe("logfmt")
  } finally {
    if (prev === undefined) delete process.env["OLAI_LOG"]
    else process.env["OLAI_LOG"] = prev
  }
})

// Colour is a property of the DESTINATION stream (and NO_COLOR), not of
// stdout — the bug that left `olai mcp` monochrome whenever stdout was piped.
test("colours follow the destination stream and honour NO_COLOR", () => {
  const prev = process.env["NO_COLOR"]
  try {
    delete process.env["NO_COLOR"]
    expect(colorsFor({ isTTY: true })).toBe(true)
    expect(colorsFor({ isTTY: false })).toBe(false)
    expect(colorsFor({})).toBe(false)

    process.env["NO_COLOR"] = "1"
    expect(colorsFor({ isTTY: true })).toBe(false)
  } finally {
    if (prev === undefined) delete process.env["NO_COLOR"]
    else process.env["NO_COLOR"] = prev
  }
})
