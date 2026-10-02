import assert from "node:assert/strict"
type ElementHandle = NonNullable<Awaited<ReturnType<ReturnType<OlaiWorld["pane"]>["elementHandle"]>>>
import { Then, When } from "@olai/tests/harness/runner.ts"
import { CHAT_ENTRY_STREAMING, FILTER_INPUT } from "@olai/tests/harness/world.ts"
import type { OlaiWorld } from "@olai/tests/harness/world.ts"
import { selector } from "@olai/ui-primitives/testids.ts"
import { TESTID } from "olai-plugin-layout/testids"

const remembered = new WeakMap<OlaiWorld, Map<string, ElementHandle>>()
When("I remember pane {int} as {string}", async function (this: OlaiWorld, index: number, name: string) {
  const node = await this.pane(index).elementHandle()
  assert.ok(node)
  let panes = remembered.get(this)
  if (!panes) { panes = new Map(); remembered.set(this, panes) }
  panes.set(name, node)
})
Then("pane {int} is still {string}", async function (this: OlaiWorld, index: number, name: string) {
  const old = remembered.get(this)?.get(name)
  assert.ok(old)
  assert.equal(await this.pane(index).evaluate((node, old) => node === old, old), true)
})
Then("remembered pane {string} is {word}", async function (this: OlaiWorld, name: string, status: string) {
  const old = remembered.get(this)?.get(name)
  assert.ok(old)
  const connected = await old.evaluate(node => node.isConnected)
  assert.equal(connected, status === "mounted")
})
Then("there are {int} live lanes", async function (this: OlaiWorld, count: number) {
  await this.waitUntil(async () => await this.page.locator(selector(TESTID.lane)).count() === count, `${count} live lanes`)
  // Keep observing through subsequent paints: an early one-lane frame at
  // reload must not conceal a later eager mount of the background tabs.
  assert.equal(await this.page.evaluate(async ({ lane, count }) => {
    const until = performance.now() + 500
    while (performance.now() < until) {
      if (document.querySelectorAll(lane).length !== count) return false
      await new Promise(requestAnimationFrame)
    }
    return true
  }, { lane: selector(TESTID.lane), count }), true)
})

Then("pane {int} is at its bottom", async function (this: OlaiWorld, index: number) {
  await this.waitUntil(() => this.pane(index).evaluate(root => {
    let host = root.parentElement
    while (host && !/auto|scroll/.test(getComputedStyle(host).overflowY)) host = host.parentElement
    return host !== null && host.scrollHeight > host.clientHeight && host.scrollHeight - host.scrollTop - host.clientHeight < 2
  }), "the retained pane to resume following")
})

When("I drag pane header {int} to pane header {int}", async function (this: OlaiWorld, from: number, to: number) {
  const headers = this.frontLane().locator(selector(TESTID.paneHeader))
  const source = await headers.nth(from).boundingBox()
  const target = await headers.nth(to).boundingBox()
  assert.ok(source && target)
  await this.page.mouse.move(source.x + source.width / 2, source.y + source.height / 2)
  await this.page.mouse.down()
  await this.page.mouse.move(target.x + target.width / 2, target.y + target.height / 2, { steps: 12 })
  await this.page.mouse.up()
})

const savedPaneScroll = new WeakMap<OlaiWorld, Map<number, number>>()
When("I leave pane {int} halfway down", async function (this: OlaiWorld, index: number) {
  const top = await this.pane(index).evaluate(root => {
    let host = root.parentElement
    while (host && !/auto|scroll/.test(getComputedStyle(host).overflowY)) host = host.parentElement
    if (!host) throw new Error("no pane scroller")
    host.scrollTop = (host.scrollHeight - host.clientHeight) / 2
    return host.scrollTop
  })
  assert.ok(top > 50, "the pane must overflow enough to prove its scroll survives")
  let saved = savedPaneScroll.get(this)
  if (!saved) { saved = new Map(); savedPaneScroll.set(this, saved) }
  saved.set(index, top)
  await this.waitForFrame()
})
Then("pane {int} keeps its nonzero scroll position", async function (this: OlaiWorld, index: number) {
  const expected = savedPaneScroll.get(this)?.get(index)
  assert.ok(expected !== undefined && expected > 50)
  await this.waitUntil(() => this.pane(index).evaluate((root, expected) => {
    let host = root.parentElement
    while (host && !/auto|scroll/.test(getComputedStyle(host).overflowY)) host = host.parentElement
    return host !== null && Math.abs(host.scrollTop - expected) < 2
  }, expected), "the split column to retain the reader's position").catch(async cause => {
    const actual = await this.pane(index).evaluate(root => {
      let host = root.parentElement
      while (host && !/auto|scroll/.test(getComputedStyle(host).overflowY)) host = host.parentElement
      return host && { top: host.scrollTop, height: host.scrollHeight, viewport: host.clientHeight }
    })
    throw new Error(`${cause}; expected top ${expected}, actual ${JSON.stringify(actual)}`)
  })
})

const hiddenText = new WeakMap<OlaiWorld, string>()
Then("remembered pane {string} keeps receiving text while hidden", async function (this: OlaiWorld, name: string) {
  const pane = remembered.get(this)?.get(name)
  assert.ok(pane)
  assert.equal(await pane.evaluate(node => node.checkVisibility()), false)
  const before = await pane.evaluate((node, selector) => node.querySelector(selector)?.textContent ?? "", CHAT_ENTRY_STREAMING)
  assert.ok(before.includes("working on it"))
  await this.waitUntil(async () => {
    const after = await pane.evaluate((node, selector) => node.querySelector(selector)?.textContent ?? "", CHAT_ENTRY_STREAMING)
    if (after.length <= before.length + 2) return false
    hiddenText.set(this, after)
    return true
  }, "streamed text to grow in the hidden retained pane")
})
Then("pane {int} contains the text received while hidden", async function (this: OlaiWorld, index: number) {
  const text = hiddenText.get(this)
  assert.ok(text)
  assert.ok((await this.pane(index).textContent())?.includes(text))
})

const frames = new WeakMap<OlaiWorld, ElementHandle>()
When("I remember the HTML frame", async function (this: OlaiWorld) {
  const frame = this.frontLane().locator("iframe")
  await frame.waitFor({ state: "visible" })
  const handle = await frame.elementHandle()
  assert.ok(handle)
  frames.set(this, handle)
})
Then("the remembered HTML frame is mounted but hidden", async function (this: OlaiWorld) {
  const frame = frames.get(this)
  assert.ok(frame)
  assert.equal(await frame.evaluate(node => node.isConnected && !node.checkVisibility()), true)
})
Then("the remembered HTML frame is shown unchanged", async function (this: OlaiWorld) {
  const frame = frames.get(this)
  assert.ok(frame)
  assert.equal(await this.frontLane().locator("iframe").evaluate((node, old) => node === old && node.checkVisibility(), frame), true)
})

Then("pane {int} keeps the filter {string}", async function (this: OlaiWorld, index: number, text: string) {
  await this.waitUntil(async () => await this.pane(index).locator(FILTER_INPUT).inputValue() === text, `pane ${index} to retain its filter`)
})
