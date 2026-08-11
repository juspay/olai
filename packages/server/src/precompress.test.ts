/**
 * The build's `.br` / `.gz` siblings actually reach a browser that asks for
 * them. Kolu's static layer owns the negotiation; this is the end-to-end seam
 * for olai — a real `serve` over a dist that looks like what `build.ts` emits.
 */

import { collector, findSaid } from "@olai/log/testlib"
import { expect, test } from "bun:test"
import { Effect } from "effect"
import * as fs from "node:fs"
import * as http from "node:http"
import * as os from "node:os"
import * as path from "node:path"
import { brotliCompressSync, gzipSync } from "node:zlib"

import { serve } from "./serve.ts"
import { SERVER_LAYERS } from "./serve.testlib.ts"

const BOUND_MS = 10_000

/** A client dist with one hashed JS asset and both precompressed siblings —
 *  the layout `packages/web/src/precompress.ts` writes after a real build. */
const clientDist = (): string => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "olai-client-"))
  const assets = path.join(root, "assets")
  fs.mkdirSync(assets)
  const identity = "console.log('identity-bundle-body')\n".repeat(200)
  fs.writeFileSync(path.join(assets, "main-abc123.js"), identity)
  fs.writeFileSync(
    path.join(assets, "main-abc123.js.br"),
    brotliCompressSync(Buffer.from(identity)),
  )
  fs.writeFileSync(
    path.join(assets, "main-abc123.js.gz"),
    gzipSync(Buffer.from(identity)),
  )
  fs.writeFileSync(
    path.join(root, "index.html"),
    `<!doctype html><script type="module" src="/assets/main-abc123.js"></script>`,
  )
  // One outline so the store boots.
  fs.writeFileSync(
    path.join(root, "a.jsonl"),
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
      commit: false,
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

test("Accept-Encoding: br serves the .br sibling with Content-Encoding: br", async () => {
  const dist = clientDist()
  try {
    await withServer(dist, async (base) => {
      const res = await get(`${base}/assets/main-abc123.js`, {
        "Accept-Encoding": "br, gzip",
      })
      expect(res.status).toBe(200)
      expect(res.headers["content-encoding"]).toBe("br")
      expect(String(res.headers.vary ?? "")).toMatch(/Accept-Encoding/i)
      expect(String(res.headers["content-type"] ?? "")).toMatch(/javascript/)
      expect(res.body.equals(
        fs.readFileSync(path.join(dist, "assets", "main-abc123.js.br")),
      )).toBe(true)
    })
  } finally {
    fs.rmSync(dist, { recursive: true, force: true })
  }
})

test("Accept-Encoding: gzip alone falls back to the .gz sibling", async () => {
  const dist = clientDist()
  try {
    await withServer(dist, async (base) => {
      const res = await get(`${base}/assets/main-abc123.js`, {
        "Accept-Encoding": "gzip",
      })
      expect(res.headers["content-encoding"]).toBe("gzip")
      expect(res.body.equals(
        fs.readFileSync(path.join(dist, "assets", "main-abc123.js.gz")),
      )).toBe(true)
    })
  } finally {
    fs.rmSync(dist, { recursive: true, force: true })
  }
})

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

test("the no-store shell is never served compressed, even with a sibling on disk", async () => {
  const dist = clientDist()
  fs.writeFileSync(path.join(dist, "index.html.br"), "BROTLI-SHELL")
  try {
    await withServer(dist, async (base) => {
      const res = await get(`${base}/`, { "Accept-Encoding": "br, gzip" })
      expect(res.status).toBe(200)
      expect(res.headers["content-encoding"]).toBeUndefined()
      expect(res.body.toString("utf8")).toContain("<!doctype html>")
      expect(res.body.toString("utf8")).not.toBe("BROTLI-SHELL")
    })
  } finally {
    fs.rmSync(dist, { recursive: true, force: true })
  }
})
