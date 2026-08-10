/**
 * The decoder, against lines the encoder actually produces.
 *
 * This is the half of the format contract that lives outside the process: two
 * suites spawn the real binary and wait on a line of its stdout, so what they
 * are really waiting on is that these two agree. Round-tripping through
 * `Logger.formatLogFmt` rather than against hand-written strings is what makes
 * that a test of the pair rather than of somebody's memory of the format.
 */

import { expect, test } from "bun:test"
import { Effect, Logger, References } from "effect"

import { findLogfmt, readLogfmt } from "./lines.testlib.ts"

/** What the sinks would have written, without writing it anywhere — the same
 *  `formatLogFmt` they are built from, with the console step taken off. */
const encoded = (line: Effect.Effect<void>): Promise<string> => {
  const written: Array<string> = []
  const sink = Logger.map(Logger.formatLogFmt, (text) => {
    written.push(text)
  })
  return Effect.runPromise(
    line.pipe(
      Effect.provideService(References.MinimumLogLevel, "Debug"),
      Effect.provide(Logger.layer([sink])),
      Effect.map(() => written.join("\n")),
    ),
  )
}

test("a field the encoder left bare reads back as itself", async () => {
  const fields = readLogfmt(
    await encoded(
      Effect.annotateLogs(Effect.logInfo("serving"), {
        url: "http://127.0.0.1:40429",
      }),
    ),
  )

  expect(fields.level).toBe("Info")
  expect(fields.message).toBe("serving")
  expect(fields.url).toBe("http://127.0.0.1:40429")
})

// The failure the three hand-rolled regexes this replaced would have had, and
// would have had SILENTLY: a value gains a space, the encoder quotes it, and a
// `key=(\S+)` match quietly stops finding the line it is waiting for.
test("a value the encoder had to quote reads back unquoted", async () => {
  const fields = readLogfmt(
    await encoded(
      Effect.annotateLogs(Effect.logWarning("surface connection failed"), {
        why: `the socket said "no" and\\or hung up`,
      }),
    ),
  )

  expect(fields.message).toBe("surface connection failed")
  expect(fields.why).toBe(`the socket said "no" and\\or hung up`)
})

test("a line found by message is that line, not a later one that shares a field", async () => {
  const fallback = await encoded(
    Effect.annotateLogs(Effect.logInfo("port in use — serving elsewhere"), {
      asked: 7714,
      url: "http://127.0.0.1:40429",
    }),
  )
  const serving = await encoded(
    Effect.annotateLogs(Effect.logInfo("serving"), { url: "http://127.0.0.1:40429" }),
  )

  // Both lines carry a `url=`; the message is what tells them apart, and it is
  // matched exactly rather than as a substring for exactly that reason.
  expect(findLogfmt(`${fallback}\n${serving}`, "serving")?.asked).toBeUndefined()
  expect(findLogfmt(fallback, "serving")).toBeUndefined()
})

// A spawned server's stdout arrives in chunks and a test polls the buffer it
// has so far. A half-written line must simply not match yet — including one cut
// in the middle of a quoted value, where there is no closing quote to find and
// the fields read so far are all there is.
test("a partial trailing line is not a match", () => {
  expect(findLogfmt("timestamp=… level=Info fiber=#2 message=serv", "serving"))
    .toBeUndefined()

  const cut = `timestamp=… level=Warn message="the agent could not`
  expect(findLogfmt(cut, "the agent could not open a session")).toBeUndefined()
  expect(readLogfmt(cut).level).toBe("Warn")
  expect(readLogfmt(cut).message).toBeUndefined()
})
