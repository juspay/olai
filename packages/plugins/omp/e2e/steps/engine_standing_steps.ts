/**
 * WHAT A MACHINE WITHOUT THIS ENGINE IS TOLD, and what happens when it gets it.
 *
 * THESE STEPS ARE THIS ROW'S because the scenarios name this row: the engine
 * that is missing is Oh My Pi, the executable that arrives mid-scenario is this
 * package's own scripted fake, and the sentence every face is checked against
 * is this package's own `INSTALL`. A step that lived in chat's `e2e/` would have
 * had to reach `olai-plugin-omp/e2e/fake` — a module that is not one of this
 * row's declared contract doors — so the suite would have been importing an
 * engine's fixtures through a hole in the plugin wall to say something about
 * that engine. Here the fake is a sibling file and the sentence is `../../src`.
 *
 * WHAT THEY ASSERT ABOUT ON THE OTHER SIDE is chat's DOM, through
 * `olai-plugin-chat/testids` — a declared contract door of a package this one
 * already depends on, because an engine's row IS drawn by the conversation
 * plugin's picker and the plugins panel's row. The ids are the promise; the
 * words are this package's.
 */
import assert from "node:assert/strict"
import { symlinkSync } from "node:fs"
import { join } from "node:path"
import { Given, Then, When } from "@olai/tests/harness/runner.ts"
import { attr, HYDRATION_TIMEOUT, type OlaiWorld, POLL_TIMEOUT } from "@olai/tests/harness/world.ts"
import { selector } from "@olai/ui-primitives/testids.ts"
import { TESTID } from "olai-plugin-chat/testids"
import { INSTALL } from "../../src/install.ts"
import { fake } from "../fake/index.ts"

/** What this scenario is comparing ACROSS faces: the process it started with
 *  (nothing here may restart it) and the sentence the picker drew, which the
 *  inspector row has to draw the same. */
const held = new WeakMap<OlaiWorld, { readonly pid: number; sentence?: string }>()

/** The absence line on the plugins panel's row for this engine. */
const missing = selector(TESTID.engineMissing)
/** The engine picker, and the one row in it that cannot be picked. */
const menu = selector(TESTID.agentEngineMenu)
const greyed = selector(TESTID.agentEngineMissing)

/** THE COMMAND THIS ENGINE IS FOUND AS — the file beside `../fake/index.ts`,
 *  and the word `INSTALL.why` asks a person to put on the server's PATH. One
 *  spelling, because the install step is claiming to be that installation. */
const EXECUTABLE = "omp"

/** Read the picker's rows, as `[engine, aria-disabled]` pairs in drawn order —
 *  the whole table rather than the pickable part of it, because a row that is
 *  DROPPED and a row that is greyed are the two answers this feature tells
 *  apart. */
const drawn = (world: OlaiWorld): Promise<ReadonlyArray<ReadonlyArray<string | null>>> =>
  world.page.locator(`${menu} [role="menuitem"]`).evaluateAll(rows =>
    rows.map(row => [row.getAttribute("data-engine"), row.getAttribute("aria-disabled")])
  )

/** THE PROCESS THIS SCENARIO IS SERVED BY, remembered before anything is
 *  installed. The claim it is remembered for is at the end: an engine arriving
 *  on a running serve is a re-probe, so the tab, the page and the child all
 *  survive it — and a harness that quietly restarted the server would satisfy
 *  every other assertion in the feature. */
Given("I note this scenario's serving process", function(this: OlaiWorld) {
  const pid = this.ownServer?.pid
  assert.ok(pid, "this scenario installs an engine under its own server, so it must own one (@scratch:)")
  held.set(this, { pid })
})

