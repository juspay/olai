/**
 * Load-performance measurement harness for olai's web UI.
 *
 * Produces hard numbers for: server cold start → listening; app-shell TTFB;
 * asset download sizes (no gzip today); WebSocket handshake + outline payload
 * (bytes + messages) until roadmap rows exist; browser navigation → first
 * outline rows painted (Playwright Performance API + optional tracing).
 *
 * Usage (from repo root, inside the e2e shell for Playwright):
 *
 *   nix develop .#e2e --accept-flake-config -c bun scripts/load-perf/measure.mjs
 *
 * Env:
 *   LEDGER        directory to serve (default: docs)
 *   MODE          nix | dev  (default: nix)
 *   PORT          fixed port (default: free ephemeral)
 *   REPS          cold-start samples (default: 3)
 *   TRACE         1 to write a Playwright trace under scripts/load-perf/out/
 *   OLAI_BIN      override nix-built binary path
 *   NO_AGENT      1 to set OLAI_ACP_AGENT= (default: 1 — isolate store/serve)
 *
 * Writes JSON + a short text summary to scripts/load-perf/out/.
 */

import { spawn, execFileSync } from "node:child_process"
import {
  mkdirSync,
  writeFileSync,
  readFileSync,
  readdirSync,
  statSync,
} from "node:fs"
import { createServer } from "node:net"
import { basename, dirname, join, resolve } from "node:path"
import { fileURLToPath } from "node:url"
import { performance } from "node:perf_hooks"
import { Result } from "effect"

const HERE = dirname(fileURLToPath(import.meta.url))
const ROOT = resolve(HERE, "../..")
/** Every harness write lands under this directory — a constant, not env. */
const OUT = join(HERE, "out")
// mkdir -p semantics: recursive create, no exists-then-create race.
mkdirSync(OUT, { recursive: true })

/**
 * Path under {@link OUT} from a basename we control. Rejects anything that is
 * not a single path segment of safe characters so HTTP/env taint cannot walk
 * out of the measurement directory (CodeQL js/http-to-file-access).
 */
const outFile = (name) => {
  const base = basename(name)
  if (base !== name || base === "" || base === "." || base === "..") {
    throw new Error(`outFile: refuse non-basename ${JSON.stringify(name)}`)
  }
  if (!/^[A-Za-z0-9][A-Za-z0-9._-]*$/.test(base)) {
    throw new Error(`outFile: refuse unsafe basename ${JSON.stringify(base)}`)
  }
  return join(OUT, base)
}

const LEDGER = resolve(process.env.LEDGER ?? join(ROOT, "docs"))
/** Allowlisted mode token — never interpolated raw from the environment. */
const MODE = process.env.MODE === "dev" ? "dev" : "nix"
const REPS = Number(process.env.REPS ?? "3")
const WANT_TRACE = process.env.TRACE === "1"
const NO_AGENT = process.env.NO_AGENT !== "0"
/** Path to open in the browser (default `/`). For the project plan: `/o/roadmap.jsonl`. */
const APP_PATH = process.env.APP_PATH ?? "/"

const now = () => performance.now()

/** Free loopback port. */
const freePort = () =>
  new Promise((resolvePort, reject) => {
    const s = createServer()
    s.unref()
    s.on("error", reject)
    s.listen(0, "127.0.0.1", () => {
      const addr = s.address()
      if (addr === null || typeof addr === "string") {
        s.close()
        reject(new Error("no port"))
        return
      }
      const { port } = addr
      s.close(() => resolvePort(port))
    })
  })

const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

const binOf = () => {
  if (process.env.OLAI_BIN) return { kind: "nix", bin: process.env.OLAI_BIN }
  if (MODE === "nix") {
    // argv array, no shell — same rule as the curl probe below.
    const out = execFileSync(
      "nix",
      ["build", ".#olai", "--no-link", "--print-out-paths", "--accept-flake-config"],
      { cwd: ROOT, encoding: "utf8" },
    ).trim()
    return { kind: "nix", bin: join(out, "bin/olai") }
  }
  const dist = join(ROOT, "packages/web/dist")
  // Open and handle miss — no exists-then-act race (CodeQL js/file-system-race).
  try {
    readFileSync(join(dist, "index.html"))
  } catch (e) {
    if (e && /** @type {NodeJS.ErrnoException} */ (e).code === "ENOENT") {
      throw new Error("dev mode needs packages/web/dist — run `just build-client`")
    }
    throw e
  }
  return {
    kind: "dev",
    bin: null,
    dist,
    main: join(ROOT, "packages/server/src/main.ts"),
  }
}

