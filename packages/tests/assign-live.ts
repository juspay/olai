/**
 * THE MIGRATION GESTURE and a REAL EDIT, against the pinned adapter — the
 * third of these drivers, and the one that covers the path the other two leave.
 *
 * `panel-live.ts` drives a conversation; `node-live.ts` drives the node a
 * conversation gets attached to, by the gesture that MAKES one. This drives the
 * other way round: a conversation that already exists, given a node — which is
 * the one remaining place olai MOVES a conversation between scopes, and moving
 * one is `session/load`.
 *
 * That is what makes it worth a real engine. The gesture that creates a node
 * agent used to move a conversation the same way and did not work at all
 * against a real adapter: no engine has written a session it has only just
 * minted and nobody has spoken into, so the load came back `Resource not
 * found`. This path is the same shape with one difference — the conversation
 * being moved is a STORED one, with turns in it — and whether that difference
 * is enough is a fact about the adapter rather than about olai, so no scripted
 * agent can answer it.
 *
 * The second half is a DIFF, which is the other thing only a real agent
 * produces: the panel draws an edit's own lines, and every scenario in
 * `features/` reads them off a script.
 *
 * NOT PART OF THE SUITE — nothing imports it and `just e2e` never runs it. It
 * needs a real, authenticated `claude` and costs real turns.
 *
 *   bash assign-live.sh                # …or, against a server you started:
 *   BASE=http://127.0.0.1:PORT VAULT=/path/to/vault bun assign-live.ts
 */
import { chromium } from "playwright"

import { selector, type TestId } from "@olai/web/testlib"
import type { PluginTestId } from "@olai/bundle/testids"

import { BROWSER_ARGS } from "./support/browser.ts"

type Named = TestId | PluginTestId

const BASE = process.env["BASE"]
const VAULT = process.env["VAULT"]
if (BASE === undefined || VAULT === undefined) {
  console.error(
    "assign-live.ts needs BASE=<where the server is> and VAULT=<the directory it serves>" +
      " — `bash assign-live.sh` sets both",
  )
  process.exit(2)
}
const SHOTS = process.env["SHOTS"] ?? "/tmp/assignshots"
const FILE = `${VAULT}/lanes.olai`
const NODE = "connector"
/** The node this driver assigns TO, by the title a person reads and searches
 *  for — the shortlist takes a printed address, never an id. */
const TITLE = "watch the connector"

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

/** The binding on disk, which is where an assignment LANDS — either key, for
 *  `node-live.ts`'s stated reason. */
const bindingOnDisk = async (): Promise<string | null> => {
  for (const line of (await Bun.file(FILE).text()).split("\n")) {
    if (line.trim() === "") continue
    const row = JSON.parse(line) as { id?: string; custom?: Record<string, string> }
    if (row.id === NODE) {
      return row.custom?.["chat-agent-session"] ?? row.custom?.["agent-session"] ?? null
    }
  }
  return null
}

const until = async <A>(
  read: () => Promise<A | null>,
  good: (a: A) => boolean,
  ms = 120_000,
): Promise<A | null> => {
  const stop = Date.now() + ms
  for (;;) {
    const now = await read()
    if (now !== null && good(now)) return now
    if (Date.now() > stop) return now
    await p.waitForTimeout(250)
  }
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

// ── 0. a conversation with something in it, so it is STORED ────────────
// An engine lists what it has written down, and it writes a conversation down
// when there is a turn in it. So the driver has to say something before there
// is anything to assign — which is also the difference this file is about.
await p.goto(BASE)
ok("the app came up", await drawn("outline-list"))
await p.locator(selector("chat-toggle")).click()
ok("...and the panel opens", await drawn("chat-input"))
await type("Reply with exactly STORED and nothing else.")
await drawn("chat-busy")
await idle()
ok(
  "a conversation nobody claims has been spoken into",
  (await p.locator(selector("chat-entry")).last().innerText()).includes("STORED"),
)
ok("...and no node claims it yet", await bindingOnDisk() === null, "no binding on disk")
await shot("1-stored")

// ── 1. giving it a node ────────────────────────────────────────────────
await p.locator(selector("agent-unassigned")).click()
ok("the unassigned list opens", await drawn("unassigned-panel"))
const row = p.locator(selector("unassigned-chat")).first()
await row.waitFor({ state: "visible", timeout: 60_000 })
ok("...on this directory's stored conversations", await row.innerText())
await row.locator(selector("unassigned-assign")).click()
await row.locator(selector("assign-search")).fill("connector")
ok("the search answers with nodes to give it to", await drawn("assign-hit", 30_000))
await shot("2-assigning")
await p.locator(selector("assign-hit"), { hasText: TITLE }).first().click()

// THE CLAIM THIS FILE EXISTS FOR. The assignment writes the property AND moves
// the conversation into the node's scope, which is a `session/load` of a
// conversation this engine has written down. If that load is refused the panel
// draws its third body and the node is bound to something nothing can open —
// which is exactly what the OTHER gesture used to do, and the difference is
// only that this conversation has a turn in it.
const bound = await until(bindingOnDisk, (held) => held.includes(":"))
ok("the node now names that conversation", bound !== null, `agent-session: ${bound}`)
ok("...and the conversation was NOT refused on the way into the scope", await gone("chat-unopened", 30_000))
await p.locator(selector("unassigned-done")).click()
ok("the panel is in it", await drawn("chat-node", 60_000))
ok("...with somewhere to type", await drawn("chat-input", 60_000))
await shot("3-assigned")

// ...AND IT KEPT ITS MEMORY, which is the whole point of assigning rather than
// starting fresh: the transcript that was there is the one the agent answers
// out of.
await type("What single word did you reply with a moment ago? Answer with just that word.")
await drawn("chat-busy")
await idle()
ok(
  "the assigned conversation is the SAME one — it remembers its turn",
  (await p.locator(selector("chat-entry")).last().innerText()).includes("STORED"),
)
await shot("4-remembered")

// ── 2. a real edit, and the lines the panel draws for it ───────────────
await type(
  `Use the Write tool once to create a file called note.txt in ${VAULT} ` +
    'containing exactly the line "the socket is 4mm proud". Then reply with just the word WROTE.',
)
await drawn("chat-busy")
ok("a tool call is drawn while it runs", await drawn("chat-tool", 180_000))
await idle()
ok("...and the edit's own lines are on the transcript", await drawn("chat-diff", 60_000))
ok("...with a gutter saying which side each is", await drawn("chat-diff-gutter", 30_000))
await shot("5-diff")

console.log(`\n${at()}  ${failures === 0 ? "ALL PASS" : `${failures} FAILED`}`)
await b.close()
process.exit(failures === 0 ? 0 : 1)
