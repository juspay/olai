/**
 * NODE AGENTS, against the PINNED ADAPTER — `panel-live.ts`'s other half.
 *
 * That driver is about a CONVERSATION: sending, queueing, interrupting, a
 * background task's clock, a subagent's rail. This one is about the thing a
 * conversation gets attached to — a node that carries a binding, the roster row
 * and door that are the query over it, the panel following it, and the two
 * gestures that make and remake it. None of that existed when `panel-live.ts`
 * was written, and none of it has ever met the real adapter: every scenario in
 * `features/node_agents.feature` drives the SCRIPTED agent, whose
 * `session/new` answers `fake-session-1` every time — so the one thing those
 * scenarios cannot assert is a node that changes which conversation it names,
 * which is exactly what *fresh session* is.
 *
 * ## THE TRAP is the last section, and it is why this file exists
 *
 * A node's property names a conversation the engine no longer has — a
 * `claude --resume` store cleared, a machine changed, an id that was never
 * theirs. `session/load` answers `no such conversation`, the panel draws the
 * refusal, and what it used to offer was *try again*, which asks for the same
 * lost conversation for ever. The way out is that agent's own *fresh session*,
 * and it hangs off the node the header knows — which a refused open used to
 * drop along with the conversation.
 *
 * The scripted agent can be told to refuse a load, so the suite covers the
 * shape. What it cannot do is be an engine that GENUINELY does not have a
 * conversation, which is the only way to know that a real `session/load` for a
 * stranger's id comes back `refused` (the panel's third body) rather than as a
 * dead process (its second). That distinction is the whole fix, and this is the
 * only place it can be measured.
 *
 * NOT PART OF THE SUITE — nothing imports it and `just e2e` never runs it. It
 * needs a real, authenticated `claude` and costs real turns.
 *
 *   bash node-live.sh                  # …or, against a server you started:
 *   BASE=http://127.0.0.1:PORT VAULT=/path/to/vault bun node-live.ts
 */
import { chromium } from "playwright"

import { selector, type TestId } from "@olai/web/testlib"
import type { PluginTestId } from "@olai/bundle/testids"

import { BROWSER_ARGS } from "./support/browser.ts"

/** An id from either table — the shell's and the plugin's, for the reason
 *  `panel-live.ts` spells out at the same import. */
type Named = TestId | PluginTestId

const BASE = process.env["BASE"]
const VAULT = process.env["VAULT"]
if (BASE === undefined || VAULT === undefined) {
  console.error(
    "node-live.ts needs BASE=<where the server is> and VAULT=<the directory it serves>" +
      " — `bash node-live.sh` sets both",
  )
  process.exit(2)
}
const SHOTS = process.env["SHOTS"] ?? "/tmp/nodeshots"
/** The node this driver works on, and the file it lives in — written by
 *  `node-live.sh`, re-written HERE for the trap. */
const FILE = `${VAULT}/lanes.olai`
const NODE = "connector"

const t0 = Date.now()
const at = (): string => `${((Date.now() - t0) / 1000).toFixed(1).padStart(6)}s`
let failures = 0

const ok = (claim: string, held: boolean | string | null, detail = ""): void => {
  const passed = held !== false && held !== null
  const said = typeof held === "string" && held !== "" ? held : detail
  if (!passed) failures += 1
  console.log(`${at()}  ${passed ? "PASS" : "FAIL"}  ${claim}${said === "" ? "" : `  — ${said}`}`)
}

const b = await chromium.launch({ args: [...BROWSER_ARGS] })
const p = await b.newPage({ viewport: { width: 1500, height: 1000 } })
p.on("pageerror", (e) => console.log(`${at()}  PAGE ERROR  ${e.message}`))

/** The three reads, and all of them WAIT — `panel-live.ts` argues why at
 *  length, and the argument is the same one: the panel is a beat behind
 *  everything, and a state it never reaches is a FINDING rather than somebody
 *  else's stack trace. `where` takes a full CSS selector so the roster's rows
 *  can be asked for by the node they are about. */
const shown = (where: string, ms = 60_000): Promise<string | null> =>
  p.waitForSelector(where, { timeout: ms })
    .then((el) => el.innerText())
    .then((words) => words.replace(/\s+/g, " ").trim())
    .catch(() => null)
