/**
 * THE PLACES A VAULT PLUGIN DRAWS OUTSIDE AN OUTLINE — the reading
 * companion's sidebar section, its chord and its palette row, and the catalog
 * an agent reads to learn they exist.
 *
 * The faces are found by the `data-plugin` the sidebar stamps on a section and
 * by the attributes the fixture's own source writes, because a plugin a vault
 * defines is by definition not in this build's testid table.
 */

import * as assert from "node:assert/strict"
import * as fs from "node:fs"
import * as path from "node:path"

import { Then, When } from "@olai/tests/harness/runner.ts"
import { TESTID } from "@olai/tests/harness/testids.ts"
import { attr, HYDRATION_TIMEOUT, nodeSelector, POLL_TIMEOUT, SIDEBAR } from "@olai/tests/harness/world.ts"
import { selector } from "@olai/web/testlib"

import { TESTID as VAULT_PLUGINS_TESTID } from "../../src/testids.ts"
import type { OlaiWorld } from "@olai/tests/harness/world.ts"

/** One entry of `vault-plugins_inspect`'s slot list. */
interface Slot {
  readonly name: string
  readonly keyedBy: string
  readonly handed: string
}

const catalog = async (world: OlaiWorld): Promise<ReadonlyArray<Slot>> => {
  // Loaded on first use, as every MCP step in this row loads it: a scenario
  // with no agent in it never opens the client.
  const { callTool, connectTerminalAgent } = await import("@olai/tests/harness/mcp.ts")
  world.terminalAgent ??= await connectTerminalAgent(`${world.baseUrl}/mcp`)
  const answer = await callTool(world.terminalAgent, "vault-plugins_inspect", {})
  return (answer["structuredContent"] as { slots: ReadonlyArray<Slot> }).slots
}

Then("the slot catalog lists {string}", async function (this: OlaiWorld, names: string) {
  const listed = (await catalog(this)).map((one) => one.name)
  const missing = names.split(",").map((one) => one.trim()).filter((one) => !listed.includes(one))
  assert.deepEqual(missing, [], `the catalog lists ${listed.join(", ")}`)
})

Then("every slot in the catalog says what its face is handed", async function (this: OlaiWorld) {
  const slots = await catalog(this)
  assert.ok(slots.length > 0, "the catalog lists no slot at all")
  const silent = slots.filter((one) => typeof one.handed !== "string" || one.handed.trim() === "").map((one) => one.name)
  assert.deepEqual(silent, [], "these slots do not say what their face is handed")
})

/** The section the reader draws, inside the wrapper the sidebar stamps with
 *  the contributing plugin's word. The plugin's own rows in the Plugins section
 *  carry that word too, so the fixture's attribute is what tells them apart. */
const section = (world: OlaiWorld) =>
  world.page.locator(`${SIDEBAR} ${attr("data-plugin", "reader")} ${attr("data-reader", "section")}`)

Then("the sidebar draws the reading section", async function (this: OlaiWorld) {
  await section(this).first().waitFor({ state: "visible", timeout: HYDRATION_TIMEOUT })
})

Then("the sidebar draws no reading section", async function (this: OlaiWorld) {
  await this.waitUntil(async () => (await section(this).count()) === 0, "the sidebar to draw no reading section")
})

When("I follow {string} in the reading section", async function (this: OlaiWorld, label: string) {
  const link = section(this).locator("a").filter({ hasText: label }).first()
  await link.waitFor({ state: "visible", timeout: POLL_TIMEOUT })
  await this.press(link)
})

/** A chord nobody answers moves nothing: the page in front of the reader is
 *  the page that was there before the press. Read after two frames, because
 *  the absence has to be true now. */
Then("pressing {string} leaves this page where it is", async function (this: OlaiWorld, chord: string) {
  const was = this.place()
  await this.page.keyboard.press(chord)
  await this.waitForFrame()
  await this.waitForFrame()
  assert.equal(this.place(), was, `pressing ${chord} moved the page`)
})

/** The two columns the reader draws under a sentence, from its `columns.tsx`. */
Then("the row {string} draws the French and the English side by side", async function (this: OlaiWorld, node: string) {
  const columns = this.page.locator(`${nodeSelector(node)} ${attr("data-reader", "columns")}`).first()
  await columns.waitFor({ state: "visible", timeout: HYDRATION_TIMEOUT })
  assert.equal(await columns.locator(`p[lang="fr"]`).count(), 1)
  assert.equal(await columns.locator(`p[lang="en"]`).count(), 1)
})

