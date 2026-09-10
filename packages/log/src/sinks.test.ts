/**
 * Which stream a line lands on, and which face it wears.
 *
 * A process whose stdout is already spoken for still needs a log. "The
 * stderr sink writes to stderr" is a routing property, not a preference, and
 * it is asserted rather than argued.
 *
 * The face is a second contract: non-TTY (and `log-format: logfmt`) is logfmt
 * **byte-identical** to Effect's `formatLogFmt`, because the testlib decoder
 * and every agent that greps a line depend on that shape. Pretty is only for
 * a human TTY — and `log-format: pretty` can force it even when nothing is a TTY,
 * which is what the override test proves.
 *
 * Through Effect's own `TestConsole` rather than a spy on the global one:
 * these loggers write through the fiber's `Console` service, which is the thing
 * `TestConsole` is for, and swapping a service beats monkey-patching a global
 * that every other test in the process shares.
 */

import { expect, test } from "bun:test"
import { Cause, Effect, Layer, Logger, Redacted } from "effect"
import { TestConsole } from "effect/testing"

import {
  colorsFor,
  formatFor,
  prettyFor,
  LogPresentation,
  type Presentation,
  type Stream,
  toStderr,
  toStdout,
} from "./sinks.ts"

/** Say one thing through `sink`, and answer which stream it went to. */
const written = (
  sink: Layer.Layer<never>,
  format: Presentation = "auto",
): Promise<{ readonly out: ReadonlyArray<unknown>; readonly err: ReadonlyArray<unknown> }> =>
  Effect.gen(function*() {
    yield* Effect.logInfo("serving").pipe(
      Effect.annotateLogs({ url: "http://127.0.0.1:7714" }),
      Effect.provide(sink),
      Effect.provideService(LogPresentation, () => format),
    )
    return { out: yield* TestConsole.logLines, err: yield* TestConsole.errorLines }
  }).pipe(Effect.provide(TestConsole.layer), Effect.runPromise)

/** Force `NO_COLOR` for the duration of `body`, then restore. */
const withNoColor = async <A>(
  value: string | undefined,
  body: () => Promise<A>,
): Promise<A> => {
  const prev = process.env["NO_COLOR"]
  if (value === undefined) delete process.env["NO_COLOR"]
  else process.env["NO_COLOR"] = value
  try {
    return await body()
  } finally {
    if (prev === undefined) delete process.env["NO_COLOR"]
    else process.env["NO_COLOR"] = prev
  }
}

/**
 * Render one pretty line for `stream` through TestConsole — the bytes a sink
 * built from {@link prettyFor} would write. Asserting on these is what locks
 * colour to the destination stream (mutation: wire prettyStderr off stdout
 * must fail).
 */
const renderedPretty = (stream: Stream): Promise<string> =>
  Effect.gen(function*() {
    yield* Effect.logInfo("serving").pipe(
      Effect.provide(Logger.layer([prettyFor(stream)])),
    )
    return (yield* TestConsole.logLines).map(String).join("\n")
  }).pipe(Effect.provide(TestConsole.layer), Effect.runPromise)

/**
 * One log event through `sink`, with a parallel `formatLogFmt` collector on
 * the same event (mergeWithExisting). Same timestamp, same fiber, so the two
 * strings can be compared for byte identity.
 */
const writtenWithExpected = (
  sink: Layer.Layer<never>,
  format: Presentation = "auto",
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
      Effect.provideService(LogPresentation, () => format),
    )
    return {
      out: yield* TestConsole.logLines,
      err: yield* TestConsole.errorLines,
      expected: collected[0]!,
    }
  }).pipe(Effect.provide(TestConsole.layer), Effect.runPromise)
}

test("the stdout sink writes logfmt on stdout", async () => {
  {
    const format = "logfmt" as const
    const { err, out } = await written(toStdout, format)

    expect(err).toEqual([])
    expect(out).toHaveLength(1)
    // The shape the e2e suite reads the server's address out of: one line, the
    // level as a field, and every varying value its own `key=value`.
    const line = String(out[0])
    expect(line).toContain("level=INFO")
    expect(line).toContain("message=serving")
    expect(line).toContain("url=http://127.0.0.1:7714")
    expect(line).not.toContain("\n")
  }
})

test("the stderr sink writes the same line on stderr, so stdout stays the protocol", async () => {
  {
    const format = "logfmt" as const
    const { err, out } = await written(toStderr, format)

    expect(out).toEqual([])
    expect(err).toHaveLength(1)
    expect(String(err[0])).toContain("message=serving")
    expect(String(err[0])).toContain("url=http://127.0.0.1:7714")
  }
})

// The contract agents and the testlib decoder hold: when nothing is a TTY (or
// log-format forces logfmt), the bytes are exactly Effect's formatLogFmt — not
// "looks like logfmt", the same string on the same event.
test("non-TTY (log-format: logfmt) is byte-identical to formatLogFmt", async () => {
  {
    const format = "logfmt" as const
    const stdout = await writtenWithExpected(toStdout, format)
    expect(stdout.err).toEqual([])
    expect(String(stdout.out[0])).toBe(stdout.expected)

    const stderr = await writtenWithExpected(toStderr, format)
    expect(stderr.out).toEqual([])
    expect(String(stderr.err[0])).toBe(stderr.expected)
  }
})

