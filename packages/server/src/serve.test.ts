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
 */

import { NodeHttpServer, NodeServices } from "@effect/platform-node"
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
): Promise<ReadonlyArray<string>> => {
  const said: Array<string> = []
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
      log: (message) => said.push(message),
    })
  }).pipe(
    Effect.scoped,
    Effect.provide(LAYERS),
    Effect.map(() => said as ReadonlyArray<string>),
    Effect.runPromise,
  )
}

const url = /http:\/\/127\.0\.0\.1:(\d+)/

test("a port that is already listening is a fallback, not a failure", async () => {
  const taken = await occupied()
  try {
    const said = await run({ port: taken.port })

    const notice = said.find((line) => line.includes("in use"))
    expect(notice).toContain(`port ${taken.port} in use`)
    // It names where we went, and that is a DIFFERENT port that is really ours.
    const landed = url.exec(notice ?? "")?.[1]
    expect(landed).toBeDefined()
    expect(Number(landed)).not.toBe(taken.port)
    // And the line everyone reads for the address agrees with it: the bound
    // address is the single source of truth, fallback or not.
    expect(said.find((line) => line.startsWith("serving "))).toContain(
      `http://127.0.0.1:${landed}`,
    )
  } finally {
    await taken.release()
  }
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
  expect(said.some((line) => line.includes("in use"))).toBe(false)
  expect(said.find((line) => line.startsWith("serving "))).toMatch(url)
})
