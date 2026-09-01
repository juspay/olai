/**
 * The PANEL, against a live conversation with the PINNED ADAPTER — the fifth
 * driver here, and the one a PIN BUMP is not finished without.
 *
 * `tasks.ts` drives the adapter with no olai in it, because what it measures
 * is somebody else's process. This one is the other half of that question and
 * the half a unit suite cannot answer: the panel's own behaviours — sending,
 * queueing, interrupting, cancelling, the model line, the context fraction, a
 * background task's clock and its death notice, a subagent's rail and the
 * shelf its calls are read in — driven through a real browser against the
 * agent olai SHIPS. Every scenario in `features/` drives a SCRIPTED agent, on
 * purpose (a turn has to be deterministic to be asserted); the cost of that is
 * that no scenario has ever seen the real one, and a pin bump is precisely
 * when that matters.
 *
 * ORDER MATTERS HERE, and it is the driver's own subject rather than a
 * convenience: the interrupt is asserted BEFORE anything has queued and before
 * any `Monitor` has been armed, because each of those leaves the pinned
 * adapter unable to settle a steered turn (`acp/patches/README.md` has both
 * triggers and what was measured). Run the same assertions in the other order
 * and the driver hangs — which is the panel hanging, which is how this one
 * was found in the first place.
 *
 * NOT PART OF THE SUITE — nothing imports it and `just e2e` never runs it. It
 * needs a real, authenticated `claude` and costs real turns.
 *
 *   bash panel-live.sh                 # …or, against a server you started:
 *   BASE=http://127.0.0.1:PORT bun panel-live.ts
 */
import { chromium } from "playwright"
import { BROWSER_ARGS } from "./support/browser.ts"

const BASE = process.env["BASE"]!
const SHOTS = process.env["SHOTS"] ?? "/tmp/panelshots"
const t0 = Date.now()
const at = () => `${((Date.now() - t0) / 1000).toFixed(1).padStart(6)}s`
let failures = 0
const ok = (claim: string, held: boolean, detail = "") => {
  if (!held) failures += 1
  console.log(`${at()}  ${held ? "PASS" : "FAIL"}  ${claim}${detail === "" ? "" : `  — ${detail}`}`)
}
const id = (name: string) => `[data-testid="${name}"]`

const b = await chromium.launch({ args: [...BROWSER_ARGS] })
const p = await b.newPage({ viewport: { width: 1500, height: 1000 } })
p.on("pageerror", (e) => console.log(`${at()}  PAGE ERROR  ${e.message}`))
await p.goto(BASE)
await p.waitForSelector(id("outline-list"))
await p.locator(id("chat-toggle")).click()
await p.waitForSelector(id("chat-input"), { timeout: 60_000 })

const type = async (text: string) => {
  await p.locator(id("chat-input")).fill(text)
  await p.locator(id("chat-send")).click()
}
const idle = (ms = 300_000) => p.waitForSelector(id("chat-busy"), { state: "detached", timeout: ms })
/** A whole turn: sent, started, and over — the panel's own busy strip is the
 *  boundary, never a word in the transcript (the prompt is in there too). */
const turn = async (text: string, ms = 300_000) => {
  await type(text)
  await p.waitForSelector(id("chat-busy"), { timeout: 60_000 })
  await idle(ms)
}
const textOf = async (name: string) => (await p.locator(id(name)).first().innerText()).trim()
const seen = (name: string) => p.locator(id(name)).first().isVisible().catch(() => false)
const said = async (word: string) =>
  (await p.locator(id("chat-entry")).last().innerText()).includes(word)
const shot = (name: string) => p.screenshot({ path: `${SHOTS}/${name}.png` })

await p.waitForSelector(id("chat-model"), { timeout: 60_000 })
console.log(`${at()}  agent=${await textOf("chat-agent")}  model=${await textOf("chat-model")}`)
ok("the model line is drawn", (await textOf("chat-model")).length > 0, await textOf("chat-model"))

// ── 1. sending, and the context fraction that follows it ───────────────
await turn("Reply with exactly READY and nothing else.")
ok("a turn was sent and answered", await said("READY"), "last row says READY")
await p.waitForSelector(id("chat-usage"), { timeout: 30_000 })
ok("the context fraction appears once the agent has spent some", true, await textOf("chat-usage"))
await shot("1-answered")

// ── 2. the interrupt, offered while nothing has queued ─────────────────
await type("Count slowly from 1 to 40, one number per line, and say DONE at the end.")
await p.waitForSelector(id("chat-busy"), { timeout: 60_000 })
ok("the busy strip is up while a turn runs", true, await textOf("chat-busy"))
await p.locator(id("chat-input")).fill("Stop counting. Reply with exactly STEERED.")
ok("the INTERRUPT is on offer in a conversation that has never queued", await seen("chat-interrupt"))
await shot("2-interrupt-offered")
await p.locator(id("chat-interrupt")).click()
await idle()
ok("the interrupted turn took the words INTO itself and ENDED", await said("STEERED"),
  "the last row answers the steer")