const drawn = (name: Named, ms = 60_000): Promise<string | null> => shown(selector(name), ms)
const gone = (name: Named, ms = 60_000): Promise<boolean> =>
  p.waitForSelector(selector(name), { state: "hidden", timeout: ms }).then(() => true).catch(() =>
    false
  )

const shot = (name: string): Promise<Buffer> => p.screenshot({ path: `${SHOTS}/${name}.png` })

/** The roster's row, its door, and the panel's header line, each by the node
 *  they are about — the same `data-agent` the suite's own steps go through. */
const rowOf = (node: string): string =>
  `${selector("agent-roster")} ${selector("agent-row")}[data-agent="${node}"]`
const doorOf = (node: string): string => `${selector("agent-door")}[data-agent="${node}"]`

/** The `•••` on an outline row, opened the way a person opens it: the gutter is
 *  `opacity-0` until the row is hovered, and opacity is not something
 *  Playwright's actionability check can see through. */
const dots = async (node: string): Promise<void> => {
  const row = `${selector("node")}[data-node-id="${node}"]`
  await p.locator(`${row} ${selector("node-gutter")}`).hover()
  await p.locator(`${row} ${selector("node-menu")}`).click({ force: true })
  await p.waitForSelector(selector("node-menu-panel"), { timeout: 30_000 })
}
/** ... and one entry of it, by the words a person reads off it. */
const choose = async (label: string): Promise<void> => {
  await p.locator(selector("node-menu-item")).filter({ hasText: label }).first().click()
}

/** WHAT THE VAULT SAYS THIS NODE'S BINDING IS, read off the file rather than
 *  off the screen: the property is the durable half of a node agent, and every
 *  claim about a gesture having landed is a claim about what is on disk. */
const bindingOnDisk = async (): Promise<string | null> => {
  const text = await Bun.file(FILE).text()
  for (const line of text.split("\n")) {
    if (line.trim() === "") continue
    const row = JSON.parse(line) as {
      id?: string
      custom?: Record<string, string>
    }
    if (row.id === NODE) return row.custom?.["agent-session"] ?? null
  }
  return null
}
/** ... and the same property WRITTEN, which is how the trap is set: an id no
 *  engine ever minted, in the one place a node agent's binding lives. */
const pointAt = async (value: string): Promise<void> => {
  const text = await Bun.file(FILE).text()
  const lines = text.split("\n").map((line) => {
    if (line.trim() === "") return line
    const row = JSON.parse(line) as { id?: string; custom?: Record<string, string> }
    if (row.id !== NODE) return line
    return JSON.stringify({ ...row, custom: { ...row.custom, "agent-session": value } })
  })
  await Bun.write(FILE, lines.join("\n"))
}

const type = async (text: string): Promise<void> => {
  await p.locator(selector("chat-input")).fill(text)
  await p.locator(selector("chat-send")).click()
}
const idle = async (): Promise<void> => {
  const ms = 300_000
  if (await gone("chat-busy", ms)) return
  ok(`the turn ENDED (still on *working…* after ${ms / 1000}s)`, false)
  await shot("hung")
  await b.close()
  process.exit(1)
}

// ── 0. the boot, and a node that is not an agent ───────────────────────
await p.goto(BASE)
ok("the app came up", await drawn("outline-list"))
await p.locator(selector("chat-toggle")).click()
ok("...and the panel opens", await drawn("chat-input"))
ok(
  "a bare node wears no door",
  await p.locator(doorOf(NODE)).count() === 0,
  "nothing is bound yet",
)
ok("...and its property says so", await bindingOnDisk() === null, "no `agent-session` on disk")

// ── 1. the gesture that CREATES a node agent ───────────────────────────
await dots(NODE)
ok("the row's `•••` offers a session to start", await drawn("node-menu-panel"))
await shot("1-menu")
await choose("Start an agent session")
const bound = await p.waitForFunction(
  () => document.querySelectorAll('[data-testid="agent-door"]').length > 0,
  { timeout: 120_000 },
).then(() => true).catch(() => false)
ok("one press and the node IS an agent — a row and a door", bound)
ok("...the door names the engine", await shown(doorOf(NODE), 30_000))
const first = await bindingOnDisk()
ok(
  "...and the property carries BOTH halves, which is the durable answer",
  first !== null && first.includes(":"),
  `agent-session: ${first}`,
)
await shot("2-bound")

