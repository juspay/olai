import * as assert from "node:assert/strict"
import { Given, When, Then } from "@olai/tests/harness/runner.ts"
import { attr } from "@olai/tests/harness/world.ts"
import type { OlaiWorld } from "@olai/tests/harness/world.ts"

const link = (world: OlaiWorld, surface: string) => {
  switch (surface) {
    case "note": return world.page.locator('[data-testid="desc"] a').getByText("target", { exact: true }).first()
    case "see": return world.page.locator('[data-testid="see-refs"] a').first()
    case "bullet": return world.page.locator('[data-testid="zoom"]').first()
    case "title": return world.page.locator('[data-node-id="preview-source"] [data-testid="title"] a').first()
    case "document": return world.page.getByRole("link", { name: "target row", exact: true }).first()
    case "toc": return world.page.locator('[data-testid="toc-link"]').getByText("End", { exact: true }).first()
    case "backlink": return world.page.locator('[data-testid="backlinks"] a[href="/#preview-source"]').first()
    case "breadcrumb": return world.page.locator('[data-testid="breadcrumbs"] a[href="/#preview-target"]').first()
    case "palette": return world.page.locator('[data-testid="palette-item"][href="/#preview-target"]').first()
    case "search": return world.page.locator('[data-testid="header-search-item"][href="/#preview-target"]').first()
    case "rail": return world.page.locator('[data-testid="rail-trash"]').first()
    case "card": return world.page.locator('[data-testid="link-preview"] a').getByText("nested", { exact: true }).first()
    case "html": return world.page.frameLocator('iframe').first().getByRole("link", { name: "target row", exact: true })
    case "chat-written": return world.page.locator('[data-testid="chat-said"] a').getByText("the order row", { exact: true }).last()
    case "chat-code": return world.page.locator('[data-testid="chat-said"] a[data-node-chip]').filter({ hasText: "order" }).last()
    case "chat-reference": return world.page.locator('[data-testid="chat-node-ref"][href="/#order"]').last()
    case "roster": return world.page.locator('[data-testid="agent-row"][data-agent="kitchen"]').first()
    case "heading": return world.page.getByRole("link", { name: "the end", exact: true }).first()
    default: throw new Error(`Unknown surface ${surface}`)
  }
}
When("I activate the unified {string} link with {string}", async function(this: OlaiWorld, surface: string, gesture: string) {
  const anchor = link(this, surface)
  assert.equal(await anchor.evaluate(el => el.tagName), "A")
  await this.markPage()
  if (gesture === "Enter") { await anchor.focus(); await anchor.press("Enter") }
  else await anchor.click({ modifiers: gesture === "Alt" ? ["Alt"] : gesture === "Alt-Shift" ? ["Alt", "Shift"] : [] })
  assert.ok(await this.pageStillMarked(), "link must stay in the live application")
})
When("I open the unified {string} link menu", async function(this: OlaiWorld, surface: string) {
  await link(this, surface).click({ button: "right" })
})
Then("the unified link menu offers Open in new tab", async function(this: OlaiWorld) {
  await this.page.getByRole("menuitem", { name: "Open in new tab", exact: true }).waitFor({ state: "visible" })
})
Then("the unified destination row {string} is selected", async function(this: OlaiWorld, id: string) {
  await this.waitUntil(async () => this.page.locator(`a${attr("href", `/zoom/#${encodeURIComponent(id)}`)}`).evaluateAll(links => links.some(el => el.closest("[data-node-id]")?.getAttribute("data-focused") === "true")), "destination row selected")
})
Then("the unified destination row {string} is selected in pane {int}", async function(this: OlaiWorld, id: string, pane: number) {
  await this.page.locator(`${attr("data-pane", String(pane))} ${attr("data-node-id", id)}[data-focused="true"]`).first().waitFor({ state: "visible" })
})

Then("the unified heading {string} is visible in pane {int}", async function(this: OlaiWorld, text: string, pane: number) {
  const heading = this.page.locator(attr("data-pane", String(pane))).locator("h1,h2,h3,h4,h5,h6").filter({ hasText: text }).first()
  await heading.waitFor({ state: "visible" })
  await this.waitUntil(async () => {
    const box = await heading.boundingBox()
    return !!box && box.y >= 0 && box.y + box.height <= this.viewport().height
  }, "heading inside the viewport")
})

Given("the unified document links are served", function(this: OlaiWorld) {
  this.writeServed("intent.md", "# Links\n\n[target row](/#preview-target)\n\n[the end](#end)\n\n" + "Paragraph before.\n\n".repeat(70) + "## End\n\n" + "Paragraph after.\n\n".repeat(60))
  this.writeServed("intent.html", '<!doctype html><title>Links</title><a href="preview.olai#preview-target">target row</a>')
})
Given("I prepare the unified {string} surface", async function(this: OlaiWorld, surface: string) {
  if (["document", "heading", "toc"].includes(surface)) {
    await this.open("/intent.md")
    if (surface === "toc" && !(await this.page.getByTestId("toc").getAttribute("open") !== null)) await this.page.locator('[data-testid="toc"] summary').click()
  } else if (surface === "html") await this.open("/intent.html")
  else if (surface === "backlink") {
    await this.openNode("preview-target")
    await this.page.getByTestId("backlinks-summary").click()
  } else if (surface === "breadcrumb") await this.openNode("preview-child-0")
  else if (surface === "palette" || surface === "search") {
    await this.open("/house.olai")
    if (surface === "palette") {
      await this.page.keyboard.press("Control+k")
      await this.page.getByTestId("palette-input").fill("Preview target")
    } else await this.page.getByTestId("header-search").fill("Preview target")
  } else {
    await this.openNode("preview-source")
    if (surface === "card") await link(this, "note").hover()
    if (surface === "rail") await this.page.getByTestId("sidebar-collapse").click()
  }
  await link(this, surface).waitFor({ state: "visible" })
})
Then("the unified {string} link leaves {string} to the browser", async function(this: OlaiWorld, surface: string, gesture: string) {
  const anchor = link(this, surface), before = this.page.url()
  const picked = await this.page.locator('[data-picked="true"]').count()
  // Prevent the browser's actual tab creation only after all app handlers;
  // record whether the app claimed the genuine modifier press first.
  await anchor.evaluate((element, gesture) => {
    element.ownerDocument.defaultView!.addEventListener(gesture === "middle" ? "auxclick" : "click", event => {
      (element.ownerDocument.defaultView as unknown as { linkClaimed: boolean }).linkClaimed = event.defaultPrevented
      event.preventDefault()
    }, { once: true })
  }, gesture)
  await anchor.click({ button: gesture === "middle" ? "middle" : "left", modifiers: gesture === "Ctrl" ? ["Control"] : gesture === "Meta" ? ["Meta"] : [] })
  assert.equal(await anchor.evaluate(element => (element.ownerDocument.defaultView as unknown as { linkClaimed: boolean }).linkClaimed), false)
  assert.equal(this.page.url(), before)
  assert.equal(await this.page.locator('[data-picked="true"]').count(), picked)
})
Then("the unified {string} link previews {string}", async function(this: OlaiWorld, surface: string, text: string) {
  await link(this, surface).hover()
  await this.waitUntil(async () => (await this.page.getByTestId("link-preview").textContent())?.includes(text) === true, `preview ${text}`)
})

Given("legacy zoom tabs are stored", async function(this: OlaiWorld) {
  await this.page.evaluate(() => {
    localStorage.setItem("olai.tabs", JSON.stringify({ v: 1, front: "front", tabs: [
      { id: "front" }, { id: "old", href: "/#install", title: "install" },
      { id: "layout", href: "/s/house.olai/%23order", title: "old layout" },
    ] }))
  })
  await this.page.reload()
})
Given("a legacy zoom history entry is restored", async function(this: OlaiWorld) {
  await this.page.evaluate(() => history.replaceState({ key: "legacy", lane: null, at: 0 }, "", "/#install"))
  await this.page.reload()
})