const startServer = async (launcher, port) => {
  const env = { ...process.env }
  if (NO_AGENT) env.OLAI_ACP_AGENT = ""
  // Never inherit a parent's agent override unless NO_AGENT is off.

  let child
  const t0 = now()
  if (launcher.kind === "nix") {
    child = spawn(
      launcher.bin,
      ["web", LEDGER, "--port", String(port), "--host", "127.0.0.1", "--no-commit"],
      { env, stdio: ["ignore", "pipe", "pipe"], cwd: ROOT },
    )
  } else {
    child = spawn(
      "bun",
      [launcher.main, "web", LEDGER, "--port", String(port), "--host", "127.0.0.1", "--no-commit"],
      {
        env: { ...env, OLAI_DIST_DIR: launcher.dist },
        stdio: ["ignore", "pipe", "pipe"],
        cwd: ROOT,
      },
    )
  }

  let log = ""
  const onChunk = (d) => {
    log += d.toString()
  }
  child.stdout.on("data", onChunk)
  child.stderr.on("data", onChunk)

  let serveMs = null
  let listenMs = null
  for (let i = 0; i < 500; i++) {
    // Prefer the server's own "serving" log with serve=Nms span.
    const m = log.match(/message=serving[^\n]*serve=(\d+)ms/)
    if (m && serveMs === null) serveMs = Number(m[1])
    try {
      const r = await fetch(`http://127.0.0.1:${port}/`, {
        signal: AbortSignal.timeout(80),
      })
      if (r.ok) {
        listenMs = now() - t0
        break
      }
    } catch {
      /* not up yet */
    }
    await sleep(15)
  }
  if (listenMs === null) {
    child.kill("SIGTERM")
    throw new Error(`server did not listen on ${port}\n${log.slice(-2000)}`)
  }
  return {
    child,
    port,
    baseUrl: `http://127.0.0.1:${port}`,
    coldStartMs: listenMs,
    serveSpanMs: serveMs,
    log,
    stop: async () => {
      child.kill("SIGTERM")
      await new Promise((r) => child.once("exit", r))
    },
  }
}

/** curl-like timing for one URL. */
const httpTiming = async (url) => {
  const t0 = now()
  const res = await fetch(url)
  const ttfb = now() - t0
  const buf = Buffer.from(await res.arrayBuffer())
  const total = now() - t0
  return {
    url,
    status: res.status,
    bytes: buf.byteLength,
    ttfbMs: +ttfb.toFixed(2),
    totalMs: +total.toFixed(2),
    contentType: res.headers.get("content-type"),
    contentEncoding: res.headers.get("content-encoding"),
    cacheControl: res.headers.get("cache-control"),
  }
}

const shellAndAssets = async (baseUrl) => {
  const shell = await httpTiming(baseUrl + "/")
  const html = await (await fetch(baseUrl + "/")).text()
  const assets = []
  for (const m of html.matchAll(/(?:src|href)="(\/assets\/[^"]+)"/g)) {
    assets.push(await httpTiming(baseUrl + m[1]))
  }
  // Raw HTTP for encoding probes: undici/Bun `fetch` decompresses the body and
  // strips Content-Encoding, which would make a successful brotli look like
  // identity. curl keeps the on-the-wire bytes.
  const jsHref = html.match(/src="(\/assets\/main-[^"]+\.js)"/)?.[1]
  let gzipProbe = null
  if (jsHref) {
    gzipProbe = {
      br: rawAssetProbe(baseUrl + jsHref, "br, gzip"),
      gzipOnly: rawAssetProbe(baseUrl + jsHref, "gzip"),
      identity: rawAssetProbe(baseUrl + jsHref, "identity"),
    }
  }
  return { shell, assets, gzipProbe, htmlBytes: shell.bytes }
}

