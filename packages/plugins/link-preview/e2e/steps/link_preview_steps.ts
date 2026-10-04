import * as assert from "node:assert/strict"
import { readFileSync, existsSync } from "node:fs"
import { join } from "node:path"
import { Given, When, Then } from "@olai/tests/harness/runner.ts"
import { attr } from "@olai/tests/harness/world.ts"
import type { OlaiWorld } from "@olai/tests/harness/world.ts"
import { TESTID } from "../../src/testids.ts"

const card = (world: OlaiWorld) => world.page.getByTestId(TESTID.linkPreview)
const link = (world: OlaiWorld, label: string) => world.page.locator('[data-testid="desc"] a').getByText(label, { exact: true }).first()
const records = () => [
  { id: "preview-source", ord: "a0", title: "Preview source", desc: "[target](/#preview-target) [dead](/#preview-missing) [row](/preview.olai#preview-target) [wrong row](/house.olai#preview-target) [outline](/preview.olai) [document](/preview.md) [heading](/preview.md#section-1) [missing heading](/preview.md#absent) [local](#preview-target) [external](https://example.com)", see: ["preview-target"] },
  { id: "preview-parent", ord: "a1", title: "Preview parent" },
  { id: "preview-target", parent: "preview-parent", ord: "a0", title: "Preview target #sample", todo: "2026-10-04", date: "2026-10-04", desc: "A live note with [nested](/#preview-destination).\n\n- [ ] Cannot toggle this\n\nMore prose." },
  ...["one", "two", "three", "four"].map((word, i) => ({ id: `preview-child-${i}`, parent: "preview-target", ord: `a${i}`, title: `Child ${word}`, todo: "2026-10-04" })),
  { id: "preview-destination", ord: "a2", title: "Preview destination" },
  { id: "preview-extra", ord: "a3", title: "Extra root" },
]
const write = (world: OlaiWorld, rows: unknown[]) => world.writeServed("preview.olai", rows.map(row => JSON.stringify(row)).join("\n"))
Given("the link preview examples are served", function (this: OlaiWorld) {
  write(this, records())
  this.writeServed("preview.md", "# Document\n\nOpening paragraph\n\n## Section\n\nFirst section text\n\n## Section\n\nSecond section text\n\n## End\n\nThird section text\n")
})
When("I hover the preview link {string}", async function (this: OlaiWorld, label: string) { await link(this, label).hover() })
When("a target link replaces the local link under the stationary pointer", async function (this: OlaiWorld) {
  await link(this, "local").evaluate(el => {
    const replacement = el.cloneNode(true) as HTMLAnchorElement
    replacement.href = "/#preview-target"
    el.replaceWith(replacement)
  })
})
When("I move slightly within the preview link {string}", async function (this: OlaiWorld, label: string) {
  const box = (await link(this, label).boundingBox())!
  await this.page.mouse.move(box.x + box.width / 2 + 2, box.y + box.height / 2)
})
When("I focus the preview link {string}", async function (this: OlaiWorld, label: string) { await link(this, label).focus() })
When("I blur the preview link", async function (this: OlaiWorld) { await this.page.evaluate(() => (document.activeElement as HTMLElement)?.blur()) })
When("I move onto the preview card", async function (this: OlaiWorld) { await card(this).hover() })
When("I leave the preview card", async function (this: OlaiWorld) { await this.page.mouse.move(0, 0); await this.page.evaluate(() => (document.activeElement as HTMLElement)?.blur()) })
When("I briefly hover the preview link {string}", async function (this: OlaiWorld, label: string) { await link(this, label).hover(); await this.page.mouse.move(0, 0) })
Then("the link preview contains {string}", async function (this: OlaiWorld, text: string) {
  await this.waitUntil(async () => (await card(this).textContent())?.includes(text) === true, `preview to contain ${text}`)
})
Then("the link preview does not contain {string}", async function (this: OlaiWorld, text: string) { assert.ok(!(await card(this).textContent())?.includes(text)) })
Then("there is exactly one link preview", async function (this: OlaiWorld) { assert.equal(await card(this).count(), 1) })
Then("the link preview closes", async function (this: OlaiWorld) { await card(this).waitFor({ state: "detached" }) })
Then("the link preview stays closed", async function (this: OlaiWorld) { await this.page.waitForTimeout(650); assert.equal(await card(this).count(), 0) })
Then("the link preview remains open", async function (this: OlaiWorld) { await this.page.waitForTimeout(350); assert.equal(await card(this).count(), 1) })
Then("the link preview is read-only and clipped", async function (this: OlaiWorld) {
  assert.equal(await card(this).locator('input:not([disabled]), textarea, [contenteditable="true"], button').count(), 0)
  assert.ok((await card(this).boundingBox())!.height < 400)
  await card(this).getByText("Preview target #sample", { exact: false }).first().click()
  assert.equal(await card(this).locator('[data-testid="title-editor"]').count(), 0)
})
When("I make the preview note an active editor", async function (this: OlaiWorld) { await link(this, "target").evaluate(el => el.parentElement!.setAttribute("contenteditable", "true")) })
When("I change the preview target on disk", function (this: OlaiWorld) { write(this, records().map(row => row.id === "preview-target" ? { ...row, title: "Changed preview target" } : row)) })
When("I delete the preview target on disk", function (this: OlaiWorld) {
  // Keep the outline valid: structural see references cannot dangle, while
  // the source's Markdown link deliberately remains to show the missing card.
  write(this, records().filter(row => row.id !== "preview-target" && !("parent" in row && row.parent === "preview-target"))
    .map(row => row.id === "preview-source" ? { ...row, see: [] } : row))
})
When("I mark the preview card identity", async function (this: OlaiWorld) { await card(this).evaluate(el => { (window as unknown as { previewCard: Element }).previewCard = el }) })
Then("the preview card identity is unchanged", async function (this: OlaiWorld) { assert.ok(await card(this).evaluate(el => (window as unknown as { previewCard: Element }).previewCard === el)) })
When("I hover the nested preview link", async function (this: OlaiWorld) { await card(this).getByRole("link", { name: "nested" }).hover(); await this.page.waitForTimeout(500) })
When("I click the nested preview link", async function (this: OlaiWorld) { await card(this).getByRole("link", { name: "nested" }).click() })
When("I click the preview link {string}", async function (this: OlaiWorld, label: string) { await link(this, label).click() })
When("I alt-click the preview link {string}", async function (this: OlaiWorld, label: string) { await link(this, label).click({ modifiers: ["Alt"] }) })
Then("no preview target page was requested", function (this: OlaiWorld) { assert.equal(this.socketAskedSince("page/get", "preview-target"), 0) })
Then("the preview target page subscription is closed", async function (this: OlaiWorld) {
  this.markWire()
  write(this, records().map(row => row.id === "preview-target" ? { ...row, desc: "Closed preview must not receive this unique text" } : row))
  await this.page.waitForTimeout(800)
  assert.equal(this.socketSaidSince("zoomed", "Closed preview must not receive this unique text"), 0)
})
When("I set the preview plugin {string} {word} on disk", async function (this: OlaiWorld, plugin: string, state: string) {
  const file = join(this.scratch(), "_olai/Settings.olai")
  const rows = existsSync(file) ? readFileSync(file, "utf8").trim().split("\n").filter(Boolean).map(line => JSON.parse(line)) : []
  const id = plugin
  let row = rows.find(row => row.title === id)
  if (!row) { row = { id: `preview-plugin-${plugin}`, ord: "a9999", title: id }; rows.push(row) }
  row.custom = { ...row.custom, on: state === "on" ? "yes" : "no" }
  this.writeServed("_olai/Settings.olai", rows.map(row => JSON.stringify(row)).join("\n"))
  await this.page.waitForTimeout(700)
})
Then("the preview overlay is removed", async function (this: OlaiWorld) { await this.page.locator('[data-link-preview-overlay]').waitFor({ state: "detached" }) })
When("I hover the preview see link", async function (this: OlaiWorld) { await this.page.locator('[data-testid="see-refs"] a').first().hover() })
When("I expand the preview backlinks", async function (this: OlaiWorld) {
  const summary = this.page.getByTestId("backlinks-summary")
  await summary.click()
})
When("I hover the preview backlink", async function (this: OlaiWorld) { await this.page.locator('[data-testid="backlinks"] a[href="/#preview-source"]').first().hover() })
When("I hover the chat preview reference {string}", async function (this: OlaiWorld, id: string) { await this.page.locator(`code${attr("data-node-ref", id)}`).last().hover() })
When("I hover the conversation preview link {string}", async function (this: OlaiWorld, id: string) { await this.page.locator(`a${attr("href", `/#${id}`)}`).first().hover() })

When("I dismiss the link preview with Escape", async function (this: OlaiWorld) { await this.page.keyboard.press("Escape") })

When("I remove the preview source links on disk", function (this: OlaiWorld) {
  write(this, records().map(row => row.id === "preview-source" ? { ...row, desc: "The links have been removed." } : row))
})

When("I hover the editing row permalink", async function (this: OlaiWorld) { await this.page.locator('[data-editing="true"] [data-testid="zoom"]').hover() })

Then("the qualified preview requested only the target node", function (this: OlaiWorld) {
  assert.ok(this.socketAskedSince("page/get", '"kind":"node"', "preview-target") > 0)
  assert.equal(this.socketAskedSince("page/get", '"kind":"row"', "preview-target"), 0)
})

When("I watch Escape beneath the preview", async function (this: OlaiWorld) {
  await this.page.evaluate(() => {
    const state = { focus: document.activeElement, href: location.href, escapes: 0 }
    Object.assign(window, { previewEscape: state })
    document.addEventListener("keydown", event => { if (event.key === "Escape") state.escapes++ })
  })
})
Then("Escape leaves the preview's underlying page untouched", async function (this: OlaiWorld) {
  assert.deepEqual(await this.page.evaluate(() => {
    const state = (window as unknown as { previewEscape: { focus: Element | null; href: string; escapes: number } }).previewEscape
    return { focus: state.focus === document.activeElement, href: state.href === location.href, escapes: state.escapes }
  }), { focus: true, href: true, escapes: 0 })
})
Then("Escape reaches the page when no preview is open", async function (this: OlaiWorld) {
  await this.page.keyboard.press("Escape")
  assert.equal(await this.page.evaluate(() => (window as unknown as { previewEscape: { escapes: number } }).previewEscape.escapes), 1)
})

When("I remove the first preview child on disk", function (this: OlaiWorld) { write(this, records().filter(row => row.id !== "preview-child-0")) })
