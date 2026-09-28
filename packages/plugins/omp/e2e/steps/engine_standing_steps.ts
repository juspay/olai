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

/** The process this scenario started with: nothing here may restart it. */
const held = new WeakMap<OlaiWorld, { readonly pid: number }>()

/** The absence line on the plugins panel's row for this engine. */
const missing = selector(TESTID.engineMissing)
/** The agent menu, and the absence row it no longer draws. */
const menu = selector(TESTID.agentEngineMenu)
const greyed = selector(TESTID.agentEngineMissing)

/** THE COMMAND THIS ENGINE IS FOUND AS — the file beside `../fake/index.ts`,
 *  and the word `INSTALL.why` asks a person to put on the server's PATH. One
 *  spelling, because the install step is claiming to be that installation. */
const EXECUTABLE = "omp"

/** Read the menu's rows, as `[engine, aria-disabled]` pairs in drawn order —
 *  every row, so a greyed row would show up as one rather than hide among the
 *  pickable ones. */
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

Then("the agent menu offers what this machine has, and not omp", async function(this: OlaiWorld) {
  const choices = this.page.locator(menu)
  await choices.waitFor({ state: "visible", timeout: HYDRATION_TIMEOUT })
  // ONLY WHAT WORKS, in bundle order: omp is enabled but missing, so it is not
  // a row here at all — greyed or otherwise.
  assert.deepEqual(await drawn(this), [["claude", null], ["opencode", null]])
  for (const name of ["Claude Code", "OpenCode"]) {
    assert.equal(await choices.getByRole("menuitem", { name, exact: true }).isEnabled(), true)
  }
  assert.equal(await choices.locator(greyed).count(), 0)
  assert.equal(await choices.locator(attr("data-engine", "omp")).count(), 0)
})

Then("the omp inspector row explains its absence under Needs attention", async function(this: OlaiWorld) {
  const row = this.pluginsPanel().locator('[data-section="Needs attention"] [data-pref="plugin-omp"]')
  const said = row.locator(missing)
  await said.waitFor({ state: "visible", timeout: HYDRATION_TIMEOUT })
  // This engine's OWN sentence — the one place a person is told what to
  // install, now that the agent menu drops the row.
  assert.ok((await said.innerText()).includes(INSTALL.why), `the omp row to carry ${JSON.stringify(INSTALL.why)}, and it reads ${JSON.stringify(await said.innerText())}`)
  // ...AND THE NAME IS A LINK, because this row is reachable by keyboard:
  // where the engine comes from is the other half of what a person has to do.
  assert.equal(await said.getByRole("link").getAttribute("href"), INSTALL.where)
  assert.equal(await row.getByRole("switch", { name: "Enable Oh My Pi" }).getAttribute("aria-checked"), "true")
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
  await this.waitUntil(async () => await row.getByRole("switch", { name: "Enable Oh My Pi" }).getAttribute("aria-checked") === "true", "omp to return")
  await row.locator(missing).waitFor({ state: "detached", timeout: POLL_TIMEOUT })
  assert.equal(await row.evaluate(element => element.closest("[data-section]")?.getAttribute("data-section")), "Agents")
})

Then("the engine picker offers every engine in bundle order", async function(this: OlaiWorld) {
  await this.waitUntil(async () => (await drawn(this)).length === 3, "all three engine choices")
  assert.deepEqual(await drawn(this), [["claude", null], ["opencode", null], ["omp", null]])
})

Then("the engine recovery kept the same server process", function(this: OlaiWorld) {
  assert.equal(this.ownServer?.pid, held.get(this)?.pid)
})

Then("no engine installation advice is drawn in the inspector", async function(this: OlaiWorld) {
  await this.pluginsPanel().locator(missing).waitFor({ state: "detached", timeout: HYDRATION_TIMEOUT })
})

/** Plural advice without coupling this engine's bench to a sibling's name. */
Then("the no-agent face explains multiple missing engines including omp", async function(this: OlaiWorld) {
  const advice = `${selector(TESTID.chatNoAgent)} ${selector(TESTID.chatInstall)}`
  await this.page.locator(`${advice}${attr("data-engine", "omp")}`).waitFor({ state: "visible", timeout: HYDRATION_TIMEOUT })
  const rows = this.page.locator(advice)
  assert.ok(await rows.count() > 1, "each missing engine gets its own advice")
  for (const sentence of await rows.allInnerTexts()) assert.match(sentence, /— .+/)
})