/** Fixed body path for curl probes — under OUT, never /tmp or env-derived. */
const PROBE_BODY = outFile("probe-body.bin")

/**
 * On-the-wire asset probe via curl (preserves Content-Encoding + body size).
 * argv array only — never a shell string (CodeQL js/command-line-injection).
 */
const rawAssetProbe = (url, acceptEncoding) => {
  try {
    const out = execFileSync(
      "curl",
      [
        "-sS",
        "-D",
        "-",
        "-o",
        PROBE_BODY,
        "-H",
        `Accept-Encoding: ${acceptEncoding}`,
        url,
      ],
      { encoding: "utf8", maxBuffer: 2 * 1024 * 1024 },
    )
    const headerEnd = out.indexOf("\r\n\r\n")
    const headers = headerEnd === -1 ? out : out.slice(0, headerEnd)
    const encoding = /content-encoding:\s*(\S+)/i.exec(headers)?.[1] ?? null
    const vary = /vary:\s*([^\r\n]+)/i.exec(headers)?.[1] ?? null
    const status = /HTTP\/[\d.]+\s+(\d+)/.exec(headers)?.[1] ?? null
    let bytes = null
    try {
      bytes = statSync(PROBE_BODY).size
    } catch {
      /* no body file */
    }
    return {
      acceptEncoding,
      status: status === null ? null : Number(status),
      contentEncoding: encoding,
      vary,
      bytesReceived: bytes,
    }
  } catch (e) {
    return { acceptEncoding, error: String(e) }
  }
}

/** Local dist sizes (source of truth for "what we ship"). */
const distSizes = () => {
  const assetsDir = join(ROOT, "packages/web/dist", "assets")
  let names
  try {
    names = readdirSync(assetsDir)
  } catch (e) {
    if (e && /** @type {NodeJS.ErrnoException} */ (e).code === "ENOENT") return null
    throw e
  }
  const files = []
  for (const name of names) {
    if (name.endsWith(".map")) continue
    const p = join(assetsDir, name)
    let raw
    let st
    try {
      // Single open path — no exists-then-read race.
      raw = readFileSync(p)
      st = statSync(p)
    } catch (e) {
      if (e && /** @type {NodeJS.ErrnoException} */ (e).code === "ENOENT") continue
      throw e
    }
    let gzip = null
    try {
      gzip = Bun.gzipSync(raw).byteLength
    } catch {
      /* no bun gzip */
    }
    files.push({ name, bytes: st.size, gzipBytes: gzip })
  }
  return files
}

/**
 * Microbench: parse / assemble / validate / derive for the ledger on disk.
 * Runs inside the same process via dynamic import of workspace packages.
 */