/** The agent's own write, of any code file inside the plugin's folder. */
When("the terminal agent writes {string} of the plugin {string} as:", async function (this: OlaiWorld, file: string, word: string, text: string) {
  // Loaded on first use, as every MCP step in this row loads it.
  const { callTool, connectTerminalAgent } = await import("@olai/tests/harness/mcp.ts")
  this.terminalAgent ??= await connectTerminalAgent(`${this.baseUrl}/mcp`)
  this.toolAnswer = await callTool(this.terminalAgent, "vault-plugins_write", { name: word, file, text })
})

Then("the terminal agent was told the plugin {string} compiles", function (this: OlaiWorld, word: string) {
  const answer = this.toolAnswer?.["structuredContent"] as { path?: string; compiles?: boolean; why?: string } | undefined
  assert.ok(answer?.path?.startsWith(`plugins/${word}/`), JSON.stringify(answer))
  assert.equal(answer?.compiles, true, answer?.why ?? JSON.stringify(answer))
})

/** One row of an outline file on disk, as the format writes it: one JSON
 *  record per line. */
interface Row {
  readonly id: string
  readonly title?: string
  readonly custom?: Readonly<Record<string, unknown>>
}

/** The rows of an outline in this scenario's own copy of the corpus — the
 *  durable half of a write, which is what a restart comes back to. */
const rowsOf = (world: OlaiWorld, file: string): ReadonlyArray<Row> => {
  const text = fs.readFileSync(path.join(world.scratch(), file), "utf8")
  return text.split("\n").filter((line) => line.trim() !== "").map((line) => JSON.parse(line) as Row)
}

When("I press the word {string} under the row {string}", async function (this: OlaiWorld, word: string, node: string) {
  const button = this.page.locator(`${nodeSelector(node)} ${attr("data-reader", "word")}${attr("data-word", word)}`).first()
  await button.waitFor({ state: "visible", timeout: HYDRATION_TIMEOUT })
  await this.press(button)
})

Then("{string} has a row titled {string} carrying {string}", async function (this: OlaiWorld, file: string, title: string, key: string) {
  await this.waitUntil(
    () => Promise.resolve(rowsOf(this, file).some((row) => row.title === title && typeof row.custom?.[key] === "string")),
    `${file} to hold a row titled ${JSON.stringify(title)} carrying ${key}`,
  )
})

/** An outline waiting in the commit panel is a group of its own, named by its
 *  file and listing the rows that changed — not one of the other files. */
Then("the commit panel lists the outline {string} with the row {string}", async function (this: OlaiWorld, file: string, title: string) {
  const group = this.page.locator(`${selector(TESTID.commitGroup)}${attr("data-file", file)}`)
  await group.waitFor({ state: "visible", timeout: POLL_TIMEOUT })
  await this.waitUntil(async () => (await group.innerText()).includes(title), `the ${file} group to name ${JSON.stringify(title)}`)
})

/** The review the reader draws at the foot of the vocabulary row's own page. */
const review = (world: OlaiWorld) => world.page.locator(attr("data-reader", "review"))

Then("the review offers the word {string}", async function (this: OlaiWorld, word: string) {
  await review(this).and(this.page.locator(attr("data-word", word))).first()
    .waitFor({ state: "visible", timeout: HYDRATION_TIMEOUT })
})

When("I grade the word {string} as {string}", async function (this: OlaiWorld, word: string, grade: string) {
  const button = review(this).and(this.page.locator(attr("data-word", word))).locator(`button${attr("data-grade", grade)}`).first()
  await button.waitFor({ state: "visible", timeout: POLL_TIMEOUT })
  await this.press(button)
})

Then("the row {string} of {string} is next due after {string}", async function (this: OlaiWorld, node: string, file: string, day: string) {
  await this.waitUntil(() => {
    const due = rowsOf(this, file).find((row) => row.id === node)?.custom?.["reader-due"]
    return Promise.resolve(typeof due === "string" && due > day)
  }, `the row ${node} of ${file} to be due after ${day}`)
})

Then("the review is not drawn", async function (this: OlaiWorld) {
  await this.waitForFrame()
  await this.waitUntil(async () => (await review(this).count()) === 0, "the review to be gone")
})

/** The reader's own page, drawn by the plugin at `/plugins/reader/app…` and
 *  found by the attributes its source writes. */
