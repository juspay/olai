import * as assert from "node:assert"
import * as fs from "node:fs"
import * as path from "node:path"

import { Then, When } from "@olai/tests/harness/runner.ts"

import { isoDayOf } from "@olai/web/testlib"

import {
  attr,
  FILE_DIR_TOGGLE,
  HYDRATION_TIMEOUT,
  nodeSelector,
  OUTLINE_FAILURE,
  PANE,
  PLUGINS_PANEL,
  POLL_TIMEOUT,
  PREFS_ROW,
  SIDEBAR,
} from "@olai/tests/harness/world.ts"
import type { OlaiWorld } from "@olai/tests/harness/world.ts"

import { consentOf } from "./faces.ts"

const fileOf = (word: string, file: string): string => `plugins/${word}/${file}`

const served = (world: OlaiWorld, file: string): string =>
  fs.readFileSync(path.join(world.scratch(), file), "utf8")

When("the plugin's face is edited", function (this: OlaiWorld) {
  const file = fileOf("swatch", "browser.tsx")
  const was = served(this, file)
  const now = was.replaceAll("w-3 rounded", "w-3 rounded-full")
  assert.notStrictEqual(now, was, `nothing in ${file} matched the face this step edits`)
  this.writeServed(file, now)
})

When("the plugin's README is improved", function (this: OlaiWorld) {
  const file = fileOf("swatch", "README.md")
  const was = served(this, file)
  this.writeServed(file, `${was.trimEnd()}\n\nIt draws the swatch beside the value, never instead of it.\n`)
})

When("a plugin folder {string} is copied in", function (this: OlaiWorld, word: string) {
  this.writeServed(
    fileOf(word, "README.md"),
    `# ${word[0]!.toUpperCase()}${word.slice(1)}\n\nA plugin somebody copied in from another vault.\n`,
  )
  this.writeServed(
    fileOf(word, "server.ts"),
    [
      `import { definePlugin, Kinds } from "@olai/plugin-api"`,
      `import { Effect } from "effect"`,
      ``,
      `export default definePlugin({`,
      `  name: "${word}",`,
      `  needs: [Kinds],`,
      `  apply: Effect.gen(function*() {`,
      `    const kinds = yield* Kinds`,
      `    yield* kinds.register({ kind: "hex", takes: "a #rrggbb colour", admits: (value: string) => /^#[0-9a-f]{6}$/i.test(value) })`,
      `  }),`,
      `})`,
    ].join("\n"),
  )
})

When("the folder {string} is deleted", function (this: OlaiWorld, folder: string) {
  fs.rmSync(path.join(this.scratch(), folder), { recursive: true })
})

When("the folder {string} is renamed to {string}", function (this: OlaiWorld, from: string, to: string) {
  fs.renameSync(path.join(this.scratch(), from), path.join(this.scratch(), to))
})

When("the file {string} is deleted", function (this: OlaiWorld, file: string) {
  this.removeServed(file)
})

Then("the vault has recorded nothing about the plugin {string}", async function (this: OlaiWorld, word: string) {
  await this.page.waitForTimeout(500)
  assert.strictEqual(
    consentOf(this, word),
    undefined,
    `the settings file already carries a node for "${word}", which nobody has decided about`,
  )
})

Then("the plugins panel does not list {string}", async function (this: OlaiWorld, plugin: string) {
  await this.page
    .locator(`${PLUGINS_PANEL} ${PREFS_ROW}${attr("data-pref", `plugin-${plugin}`)}`)
    .waitFor({ state: "detached", timeout: POLL_TIMEOUT })
})

const openedTree = async (world: OlaiWorld): Promise<void> => {
  await world.expandReference()
  for (let pass = 0; pass < 3; pass += 1) {
    const shut = world.page.locator(`${FILE_DIR_TOGGLE}[aria-expanded="false"]`)
    const count = await shut.count()
    if (count === 0) return
    for (let index = 0; index < count; index += 1) {
      await shut.nth(index).click({ timeout: 2000 }).catch(() => undefined)
    }
  }
}

Then("Reference lists the file {string}", async function (this: OlaiWorld, file: string) {
  await openedTree(this)
  await this.page.locator(`${SIDEBAR} a${attr("data-file", file)}`)
    .first().waitFor({ state: "visible", timeout: POLL_TIMEOUT })
})