const formatMicrobench = async () => {
  // Same path the store's codec uses: decode each file → assemble → validate,
  // then the client's own `derive` over the flat node list.
  const { parseOutline, assemble, validate, derive, fileKind } = await import(
    join(ROOT, "packages/format/src/index.ts")
  )
  const { readdirSync: rd, readFileSync: rf, statSync: st } = await import("node:fs")
  const { join: j } = await import("node:path")

  const walk = (dir, base = "") => {
    const out = []
    for (const name of rd(dir)) {
      if (name === ".git") continue
      const abs = j(dir, name)
      const rel = base ? `${base}/${name}` : name
      if (st(abs).isDirectory()) out.push(...walk(abs, rel))
      else if (fileKind(rel) !== null) out.push({ abs, rel })
    }
    return out
  }

  const files = walk(LEDGER)
  // Pre-read so we measure pure CPU, not Dropbox/FS latency.
  const texts = files.map((f) => ({ rel: f.rel, text: rf(f.abs, "utf8"), bytes: st(f.abs).size }))
  const diskBytes = texts.reduce((a, f) => a + f.bytes, 0)

  const reps = 30
  const samples = { decodeMs: [], validateMs: [], deriveMs: [], totalMs: [] }
  let last = null
  for (let i = 0; i < reps; i++) {
    const t0 = now()
    const decoded = new Map()
    for (const f of texts) {
      if (fileKind(f.rel) === "document") {
        decoded.set(f.rel, Result.succeed({ file: f.rel, text: f.text }))
      } else {
        decoded.set(f.rel, parseOutline(f.rel, f.text))
      }
    }
    const tDecode = now()
    const assembled = assemble(decoded)
    const outcome = validate(assembled)
    const tVal = now()
    if (!Result.isSuccess(outcome)) {
      throw new Error(
        `validate failed: ${JSON.stringify(outcome.failure?.slice?.(0, 3) ?? outcome)}`,
      )
    }
    const set = outcome.success
    const derived = derive(set.nodes)
    const tEnd = now()
    samples.decodeMs.push(tDecode - t0)
    samples.validateMs.push(tVal - tDecode)
    samples.deriveMs.push(tEnd - tVal)
    samples.totalMs.push(tEnd - t0)
    last = {
      files: set.files.length,
      nodes: set.nodes.length,
      documents: set.documents.length,
      broken: set.broken.length,
      derivedIds: derived.byId.size,
      // Approximate wire payload: Located[] as JSON (surface uses Effect Schema /
      // ndjson; this is a lower bound for the outlines snapshot body).
      nodesJsonBytes: Buffer.byteLength(JSON.stringify(set.nodes), "utf8"),
    }
  }
  const avg = (xs) => xs.reduce((a, b) => a + b, 0) / xs.length
  const min = (xs) => Math.min(...xs)
  return {
    ledger: LEDGER,
    diskBytes,
    fileCount: files.length,
    shape: last,
    reps,
    meanMs: {
      decode: +avg(samples.decodeMs).toFixed(3),
      validate: +avg(samples.validateMs).toFixed(3),
      derive: +avg(samples.deriveMs).toFixed(3),
      total: +avg(samples.totalMs).toFixed(3),
    },
    minMs: {
      decode: +min(samples.decodeMs).toFixed(3),
      validate: +min(samples.validateMs).toFixed(3),
      derive: +min(samples.deriveMs).toFixed(3),
      total: +min(samples.totalMs).toFixed(3),
    },
  }
}

/**
 * Browser measurement via Playwright + CDP WebSocket frames.
 * Waits for outline rows ([data-testid=node]) or the empty/error states.
 */
