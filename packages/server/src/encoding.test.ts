/**
 * olai's own `serve` has the negotiating static layer in it, and every arm of
 * the negotiation has something on disk to answer with.
 *
 * That is a COMPOSITION claim and the only one left here. What the negotiation
 * DOES — which token beats which, that a q-value does not match, that an
 * already-compressed media type stays identity, that the `no-store` shell is
 * never encoded — is kolu's, tested against kolu's own emitter in its
 * `dist.test.ts` (kolu#2159, which is also what emits the siblings now that
 * olai's `precompress.ts` is gone). Restating any of it here would be a copy of
 * the framework's internals living on as an assertion in a consumer.
 *
 * The fixture's siblings are written FROM `PRECOMPRESSED_ENCODINGS` — the one
 * table the negotiator reads and the emitter writes from — rather than from a
 * list spelled here. That is not tidiness: a hand-spelled list is exactly how
 * olai shipped a dist with no `.zst` in it while the server had preferred zstd
 * all along, which is the bug this pin closes. A fourth encoding landing
 * upstream now arrives in this test rather than quietly going untested in it.
 */

import { PRECOMPRESSED_ENCODINGS } from "@kolu/surface-app"
import { collector, findSaid } from "@olai/log/testlib"
import { expect, test } from "bun:test"
import { Effect } from "effect"
import * as fs from "node:fs"
import * as http from "node:http"
import * as os from "node:os"
import * as path from "node:path"
import {
  brotliCompressSync,
  constants as zlibConstants,
  gzipSync,
  zstdCompressSync,
} from "node:zlib"

import { DEFAULT_IDENTITY_HEADERS } from "@olai/identity"
import { serve } from "./serve.ts"
import { SERVER_LAYERS } from "./serve.testlib.ts"

const BOUND_MS = 10_000

/** One compressor per encoding in the shared table, keyed by the union, so a
 *  row added upstream fails to build here until somebody says what it
 *  compresses with — kolu's own emitter is a `Record` for the same reason. */
const COMPRESS: Record<
  (typeof PRECOMPRESSED_ENCODINGS)[number][0],
  (raw: Buffer) => Buffer
> = {
  br: (raw) => brotliCompressSync(raw),
  zstd: (raw) =>
    zstdCompressSync(raw, {
      params: { [zlibConstants.ZSTD_c_compressionLevel]: 19 },
    }),
  gzip: (raw) => gzipSync(raw, { level: 9 }),
}

/** A client dist with one hashed JS asset and a sibling per encoding — the
 *  layout `buildSurfaceClient` leaves behind, written by hand so this stays a
 *  test of the SERVE rather than a second run of the build. */
const clientDist = (): string => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "olai-client-"))
  const assets = path.join(root, "assets")
  fs.mkdirSync(assets)
  const identity = Buffer.from("console.log('identity-bundle-body')\n".repeat(200))
  fs.writeFileSync(path.join(assets, "main-abc123.js"), identity)
  for (const [encoding, suffix] of PRECOMPRESSED_ENCODINGS) {
    fs.writeFileSync(
      path.join(assets, `main-abc123.js${suffix}`),
      COMPRESS[encoding](identity),
    )
  }
  fs.writeFileSync(
    path.join(root, "index.html"),
    `<!doctype html><script type="module" src="/assets/main-abc123.js"></script>`,
  )
  // One outline so the store boots.
  fs.writeFileSync(
    path.join(root, "a.olai"),
    `{"id":"a","ord":"a0","title":"a"}\n`,
  )
  return root
}

const withServer = (
  dist: string,
  body: (url: string) => Promise<void>,
): Promise<void> => {
  const { layer, said } = collector()
  return Effect.gen(function*() {
    yield* serve({
      root: dist,
      port: 0,
      host: "127.0.0.1",
      clientDist: dist,
      allowedOrigins: [],
      identity: DEFAULT_IDENTITY_HEADERS,
      git: { commit: "off", push: null },
    })
    const url = findSaid(said, "serving")?.annotations.url
    expect(typeof url).toBe("string")
    yield* Effect.promise(() => body(String(url)))
  }).pipe(
    Effect.scoped,
    Effect.provide(SERVER_LAYERS),
    Effect.provide(layer),
    Effect.runPromise,
  )
}

/** Raw HTTP so the body stays compressed — `fetch` would decompress it. */
const get = (
  url: string,
  headers: Record<string, string>,
): Promise<{
  status: number
  headers: http.IncomingHttpHeaders
  body: Buffer
}> =>
  new Promise((resolve, reject) => {
    const req = http.get(url, { headers }, (res) => {
      const chunks: Buffer[] = []
      res.on("data", (c) => chunks.push(c))
      res.on("end", () =>
        resolve({
          status: res.statusCode ?? 0,
          headers: res.headers,
          body: Buffer.concat(chunks),
        }),
      )
    })
    req.setTimeout(BOUND_MS, () => {
      req.destroy(new Error(`GET ${url} timed out`))
    })
    req.on("error", reject)
  })

// Every arm, one at a time, offered ALONE — so this says "olai's serve can
// answer with this encoding" rather than restating kolu's preference order,
// which is kolu's to change. `zstd` is the arm that matters: it is what the
// server has preferred all along and what no olai build could produce until
// this pin, so a dist that cannot feed it is the defect, not a missing luxury.
for (const [encoding, suffix] of PRECOMPRESSED_ENCODINGS) {
  test(`a hashed asset is served ${encoding} when only ${encoding} is offered`, async () => {
    const dist = clientDist()
    try {
      await withServer(dist, async (base) => {
        const res = await get(`${base}/assets/main-abc123.js`, {
          "Accept-Encoding": encoding,
        })
        expect(res.status).toBe(200)
        expect(res.headers["content-encoding"]).toBe(encoding)
        expect(String(res.headers.vary ?? "")).toMatch(/Accept-Encoding/i)
        // The ORIGINAL type, not the compressor's: an encoding is how the bytes
        // travel, never what they are.
        expect(String(res.headers["content-type"] ?? "")).toMatch(/javascript/)
        expect(res.body.equals(
          fs.readFileSync(path.join(dist, "assets", `main-abc123.js${suffix}`)),
        )).toBe(true)
      })
    } finally {
      fs.rmSync(dist, { recursive: true, force: true })
    }
  })
}

test("identity is honoured — no Content-Encoding, raw bytes", async () => {
  const dist = clientDist()
  try {
    await withServer(dist, async (base) => {
      const res = await get(`${base}/assets/main-abc123.js`, {
        "Accept-Encoding": "identity",
      })
      expect(res.headers["content-encoding"]).toBeUndefined()
      expect(res.body.toString("utf8")).toContain("identity-bundle-body")
    })
  } finally {
    fs.rmSync(dist, { recursive: true, force: true })
  }
})