await shot("3-steered")

// ── 3. queueing, and the interrupt it costs (#366's guard) ─────────────
await type("Count slowly from 1 to 40, one number per line, and say DONE at the end.")
await p.waitForSelector(id("chat-busy"), { timeout: 60_000 })
await type("Then reply with exactly BANANA.")
await p.waitForSelector(id("chat-queued"), { timeout: 60_000 })
ok("a message typed during a turn QUEUES rather than aborting the turn", true)
await p.locator(id("chat-input")).fill("something to steer with")
ok("...and the interrupt is withdrawn for the rest of this conversation (#1039's guard)",
  !(await seen("chat-interrupt")))
await shot("4-queued")

// ── 4. cancelling ──────────────────────────────────────────────────────
ok("the cancel is on offer", await seen("chat-cancel"))
await p.locator(id("chat-cancel")).click()
await p.waitForSelector(id("chat-busy"), { state: "detached", timeout: 120_000 })
ok("cancel ends the turn", true)
await shot("5-cancelled")

// ── 5. a background task: its clock, and its death notice ──────────────
await type(
  'Use the Monitor tool exactly once with description "tick watch", persistent false, ' +
  "timeout_ms 60000, and command: for i in 1 2 3; do echo tick-$i; sleep 2; done. " +
  "Then reply with just the word ARMED and end your turn. Do not call any other tool.",
)
await p.waitForSelector(id("chat-watching"), { timeout: 240_000 })
const task = p.locator(id("chat-watching-task")).first()
ok("the watching strip names the live task", await task.isVisible(),
  `data-kind=${await task.getAttribute("data-kind")}`)
await p.waitForSelector(id("chat-watching-for"), { timeout: 30_000 })
const clock1 = await textOf("chat-watching-for")
ok("the armed task carries a clock", clock1.length > 0, clock1)
ok("the call that armed it says what it left running", await seen("chat-armed"),
  (await textOf("chat-armed")).replace(/\s+/g, " "))
ok("its rail says it is still out there", await seen("chat-armed-still"))
await shot("6-armed")
await p.waitForTimeout(4000)
const clock2 = await textOf("chat-watching-for")
ok("the clock ticks", clock1 !== clock2, `${clock1} -> ${clock2}`)
await p.waitForSelector(id("chat-armed-ended"), { timeout: 240_000 })
const ended = await p.locator(id("chat-armed-ended")).first().getAttribute("data-ended")
ok("the task's DEATH is on the row, in the harness's own word", ended !== null, `data-ended=${ended}`)
ok("the still-running rail is gone with it", !(await seen("chat-armed-still")))
ok("the watching strip is empty again", !(await seen("chat-watching")))
await shot("7-ended")
await idle()

// ── 6. a subagent, its rail, and the shelf its calls are read in ───────
await type(
  'Use the Agent tool exactly once, with description "count the ticks" and subagent_type ' +
  "general-purpose, and give it this task: run `echo tick-one` with the Bash tool, then reply " +
  "with the word ONE and nothing else. When it reports, reply with just the word SPAWNED.",
)
await p.waitForSelector(id("chat-spawn"), { timeout: 300_000 })
ok("the row says WHO it sent out", true,
  `data-spawn-kind=${await p.locator(id("chat-spawn")).first().getAttribute("data-spawn-kind")}`)
const railed = await p.waitForSelector(id("chat-spawn-working"), { timeout: 120_000 })
  .then(() => true).catch(() => false)
ok("...and the rail says that agent has not stopped", railed,
  railed ? (await textOf("chat-spawn-working")).replace(/\s+/g, " ").slice(0, 50) : "never drawn")
await shot("8-subagent")
await p.waitForSelector(id("chat-lane-door"), { timeout: 300_000 })
await p.locator(id("chat-lane-door")).first().click()
await p.waitForSelector(id("chat-preview"), { timeout: 30_000 })
ok("the shelf opens onto that agent's own calls", true,
  (await textOf("chat-preview-of")).replace(/\s+/g, " ").slice(0, 60))
await shot("9-shelf")
await idle()

// ── 7. what the conversation picker knows about stored conversations ───
await p.locator(id("chat-sessions")).click()
await p.waitForSelector(id("chat-session-list"), { timeout: 60_000 })
await p.waitForSelector(id("chat-session"), { timeout: 120_000 }).catch(() => undefined)
const rows = await p.locator(id("chat-session")).count()
ok("the conversation picker lists this directory's stored conversations", rows > 0,
  rows > 0 ? `${rows} rows` : (await textOf("chat-session-list")).replace(/\s+/g, " "))
await shot("10-sessions")

console.log(`\n${at()}  ${failures === 0 ? "ALL PASS" : `${failures} FAILED`}`)
await b.close()
process.exit(failures === 0 ? 0 : 1)