test("log-format: pretty forces pretty even when the stream is not a TTY", async () => {
  // process.stdout under bun test is typically not a TTY; if it is, the
  // override is still the thing under test — pretty must win either way.
  expect(formatFor({ isTTY: false })).toBe("logfmt")

  {
    const format = "pretty" as const
    expect(formatFor({ isTTY: false }, format)).toBe("pretty")
    expect(formatFor({ isTTY: true }, format)).toBe("pretty")

    const { out } = await written(toStdout, format)
    // Pretty is message-first with local time — not logfmt's
    // `timestamp=… level=INFO message=…` field order. One line at least
    // carries the message; none is a bare logfmt line.
    const joined = out.map(String).join("\n")
    expect(joined).toContain("serving")
    expect(joined).not.toMatch(/^timestamp=\S+ level=INFO /m)
    // Coloured level is uppercased in pretty; logfmt now is too (Effect rc).
    expect(joined).toMatch(/INFO/)
  }
})

// The load-bearing new wiring: pretty on toStderr must still leave stdout
// empty. If LogToStderr were dropped, pretty would land on stdout and
// corrupt a stream the caller wanted left alone, with every logfmt-only
// test still green.
test("log-format: pretty on toStderr keeps stdout empty (the protocol stream)", async () => {
  {
    const format = "pretty" as const
    const { err, out } = await written(toStderr, format)

    expect(out).toEqual([])
    expect(err.length).toBeGreaterThan(0)
    const joined = err.map(String).join("\n")
    expect(joined).toContain("serving")
    expect(joined).not.toMatch(/^timestamp=\S+ level=INFO /m)
    expect(joined).toMatch(/INFO/)
  }
})

test("presentation is explicit, while auto follows the destination", () => {
  expect(formatFor({ isTTY: true }, "logfmt")).toBe("logfmt")
  expect(formatFor({ isTTY: false }, "pretty")).toBe("pretty")
  expect(formatFor({ isTTY: true })).toBe("pretty")
  expect(formatFor({ isTTY: false })).toBe("logfmt")
  expect(formatFor({})).toBe("logfmt")
})

// Factory lock: stub streams, not the real process fds. Necessary but not
// sufficient — under bun test both real streams have isTTY undefined, so
// wiring prettyStderr off process.stdout still passes this alone.
test("prettyFor emits ANSI only for a TTY stream", async () => {
  await withNoColor(undefined, async () => {
    const onTty = await renderedPretty({ isTTY: true })
    const onPipe = await renderedPretty({ isTTY: false })

    expect(onTty).toContain("serving")
    expect(onPipe).toContain("serving")
    // ESC[ — Effect's withColor codes. Stub streams, not process.stdout, so
    // this is independent of how the test process was launched.
    expect(onTty).toContain("\u001b[")
    expect(onPipe).not.toContain("\u001b[")
  })
})

test("prettyFor honours NO_COLOR even on a TTY stream", async () => {
  await withNoColor("1", async () => {
    expect(colorsFor({ isTTY: true })).toBe(false)
    const line = await renderedPretty({ isTTY: true })
    expect(line).toContain("serving")
    expect(line).not.toContain("\u001b[")
  })
})

/**
 * Stub isTTY on a real WriteStream for the duration of `body`. Colour is
 * re-read at emit, so this is what lets a test present the mixed case
 * (stdout pipe + stderr TTY) to the actual sink wiring.
 */
const withIsTTY = async <A>(
  stream: NodeJS.WriteStream,
  value: boolean,
  body: () => Promise<A>,
): Promise<A> => {
  const prev = Object.getOwnPropertyDescriptor(stream, "isTTY")
  Object.defineProperty(stream, "isTTY", { value, configurable: true, writable: true })
  try {
    return await body()
  } finally {
    if (prev !== undefined) Object.defineProperty(stream, "isTTY", prev)
    else delete (stream as unknown as { isTTY?: boolean }).isTTY
  }
}

// The WIRING lock for toStderr (reviewer-written, M1). prettyFor's factory
// tests cannot see which real stream the sink is bound to — under bun test
// both process fds have isTTY undefined. Stub the real streams and drive
// toStderr: stderr TTY + stdout pipe must colour. The converse (stderr pipe
// + stdout TTY → no ANSI) locks emit-time colour selection for this sink; it
// does *not* lock toStdout's binding (that is the symmetric test below).
test("toStderr's pretty colour comes from stderr, not stdout", async () => {
  await withNoColor(undefined, async () => {
    {
      const format = "pretty" as const
      await withIsTTY(process.stdout, false, () =>
        withIsTTY(process.stderr, true, async () => {
          const { err, out } = await written(toStderr, format)
          expect(out).toEqual([])
          expect(err.map(String).join("\n")).toContain("\u001b[")
        }),
      )
      // Converse: stderr is the pipe → no ANSI even though stdout is a TTY
      // (emit-time colour from *this* stream, not the sibling).
      await withIsTTY(process.stdout, true, () =>
        withIsTTY(process.stderr, false, async () => {
          const { err } = await written(toStderr, format)
          expect(err.map(String).join("\n")).not.toContain("\u001b[")
        }),
      )
    }
  })
})

