/**
 * Starting up, and the two ways it can go wrong.
 *
 * Both are about what the OPERATOR is told. A port that is already listening
 * is not a reason to refuse to serve, so it is not an error at all any more —
 * it is a line saying where we went instead. A port that cannot be bound for
 * any other reason IS an error, and the whole point of these tests is that the
 * error the reader gets is the real one: the bug they replace printed
 * `surface runtime faulted — unrecoverable: [object Object]` and exited before
 * the actual `cannot listen on …` could be reported.
 *
 * They start a real server on a real port. Nothing here is mocked, because the
 * thing under test is exactly the seam where Node's `listen` meets the Effect
 * runtime — the seam a mock would replace with an assumption.
 *
 * What they read is a collecting LOGGER rather than an injected callback: the
 * server logs the way every other package does, so the way to hear it is the
 * way anything hears an Effect log. That also means these assert on the pieces
 * — the level, the message, the annotations — rather than on one interpolated
 * sentence, which is the whole reason the pieces exist.
 */

import { NodeHttpServer, NodeServices } from "@effect/platform-node"
import { collector, findSaid, type Logged } from "@olai/log/testlib"
import { expect, test } from "bun:test"
import { Effect, Layer } from "effect"
import * as fs from "node:fs"
import * as net from "node:net"
import * as os from "node:os"
import * as path from "node:path"

import { serve } from "./serve.ts"

const LAYERS = Layer.mergeAll(NodeServices.layer, NodeHttpServer.layerHttpServices)

/** A directory with one valid outline in it, thrown away with the test. */
const served = (): string => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "olai-serve-"))
  fs.writeFileSync(
    path.join(root, "a.jsonl"),
    `{"id":"a","ord":"a0","title":"a"}\n`,
  )
  return root
}

/** A port with something already listening on it, closed with the test. */
const occupied = (): Promise<{ port: number; release: () => Promise<void> }> =>
  new Promise((resolve, reject) => {
    const squatter = net.createServer()
    squatter.on("error", reject)
    squatter.listen(0, "127.0.0.1", () => {
      const address = squatter.address()
      if (address === null || typeof address === "string") {
        reject(new Error("could not read a port from the squatter socket"))
        return
      }
      resolve({
        port: address.port,
        release: () => new Promise<void>((done) => squatter.close(() => done())),
      })
    })
  })

/** Run `serve` and shut it straight back down, collecting what it said. */
const run = (
  options: { readonly port: number; readonly host?: string },
): Promise<ReadonlyArray<Logged>> => {
  const { layer, said } = collector()

  return Effect.gen(function*() {
    yield* serve({
      root: served(),
      port: options.port,
      host: options.host ?? "127.0.0.1",
      clientDist: served(),
      allowedOrigins: [],
      // These start and stop a real server against a temp directory; committing
      // to whatever repository happens to contain it is not theirs to do.
      commit: false,
    })
  }).pipe(
    Effect.scoped,
    Effect.provide(LAYERS),
    Effect.provide(layer),
    Effect.map(() => said),
    Effect.runPromise,
  )
}

const url = /^http:\/\/127\.0\.0\.1:(\d+)$/

test("a port that is already listening is a fallback, not a failure", async () => {
  const taken = await occupied()
  try {
    const said = await run({ port: taken.port })

    const notice = findSaid(said, "port in use")
    expect(notice?.annotations.asked).toBe(taken.port)
    // It names where we went, and that is a DIFFERENT port that is really ours.
    const landed = url.exec(String(notice?.annotations.url))?.[1]
    expect(landed).toBeDefined()
    expect(Number(landed)).not.toBe(taken.port)
    // And the line everyone reads for the address agrees with it: the bound
    // address is the single source of truth, fallback or not.
    expect(findSaid(said, "serving")?.annotations.url).toBe(
      `http://127.0.0.1:${landed}`,
    )
  } finally {
    await taken.release()
  }
})

// Every line the served directory produces says which directory it was —
// including the ones a store fiber emits from three layers down, which is the
// reason the annotation is set before anything is started rather than added to
// each message by hand.
test("every line says which directory it is about", async () => {
  const said = await run({ port: 0 })

  const root = findSaid(said, "serving")?.annotations.root
  expect(typeof root).toBe("string")
  expect(said.every((line) => line.annotations.root === root)).toBe(true)
})

// The regression this file exists for. A host that is not this machine's
// cannot be bound, the scope unwinds, and closing the surface runtime settles
// its `done` on the way out — which used to be read as a fault, printed as
// `[object Object]`, and followed by `process.exit(1)`. An exiting process
// takes the test runner with it, so this failing is loud in the right way.
test("a listen failure is reported as itself, not as a faulted runtime", async () => {
  const failure = await run({ port: 7714, host: "192.0.2.1" }).then(
    () => undefined,
    (cause: unknown) => String(cause),
  )

  expect(failure).toBeDefined()
  expect(failure).toContain("cannot listen on 192.0.2.1:7714")
  expect(failure).not.toContain("[object Object]")
  expect(failure).not.toContain("faulted")
})

// A fallback is for a port someone else holds. Asking for one the OS picks is
// already that, so there is nothing to fall back FROM — and a retry loop on
// port 0 would be a way to hide a real bind failure behind a second one.
test("port 0 is a request, not a collision", async () => {
  const said = await run({ port: 0 })

  expect(findSaid(said, "port in use")).toBeUndefined()
  expect(String(findSaid(said, "serving")?.annotations.url)).toMatch(url)
})

// Binding off loopback is the one thing this layer warns about, and the LEVEL
// is now what says so — the message used to have to shout `WARNING:` at itself.
test("binding off loopback is a warning, not a line among lines", async () => {
  const said = await run({ port: 0, host: "0.0.0.0" })

  const warned = findSaid(said, "bound off loopback")
  expect(warned?.level).toBe("Warn")
  expect(warned?.annotations.host).toBe("0.0.0.0")
})
