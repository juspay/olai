import assert from "node:assert/strict"
import { mkdirSync, symlinkSync } from "node:fs"
import { join } from "node:path"
import { Given, Then, When } from "@olai/tests/harness/runner.ts"
import { startOwnServer, stopOwnServer } from "@olai/tests/harness/hooks.ts"
import { type OlaiWorld, HYDRATION_TIMEOUT, POLL_TIMEOUT } from "@olai/tests/harness/world.ts"
import { selector } from "@olai/web/testlib"
import { TESTID } from "../../src/testids.ts"
import { fake } from "olai-plugin-omp/e2e/fake"

const held = new WeakMap<OlaiWorld, { pid: number | undefined; sentence?: string }>()
const missing = selector(TESTID.engineMissing)
const menu = selector(TESTID.agentEngineMenu)

Given("the agent search directory is empty", async function(this: OlaiWorld) {
  await stopOwnServer(this)
  this.agentSearchPath = join(this.scratch(), ".agent-search")
  mkdirSync(this.agentSearchPath)
  await startOwnServer(this)
  held.set(this, { pid: this.ownServer?.pid })
})

When("I press the agent start pill on {string}", async function(this: OlaiWorld, node: string) {
  this.activeAgent = node
  await this.press(this.node(node).locator(selector(TESTID.agentStart)))
})

Then("the engine picker has Claude available and omp missing", async function(this: OlaiWorld) {
  const choices = this.page.locator(menu)
  await choices.waitFor({ state: "visible", timeout: HYDRATION_TIMEOUT })
  assert.deepEqual(await choices.locator('[role="menuitem"]').evaluateAll(rows => rows.map(row => row.getAttribute("data-engine"))), ["claude", "omp"])
  assert.equal(await choices.getByRole("menuitem", { name: "Claude Code", exact: true }).isEnabled(), true)
  const absent = choices.locator(selector(TESTID.agentEngineMissing))
  assert.equal(await absent.getAttribute("aria-disabled"), "true")
  assert.equal(await absent.getAttribute("data-engine"), "omp")
  assert.match(await absent.innerText(), /PATH/)
  assert.equal(await absent.getByRole("link").getAttribute("href"), "https://github.com/can1357/oh-my-pi")
  held.get(this)!.sentence = (await absent.innerText()).trim()
  await absent.click({ force: true })
  assert.equal(await choices.isVisible(), true)
  assert.equal(await this.page.locator(selector(TESTID.agentFold)).count(), 0)
})

Then("the omp inspector row carries the picker's absence under Needs you", async function(this: OlaiWorld) {
  const row = this.pluginsPanel().locator('[data-section="Needs you"] [data-pref="plugin-omp"]')
  await row.locator(missing).waitFor({ state: "visible", timeout: HYDRATION_TIMEOUT })
  assert.equal((await row.locator(missing).innerText()).trim(), held.get(this)!.sentence)
  assert.equal(await row.getByRole("switch", { name: "Enable omp" }).getAttribute("aria-checked"), "true")
})

When("I install the fake omp in the agent search directory", function(this: OlaiWorld) {
  assert.ok(this.agentSearchPath)
  assert.ok(fake.searchPath)
  symlinkSync(join(fake.searchPath, "omp"), join(this.agentSearchPath, "omp"))
})

Then("the omp inspector row no longer needs installation", async function(this: OlaiWorld) {
  const row = await this.showPluginRow("omp")
  await this.waitUntil(async () => await row.getByRole("switch", { name: "Enable omp" }).getAttribute("aria-checked") === "true", "omp to return")
  await row.locator(missing).waitFor({ state: "detached", timeout: POLL_TIMEOUT })
  assert.equal(await row.evaluate(element => element.closest('[data-section]')?.getAttribute("data-section")), "Conversation")
})

Then("the engine picker has both engines available in bundle order", async function(this: OlaiWorld) {
  const choices = this.page.locator(`${menu} [role="menuitem"]`)
  await this.waitUntil(async () => await choices.count() === 2, "both engine choices")
  assert.deepEqual(await choices.evaluateAll(rows => rows.map(row => [row.getAttribute("data-engine"), row.getAttribute("aria-disabled")])), [["claude", null], ["omp", null]])
})

Then("the engine recovery kept the same server process", function(this: OlaiWorld) {
  assert.ok(held.get(this)?.pid)
  assert.equal(this.ownServer?.pid, held.get(this)!.pid)
})

Then("no engine installation advice is drawn in the inspector", async function(this: OlaiWorld) {
  await this.pluginsPanel().locator(missing).waitFor({ state: "detached", timeout: HYDRATION_TIMEOUT })
})

Then("the no-agent face explains the missing {string} engine", async function(this: OlaiWorld, engine: string) {
  const row = this.page.locator(`${selector(TESTID.chatNoAgent)} [data-engine="${engine}"]`)
  await row.waitFor({ state: "visible", timeout: HYDRATION_TIMEOUT })
  assert.match(await row.innerText(), /— .+/)
})
