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

const BASE = process.env["BASE"]
if (BASE === undefined) {
  console.error("panel-live.ts needs BASE=<where the server is> — `bash panel-live.sh` sets it")
  process.exit(2)
}
const SHOTS = process.env["SHOTS"] ?? "/tmp/panelshots"

const t0 = Date.now()
const at = (): string => `${((Date.now() - t0) / 1000).toFixed(1).padStart(6)}s`
let failures = 0

/** One claim, and the evidence beside it. A `string` for `held` is what
 *  {@link drawn} and {@link attr} answer — the words or the datum that DECIDED
 *  the claim — so a line reports out of the same read it was judged by, and
 *  `null` is the one thing that reads as no. */
const ok = (claim: string, held: boolean | string | null, detail = ""): void => {
  const passed = held !== false && held !== null
  const said = typeof held === "string" && held !== "" ? held : detail
  if (!passed) failures += 1
  console.log(`${at()}  ${passed ? "PASS" : "FAIL"}  ${claim}${said === "" ? "" : `  — ${said}`}`)
}
const id = (name: string) => `[data-testid="${name}"]`

const b = await chromium.launch({ args: [...BROWSER_ARGS] })
const p = await b.newPage({ viewport: { width: 1500, height: 1000 } })
p.on("pageerror", (e) => console.log(`${at()}  PAGE ERROR  ${e.message}`))

/**
 * THE ONLY WAY THIS FILE ASKS WHETHER SOMETHING IS ON SCREEN, in both
 * directions, and both of them WAIT.
 *
 * The panel is a beat behind everything a turn does, so an instant read is a
 * race — and this file reported FAIL twice for a panel that was simply not
 * finished drawing before it got round to the second half. Neither direction
 * throws either: a state the panel never reaches is a FINDING about the
 * panel, which is what this driver is for, and it belongs on the report as
 * one line rather than arriving as somebody else's stack trace.
 *
 * `drawn` answers with the row's OWN WORDS (`null` when it never came), so
 * what a claim reports and what decided it are one read. Two reads is the
 * other half of the same race. Handed to {@link ok} it IS the claim; awaited
 * bare it is a wait, and the difference is whether the panel getting there is
 * something this driver is asserting or something it is standing on.
 */
const drawn = (name: string, ms = 60_000): Promise<string | null> =>
  p.waitForSelector(id(name), { timeout: ms })
    .then((el) => el.innerText())
    .then((words) => words.replace(/\s+/g, " ").trim())
    .catch(() => null)
/** ... and the same read for a row's own DATA, which is what a claim asserts
 *  wherever the words are the panel's sentence and the attribute is the fact.
 *  `null` is the same answer either way — the datum was not there. */
const attr = (name: string, key: string, ms = 60_000): Promise<string | null> =>
  p.waitForSelector(id(name), { timeout: ms }).then((el) => el.getAttribute(key)).catch(() => null)
/** ... and the way OUT of a state, which waits exactly as hard: two pieces of
 *  panel state need not land in one revision, so "it has gone" asked the
 *  instant its cause arrived is the same race read backwards. */
const gone = (name: string, ms = 60_000): Promise<boolean> =>
  p.waitForSelector(id(name), { state: "hidden", timeout: ms }).then(() => true).catch(() => false)

// The boot, reported like everything else: an app that does not come up, or a
// panel with no door on it, is a finding about the panel and not a crash.
await p.goto(BASE)
ok("the app came up", await drawn("outline-list"))
ok("the panel has a door", await drawn("chat-toggle"))
await p.locator(id("chat-toggle")).click()
ok("...and it opens on a box to type in", await drawn("chat-input"))

const shot = (name: string): Promise<Buffer> => p.screenshot({ path: `${SHOTS}/${name}.png` })
const type = async (text: string): Promise<void> => {
  await p.locator(id("chat-input")).fill(text)
  await p.locator(id("chat-send")).click()
}
/**
 * Wait for the running turn to be over, and STOP if it never is.
 *
 * A turn that does not end is the one failure this driver must not sail past.
 * It is what claude-agent-acp#1039 looks like from a person's chair, and every
 * claim made after it would be a claim about a panel still spinning — so it is
 * reported as itself and the run ends there.
 */
