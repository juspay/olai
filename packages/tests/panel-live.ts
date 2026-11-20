/**
 * Keep that precautionary order; the steering-history table in
 * `@kolu/acp-claude`'s `adapter/patches/README.md#steering-history-measurements`
 * records the current measurements and their limits.
 */
import type { AnyTestId as TestId } from "@olai/ui-primitives/testids.ts"
import { chromium } from "playwright"

import { selector } from "@olai/web/testlib"
import type { PluginTestId } from "@olai/bundle/testids"

import { BROWSER_ARGS } from "./support/browser.ts"

type Named = TestId | PluginTestId

const BASE = process.env["BASE"]
if (BASE === undefined) {
  console.error("panel-live.ts needs BASE=<where the server is> — `bash panel-live.sh` sets it")
  process.exit(2)
}
const SHOTS = process.env["SHOTS"] ?? "/tmp/panelshots"

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

const drawn = (name: Named, ms = 60_000): Promise<string | null> =>
  p.waitForSelector(selector(name), { timeout: ms })
    .then((el) => el.innerText())
    .then((words) => words.replace(/\s+/g, " ").trim())
    .catch(() => null)
const attr = (name: Named, key: string, ms = 60_000): Promise<string | null> =>
  p.waitForSelector(selector(name), { timeout: ms }).then((el) => el.getAttribute(key)).catch(() => null)
const gone = (name: Named, ms = 60_000): Promise<boolean> =>
  p.waitForSelector(selector(name), { state: "hidden", timeout: ms }).then(() => true).catch(() => false)
const changed = async (name: Named, from: string | null, ms = 30_000): Promise<string | null> => {
  const until = Date.now() + ms
  for (;;) {
    const now = await drawn(name, 5_000)
    if (now !== from || Date.now() > until) return now
    await p.waitForTimeout(200)
  }
}

await p.goto(BASE)
ok("the app came up", await drawn("outline-list"))
ok("the panel has a door", await drawn("chat-new"))
await p.locator(selector("chat-new")).click()
await p.locator(selector("palette-item")).first().click()
await p.locator(`${selector("palette-option")}[data-id="claude"]`).click()
await p.locator(selector("palette-input")).fill("Reply with exactly READY and nothing else.")
await p.locator(selector("palette-input")).press("Enter")
ok("...and it opens on a box to type in", await drawn("chat-input"))

const shot = (name: string): Promise<Buffer> => p.screenshot({ path: `${SHOTS}/${name}.png` })
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
const said = async (word: string): Promise<boolean> =>
  (await p.locator(selector("chat-entry")).last().innerText()).includes(word)

ok("the model line is drawn", await drawn("chat-model"))
console.log(`${at()}  agent=${await drawn("chat-agent")}`)

await type("Reply with exactly READY and nothing else.")
await drawn("chat-busy")
await idle()
ok("a turn was sent and answered", await said("READY"), "last row says READY")
ok("the context fraction appears once the agent has spent some", await drawn("chat-usage", 30_000))
await shot("1-answered")

await type("Count slowly from 1 to 40, one number per line, and say DONE at the end.")
ok("the busy strip is up while a turn runs", await drawn("chat-busy"))
await p.locator(selector("chat-input")).fill("Stop counting. Reply with exactly STEERED.")
ok("the INTERRUPT is on offer in a conversation that has never queued", await drawn("chat-interrupt"))
await shot("2-interrupt-offered")
await p.locator(selector("chat-interrupt")).click()
await idle()
ok("the interrupted turn took the words INTO itself and ENDED", await said("STEERED"),
  "the last row answers the steer")
await shot("3-steered")

await type("Count slowly from 1 to 40, one number per line, and say DONE at the end.")
await drawn("chat-busy")
await type("Then reply with exactly BANANA.")
ok("a message typed during a turn QUEUES rather than aborting the turn", await drawn("chat-queued"))
await p.locator(selector("chat-input")).fill("something to steer with")
ok("...and the interrupt is withdrawn for the rest of this conversation (#1039's guard)",
  await gone("chat-interrupt"))
await shot("4-queued")

ok("the cancel is on offer", await drawn("chat-cancel"))
await p.locator(selector("chat-cancel")).click()
ok("cancel ends the turn", await gone("chat-busy", 120_000))
await shot("5-cancelled")

await type(
  'Use the Monitor tool exactly once with description "tick watch", persistent false, ' +
  "timeout_ms 60000, and command: for i in 1 2 3; do echo tick-$i; sleep 2; done. " +
  "Then reply with just the word ARMED and end your turn. Do not call any other tool.",
)
ok("the watching strip names the live task",
  await attr("chat-watching-task", "data-kind", 240_000))
const clock1 = await drawn("chat-watching-for", 30_000)
ok("the armed task carries a clock", clock1)
ok("the call that armed it says what it left running", await drawn("chat-armed"))
ok("its rail says it is still out there", await drawn("chat-armed-still"))
await shot("6-armed")
const clock2 = await changed("chat-watching-for", clock1)
ok("the clock ticks", clock2 !== null && clock2 !== clock1, `${clock1} -> ${clock2}`)
ok("the task's DEATH is on the row, in the harness's own word",
  await attr("chat-armed-ended", "data-ended", 240_000))
ok("the still-running rail is gone with it", await gone("chat-armed-still"))
ok("the watching strip is empty again", await gone("chat-watching"))
await shot("7-ended")
await idle()

await type(
  'Use the Agent tool exactly once, with description "count the ticks" and subagent_type ' +
  "general-purpose, and give it this task: run `echo tick-one` with the Bash tool, then reply " +
  "with the word ONE and nothing else. When it reports, reply with just the word SPAWNED.",
)
ok("the row says WHO it sent out",
  await attr("chat-spawn", "data-spawn-kind", 300_000))
ok("...and the rail says that agent has not stopped", await drawn("chat-spawn-working", 120_000))
await shot("8-subagent")
await drawn("chat-lane-door", 300_000)
await p.locator(selector("chat-lane-door")).first().click()
ok("the shelf opens onto that agent's own calls", await drawn("chat-preview-of", 30_000))
await shot("9-shelf")
await idle()

const previousSession = await p.locator(selector("chat-panel")).getAttribute("data-session-id")
await p.locator(selector("chat-fresh-session")).click()
{
  const agents = p.locator(selector("agent-engine-menu"))
  const confirm = p.getByRole("button", { name: "Start fresh chat", exact: true })
  await confirm.or(agents).first().waitFor({ state: "visible", timeout: 30_000 })
  if (await agents.isVisible()) await agents.locator('[data-engine="claude"]').click()
  await confirm.click()
}
await p.waitForFunction(({ panel, previous }) => {
  const current = document.querySelector(panel)?.getAttribute("data-session-id")
  return current != null && current !== previous
}, { panel: selector("chat-panel"), previous: previousSession }, { timeout: 120_000 })
await drawn("chat-input")
await p.locator(selector("chat-sessions")).click()
await drawn("chat-session-list")
ok("the history holds the stored conversation after a fresh start",
  await drawn("chat-past-session", 120_000),
  `${await p.locator(selector("chat-past-session")).count()} rows`)
await shot("10-sessions")

console.log(`\n${at()}  ${failures === 0 ? "ALL PASS" : `${failures} FAILED`}`)
await b.close()
process.exit(failures === 0 ? 0 : 1)
