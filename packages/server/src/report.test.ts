import { expect, test } from "bun:test"
import { defineSurface } from "@kolu/surface/define"
import { implementSurface, SurfaceSiblingDropped } from "@kolu/surface/server"
import { type ServableSocket, serveSurfaceSocket } from "@kolu/surface-app/server"
import type { SurfaceAppConnection, SurfaceAppEvent } from "@kolu/surface-app/serve"
import { collector, findSaid } from "@olai/log/testlib"
import type { LinkFact } from "@olai/plugin-api/transport"
import { Cause, Effect, Layer, References, Schema } from "effect"
import { connectionLogging } from "./connectionLogging.ts"
import { type Gravity, gravityOf, report } from "./report.ts"

const TAB = "0123456789abcdef"

const connectionAt = (url: string, id = 7): SurfaceAppConnection<string> => ({
  id,
  url: new URL(url),
  remoteAddress: "127.0.0.1",
  headers: {},
  close: () => {},
})

const connection = connectionAt(`ws://olai.test/rpc/ws?pid=1&tab=${TAB}&dial=3`)

/** Every line `report` says for one event, in the pieces it was said in. */
const hear = (event: SurfaceAppEvent<string> | LinkFact) => {
  const { layer, said } = collector()
  report(event, (line) =>
    Effect.runSync(line.pipe(Effect.provide(Layer.merge(layer, Layer.succeed(References.MinimumLogLevel, "All"))))))
  return said
}

const measure = { lived: 1900, inFrames: 4, inBytes: 400, outFrames: 9, outBytes: 9000, largestOut: 4000, sincePong: 300, sinceInbound: 20 }

const table: ReadonlyArray<readonly [string, SurfaceAppEvent<string> | LinkFact, string, string, Record<string, unknown>]> = [
  ["a connection", { _tag: "Connected", connection }, "Debug", "tab connected", { conn: 7, tab: TAB, dial: 3, peer: "127.0.0.1" }],
  ["an ordinary close", { _tag: "Disconnected", connection, code: 1000, reason: "" }, "Debug", "tab disconnected", { conn: 7, code: 1000, means: "normal" }],
  ["a tab going away", { _tag: "LinkEnded", ended: { _tag: "Disconnected", connection, code: 1001, reason: "" }, measure }, "Debug", "tab disconnected", { code: 1001, means: "going away", lived: "1.9s" }],
  [
    "an abnormal close, with what it carried",
    { _tag: "LinkEnded", ended: { _tag: "Disconnected", connection, code: 1006, reason: "" }, measure },
    "Warn",
    "tab disconnected",
    { conn: 7, tab: TAB, dial: 3, code: 1006, means: "abnormal", lived: "1.9s", inFrames: 4, inBytes: 400, outFrames: 9, outBytes: 9000, largestOut: 4000, sincePong: "300ms", sinceInbound: "20ms" },
  ],
  ["a frame too big", { _tag: "Disconnected", connection, code: 1009, reason: "MaxBufferSizeExceeded" }, "Warn", "tab disconnected", { code: 1009, means: "too big", reason: "MaxBufferSizeExceeded" }],
  [
    "a frame over the cap",
    { _tag: "FrameOverCap", connection, bytes: 16_777_217, cap: 16_777_216, kind: "Chunk", request: "41" },
    "Warn",
    "sent a frame larger than a tab accepts",
    { conn: 7, tab: TAB, dial: 3, bytes: 16_777_217, cap: 16_777_216, kind: "Chunk", request: "41" },
  ],
  ["a stale tab", { _tag: "StaleTab", claimedPid: "old", url: connection.url }, "Info", "stale tab rejected", { claimed: "old", tab: TAB, dial: 3 }],
  ["a refused origin", { _tag: "DisallowedOrigin", origin: "https://elsewhere.test", url: connection.url }, "Warn", "websocket upgrade refused", { origin: "https://elsewhere.test", url: "/rpc/ws" }],
  ["a refused generation", { _tag: "GenerationRefused", error: new Error("disagree"), url: connection.url }, "Error", "surface generation refused — this socket was dropped", { url: "/rpc/ws" }],
  ["refused headers", { _tag: "UpgradeHeadersRefused", error: new Error("set-cookie"), url: connection.url }, "Warn", "upgrade headers refused — this socket is anonymous", { url: "/rpc/ws" }],
  ["a socket error", { _tag: "SocketError", error: new Error("reset"), url: connection.url }, "Warn", "surface socket failed", {}],
  ["a serving fault", { _tag: "ServingFailed", cause: new Error("boom"), connection }, "Warn", "surface connection failed", { conn: 7, tab: TAB, dial: 3 }],
]

test.each(table)("%s reads at its level, with its fields", (_, event, level, message, fields) => {
  const said = hear(event)
  expect(said).toHaveLength(1)
  expect(said[0]!.level).toBe(level)
  expect(said[0]!.message).toBe(message)
  expect(said[0]!.annotations).toMatchObject(fields)
})

test("a URL whose tab and dial are malformed names the connection by its ordinal alone", () => {
  const odd = connectionAt("ws://olai.test/rpc/ws?tab=%3Cscript%3E&dial=x", 8)
  const [line] = hear({ _tag: "Connected", connection: odd })
  expect(line!.annotations).toMatchObject({ conn: 8 })
  expect("tab" in line!.annotations).toBe(false)
  expect("dial" in line!.annotations).toBe(false)
})