Then("Reference does not list the file {string}", async function (this: OlaiWorld, file: string) {
  await openedTree(this)
  assert.strictEqual(
    await this.page.locator(`${SIDEBAR} a${attr("data-file", file)}`).count(),
    0,
    `"${file}" is in the sidebar's tree, which is a second front door onto a file the plugin's page is for`,
  )
})

Then("the open file is {string}", async function (this: OlaiWorld, file: string) {
  await this.page.locator(`${PANE}${attr("data-drawn-file", file)}`)
    .first().waitFor({ state: "visible", timeout: HYDRATION_TIMEOUT })
})

Then(
  "the row {string} wears a swatch for {string}",
  async function (this: OlaiWorld, node: string, value: string) {
    await this.page
      .locator(`${nodeSelector(node)} ${attr("data-swatch", value)}`)
      .first()
      .waitFor({ state: "visible", timeout: POLL_TIMEOUT })
  },
)

Then("that swatch is round", async function (this: OlaiWorld) {
  await this.page
    .locator(`[data-swatch].rounded-full`)
    .first()
    .waitFor({ state: "visible", timeout: POLL_TIMEOUT })
})

Then("no row wears a swatch", { timeout: 60_000 }, async function (this: OlaiWorld) {
  await this.waitUntil(
    async () => (await this.page.locator("[data-swatch]").count()) === 0,
    "every swatch to leave after the plugin is stopped or loses approval",
    45_000,
  )
})

When("a task is due today", function (this: OlaiWorld) {
  this.appendServed("work.olai", {
    id: "sand",
    parent: "deck",
    ord: "a3",
    title: "sand the rails",
    todo: true,
    date: isoDayOf(new Date()),
  })
})

When("the palette provider is replaced", function (this: OlaiWorld) {
  const file = fileOf("palette", "server.ts")
  const source = served(this, file)
  const now = source.replace("[0-9a-f]{6}", "(?:ff8800|00ff00)")
  assert.notStrictEqual(now, source, `nothing in ${file} matched the palette this step replaces`)
  this.writeServed(file, now)
})

Then("the agent service catalog {word} {string}", async function (this: OlaiWorld, presence: string, key: string) {
  const { callTool, connectTerminalAgent } = await import("@olai/tests/harness/mcp.ts")
  this.terminalAgent ??= await connectTerminalAgent(`${this.baseUrl}/mcp`)
  const answer = await callTool(this.terminalAgent, "vault-plugins_inspect", {})
  const catalog = answer["structuredContent"] as { services: Array<{ key: string; half: string }> }
  const keys = catalog.services.filter((one) => one.half === "server").map((one) => one.key)
  assert.ok(keys.includes("vault"), "core services remain discoverable")
  assert.strictEqual(keys.includes(key), presence === "includes")
})

Then("the plugin layout names the folder, the settings file and the reserved words", async function (this: OlaiWorld) {
  const { callTool, connectTerminalAgent } = await import("@olai/tests/harness/mcp.ts")
  this.terminalAgent ??= await connectTerminalAgent(`${this.baseUrl}/mcp`)
  const answer = await callTool(this.terminalAgent, "vault-plugins_inspect", {})
  const layout = (answer["structuredContent"] as {
    layout: {
      folder: string
      readme: string
      server: string
      browser: string
      settings: { file: string; schema: string; properties: string; reserved: ReadonlyArray<string> }
    }
  }).layout
  assert.strictEqual(layout.folder, "plugins/")
  assert.deepStrictEqual(
    [layout.readme, layout.server, layout.browser],
    ["README.md", "server.ts", "browser.tsx"],
  )
  assert.strictEqual(layout.settings.file, "_olai/Settings.olai")
  assert.strictEqual(layout.settings.schema, "Config")
  assert.deepStrictEqual([...layout.settings.reserved].sort(), ["approved", "checked", "on"])
})

When("the terminal agent runs the plugin {string}", async function (this: OlaiWorld, word: string) {
  const { callTool, connectTerminalAgent } = await import("@olai/tests/harness/mcp.ts")
  this.terminalAgent ??= await connectTerminalAgent(`${this.baseUrl}/mcp`)
  this.toolAnswer = await callTool(this.terminalAgent, "vault-plugins_run", { name: word })
})