const idle = async (ms = 300_000): Promise<void> => {
  if (await gone("chat-busy", ms)) return
  ok(`the turn ENDED (still on *working…* after ${ms / 1000}s)`, false)
  await shot("hung")
  await b.close()
  process.exit(1)
}
/** A whole turn: sent, started, and over — the panel's own busy strip is the
 *  boundary, never a word in the transcript (the prompt is in there too). */
const turn = async (text: string, ms = 300_000): Promise<void> => {
  await type(text)
  await drawn("chat-busy")
  await idle(ms)
}
const said = async (word: string): Promise<boolean> =>
  (await p.locator(id("chat-entry")).last().innerText()).includes(word)

ok("the model line is drawn", await drawn("chat-model"))
console.log(`${at()}  agent=${await drawn("chat-agent")}`)

// ── 1. sending, and the context fraction that follows it ───────────────
await turn("Reply with exactly READY and nothing else.")
ok("a turn was sent and answered", await said("READY"), "last row says READY")
ok("the context fraction appears once the agent has spent some", await drawn("chat-usage", 30_000))
await shot("1-answered")

// ── 2. the interrupt, offered while nothing has queued ─────────────────
await type("Count slowly from 1 to 40, one number per line, and say DONE at the end.")
ok("the busy strip is up while a turn runs", await drawn("chat-busy"))
await p.locator(id("chat-input")).fill("Stop counting. Reply with exactly STEERED.")
ok("the INTERRUPT is on offer in a conversation that has never queued", await drawn("chat-interrupt"))
await shot("2-interrupt-offered")
await p.locator(id("chat-interrupt")).click()
await idle()
ok("the interrupted turn took the words INTO itself and ENDED", await said("STEERED"),
  "the last row answers the steer")
await shot("3-steered")

// ── 3. queueing, and the interrupt it costs (#366's guard) ─────────────
await type("Count slowly from 1 to 40, one number per line, and say DONE at the end.")
await drawn("chat-busy")
await type("Then reply with exactly BANANA.")
ok("a message typed during a turn QUEUES rather than aborting the turn", await drawn("chat-queued"))
await p.locator(id("chat-input")).fill("something to steer with")
ok("...and the interrupt is withdrawn for the rest of this conversation (#1039's guard)",
  await gone("chat-interrupt"))
await shot("4-queued")

// ── 4. cancelling ──────────────────────────────────────────────────────
ok("the cancel is on offer", await drawn("chat-cancel"))
await p.locator(id("chat-cancel")).click()
ok("cancel ends the turn", await gone("chat-busy", 120_000))
await shot("5-cancelled")

// ── 5. a background task: its clock, and its death notice ──────────────
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
await p.waitForTimeout(4000)
const clock2 = await drawn("chat-watching-for")
ok("the clock ticks", clock1 !== clock2, `${clock1} -> ${clock2}`)
ok("the task's DEATH is on the row, in the harness's own word",
  await attr("chat-armed-ended", "data-ended", 240_000))
ok("the still-running rail is gone with it", await gone("chat-armed-still"))
ok("the watching strip is empty again", await gone("chat-watching"))
await shot("7-ended")
await idle()

// ── 6. a subagent, its rail, and the shelf its calls are read in ───────
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
await p.locator(id("chat-lane-door")).first().click()
ok("the shelf opens onto that agent's own calls", await drawn("chat-preview-of", 30_000))
await shot("9-shelf")
await idle()

// ── 7. what the conversation picker knows about stored conversations ───
await p.locator(id("chat-sessions")).click()
await drawn("chat-session-list")
ok("the conversation picker lists this directory's stored conversations",
  await drawn("chat-session", 120_000),
  `${await p.locator(id("chat-session")).count()} rows`)
await shot("10-sessions")

console.log(`\n${at()}  ${failures === 0 ? "ALL PASS" : `${failures} FAILED`}`)
await b.close()
process.exit(failures === 0 ? 0 : 1)
