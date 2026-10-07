/**
 * THE PINNED PAIR, END TO END — run by `default.nix`'s `surface` check with the
 * packaged MCP and Chromium, and by hand with any two executables.
 *
 * The disposable probe still never opens a page; then the row's own owner
 * launches Chromium headless on a temp profile — without Chromium's own
 * sandbox, which a build sandbox may not allow and olai's runtime never
 * drops — the handed-over MCP attaches over CDP and navigates to
 * `about:blank`, two MCPs prove they share one cookie jar, `browser_close` leaves the browser and the person's tab
 * standing, and the plugin's own CDP client receives a screencast frame. It
 * prints the frame sizes against the surface's frame cap. No network.
 */
import { callStdioMcp } from "@olai/plugin-kit/stdio-mcp"
import { RPC_MAX_FRAME_BYTES } from "@kolu/surface/frame-limit"
import { Effect, Option, Stream } from "effect"
import { mkdtempSync, rmSync } from "node:fs"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { launchChromium, WITHOUT_ITS_OWN_SANDBOX } from "./chromium.ts"
import { openLive } from "./live.ts"
import { probing } from "./probe.ts"
import { openScratch } from "./scratch.ts"

const [mcp, chromium] = process.argv.slice(2)
if (!mcp || !chromium) throw new Error("usage: surface.check.ts <playwright-mcp> <chromium>")
const home = mkdtempSync(join(tmpdir(), "olai-browser-check-"))

const fail = (why: string): never => { throw new Error(why) }

/** What the launched Chromium has said, for the failure report. */
let chromiumSaid = (_chars?: number): string => ""

const program = Effect.scoped(Effect.gen(function*() {
  const output = yield* openScratch(undefined)
  const live = yield* openLive({
    chromium,
    absentWhy: "",
    profile: Effect.succeed(join(home, "profile")),
    now: () => new Date().toISOString(),
    publish: { standing: () => {}, tab: () => {}, untab: () => {} },
    // A build sandbox may have no user namespaces for Chromium's own sandbox
    // (`./chromium.ts`), and macOS's refuses Chromium's reading of the system
    // proxy settings, which left every page load hanging; the check browses
    // loopback only, so it asks for no proxy. Both are the check's alone.
    launch: (executable, profile) => Effect.tap(
      launchChromium(executable, profile, { extraFlags: [...WITHOUT_ITS_OWN_SANDBOX, "--no-proxy-server", "--enable-logging=stderr"] }),
      (launched) => Effect.sync(() => { chromiumSaid = launched.said }),
    ),
  })
  const answer = yield* probing({ ...process.env, OLAI_BROWSER_MCP: mcp }, output, 15_000, live.attach)
  const server = answer.server ?? fail(answer.missing?.why ?? "No browser MCP executable was supplied.")
  if (!server.args.includes("--cdp-endpoint")) fail(`the handed-over server does not attach: ${server.args.join(" ")}`)
  const standing = live.standing()
  if (standing.kind !== "up") fail(`the browser is not up: ${JSON.stringify(standing)}`)
  const pid = standing.kind === "up" ? standing.pid : 0
  // The MCP's own log, so a failure below says what it was waiting on.
  const env = { ...process.env, ...server.env, DEBUG: "pw:mcp*,pw:browser*,pw:api" }
  const endpoint = server.args[server.args.indexOf("--cdp-endpoint") + 1]!
  /** What the check itself sees of Chromium's DevTools port, for a failure
   *  sentence: whether HTTP answers there, and whether a websocket opens. */
  const seen = () => Effect.promise(async () => {
    const http = await fetch(`http://127.0.0.1:${new URL(endpoint).port}/json/version`)
      .then(async (answer) => `HTTP ${answer.status} ${(await answer.text()).replace(/\s+/g, " ").slice(0, 200)}`, (cause) => `HTTP failed: ${String(cause)}`)
    const socket = await new Promise<string>((resolve) => {
      const dial = new WebSocket(endpoint)
      const timer = setTimeout(() => { dial.close(); resolve("websocket: no open within 5s") }, 5_000)
      dial.onopen = () => { clearTimeout(timer); dial.close(); resolve("websocket: opened") }
      dial.onerror = (event) => { clearTimeout(timer); resolve(`websocket: error ${String((event as ErrorEvent).message ?? event.type)}`) }
    })
    const own = await fetch(page).then((answer) => `its own page answers HTTP ${answer.status}`, (cause) => `its own page fails: ${String(cause)}`)
    return `the check sees ${endpoint}: ${http}; ${socket}; ${own}; the browser is ${JSON.stringify(live.standing())}; its tabs ${JSON.stringify([...live.tabs().values()])};${chromiumSaid(2_000)}`
  })
  const session = (calls: Parameters<typeof callStdioMcp>[0]["calls"]) =>
    Effect.scoped(callStdioMcp({ command: server.command, args: server.args, env, timeout: 60_000, calls }))
  // A loopback origin, because `data:` pages have no storage: what one
  // conversation's page keeps, the next conversation's page must read.
  const site = Bun.serve({ port: 0, hostname: "127.0.0.1", fetch: () => new Response(
    "<title>check</title><h1 style='font:48px serif'>olai</h1><p>" + "lorem ipsum ".repeat(400) + "</p>",
    { headers: { "content-type": "text/html" } },
  ) })
  yield* Effect.addFinalizer(() => Effect.promise(() => site.stop(true)))
  const page = `http://127.0.0.1:${site.port}/`
  const first = yield* session([
    { name: "browser_navigate", arguments: { url: page } },
    { name: "browser_evaluate", arguments: { function: "() => { localStorage.setItem('olai', 'kept'); return document.title }" } },
  ])
  if (first._tag === "failed") fail(`the attached MCP could not navigate: ${first.cause}\n${yield* seen()}\n${first.stderr}`)
  // A second conversation, after the first has gone: the same jar.
  const second = yield* session([
    { name: "browser_navigate", arguments: { url: page } },
    { name: "browser_evaluate", arguments: { function: "() => localStorage.getItem('olai')" } },
    { name: "browser_close", arguments: {} },
  ])
  if (second._tag === "failed") return fail(`the second MCP could not attach: ${second.cause}\n${yield* seen()}\n${second.stderr}`)
  const read = JSON.stringify(second.results[1]?.["content"] ?? null)
  if (!read.includes("kept")) fail(`the second conversation did not share the first's storage: ${read}`)
  try { process.kill(pid, 0) } catch { fail("browser_close stopped the shared browser") }
  const tabs = [...live.tabs().values()]
  const shown = tabs.find((tab) => tab.title === "check") ?? fail(`no tab carries the navigated page: ${JSON.stringify(tabs)}`)
  for (const [maxWidth, quality] of [[1280, 80], [1280, 60], [640, 50]] as const) {
    const frame = yield* Stream.runHead(live.screencast({ targetId: shown.id, maxWidth, quality }))
    const got = Option.getOrElse(frame, () => fail("the screencast ended without a frame"))
    if (got._tag !== "frame") fail(`the screencast refused: ${got.says}`)
    if (got._tag === "frame") {
      const bytes = JSON.stringify(got).length
      console.log(`screencast ${maxWidth}px q${quality}: ${bytes} bytes on the wire (${(100 * bytes / RPC_MAX_FRAME_BYTES).toFixed(2)}% of ${RPC_MAX_FRAME_BYTES})`)
    }
  }
  console.log(`Browser MCP attached over CDP to Chromium ${pid}: ${server.command}`)
}))

try {
  await Effect.runPromise(program)
} finally {
  rmSync(home, { recursive: true, force: true })
}