Then("the engine picker offers what this machine has and greys omp", async function(this: OlaiWorld) {
  const choices = this.page.locator(menu)
  await choices.waitFor({ state: "visible", timeout: HYDRATION_TIMEOUT })
  // BUNDLE ORDER, ABSENCE INCLUDED: the greyed row sits where the engine sits
  // on the list, not after the ones that answered.
  assert.deepEqual(await drawn(this), [["claude", null], ["codex", null], ["omp", "true"]])
  for (const name of ["Claude Code", "Codex"]) {
    assert.equal(await choices.getByRole("menuitem", { name, exact: true }).isEnabled(), true)
  }
  const absent = choices.locator(greyed)
  assert.equal(await absent.getAttribute("data-engine"), "omp")
  // ONE ROW, ONE STAMP. The menu item carries `data-engine`; the sentence
  // inside it does not, so a step gripping this engine's row in the picker
  // grips one element rather than two nested ones.
  assert.equal(await choices.locator(attr("data-engine", "omp")).count(), 1)
  // NO LIVE LINK INSIDE A ROW NOBODY CAN REACH. Kobalte leaves a disabled item
  // out of the roving tabindex, so an anchor in here is mouse-only — offered
  // to a sighted pointer user and to nobody else. The link belongs on the
  // faces below, which are ordinary reading.
  assert.equal(await absent.getByRole("link").count(), 0)
  // ...and it is still this engine's OWN sentence that was drawn, which is the
  // whole of what a greyed row is for.
  assert.ok((await absent.innerText()).includes(INSTALL.why), `the picker's omp row to carry ${JSON.stringify(INSTALL.why)}, and it reads ${JSON.stringify(await absent.innerText())}`)
  held.set(this, { ...held.get(this)!, sentence: (await absent.innerText()).trim() })
})

Then("the omp inspector row carries the picker's absence under Needs you", async function(this: OlaiWorld) {
  const row = this.pluginsPanel().locator('[data-section="Needs you"] [data-pref="plugin-omp"]')
  const said = row.locator(missing)
  await said.waitFor({ state: "visible", timeout: HYDRATION_TIMEOUT })
  // THE SAME SENTENCE, CHARACTER FOR CHARACTER: two faces reading one standing
  // rather than two authors of one claim.
  assert.equal((await said.innerText()).trim(), held.get(this)?.sentence)
  // ...AND HERE THE NAME IS A LINK, because this row is reachable by keyboard:
  // where the engine comes from is the other half of what a person has to do.
  assert.equal(await said.getByRole("link").getAttribute("href"), INSTALL.where)
  assert.equal(await row.getByRole("switch", { name: "Enable omp" }).getAttribute("aria-checked"), "true")
})

/** INSTALL IT, the way a person would: the executable appears on the path the
 *  server was started looking at (`@agent-path:empty`), under the serve that is
 *  already running and already saying it is not there. */
When("I install the fake omp in the agent search directory", function(this: OlaiWorld) {
  const into = this.agentSearchPath
  assert.ok(into, "tag the scenario @agent-path:empty: there is nowhere to install an engine to")
  assert.ok(fake.searchPath)
  symlinkSync(join(fake.searchPath, EXECUTABLE), join(into, EXECUTABLE))
})

Then("the omp inspector row no longer needs installation", async function(this: OlaiWorld) {
  const row = await this.showPluginRow("omp")
  await this.waitUntil(async () => await row.getByRole("switch", { name: "Enable omp" }).getAttribute("aria-checked") === "true", "omp to return")
  await row.locator(missing).waitFor({ state: "detached", timeout: POLL_TIMEOUT })
  assert.equal(await row.evaluate(element => element.closest("[data-section]")?.getAttribute("data-section")), "Conversation")
})

Then("the engine picker offers every engine in bundle order", async function(this: OlaiWorld) {
  await this.waitUntil(async () => (await drawn(this)).length === 3, "all three engine choices")
  assert.deepEqual(await drawn(this), [["claude", null], ["codex", null], ["omp", null]])
})

Then("the engine recovery kept the same server process", function(this: OlaiWorld) {
  assert.equal(this.ownServer?.pid, held.get(this)?.pid)
})

Then("no engine installation advice is drawn in the inspector", async function(this: OlaiWorld) {
  await this.pluginsPanel().locator(missing).waitFor({ state: "detached", timeout: HYDRATION_TIMEOUT })
})

/** One enabled engine's own account of itself on the no-agent face — named,
 *  because the claim is that EVERY enabled engine gets a row of its own rather
 *  than one sentence about the machine. */
Then("the no-agent face explains the missing {string} engine", async function(this: OlaiWorld, engine: string) {
  const row = this.page.locator(`${selector(TESTID.chatNoAgent)} ${selector(TESTID.chatInstall)}${attr("data-engine", engine)}`)
  await row.waitFor({ state: "visible", timeout: HYDRATION_TIMEOUT })
  assert.match(await row.innerText(), /— .+/)
})