// Symmetric wiring lock for toStdout (M5). Both halves exercise only
// prettyStdout, so the toStderr test cannot see this binding.
test("toStdout's pretty colour comes from stdout, not stderr", async () => {
  await withNoColor(undefined, async () => {
    {
      const format = "pretty" as const
      // stdout is the pipe: no ANSI, even though stderr is a TTY.
      await withIsTTY(process.stdout, false, () =>
        withIsTTY(process.stderr, true, async () => {
          const { out } = await written(toStdout, format)
          expect(out.map(String).join("\n")).not.toContain("\u001b[")
        }),
      )
      // Converse: stdout is the TTY, so it colours even though stderr is a pipe.
      await withIsTTY(process.stdout, true, () =>
        withIsTTY(process.stderr, false, async () => {
          const { out } = await written(toStdout, format)
          expect(out.map(String).join("\n")).toContain("\u001b[")
        }),
      )
    }
  })
})

// LogToStderr must stay local to toStderr's pretty logger. A program-wide
// Layer.succeed would force every mergeWithExisting peer onto stderr too.
test("toStderr does not force LogToStderr on sibling loggers", async () => {
  {
    const format = "pretty" as const
    let saw: boolean | undefined
    const probe = Logger.make((options) => {
      saw = options.fiber.getRef(Logger.LogToStderr)
    })
    await Effect.gen(function*() {
      yield* Effect.logInfo("serving").pipe(
        Effect.provide(Logger.layer([probe], { mergeWithExisting: true })),
        Effect.provide(Layer.merge(toStderr, Layer.succeed(LogPresentation, () => format))),
      )
    }).pipe(Effect.provide(TestConsole.layer), Effect.runPromise)

    expect(saw).toBe(false)
  }
})


test("compact output keeps context inline, abbreviates UUIDs, and names root changes", async () => {
  const lines = await Effect.gen(function*() {
    for (const root of ["/vault/a", "/vault/a", "/vault/b", "/vault/a"]) {
      yield* Effect.logInfo("conversation opened").pipe(Effect.annotateLogs({
        root,
        agent: "claude",
        session: "9b618f09-62d4-406d-bf8f-6e88bd8b3f89",
        args: "",
        detail: "first\nsecond",
      }))
    }
    return yield* TestConsole.logLines
  }).pipe(
    Effect.provide(Logger.layer([prettyFor({ isTTY: false })])),
    Effect.provide(TestConsole.layer),
    Effect.runPromise,
  )
  expect(lines).toHaveLength(4)
  const rendered = lines.map(String)
  for (const line of rendered) {
    expect(line).not.toContain("\n")
    expect(line).toContain("agent=claude session=9b618f09")
    expect(line).toContain('detail="first\\nsecond"')
    expect(line).not.toContain("args=")
    expect(line).not.toContain("fiber")
    expect(line).not.toContain("62d4")
  }
  expect(rendered[0]).toContain("root=/vault/a")
  expect(rendered[1]).not.toContain("root=")
  expect(rendered[2]).toContain("root=/vault/b")
  expect(rendered[3]).toContain("root=/vault/a")
})

test("compact errors retain the cause and root on the selected stream", async () => {
  {
    const format = "pretty" as const
    const { out, err } = await Effect.gen(function*() {
      yield* Effect.logInfo("ready")
      yield* Effect.logError("turn failed", Cause.fail(new Error("connection lost\nretry exhausted")))
      return { out: yield* TestConsole.logLines, err: yield* TestConsole.errorLines }
    }).pipe(
      Effect.annotateLogs({ root: "/vault/failure" }),
      Effect.provide(Layer.merge(toStderr, Layer.succeed(LogPresentation, () => format))),
      Effect.provide(TestConsole.layer),
      Effect.runPromise,
    )
    expect(out).toEqual([])
    expect(err).toHaveLength(2)
    const failure = String(err[1])
    expect(failure).toContain("turn failed")
    expect(failure).toContain("root=/vault/failure")
    expect(failure).toContain("connection lost")
    expect(failure).toContain("retry exhausted")
    expect(failure).toContain("\n")
  }
})

test("compact messages handle errors, circular values, bigint and redaction", async () => {
  const circular: Record<string, unknown> = { count: 1n }
  circular["self"] = circular
  const lines = await Effect.gen(function*() {
    yield* Effect.logInfo("details", new Error("ordinary error"), circular, Redacted.make("secret-value"))
    return yield* TestConsole.logLines
  }).pipe(
    Effect.provide(Logger.layer([prettyFor({ isTTY: false })])),
    Effect.provide(TestConsole.layer),
    Effect.runPromise,
  )
  expect(lines).toHaveLength(1)
  const line = String(lines[0])
  expect(line).toContain("ordinary error")
  expect(line).toContain("Circular")
  expect(line).not.toContain("secret-value")
  expect(line).not.toContain("\n")
})
