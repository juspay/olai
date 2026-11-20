import { expect, test } from "bun:test"
import { Effect, Logger, References } from "effect"

import { findLogfmt, readLogfmt } from "./lines.testlib.ts"

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

  expect(fields.level).toBe("INFO")
  expect(fields.message).toBe("serving")
  expect(fields.url).toBe("http://127.0.0.1:40429")
})

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

  expect(findLogfmt(`${fallback}\n${serving}\n`, "serving")?.asked).toBeUndefined()
  expect(findLogfmt(`${fallback}\n`, "serving")).toBeUndefined()
})

test("a partial trailing line is not a match", () => {
  expect(findLogfmt("timestamp=… level=INFO fiber=#2 message=serv", "serving"))
    .toBeUndefined()

  const cut = `timestamp=… level=WARN message="the agent could not`
  expect(findLogfmt(cut, "the agent could not open a session")).toBeUndefined()
  expect(readLogfmt(cut).level).toBe("WARN")
  expect(readLogfmt(cut).message).toBeUndefined()

  const sliced = "timestamp=… level=INFO message=serving url=http://127.0.0.1:40"
  expect(findLogfmt(sliced, "serving")).toBeUndefined()
  expect(findLogfmt(`${sliced}429\n`, "serving")?.url).toBe(
    "http://127.0.0.1:40429",
  )
})