const gone = new SurfaceSiblingDropped({ key: "chat", at: { face: "wire", tag: "surface/chat/send" } })

const gravities: ReadonlyArray<readonly [string, Cause.Cause<unknown>, Gravity]> = [
  ["a declared failure", Cause.fail("not today"), "refused"],
  ["a plain defect", Cause.die(new Error("bug")), "defect"],
  ["a plugin that left", Cause.die(gone), "left"],
  ["a declared failure beside a plain defect", Cause.combine(Cause.fail("not today"), Cause.die(new Error("bug"))), "defect"],
  ["a plugin that left beside a declared failure", Cause.combine(Cause.die(gone), Cause.fail("not today")), "left"],
]

test.each(gravities)("%s has its gravity", (_, cause, gravity) => {
  expect(gravityOf(cause)).toBe(gravity)
})

/** A served socket the test plays the tab on: what the server sends lands in
 *  `sent`, and `frame` hands it a request. */
class TabSocket extends EventTarget {
  readyState = 1
  readonly sent: Array<string> = []
  #waiting: { readonly count: number; readonly resolve: () => void } | undefined
  /** Settles once the server has sent `count` frames in all. */
  reach(count: number): Promise<void> {
    const { promise, resolve } = Promise.withResolvers<void>()
    if (this.sent.length >= count) resolve()
    else this.#waiting = { count, resolve }
    return promise
  }
  send(data: string | Uint8Array): void {
    this.sent.push(String(data))
    if (this.#waiting !== undefined && this.sent.length >= this.#waiting.count) this.#waiting.resolve()
  }
  close(): void {
    if (this.readyState === 3) return
    this.readyState = 3
    this.dispatchEvent(Object.assign(new Event("close"), { code: 1000, reason: "" }))
  }
  frame(data: unknown): void { this.dispatchEvent(Object.assign(new Event("message"), { data: `${JSON.stringify(data)}\n` })) }
}

test("a connection's handlers and its failed calls are heard with the connection named", async () => {
  const surface = defineSurface({
    procedures: {
      reader: {
        mark: { input: Schema.Struct({ word: Schema.String }), output: Schema.Number },
        miscount: { input: Schema.Struct({}), output: Schema.Number },
        crash: { input: Schema.Struct({}), output: Schema.Number },
        refuse: { input: Schema.Struct({}), output: Schema.Number, error: Schema.String },
        wait: { input: Schema.Struct({}), output: Schema.Number },
      },
    },
  })
  const runtime = implementSurface(surface, {
    procedures: {
      reader: {
        mark: ({ input }) => Effect.as(Effect.logInfo("handler heard"), input.word.length),
        // An answer its own schema refuses: the response fails to encode.
        miscount: () => Effect.succeed("three" as unknown as number),
        crash: () => Effect.die(new Error("a handler bug")),
        refuse: () => Effect.fail("not today"),
        wait: () => Effect.never,
      },
    },
  })
  const { layer, said } = collector()
  const socket = new TabSocket()
  const serving = serveSurfaceSocket({
    group: runtime.group,
    handlers: runtime.handlers,
    socket: socket as unknown as ServableSocket,
    // Debug lines audible, the way the serve's own live level opens them.
    services: connectionLogging(connection, Layer.merge(layer, Layer.succeed(References.MinimumLogLevel, "All")), { root: "/notes" }),
  })
  const call = (id: string, verb: string, payload: unknown) =>
    socket.frame({ _tag: "Request", id, tag: `surface/reader/${verb}`, payload, headers: [] })
  call("1", "mark", { word: "boa" })
  call("2", "miscount", {})
  call("3", "crash", {})
  call("4", "refuse", {})
  call("5", "wait", {})
  await socket.reach(4)
  // The tab abandons the call still waiting; the server answers the interrupt.
  socket.frame({ _tag: "Interrupt", requestId: "5" })
  await socket.reach(5)

  const named = { conn: 7, tab: TAB, dial: 3, root: "/notes" }
  expect(findSaid(said, "handler heard")?.annotations).toMatchObject(named)

  const defects = said.filter((line) => line.message === "a call failed with a defect")
  const encode = defects.filter((line) => String(line.annotations.why).includes("Failed to encode response for RPC"))
  expect(encode).toHaveLength(1)
  expect(encode[0]!.level).toBe("Error")
  expect(String(encode[0]!.annotations.why)).toContain("surface/reader/miscount")
  expect(encode[0]!.annotations).toMatchObject(named)

  const bug = defects.filter((line) => String(line.annotations.why).includes("a handler bug"))
  expect(bug).toHaveLength(1)
  expect(bug[0]!.level).toBe("Error")
  expect(bug[0]!.annotations).toMatchObject(named)

  const refused = said.filter((line) => line.message === "a call was refused")
  expect(refused).toHaveLength(1)
  expect(refused[0]!.level).toBe("Debug")
  expect(refused[0]!.annotations).toMatchObject({ ...named, why: "not today" })

  // Two defects and one refusal, and nothing for the abandoned call.
  expect(defects).toHaveLength(2)
  expect(said.filter((line) => line.message.startsWith("a call"))).toHaveLength(3)

  serving.close()
  await serving.done
  await runtime.close()
})