const own = (world: OlaiWorld) => world.page.locator(attr("data-reader", "app"))

Then("the reader's own page is drawn at {string}", async function (this: OlaiWorld, rest: string) {
  await own(this).and(this.page.locator(attr("data-rest", rest))).first()
    .waitFor({ state: "visible", timeout: HYDRATION_TIMEOUT })
})

Then("the reader's own page is not drawn", async function (this: OlaiWorld) {
  await this.waitForFrame()
  await this.waitUntil(async () => (await own(this).count()) === 0, "the reader's own page to be absent")
})

/** What the address draws where the plugin draws nothing: the plugin's stage,
 *  in the words its approval page uses, and a way to that page. */
Then("the own page of {string} says it is {string}", async function (this: OlaiWorld, word: string, stage: string) {
  const absent = this.page.locator(`${selector(VAULT_PLUGINS_TESTID.ownPageAbsent)}${attr("data-plugin", word)}`).first()
  await absent.waitFor({ state: "visible", timeout: HYDRATION_TIMEOUT })
  await this.waitUntil(async () => (await absent.getAttribute("data-stage")) === stage, `the own page of ${word} to say ${stage}`)
  assert.equal(await absent.locator(`a[href="/plugins/${word}"]`).count(), 1, `the own page of ${word} links to its approval page`)
})

/** A transcribed page as the reader draws it, and its sentences: one row of
 *  columns per line of the file. */
const transcribed = (world: OlaiWorld, file: string) =>
  world.page.locator(`${attr("data-reader", "file")}${attr("data-file", file)}`)

Then("the reader draws {string} as {int} sentence(s) beside their/its English", async function (this: OlaiWorld, file: string, count: number) {
  const page = transcribed(this, file)
  await page.waitFor({ state: "visible", timeout: HYDRATION_TIMEOUT })
  await this.waitUntil(
    async () => (await page.locator(attr("data-reader", "columns")).count()) === count,
    `${file} to be drawn as ${count} sentence(s)`,
  )
})

When("the served file {string} becomes:", function (this: OlaiWorld, file: string, text: string) {
  this.writeServed(file, text)
})

/** The two faces the reader hangs on a note: above its text and under it. */
const noteFaces = (world: OlaiWorld) =>
  world.page.locator(`${attr("data-reader", "note-head")}, ${attr("data-reader", "note")}`)

Then("the reader's note faces are drawn on {string}", async function (this: OlaiWorld, file: string) {
  for (const which of ["note-head", "note"]) {
    await this.page.locator(`${attr("data-reader", which)}${attr("data-file", file)}`).first()
      .waitFor({ state: "visible", timeout: HYDRATION_TIMEOUT })
  }
})

Then("the reader's note faces are not drawn", async function (this: OlaiWorld) {
  await this.waitForFrame()
  await this.waitUntil(async () => (await noteFaces(this).count()) === 0, "the reader's note faces to be absent")
})

/** The gate's sentence, where the reader draws a refused write: beside what was
 *  pressed, under the row the word is on. */
Then("the reader says under the row {string} why the word was not added", async function (this: OlaiWorld, node: string) {
  const said = this.page.locator(`${nodeSelector(node)} ${attr("data-reader", "refused")}`).first()
  await said.waitFor({ state: "visible", timeout: POLL_TIMEOUT })
  const text = (await said.innerText()).trim()
  assert.ok(text.length > 0, "the refusal is drawn with no sentence")
  assert.ok(text.includes("vocabulary"), `the refusal does not name what was missing: ${text}`)
})

Then("{string} has no row titled {string}", async function (this: OlaiWorld, file: string, title: string) {
  await this.waitForFrame()
  assert.ok(!rowsOf(this, file).some((row) => row.title === title), `${file} holds a row titled ${JSON.stringify(title)}`)
})

/** HOLDING the element is marking it: a page mounted again draws a fresh
 *  element, which carries no mark, so finding the mark is finding the same one. */
When("I hold the reader's drawing of {string}", async function (this: OlaiWorld, file: string) {
  await transcribed(this, file).evaluate((element) => { element.setAttribute("data-held", "yes") })
})

Then("the reader's drawing of {string} is the one I held", async function (this: OlaiWorld, file: string) {
  await this.waitForFrame()
  assert.equal(await transcribed(this, file).count(), 1, `${file} is not drawn once`)
  assert.equal(await transcribed(this, file).getAttribute("data-held"), "yes", `${file} was drawn again rather than kept`)
})
