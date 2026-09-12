import { Then, When } from "@cucumber/cucumber"
import * as assert from "node:assert/strict"
import { readdirSync, readFileSync, writeFileSync } from "node:fs"
import { join } from "node:path"
import { TESTID } from "@olai/bundle/testids"
import { mediaHref } from "@olai/surface"
import { type OlaiWorld, rowsOfKind, attr } from "../support/world.ts"

const tool = async (world: OlaiWorld, name: string, args: Record<string, unknown>) => {
  const response = await fetch(new URL("/mcp", world.baseUrl), {
    method: "POST", headers: { "content-type": "application/json" },
    body: JSON.stringify({ jsonrpc: "2.0", id: 1, method: "tools/call", params: { name, arguments: args } }),
    signal: AbortSignal.timeout(10000),
  })
  const answer = await response.json()
  assert.equal(answer.error, undefined, "membership refusal must be a tool result, not a wire decode error")
  return answer.result
}
Then("the file-kind page says {string}", async function(this: OlaiWorld, text: string) {
  await this.waitUntil(async () => (await this.page.locator("main").allTextContents()).some(line => line.includes(text)), text)
})
Then("the Inbox and Pins entries explain the configured row is off", async function(this: OlaiWorld) {
  await this.showSidebar()
  await this.page.getByText("Inbox: the olai row is off.", { exact: true }).waitFor({ state: "visible" })
  await this.page.getByText("Pins: the olai row is off.", { exact: true }).waitFor({ state: "visible" })
})
Then("no outline file is listed", async function(this: OlaiWorld) {
  await this.waitUntil(async () => await this.page.locator(rowsOfKind("olai")).count() === 0, "outline claim withdrawal")
})
Then("no PDF file is listed", async function(this: OlaiWorld) {
  await this.waitUntil(async () => await this.page.locator(rowsOfKind("pdf")).count() === 0, "PDF claim withdrawal")
})
Then("media for {string} answers {int}", async function(this: OlaiWorld, file: string, status: number) {
  await this.waitUntil(async () => {
    const response = await this.page.request.get(new URL(mediaHref(file), this.baseUrl).href)
    const actual = response.status(); await response.dispose(); return actual === status
  }, `media status ${status}`)
})
Then("the PDF row has its contributed glyph", async function(this: OlaiWorld) {
  await this.showSidebar()
  await this.kindLink("pdf", "reports/q3.pdf").getByTestId(TESTID.fileGlyph).waitFor({ state: "visible" })
})
Then("the directory tree and rail are absent", async function(this: OlaiWorld) {
  await this.waitUntil(async () => await this.page.getByTestId(TESTID.sidebarFiles).count() === 0 && await this.page.getByTestId(TESTID.railOutlines).count() === 0, "navigation withdraws tree and rail")
})
Then("the configured outline row refuses a mint without writing", async function(this: OlaiWorld) {
  const before = readdirSync(this.scratch(), { recursive: true }).sort()
  const result = await tool(this, "files_create", { file: "must-not-be-created.olai" })
  assert.equal(result.isError, true)
  assert.ok(JSON.stringify(result).includes("the olai row is off"), JSON.stringify(result))
  assert.deepEqual(readdirSync(this.scratch(), { recursive: true }).sort(), before)
})
Then("the settings report the format reader's ignored durable switch", async function(this: OlaiWorld) {
  await this.waitUntil(async () => this.serverLog.text.includes("olai.on is ignored") && this.serverLog.text.includes("session-only"), "reader-owner warning")
})
Then("the unclaimed file {string} is absent and refused by the outline tool", async function(this: OlaiWorld, file: string) {
  const result = await tool(this, "outlines_subtree", { file })
  assert.equal(result.isError, true)
  assert.ok(JSON.stringify(result).includes("no row claims"), JSON.stringify(result))
  const index = await tool(this, "outlines_index", {})
  assert.equal(JSON.stringify(index).includes(file), false)
  assert.equal(await this.page.getByTestId(TESTID.sidebarFiles).locator(attr("data-file", file)).count(), 0)
})
Then("the directory reports both ambiguous Trash convention files", async function(this: OlaiWorld) {
  await this.waitUntil(async () => {
    // A finding blaming files is on those files' read refusal, not the
    // directory-wide errors cell (which may correctly remain empty).
    const text = JSON.stringify(await tool(this, "outlines_subtree", { file: "_olai/Trash.olai" }))
    return text.includes("ambiguous-convention") && text.includes("_olai/Trash.olai") && text.includes("_olai/TRASH.olai")
  }, "ambiguous convention finding")
})

When("the PDF row is disabled in the settings file", function(this: OlaiWorld) {
  const path = join(this.scratch(), "_olai/Settings.olai")
  const nodes = readFileSync(path, "utf8").trim().split("\n").filter(Boolean).map(line => JSON.parse(line))
  let row = nodes.find(node => node.parent === undefined && node.title === "pdf")
  if (row === undefined) { row = { id: "file-kind-pdf-setting", ord: "a9999", title: "pdf" }; nodes.push(row) }
  row.custom = { ...row.custom, on: "no" }
  writeFileSync(path, nodes.map(node => JSON.stringify(node)).join("\n") + "\n")
})

/** A browser history traversal, with no visit/reload or private service read. */
When("I navigate within the tab to {string}", async function(this: OlaiWorld, address: string) {
  await this.page.evaluate(address => {
    history.pushState(null, "", address)
    dispatchEvent(new PopStateEvent("popstate"))
  }, address)
  await this.waitForFrame()
})

Then("the held file {string} has the plain-file fallback", async function(this: OlaiWorld, file: string) {
  await this.showSidebar()
  const link = this.page.getByTestId(TESTID.fileLink).filter({ has: this.page.getByTestId(TESTID.fileGlyph) }).and(this.page.locator(attr("data-file", file)))
  await link.waitFor({ state: "visible" })
  assert.equal(await link.getByTestId(TESTID.fileGlyph).locator("svg").count(), 1)
})