Then("the plugin run reports {string} as {string} from {string}", function (this: OlaiWorld, key: string, value: string, setBy: string) {
  const readings = (this.toolAnswer?.["structuredContent"] as {
    configurationValues: Array<{ key: string; value: string; setBy: string }>
  }).configurationValues
  assert.ok(
    readings.some((one) => one.key === key && one.value === value && one.setBy === setBy),
    JSON.stringify(readings),
  )
})

Then("the plugin run says it cannot start", function (this: OlaiWorld) {
  const answer = this.toolAnswer?.["structuredContent"] as { fault?: string }
  assert.ok(
    typeof answer.fault === "string" && answer.fault.trim() !== "",
    `the run answered no fault: ${JSON.stringify(answer)}`,
  )
})

Then("the vault {word} the colour {string}", async function (this: OlaiWorld, verdict: string, value: string) {
  const { connectTerminalAgent, tryTool } = await import("@olai/tests/harness/mcp.ts")
  this.terminalAgent ??= await connectTerminalAgent(`${this.baseUrl}/mcp`)
  const answer = await tryTool(this.terminalAgent, "outlines_prop", { id: "amber", key: "swatch-hex", value })
  assert.strictEqual(answer["isError"] === true, verdict === "rejects", JSON.stringify(answer))
})

When("the browser palette provider is replaced", function (this: OlaiWorld) {
  const file = fileOf("palette", "browser.tsx")
  const source = served(this, file)
  assert.ok(source.includes("browser-palette-first"), `${file} does not carry the face this step replaces`)
  this.writeServed(file, source.replace("browser-palette-first", "browser-palette-second"))
})

Then("the browser palette face is {string}", async function (this: OlaiWorld, version: string) {
  await this.page.locator(`.browser-palette-${version} [data-swatch]`).waitFor({
    state: "visible",
    timeout: POLL_TIMEOUT,
  })
})

Then("the browser service catalog {word} {string}", async function (this: OlaiWorld, presence: string, key: string) {
  const { callTool, connectTerminalAgent } = await import("@olai/tests/harness/mcp.ts")
  this.terminalAgent ??= await connectTerminalAgent(`${this.baseUrl}/mcp`)
  const answer = await callTool(this.terminalAgent, "vault-plugins_inspect", {})
  const catalog = answer["structuredContent"] as {
    services: Array<{ key: string; half: string; availability: string }>
  }
  assert.strictEqual(
    catalog.services.some((one) => one.key === key && one.half === "browser" && one.availability === "declared"),
    presence === "includes",
  )
})

When("the browser palette initialization is repaired", function (this: OlaiWorld) {
  const file = fileOf("palette", "browser.tsx")
  const source = served(this, file)
  const broken = `\n  yield* Effect.die(new Error("palette initialization failed"))`
  assert.ok(source.includes(broken), `${file} does not carry the failure this step repairs`)
  this.writeServed(file, source.replace(broken, ""))
})

Then("the browser has reported the palette initialization failure", async function (this: OlaiWorld) {
  const expected = (error: string) =>
    error.startsWith('console.error: olai: the plugin "palette"')
    && error.includes("browser half failed to start") && error.includes("palette initialization failed")
  await this.waitUntil(async () => this.errors.some(expected), "the expected palette initialization diagnostic")
  this.errors = this.errors.filter((error) => !expected(error))
})

Then("the outline {string} is refused for {string}", async function (this: OlaiWorld, file: string, words: string) {
  const failure = this.page.locator(`${OUTLINE_FAILURE}${attr("data-file", file)}`).first()
  await failure.waitFor({ state: "visible", timeout: HYDRATION_TIMEOUT })
  await this.waitUntil(
    async () => (await failure.innerText()).includes(words),
    `${file}'s refusal to name ${JSON.stringify(words)}`,
  )
})

Then("the vault holds no files for the plugin {string}", async function (this: OlaiWorld, word: string) {
  const folder = path.join(this.scratch(), "plugins", word)
  await this.waitUntil(
    () => Promise.resolve(!fs.existsSync(folder) || fs.readdirSync(folder).length === 0),
    `the files of "${word}" to be gone from the vault`,
  )
})
