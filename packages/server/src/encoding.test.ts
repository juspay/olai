import { assetDirOf, PRECOMPRESSED_ENCODINGS } from "@kolu/surface-app"
import { ASSET_PREFIX } from "@olai/surface"
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

import { serve } from "./serve.ts"
import { SERVER_LAYERS } from "./serve.testlib.ts"

const BOUND_MS = 10_000

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

const clientDist = (): string => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "olai-client-"))
  const assets = path.join(root, assetDirOf(ASSET_PREFIX))
  fs.mkdirSync(assets, { recursive: true })
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
    `<!doctype html><script type="module" src="${ASSET_PREFIX}main-abc123.js"></script>`,
  )
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

for (const [encoding, suffix] of PRECOMPRESSED_ENCODINGS) {
  test(`a hashed asset is served ${encoding} when only ${encoding} is offered`, async () => {
    const dist = clientDist()
    try {
      await withServer(dist, async (base) => {
        const res = await get(`${base}${ASSET_PREFIX}main-abc123.js`, {
          "Accept-Encoding": encoding,
        })
        expect(res.status).toBe(200)
        expect(res.headers["content-encoding"]).toBe(encoding)
        expect(String(res.headers.vary ?? "")).toMatch(/Accept-Encoding/i)
        expect(String(res.headers["content-type"] ?? "")).toMatch(/javascript/)
        expect(res.body.equals(
          fs.readFileSync(path.join(dist, assetDirOf(ASSET_PREFIX), `main-abc123.js${suffix}`)),
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
      const res = await get(`${base}${ASSET_PREFIX}main-abc123.js`, {
        "Accept-Encoding": "identity",
      })
      expect(res.headers["content-encoding"]).toBeUndefined()
      expect(res.body.toString("utf8")).toContain("identity-bundle-body")
    })
  } finally {
    fs.rmSync(dist, { recursive: true, force: true })
  }
})
