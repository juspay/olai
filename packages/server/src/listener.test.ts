/**
 * What the listener says, and where it says it.
 *
 * This file used to fence the frame cap, and it pinned the NUMBER on purpose.
 * There is no number here to pin any more — `listener.ts`'s header has why —
 * and kolu's own `serve.test.ts` carries both the fence and the end-to-end
 * carriage. A copy here would be a test of somebody else's constant, failing in
 * the wrong repository the day it changed.
 *
 * What did NOT move upstream is the SINK (`./report.ts`), and the way that
 * wiring breaks is silent: a `console.warn` still reaches a terminal, just not
 * the logfmt an e2e harness, a systemd journal or a `--log-level` is reading.
 * So these drive real sockets at a real server and assert on what the LOGGER
 * heard.
 *
 * Two arms, and they are the two the mapping actually decides between: a tab
 * left over from a restart is ordinary (`Info`, and worth a line only because
 * it explains a page that stopped updating), while a cross-site upgrade refused
 * before it became a socket is not (`Warn`). Everything the primitive reports
 * lands on one of those two levels, so proving both proves the switch.
 */

import { STALE_PROCESS_CLOSE_CODE } from "@kolu/surface-app"
import { collector, findSaid, type Logged } from "@olai/log/testlib"
import { expect, test } from "bun:test"
import { Effect } from "effect"
import * as http from "node:http"

import { serve } from "./serve.ts"
import { served, SERVER_LAYERS } from "./serve.testlib.ts"

/** How long a socket may take to be answered, and a line to be said, before
 *  either is a hang. Generous: what is being told apart is "refused" from
 *  "never", not a fast refusal from a slow one. */
const BOUND_MS = 10_000

/** A real server on an OS-chosen port, and everything it said. The address is
 *  read off the `serving` line because that IS the interface — the port was
 *  asked for as `0`, so the process is the only thing that knows which one it
 *  got — the same reading `serve.test.ts` and the e2e harness do. */
const withServer = (
  body: (url: string, said: ReadonlyArray<Logged>) => Promise<void>,
): Promise<void> => {
  const { layer, said } = collector()

  return Effect.gen(function*() {
    yield* serve({
      root: served(),
      port: 0,
      host: "127.0.0.1",
      clientDist: served(),
      allowedOrigins: [],
      // A real server against a temp directory; committing to whatever
      // repository happens to contain it is not this test's to do.
      commit: false,
    })
    const url = findSaid(said, "serving")?.annotations.url
    expect(typeof url).toBe("string")
    yield* Effect.promise(() => body(String(url), said))
  }).pipe(
    Effect.scoped,
    Effect.provide(SERVER_LAYERS),
    Effect.provide(layer),
    Effect.runPromise,
  )
}

/** Where the listener serves the surface. Its own copy on purpose: a test that
 *  imported the path would agree with the server by construction, and this one
 *  is meant to speak to it the way a browser does. */
const WS_PATH = "/rpc/ws"

const wsUrl = (url: string, query = ""): string =>
  `${url.replace("http://", "ws://")}${WS_PATH}${query}`

/** Dial as a browser does, and answer with the code the server closed with. */
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

/** How a handshake ended: as a websocket, or not at all. */
type Handshake = "upgraded" | "refused"

/**
 * Offer the handshake by hand, from an `Origin` of our choosing.
 *
 * By hand for both halves of that sentence. The refusal under test happens
 * BEFORE the upgrade — the raw socket is destroyed, with nothing said, because
 * there is nothing to say to a page that should not have asked — so what is
 * being observed is the absence of an upgrade rather than any close code a
 * websocket client could report. And `Origin` is a header a browser sets and a
 * `WebSocket` constructor does not take: forging it is the whole point, since
 * an attacker page is a browser that has been told to lie about who it is.
 */
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
        // Sixteen bytes, base64. Any sixteen: the server hashes them back into
        // its answer and this test never reads the answer.
        "Sec-WebSocket-Key": Buffer.from("0123456789abcdef").toString("base64"),
      },
    })
    request.on("upgrade", (_response, socket) => {
      socket.destroy()
      settle("upgraded")
    })
    // An ordinary HTTP answer to an upgrade request is a refusal too — this
    // gate does not give one, and asserting only on the destroyed socket would
    // make the test agree with today's spelling rather than with the property.
    request.on("response", () => {
      request.destroy()
      settle("refused")
    })
    request.on("error", () => settle("refused"))
    request.end()
  })

/** The line whose message contains `phrase`, waited for. A line the listener
 *  logs is emitted from a Node callback, on a fiber of its own — so a test that
 *  read `said` the instant its socket closed would be racing the line it came
 *  to hear. */
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

// A tab that presents a process id this server does not answer to is bound to a
// process that is gone. It is closed rather than served — the whole of the
// stale-tab gate — and the line is what tells whoever is looking at a page that
// stopped updating why it did.
test("a tab from a previous process is closed, and the log says which", async () => {
  await withServer(async (url, said) => {
    const gone = "a-process-that-is-gone"
    // The framework's own code, not a `4001` retyped here: this half of the
    // handshake is the framework's to decide, and the browser recognises it by
    // the same constant.
    expect(await dial(wsUrl(url, `?pid=${gone}`))).toBe(STALE_PROCESS_CLOSE_CODE)

    const line = await heard(said, "stale tab rejected")
    expect(line.level).toBe("Info")
    expect(line.annotations.claimed).toBe(gone)
  })
}, BOUND_MS * 3)

// Cross-site websocket hijacking, refused on the raw socket BEFORE the upgrade.
// Nobody's browser does this by accident, which is the whole reason the level
// is the one an operator has asked to be shown.
test("a cross-site origin never becomes a socket, and that is a warning", async () => {
  await withServer(async (url, said) => {
    const origin = "http://evil.example"
    expect(await handshake(`${url}${WS_PATH}`, origin)).toBe("refused")

    const line = await heard(said, "websocket upgrade refused")
    expect(line.level).toBe("Warn")
    expect(line.annotations.origin).toBe(origin)
  })
}, BOUND_MS * 3)
