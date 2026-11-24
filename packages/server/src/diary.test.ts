import { afterEach, expect, test } from "bun:test"
import { collector, findSaid } from "@olai/log/testlib"
import type { Entry } from "@olai/log/link"
import { BROWSER_DIARY_PATH } from "@olai/plugin-api/mount"
import { Effect, Layer, References } from "effect"
import { HttpRouter } from "effect/http"
import { DIARY_CEILING, DIARY_MAX_BYTES, diaryRoute } from "./diary.ts"

const TAB = "0123456789abcdef"
const HOST = "olai.test:7714"

/** The route over a web handler, with every line it says collected. */
const serving = (now: () => number = () => 1_000_000) => {
  const { layer, said } = collector()
  const say = (line: Effect.Effect<void>) =>
    Effect.runSync(line.pipe(Effect.provide(Layer.merge(layer, Layer.succeed(References.MinimumLogLevel, "All")))))
  const app = HttpRouter.toWebHandler(diaryRoute({ allowedOrigins: [], say, now }), { disableLogger: true })
  disposals.push(app.dispose)
  const post = (body: string, headers: Record<string, string> = {}) =>
    app.handler(new Request(`http://${HOST}${BROWSER_DIARY_PATH}`, {
      method: "POST",
      body,
      headers: { host: HOST, origin: `http://${HOST}`, "content-type": "application/json", "content-length": String(new TextEncoder().encode(body).length), ...headers },
    }))
  return { post, said }
}

const disposals: Array<() => Promise<void>> = []
afterEach(async () => {
  await Promise.all(disposals.splice(0).map((dispose) => dispose()))
})

const entry = (seq: number, event: Entry["event"]): Entry => ({ seq, at: 1_700_000_000_000, dial: 2, streak: 1, event })

const dropped: Entry["event"] = {
  _tag: "Dropped",
  cause: "peer-closed",
  code: 1006,
  lived: 1900,
  silent: 40,
  inFrames: 3,
  inBytes: 300,
  largestIn: 200,
  outFrames: 2,
  outBytes: 80,
  refusedSends: 0,
  heard: [],
  starved: [],
  starvedMore: 0,
  hidden: false,
  online: true,
}

test("an accepted batch is said entry by entry, as the browser's", async () => {
  const { post, said } = serving()
  const response = await post(JSON.stringify({ tab: TAB, entries: [entry(1, { _tag: "Dialling" }), entry(2, dropped)], lost: 3 }))
  expect(response.status).toBe(204)
  const drop = findSaid(said, "wire dropped")
  expect(drop?.level).toBe("Warn")
  expect(drop?.annotations).toMatchObject({ side: "browser", tab: TAB, dial: 2, seq: 2, cause: "peer-closed", by: "peer", code: 1006, means: "abnormal" })
  expect(findSaid(said, "wire dialling")?.level).toBe("Debug")
  expect(findSaid(said, "browser diary lost entries")?.annotations).toMatchObject({ tab: TAB, lost: 3 })
})

test("a cross-site origin is refused, by the same rule as the socket", async () => {
  const { post, said } = serving()
  const response = await post(JSON.stringify({ tab: TAB, entries: [], lost: 0 }), { origin: "https://elsewhere.test" })
  expect(response.status).toBe(403)
  expect(findSaid(said, "browser diary refused")?.annotations).toMatchObject({ why: "origin", origin: "https://elsewhere.test" })
  expect(findSaid(said, "wire")).toBeUndefined()
})

test("a body that is not a batch is refused, and never echoed", async () => {
  const { post, said } = serving()
  const body = JSON.stringify({ tab: TAB, entries: [{ seq: 1, at: 0, dial: 1, streak: 0, event: { _tag: "Nonsense", secret: "do-not-log" } }], lost: 0 })
  const response = await post(body)
  expect(response.status).toBe(400)
  expect(findSaid(said, "browser diary refused")?.annotations).toEqual({ why: "malformed" })
  expect(JSON.stringify(said)).not.toContain("do-not-log")
})

test("an entry dated past what a date can hold is refused as malformed, and nothing of the batch is said", async () => {
  const { post, said } = serving()
  const response = await post(JSON.stringify({ tab: TAB, entries: [entry(1, { _tag: "Dialling" }), { ...entry(2, dropped), at: 1e300 }], lost: 0 }))
  expect(response.status).toBe(400)
  expect(findSaid(said, "browser diary refused")?.annotations).toEqual({ why: "malformed" })
  expect(said.filter((line) => line.annotations.side === "browser")).toEqual([])
})

test("a body over the size a tab may send is refused", async () => {
  const { post, said } = serving()
  const response = await post("x".repeat(DIARY_MAX_BYTES + 1))
  expect(response.status).toBe(413)
  expect(findSaid(said, "browser diary refused")?.annotations).toMatchObject({ why: "size" })
})

test("past the ceiling the serve says it is throttling once, and takes entries again the next minute", async () => {
  let clock = 1_000_000
  const { post, said } = serving(() => clock)
  const batch = (count: number) =>
    JSON.stringify({ tab: TAB, entries: Array.from({ length: count }, (_, at) => entry(at + 1, { _tag: "Dialling" })), lost: 0 })
  expect((await post(batch(DIARY_CEILING / 2))).status).toBe(204)
  expect((await post(batch(DIARY_CEILING / 2))).status).toBe(204)
  expect((await post(batch(1))).status).toBe(429)
  expect((await post(batch(1))).status).toBe(429)
  expect(said.filter((line) => line.message === "browser diary throttled")).toHaveLength(1)
  clock += 60_000
  expect((await post(batch(1))).status).toBe(204)
})
