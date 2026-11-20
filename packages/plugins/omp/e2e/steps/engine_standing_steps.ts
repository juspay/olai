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

const missing = selector(TESTID.engineMissing)
const menu = selector(TESTID.agentEngineMenu)
const greyed = selector(TESTID.agentEngineMissing)

const EXECUTABLE = "omp"

const drawn = (world: OlaiWorld): Promise<ReadonlyArray<ReadonlyArray<string | null>>> =>
  world.page.locator(`${menu} [role="menuitem"]`).evaluateAll(rows =>
    rows.map(row => [row.getAttribute("data-engine"), row.getAttribute("aria-disabled")])
  )

Given("I note this scenario's serving process", function(this: OlaiWorld) {
  const pid = this.ownServer?.pid
  assert.ok(pid, "this scenario installs an engine under its own server, so it must own one (@scratch:)")
  held.set(this, { pid })
})

Then("the agent menu offers what this machine has, and not omp", async function(this: OlaiWorld) {
  const choices = this.page.locator(menu)
  await choices.waitFor({ state: "visible", timeout: HYDRATION_TIMEOUT })
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
  assert.ok((await said.innerText()).includes(INSTALL.why), `the omp row to carry ${JSON.stringify(INSTALL.why)}, and it reads ${JSON.stringify(await said.innerText())}`)
  assert.equal(await said.getByRole("link").getAttribute("href"), INSTALL.where)
  assert.equal(await row.getByRole("switch", { name: "Enable Oh My Pi" }).getAttribute("aria-checked"), "true")
})

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

Then("the agent menu offers every engine in bundle order", async function(this: OlaiWorld) {
  await this.waitUntil(async () => (await drawn(this)).length === 3, "all three engine choices")
  assert.deepEqual(await drawn(this), [["claude", null], ["opencode", null], ["omp", null]])
})

Then("the engine recovery kept the same server process", function(this: OlaiWorld) {
  assert.equal(this.ownServer?.pid, held.get(this)?.pid)
})

Then("no engine installation advice is drawn in the inspector", async function(this: OlaiWorld) {
  await this.pluginsPanel().locator(missing).waitFor({ state: "detached", timeout: HYDRATION_TIMEOUT })
})

Then("the no-agent face explains multiple missing engines including omp", async function(this: OlaiWorld) {
  const advice = `${selector(TESTID.chatNoAgent)} ${selector(TESTID.chatInstall)}`
  await this.page.locator(`${advice}${attr("data-engine", "omp")}`).waitFor({ state: "visible", timeout: HYDRATION_TIMEOUT })
  const rows = this.page.locator(advice)
  assert.ok(await rows.count() > 1, "each missing engine gets its own advice")
  for (const sentence of await rows.allInnerTexts()) assert.match(sentence, /— .+/)
})
