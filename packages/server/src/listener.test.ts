/**
 * The frame cap, at the layer that is allowed to refuse.
 *
 * The bug: this listener capped websocket messages at 8 MiB while
 * `@kolu/surface`'s `frameLimit` classifies oversize at 16 MiB. Everything in
 * between — a big outline snapshot is the realistic one — was refused by the
 * raw ws layer, which has no classifier and no vocabulary for it: the socket
 * dies and every unrelated subscription multiplexed onto it dies with it,
 * instead of the framework's handled oversize path running.
 *
 * The first test is the regression fence and it is a test of the NUMBER, on
 * purpose. Bun's built-in `ws` — what this server actually runs on — ignores
 * `maxPayload` entirely and enforces 16 MiB of its own, so the disagreement
 * these two layers had was invisible from the outside here and a behavioural
 * assertion would have passed against the bug. What was wrong was the
 * configuration, so that is what is pinned; it fails against `8 * 1024 * 1024`
 * and against any future edit that lets the layers drift apart again.
 *
 * The second test is the behaviour that number exists for, end to end over a
 * real server and a real socket: a frame in the disputed range is carried and
 * ANSWERED rather than swallowed by a close.
 */

import { exceedsFrameLimit, RPC_MAX_FRAME_BYTES } from "@kolu/surface/frame-limit"
import { NodeHttpServer, NodeServices } from "@effect/platform-node"
import { collector, findSaid } from "@olai/log/testlib"
import { expect, test } from "bun:test"
import { Effect, Layer } from "effect"
import * as fs from "node:fs"
import * as os from "node:os"
import * as path from "node:path"

import { WS_MAX_PAYLOAD_BYTES } from "./listener.ts"
import { serve } from "./serve.ts"

/** A frame the framework carries and the old cap did not: bigger than the
 *  8 MiB this file used to pass to `ws`, smaller than the 16 MiB the framework
 *  refuses at. */
const DISPUTED_BYTES = 9 * 1024 * 1024

test("a frame the framework would carry is not refused a layer below it", () => {
  // The framework's own predicate, not a re-statement of its number: this is
  // the half of the claim that says 9 MiB is the framework's business.
  expect(exceedsFrameLimit(DISPUTED_BYTES)).toBe(false)
  // ...and this is the half that was false. 9 MiB > the old 8 MiB cap.
  expect(DISPUTED_BYTES).toBeLessThanOrEqual(WS_MAX_PAYLOAD_BYTES)
  // Generalised, so a re-pin of either number cannot re-open the gap: the
  // socket layer must never be the one that says no first.
  expect(WS_MAX_PAYLOAD_BYTES).toBeGreaterThanOrEqual(RPC_MAX_FRAME_BYTES)
  // And the delimiter, as the property rather than as the expression: the
  // BIGGEST frame the decoder accepts is `RPC_MAX_FRAME_BYTES` of content
  // arriving in a message that also carries its newline, and that message has
  // to fit. A cap of exactly the framework's number passes the line above and
  // fails this one.
  expect(RPC_MAX_FRAME_BYTES + 1).toBeLessThanOrEqual(WS_MAX_PAYLOAD_BYTES)
})

const LAYERS = Layer.mergeAll(NodeServices.layer, NodeHttpServer.layerHttpServices)

/** A directory with one valid outline in it, thrown away with the test. */
const served = (): string => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "olai-frame-"))
  fs.writeFileSync(path.join(root, "a.jsonl"), `{"id":"a","ord":"a0","title":"a"}\n`)
  return root
}

/** How long the answer may take before "carried" is a lie. Generous: what is
 *  being told apart is a reply from a close, not a fast reply from a slow one. */
const BOUND_MS = 10_000

test("a 9 MiB frame reaches the surface and is answered", async () => {
  const { layer, said } = collector()
  const answer = await Effect.gen(function*() {
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
    // The port was asked for as `0`, so the log line is the only thing that
    // knows which one we got — the same reading `serve.test.ts` does.
    const where = findSaid(said, "serving")?.annotations.url
    expect(typeof where).toBe("string")
    return yield* Effect.promise(() => ask(String(where)))
  }).pipe(Effect.scoped, Effect.provide(LAYERS), Effect.provide(layer), Effect.runPromise)

  // A real answer to a real call, which is only reachable if the frame that
  // carried it arrived: `system/identity` is the framework's own member, and
  // it succeeds. This proves CARRIAGE, not the fix — under bun it passes
  // against the old 8 MiB cap too, because bun's `ws` never enforced it. On a
  // host that does enforce `maxPayload` the old cap made this a close (node
  // `ws`: 9 MiB against 8 MiB is `Max payload size exceeded`, client 1009).
  // The number test above is the fence.
  expect(answer._tag).toBe("Exit")
  expect(answer.exit._tag).toBe("Success")
}, BOUND_MS * 3)

/** Ask `system/identity` over a 9 MiB frame, and answer with what came back —
 *  or with the close, if the socket died instead.
 *
 *  The padding is WHITESPACE TRAILING the request rather than a fat payload:
 *  `JSON.parse` accepts whitespace after a complete value, so what the decoder
 *  hands the server is an ordinary well-formed request. That keeps the test
 *  about the size of the frame and nothing else — a huge payload would fail
 *  schema decode and answer with a defect, which proves arrival too but says
 *  it less clearly. */
const ask = (url: string): Promise<{ _tag: string; exit: { _tag: string } }> =>
  new Promise((resolve, reject) => {
    const socket = new WebSocket(`${url.replace("http://", "ws://")}${WS_PATH}`)
    const timer = setTimeout(
      () => reject(new Error(`no answer to a ${DISPUTED_BYTES}-byte frame`)),
      BOUND_MS,
    )
    // Settle BEFORE hanging up: bun dispatches the `close` its own
    // `socket.close()` causes synchronously, so closing first would let this
    // promise's own hang-up reject the answer it just resolved with.
    const settle = (outcome: () => void) => {
      clearTimeout(timer)
      outcome()
      socket.close()
    }
    socket.addEventListener("error", () =>
      settle(() => reject(new Error("the socket did not open"))))
    socket.addEventListener("close", (event) =>
      settle(() =>
        reject(
          new Error(
            `the frame killed the socket: close ${event.code} ${event.reason}`,
          ),
        )
      ))
    socket.addEventListener("message", (event) =>
      settle(() => resolve(JSON.parse(String(event.data)))))
    socket.addEventListener("open", () => {
      const request = JSON.stringify({
        _tag: "Request",
        id: 1,
        tag: "surface/system/identity",
        payload: {},
        headers: [],
      })
      socket.send(
        request + " ".repeat(DISPUTED_BYTES - request.length - DELIMITER) + "\n",
      )
    })
  })

/** The newline that ends the frame — counted here so the message that goes out
 *  is `DISPUTED_BYTES` on the wire and not one more. */
const DELIMITER = 1

/** Where the listener serves the surface. Its own copy on purpose: a test that
 *  imported the path would agree with the listener by construction, and this
 *  one is meant to speak to it the way a browser does. */
const WS_PATH = "/rpc/ws"