const browserMeasure = async (baseUrl) => {
  // playwright is a devDependency of packages/tests (pinned to the e2e shell's
  // driver). Resolve it from there rather than requiring a root install.
  const { chromium } = await import(
    join(ROOT, "packages/tests/node_modules/playwright/index.mjs")
  ).catch(async () => {
    // Bun may prefer the CJS entry.
    return import(join(ROOT, "packages/tests/node_modules/playwright"))
  })
  const browser = await chromium.launch({
    headless: true,
    args: [
      "--no-sandbox",
      "--disable-setuid-sandbox",
      "--disable-gpu",
      "--disable-dev-shm-usage",
      "--headless=new",
    ],
  })
  const context = await browser.newContext({
    viewport: { width: 1440, height: 900 },
  })
  if (WANT_TRACE) {
    await context.tracing.start({ screenshots: true, snapshots: true, sources: false })
  }
  const page = await context.newPage()

  // CDP for WebSocket frame sizes
  const cdp = await context.newCDPSession(page)
  await cdp.send("Network.enable")
  const ws = {
    created: [],
    framesIn: [],
    framesOut: [],
    handshakeMs: null,
    openAt: null,
  }
  const navT0 = { t: null }

  cdp.on("Network.webSocketCreated", (p) => {
    ws.created.push({ url: p.url, requestId: p.requestId, t: now() })
  })
  cdp.on("Network.webSocketWillSendHandshakeRequest", (p) => {
    ws.hsStart = now()
    ws.hsRequestId = p.requestId
  })
  cdp.on("Network.webSocketHandshakeResponseReceived", (p) => {
    ws.handshakeMs = now() - (ws.hsStart ?? now())
    ws.openAt = now()
    ws.hsStatus = p.response?.status
  })
  cdp.on("Network.webSocketFrameReceived", (p) => {
    const payload = p.response?.payloadData ?? ""
    // CDP may base64-encode binary; surface uses ndjson text.
    const bytes = Buffer.byteLength(payload, "utf8")
    ws.framesIn.push({
      t: now(),
      bytes,
      opcode: p.response?.opcode,
    })
  })
  cdp.on("Network.webSocketFrameSent", (p) => {
    const payload = p.response?.payloadData ?? ""
    ws.framesOut.push({
      t: now(),
      bytes: Buffer.byteLength(payload, "utf8"),
    })
  })

  // Resource timing via Performance API after load
  navT0.t = now()
  const target = baseUrl.replace(/\/$/, "") + APP_PATH
  const response = await page.goto(target, { waitUntil: "commit" })
  const ttfbNav = now() - navT0.t

  // Wait until outline UI is committed: either nodes, sidebar list, or error page.
  const painted = await Promise.race([
    page
      .waitForSelector('[data-testid="node"]', { timeout: 30_000 })
      .then(async () => {
        const count = await page.locator('[data-testid="node"]').count()
        return { kind: "nodes", count, t: now() - navT0.t }
      }),
    page
      .waitForSelector('[data-testid="error-view"]', { timeout: 30_000 })
      .then(() => ({ kind: "error-view", count: 0, t: now() - navT0.t })),
    page
      .waitForSelector('[data-testid="nothing"]', { timeout: 30_000 })
      .then(() => ({ kind: "nothing", count: 0, t: now() - navT0.t })),
  ]).catch((e) => ({ kind: "timeout", error: String(e), t: now() - navT0.t }))

  // Wait until the connection is live (surface snapshot delivered) and re-count nodes.
  await page
    .waitForSelector('[data-testid="connection"][data-connection="live"]', {
      timeout: 15_000,
    })
    .catch(() => null)
  painted.liveMs = now() - navT0.t
  // Brief settle so late WS frames are counted; NOT included in liveMs.
  await sleep(250)
  const nodeCountAfter = await page.locator('[data-testid="node"]').count()
  painted.nodeCountAfterSettle = nodeCountAfter

  const perf = await page.evaluate(() => {
    const nav = performance.getEntriesByType("navigation")[0]
    const paints = performance.getEntriesByType("paint")
    const resources = performance.getEntriesByType("resource").map((r) => ({
      name: r.name.replace(location.origin, ""),
      initiatorType: r.initiatorType,
      transferSize: r.transferSize,
      encodedBodySize: r.encodedBodySize,
      decodedBodySize: r.decodedBodySize,
      duration: +r.duration.toFixed(2),
      domainLookupStart: r.domainLookupStart,
      connectStart: r.connectStart,
      requestStart: r.requestStart,
      responseStart: r.responseStart,
      responseEnd: r.responseEnd,
      startTime: +r.startTime.toFixed(2),
    }))
    const mainJs = resources.find((r) => /\/assets\/main-.*\.js$/.test(r.name))
    return {
      navigation: nav
        ? {
            type: nav.type,
            startTime: nav.startTime,
            requestStart: nav.requestStart,
            responseStart: nav.responseStart,
            responseEnd: nav.responseEnd,
            domContentLoadedEventEnd: nav.domContentLoadedEventEnd,
            loadEventEnd: nav.loadEventEnd,
            domInteractive: nav.domInteractive,
            transferSize: nav.transferSize,
            encodedBodySize: nav.encodedBodySize,
            decodedBodySize: nav.decodedBodySize,
          }
        : null,
      paints: paints.map((p) => ({ name: p.name, startTime: p.startTime })),
      mainJs,
      resources,
      longTasks:
        performance.getEntriesByType?.("longtask")?.map((t) => ({
          startTime: t.startTime,
          duration: t.duration,
        })) ?? [],
    }
  })

  // Connection indicator + how many nodes are visible
  const ui = await page.evaluate(() => {
    const conn = document.querySelector('[data-testid="connection"]')
    const nodes = document.querySelectorAll('[data-testid="node"]').length
    const tree = document.querySelector('[data-testid="outline-tree"]')
    const sidebar = document.querySelector('[data-testid="sidebar"]')
    return {
      connection: conn?.getAttribute("data-connection") ?? null,
      nodeCount: nodes,
      hasTree: !!tree,
      hasSidebar: !!sidebar,
      title: document.title,
    }
  })

  let tracePath = null
  if (WANT_TRACE) {
    tracePath = outFile(`trace-${Date.now()}.zip`)
    await context.tracing.stop({ path: tracePath })
  }

  await browser.close()

  const inBytes = ws.framesIn.reduce((a, f) => a + f.bytes, 0)
  const outBytes = ws.framesOut.reduce((a, f) => a + f.bytes, 0)
  // Time from WS open to last inbound frame that arrived before paint+300ms
  const firstIn =
    ws.framesIn.length > 0 ? ws.framesIn[0].t - (ws.openAt ?? ws.framesIn[0].t) : null
  const payloadUntilPaint = {
    framesIn: ws.framesIn.length,
    framesOut: ws.framesOut.length,
    bytesIn: inBytes,
    bytesOut: outBytes,
    handshakeMs: ws.handshakeMs === null ? null : +ws.handshakeMs.toFixed(2),
    hsStatus: ws.hsStatus ?? null,
    msToFirstFrame: firstIn === null ? null : +firstIn.toFixed(2),
    largestInFrame: ws.framesIn.reduce((a, f) => Math.max(a, f.bytes), 0),
  }

  return {
    httpStatus: response?.status() ?? null,
    navCommitMs: +ttfbNav.toFixed(2),
    painted,
    ui,
    perf,
    websocket: payloadUntilPaint,
    wsCreated: ws.created.map((c) => c.url),
    tracePath,
  }
}