// ── 2. the panel follows the binding ───────────────────────────────────
await p.locator(rowOf(NODE)).click()
ok("pressing the agent puts the panel in its conversation", await drawn("chat-node", 60_000))
await type("Reply with exactly BOUND and nothing else.")
await drawn("chat-busy")
await idle()
ok(
  "the node agent answered",
  (await p.locator(selector("chat-entry")).last().innerText()).includes("BOUND"),
)
ok("...and its door carries what it last said", await shown(`${doorOf(NODE)} ${selector("agent-said")}`, 30_000))
await shot("3-answered")

// ── 3. a fresh session, and what it costs ──────────────────────────────
ok("the header offers this agent's own sessions", await drawn("chat-sessions"))
await p.locator(selector("chat-sessions")).click()
ok("the list opens", await drawn("chat-session-list"))
const said = await drawn("chat-fresh-session")
ok(
  "*fresh session* says what it MEANS beside it",
  said !== null && said.includes("memory is the subtree") &&
    said.includes("the transcript becomes history"),
  said ?? "",
)
await shot("4-sessions")
await p.locator(selector("chat-fresh-session")).click()
// THE ONE CLAIM THE SCRIPTED AGENT CANNOT MAKE: its `session/new` answers one
// id for ever, so a node re-pointed by a fresh session names the conversation
// it already named. A real adapter mints a new one, and the property MOVING is
// the whole of what this gesture does.
const moved = await p.waitForFunction(
  (was: string) => {
    const el = document.querySelector('[data-testid="chat-node"]')
    return el !== null && was !== ""
  },
  first ?? "",
  { timeout: 120_000 },
).then(() => true).catch(() => false)
ok("the panel comes back to a conversation", moved)
const second = await bindingOnDisk()
ok(
  "...and the node names a DIFFERENT one — the property moved",
  second !== null && second !== first,
  `${first} -> ${second}`,
)
await p.locator(selector("chat-sessions")).click()
ok("...with the one it replaced kept as history", await drawn("chat-past-sessions", 30_000))
await shot("5-fresh")
await p.keyboard.press("Escape")

// ── 4. THE TRAP, against an engine that genuinely has not got it ───────
// Not a scripted refusal: the property is pointed at an id no `claude` ever
// minted, so `session/load` answers for itself. What is asserted is that the
// panel reads that as a LIVE agent saying no — its third body — and that the
// way out is on the screen a person is stuck on.
await pointAt("claude:00000000-0000-4000-8000-000000000000")
ok(
  "the roster follows the property",
  await p.waitForFunction(
    () => document.querySelectorAll('[data-testid="agent-door"]').length > 0,
    { timeout: 30_000 },
  ).then(() => true).catch(() => false),
)
await p.locator(rowOf(NODE)).click()
const why = await drawn("chat-unopened-why", 120_000)
ok("a conversation the engine has not got is REFUSED, not a dead agent", await drawn("chat-unopened"))
ok("...in the agent's own words", why)
ok("...and *try again* is offered", await drawn("chat-reopen"))
// THE FIX, and the reason this section is the last one: the header goes on
// naming the node agent whose conversation it could not open, which is what
// draws that agent's session control — the only gesture that can move.
ok("THE WAY OUT: the header still names the node agent", await drawn("chat-node"))
ok("...so its sessions control is on the refused screen", await drawn("chat-sessions"))
await shot("6-trap")
await p.locator(selector("chat-sessions")).click()
await drawn("chat-fresh-session")
await p.locator(selector("chat-fresh-session")).click()
ok("...and taking it opens a conversation", await gone("chat-unopened", 120_000))
const third = await bindingOnDisk()
ok(
  "...leaving the node on one the engine HAS",
  third !== null && !third.includes("00000000"),
  `agent-session: ${third}`,
)
await type("Reply with exactly RECOVERED and nothing else.")
await drawn("chat-busy")
await idle()
ok(
  "...that can be talked to",
  (await p.locator(selector("chat-entry")).last().innerText()).includes("RECOVERED"),
)
await shot("7-recovered")

console.log(`\n${at()}  ${failures === 0 ? "ALL PASS" : `${failures} FAILED`}`)
await b.close()
process.exit(failures === 0 ? 0 : 1)
