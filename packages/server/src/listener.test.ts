import { STALE_PROCESS_CLOSE_CODE } from "@kolu/surface-app"
import { findSaid, type Logged } from "@olai/log/testlib"
import { expect, test } from "bun:test"
import { Effect } from "effect"
import * as http from "node:http"

import { served, withServing } from "./serve.testlib.ts"

const BOUND_MS = 10_000

const withServer = (
  body: (url: string, said: ReadonlyArray<Logged>) => Promise<void>,
): Promise<void> => withServing({ root: served() }, body)

const WS_PATH = "/rpc/ws"

const wsUrl = (url: string, query = ""): string =>
  `${url.replace("http://", "ws://")}${WS_PATH}${query}`

const dial = (url: string): Promise<number> =>
  new Promise((resolve, reject) => {
    const timer = setTimeout(
      () => reject(new Error(`the socket at ${url} neither opened nor closed`)),
      BOUND_MS,
    )
    const socket = new WebSocket(url)
    socket.addEventListener("close", (event) => {
      clearTimeout(timer)
      resolve(event.code)
    })
  })

type Handshake = "upgraded" | "refused"

const handshake = (url: string, origin: string): Promise<Handshake> =>
  new Promise((resolve, reject) => {
    const timer = setTimeout(
      () => reject(new Error(`the handshake at ${url} was never answered`)),
      BOUND_MS,
    )
    const settle = (outcome: Handshake) => {
      clearTimeout(timer)
      resolve(outcome)
    }
    const request = http.request(url, {
      headers: {
        Connection: "Upgrade",
        Upgrade: "websocket",
        Origin: origin,
        "Sec-WebSocket-Version": "13",
        "Sec-WebSocket-Key": Buffer.from("0123456789abcdef").toString("base64"),
      },
    })
    request.on("upgrade", (_response, socket) => {
      socket.destroy()
      settle("upgraded")
    })
    request.on("response", () => {
      request.destroy()
      settle("refused")
    })
    request.on("error", () => settle("refused"))
    request.end()
  })

const heard = async (
  said: ReadonlyArray<Logged>,
  phrase: string,
): Promise<Logged> => {
  const deadline = performance.now() + BOUND_MS
  for (;;) {
    const line = findSaid(said, phrase)
    if (line !== undefined) return line
    if (performance.now() > deadline) {
      throw new Error(
        `nothing said "${phrase}" — heard: ${said.map((line) => line.message).join(" | ")}`,
      )
    }
    await new Promise((resolve) => setTimeout(resolve, 10))
  }
}

test("a tab from a previous process is closed, and the log says which", async () => {
  await withServer(async (url, said) => {
    const gone = "a-process-that-is-gone"
    expect(await dial(wsUrl(url, `?pid=${gone}`))).toBe(STALE_PROCESS_CLOSE_CODE)

    const line = await heard(said, "stale tab rejected")
    expect(line.level).toBe("Info")
    expect(line.annotations.claimed).toBe(gone)
  })
}, BOUND_MS * 3)

test("a cross-site origin never becomes a socket, and that is a warning", async () => {
  await withServer(async (url, said) => {
    const origin = "http://evil.example"
    expect(await handshake(`${url}${WS_PATH}`, origin)).toBe("refused")

    const line = await heard(said, "websocket upgrade refused")
    expect(line.level).toBe("Warn")
    expect(line.annotations.origin).toBe(origin)
  })
}, BOUND_MS * 3)