const mean = (xs) => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : null)

const main = async () => {
  const launcher = binOf()
  console.log(`mode=${MODE} ledger=${LEDGER} path=${APP_PATH} noAgent=${NO_AGENT}`)
  console.log(`launcher=${JSON.stringify(launcher)}`)

  // ── cold starts ──────────────────────────────────────────────────
  const cold = []
  for (let i = 0; i < REPS; i++) {
    const port = process.env.PORT ? Number(process.env.PORT) + i : await freePort()
    const s = await startServer(launcher, port)
    cold.push({
      rep: i,
      coldStartMs: +s.coldStartMs.toFixed(2),
      serveSpanMs: s.serveSpanMs,
    })
    console.log(
      `cold[${i}] listen=${s.coldStartMs.toFixed(1)}ms serveSpan=${s.serveSpanMs}ms`,
    )
    await s.stop()
    await sleep(100)
  }

  // ── steady server for the rest ───────────────────────────────────
  const port = process.env.PORT ? Number(process.env.PORT) + 100 : await freePort()
  const server = await startServer(launcher, port)
  console.log(`steady server at ${server.baseUrl}`)

  const http = await shellAndAssets(server.baseUrl)
  console.log(
    `shell ttfb=${http.shell.ttfbMs}ms bytes=${http.shell.bytes}; assets=`,
    http.assets.map((a) => `${a.url.split("/").pop()}=${a.bytes}B/${a.totalMs}ms`),
  )
  console.log(`gzip probe:`, http.gzipProbe)

  let format = null
  try {
    format = await formatMicrobench()
    console.log(`format microbench:`, format.meanMs, format.shape)
  } catch (e) {
    console.warn("format microbench failed:", e)
    format = { error: String(e) }
  }

  let browser = null
  try {
    browser = await browserMeasure(server.baseUrl)
    console.log(
      `browser paint=${JSON.stringify(browser.painted)} ws=${JSON.stringify(browser.websocket)} ui=${JSON.stringify(browser.ui)}`,
    )
  } catch (e) {
    console.warn("browser measure failed:", e)
    browser = { error: String(e), stack: e?.stack }
  }

  // Second browser pass for a warm server / cold browser cache (new context already cold)
  let browser2 = null
  try {
    browser2 = await browserMeasure(server.baseUrl)
  } catch (e) {
    browser2 = { error: String(e) }
  }

  await server.stop()

  const report = {
    when: new Date().toISOString(),
    host: {
      platform: process.platform,
      arch: process.arch,
      bun: process.versions?.bun ?? null,
      node: process.version,
    },
    mode: MODE,
    ledger: LEDGER,
    appPath: APP_PATH,
    noAgent: NO_AGENT,
    launcher,
    coldStart: {
      reps: cold,
      meanListenMs: +mean(cold.map((c) => c.coldStartMs)).toFixed(2),
      meanServeSpanMs: (() => {
        const spans = cold.map((c) => c.serveSpanMs).filter((x) => x != null)
        const m = mean(spans)
        return m === null ? null : +m.toFixed(2)
      })(),
    },
    distSizes: distSizes(),
    http,
    format,
    browser: [browser, browser2],
  }

  // Basenames are built only from the allowlisted MODE token and a digits/T/-
  // stamp — then forced through outFile() so the write path is OUT + safe name.
  const stamp = new Date().toISOString().replace(/[:.]/g, "-").replace(/[^0-9T-]/g, "")
  const jsonPath = outFile(`measure-${MODE}-${stamp}.json`)
  const latestJson = outFile(`latest-${MODE}.json`)
  const latestTxt = outFile(`latest-${MODE}.txt`)
  writeFileSync(jsonPath, JSON.stringify(report, null, 2))
  writeFileSync(latestJson, JSON.stringify(report, null, 2))

  // Human summary
  const b0 = browser && !browser.error ? browser : null
  const summary = `
# load-perf measure summary
when:     ${report.when}
mode:     ${MODE}
ledger:   ${LEDGER}
path:     ${APP_PATH}
noAgent:  ${NO_AGENT}

## server cold start (n=${REPS})
mean process→listen:  ${report.coldStart.meanListenMs} ms
mean serve= span:     ${report.coldStart.meanServeSpanMs} ms
samples: ${cold.map((c) => c.coldStartMs + "ms").join(", ")}

## HTTP shell + assets (loopback)
shell TTFB:  ${http.shell.ttfbMs} ms (${http.shell.bytes} B)
assets: ${http.assets.map((a) => `${a.url.split("/").pop()}: ${a.bytes} B in ${a.totalMs} ms`).join("; ")}
encoding probes (main.js, raw wire via curl):
  br,gzip → encoding=${http.gzipProbe?.br?.contentEncoding ?? "?"} bytes=${http.gzipProbe?.br?.bytesReceived ?? "?"}
  gzip    → encoding=${http.gzipProbe?.gzipOnly?.contentEncoding ?? "?"} bytes=${http.gzipProbe?.gzipOnly?.bytesReceived ?? "?"}
  identity→ encoding=${http.gzipProbe?.identity?.contentEncoding ?? "null"} bytes=${http.gzipProbe?.identity?.bytesReceived ?? "?"}

## format microbench (in-process, mean of ${format?.reps ?? "?"})
decode: ${format?.meanMs?.decode ?? "?"} ms  validate: ${format?.meanMs?.validate ?? "?"} ms  derive: ${format?.meanMs?.derive ?? "?"} ms  total: ${format?.meanMs?.total ?? "?"} ms
shape: ${JSON.stringify(format?.shape ?? null)} diskBytes=${format?.diskBytes}

## browser (Playwright, cold context)
nav commit:     ${b0?.navCommitMs ?? "?"} ms
first node:     ${b0?.painted?.t?.toFixed?.(1) ?? b0?.painted?.t ?? "?"} ms  (${b0?.painted?.kind}, firstCount=${b0?.painted?.count})
connection live:${b0?.painted?.liveMs?.toFixed?.(1) ?? "?"} ms  nodes=${b0?.painted?.nodeCountAfterSettle ?? b0?.ui?.nodeCount}
WS handshake:   ${b0?.websocket?.handshakeMs ?? "?"} ms
WS in:          ${b0?.websocket?.framesIn ?? "?"} frames / ${b0?.websocket?.bytesIn ?? "?"} B (largest ${b0?.websocket?.largestInFrame ?? "?"} B)
WS out:         ${b0?.websocket?.framesOut ?? "?"} frames / ${b0?.websocket?.bytesOut ?? "?"} B
perf paints:    ${JSON.stringify(b0?.perf?.paints ?? null)}
main.js:        ${JSON.stringify(b0?.perf?.mainJs ?? null)}
nav timing:     ${JSON.stringify(b0?.perf?.navigation ?? null)}
connection:     ${b0?.ui?.connection}

json: ${jsonPath}
`.trim()
  writeFileSync(latestTxt, summary + "\n")
  console.log("\n" + summary)
  console.log(`\nwrote ${jsonPath}`)
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
