import type { AnyTestId as TestId } from "@olai/ui-primitives/testids.ts"
import { chromium } from "playwright"

import { selector } from "@olai/web/testlib"
import type { PluginTestId } from "@olai/bundle/testids"

import { BROWSER_ARGS } from "./support/browser.ts"

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

const rowOf = (node: string): string =>
  `${selector("agent-roster")} ${selector("agent-row")}[data-agent="${node}"]`
const standingOf = (node: string): string => `${selector("agent-standing")}[data-agent="${node}"]`
const foldOf = (node: string): string => `${selector("agent-fold")}[data-agent="${node}"]`

const dots = async (node: string): Promise<void> => {
  const row = `${selector("node")}[data-node-id="${node}"]`
  await p.locator(`${row} ${selector("node-gutter")}`).first().hover()
  await p.locator(`${row} ${selector("node-menu")}`).first().click({ force: true })
  await p.waitForSelector(selector("node-menu-panel"), { timeout: 30_000 })
}
const startClaude = async (): Promise<void> => {
  const entry = p.locator(`${selector("node-menu-item")}[data-action^="chat:start-agent"]`).first()
  await entry.click()
  if (await entry.getAttribute("data-action") === "chat:start-agent") {
    const sub = p.locator(`${selector("node-menu-sub")}[data-sub="chat:start-agent"]`)
    await sub.waitFor({ state: "visible", timeout: 30_000 })
    await sub.locator('[data-action="chat:start-agent-claude"]').click()
  }
}
const freshStart = async (): Promise<void> => {
  await p.locator(selector("chat-fresh-session")).first().click()
  const menu = p.locator(selector("agent-engine-menu"))
  const confirm = p.getByRole("button", { name: "Start fresh chat", exact: true })
  await confirm.or(menu).first().waitFor({ state: "visible", timeout: 30_000 })
  if (await menu.isVisible()) await menu.locator('[data-engine="claude"]').click()
  await confirm.click()
}

const bindingOnDisk = async (): Promise<string | null> => {
  const text = await Bun.file(FILE).text()
  for (const line of text.split("\n")) {
    if (line.trim() === "") continue
    const row = JSON.parse(line) as {
      id?: string
      custom?: Record<string, string>
    }
    if (row.id === NODE) {
      return row.custom?.["chat-agent-session"] ?? row.custom?.["agent-session"] ?? null
    }
  }
  return null
}
const pointAt = async (value: string): Promise<void> => {
  const text = await Bun.file(FILE).text()
  const lines = text.split("\n").map((line) => {
    if (line.trim() === "") return line
    const row = JSON.parse(line) as { id?: string; custom?: Record<string, string> }
    if (row.id !== NODE) return line
    return JSON.stringify({ ...row, custom: { ...row.custom, "chat-agent-session": value } })
  })
  await Bun.write(FILE, lines.join("\n"))
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

await p.goto(BASE)
ok("the app came up", await drawn("outline-list"))
ok(
  "a bare node wears no standing",
  await p.locator(standingOf(NODE)).count() === 0,
  "nothing is bound yet",
)
ok("...and its property says so", await bindingOnDisk() === null, "no `agent-session` on disk")

await dots(NODE)
ok("the row's `•••` offers an agent to start", await drawn("node-menu-panel"))
await shot("1-menu")
await startClaude()
const bound = await p.waitForSelector(foldOf(NODE), { timeout: 120_000 }).then(() => true).catch(() => false)
ok("one press and the node IS an agent — its conversation folds open under it", bound)
ok("...the row wears a standing", await shown(standingOf(NODE), 30_000))
const first = await until(bindingOnDisk, (held) => held.includes(":"))
ok(
  "...and the property carries BOTH halves, which is the durable answer",
  first !== null && first.includes(":"),
  `agent-session: ${first}`,
)
await shot("2-bound")

ok("...on a conversation there is somewhere to type into", await drawn("chat-input", 120_000))
await type("Reply with exactly BOUND and nothing else.")
await drawn("chat-busy")
await idle()
ok(
  "the node agent answered",
  (await p.locator(selector("chat-entry")).last().innerText()).includes("BOUND"),
)
ok("...and the sidebar's Chats lists it", await shown(rowOf(NODE), 30_000))
await shot("3-answered")

ok("the agent line offers a fresh start", await drawn("chat-fresh-session"))
await freshStart()
const second = await until(bindingOnDisk, (held) => held !== first)
ok(
  "the node names a DIFFERENT conversation — the property moved",
  second !== null && second !== first,
  `${first} -> ${second}`,
)
ok("...and the fold comes back to a conversation", await drawn("chat-input", 120_000))
await p.locator(selector("chat-sessions")).click()
ok("...with the one it replaced kept among its earlier chats", await drawn("chat-past-sessions", 30_000))
await shot("5-fresh")
await p.keyboard.press("Escape")
ok("the earlier-chats list shuts", await gone("chat-session-list", 30_000))

const STRANGER = "claude:00000000-0000-4000-8000-000000000000"
await pointAt(STRANGER)
for (let press = 0; press < 5; press += 1) {
  if (await p.locator(selector("chat-unopened")).count() > 0) break
  if (await p.locator(foldOf(NODE)).count() === 0) await p.locator(rowOf(NODE)).click()
  await p.waitForTimeout(2_000)
}
const why = await drawn("chat-unopened-why", 120_000)
ok("a conversation the engine has not got is REFUSED, not a dead agent", await drawn("chat-unopened"))
ok("...in the agent's own words, naming the stranger the vault points at", why)
ok("...and *Try again* is offered", await drawn("chat-reopen"))
ok("THE WAY OUT: Fresh start is on the refused screen", await drawn("chat-fresh-session"))
await shot("6-trap")
await freshStart()
ok("...and taking it opens a conversation", await gone("chat-unopened", 120_000))
const third = await until(bindingOnDisk, (held) => held !== STRANGER)
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
