/**
 * The scenario's hand on the `/browser` pane and on the real Chromium behind
 * it (`@browsing-live`): read where the browser stands, drive the page through
 * the picture the way a person does, and serve the loopback pages it browses.
 *
 * The pages are built so a step can aim without knowing the browser's
 * viewport: the button fills the top-left of the page and the box the
 * middle-left, in viewport units, so a press at a fraction of the drawn
 * picture lands on them whatever size the frame is.
 */
import assert from "node:assert/strict"
import { createServer, type Server } from "node:http"
import type { AddressInfo } from "node:net"
import { After, Given, Then, When } from "@olai/tests/harness/runner.ts"
import { attr } from "@olai/tests/harness/selectors.ts"
import { HYDRATION_TIMEOUT, POLL_TIMEOUT } from "@olai/tests/harness/world.ts"
import type { OlaiWorld } from "@olai/tests/harness/world.ts"
import { TESTID as CHAT } from "olai-plugin-chat/testids"
import { TESTID } from "olai-plugin-browsing/testids"

const id = (name: string) => attr("data-testid", name)
const paneAt = (world: OlaiWorld, index: number) =>
  world.frontLane().locator(`[data-testid="pane"]${attr("data-pane", String(index))}`)
const pageIn = (world: OlaiWorld, index: number) => paneAt(world, index).locator(id(TESTID.browserPage))

/** The page a scenario drives: a button that renames the tab, and a box whose
 *  words become the tab's title. */
const FIXTURE = `<!doctype html><title>Fixture</title><body style="margin:0;font:32px sans-serif">
<button style="position:fixed;left:0;top:0;width:50vw;height:30vh;font-size:32px" onclick="document.title='clicked'">Rename</button>
<input style="position:fixed;left:0;top:40vh;width:50vw;height:20vh;font-size:32px" oninput="document.title='typed:'+this.value">`

/** ...and one that remembers a choice in its origin's storage, which is the
 *  stand-in for a sign-in: the title says what the browser kept. */
const REMEMBERING = `<!doctype html><title>loading</title><body style="margin:0">
<button style="position:fixed;left:0;top:0;width:50vw;height:30vh;font-size:32px"
  onclick="localStorage.setItem('olai','signed-in');document.title='kept:'+localStorage.getItem('olai')">Sign in</button>
<script>document.title='kept:'+(localStorage.getItem('olai')||'nothing')</script>`

const sites = new WeakMap<OlaiWorld, { readonly server: Server; readonly origin: string }>()
After(async function (this: OlaiWorld) {
  const site = sites.get(this)
  if (site === undefined) return
  sites.delete(this)
  await new Promise<void>((resolve) => site.server.close(() => resolve()))
})

Given("a web site the browser can visit", async function (this: OlaiWorld) {
  const server = createServer((request, response) => {
    const path = request.url ?? "/"
    const body = path.startsWith("/remember") ? REMEMBERING
      : path.startsWith("/agent") ? "<!doctype html><title>Agent page</title><p>opened by an agent</p>"
      : FIXTURE
    response.writeHead(200, { "content-type": "text/html; charset=utf-8" })
    response.end(body)
  })
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve))
  sites.set(this, { server, origin: `http://127.0.0.1:${(server.address() as AddressInfo).port}` })
})

const siteOf = (world: OlaiWorld) => {
  const site = sites.get(world)
  assert.ok(site, "start the web site first")
  return site.origin
}

When("I press the browser row in the health popover", async function (this: OlaiWorld) {
  await this.press(this.page.locator(id(TESTID.browserHeader)))
})

Then("pane {int} draws the browser page", async function (this: OlaiWorld, index: number) {
  await pageIn(this, index).waitFor({ state: "visible", timeout: HYDRATION_TIMEOUT })
})

Then("no browser page is drawn", async function (this: OlaiWorld) {
  await this.waitUntil(async () => (await this.page.locator(id(TESTID.browserPage)).count()) === 0, "every browser page to leave")
})

Then("the browser pane says the browser is {word}", async function (this: OlaiWorld, kind: string) {
  await pageIn(this, 0).locator(`xpath=self::*[@data-standing="${kind}"]`).waitFor({ state: "attached", timeout: HYDRATION_TIMEOUT })
})

Then("the browser pane says {string}", async function (this: OlaiWorld, words: string) {
  const banner = pageIn(this, 0).locator(id(TESTID.browserStanding))
  await this.waitUntil(async () => ((await banner.textContent().catch(() => "")) ?? "").includes(words), `the browser pane to say "${words}"`, HYDRATION_TIMEOUT)
})

When("I start the browser from the pane", async function (this: OlaiWorld) {
  await this.press(pageIn(this, 0).locator(id(TESTID.browserStart)))
})

Then("the browser pane shows {int} tab(s)", async function (this: OlaiWorld, count: number) {
  const tabs = pageIn(this, 0).locator(id(TESTID.browserTab))
  await this.waitUntil(async () => (await tabs.count()) === count, `${count} browser tabs`, HYDRATION_TIMEOUT)
})

Then("a browser tab in pane {int} is titled {string}", async function (this: OlaiWorld, index: number, title: string) {
  await pageIn(this, index).locator(`${id(TESTID.browserTab)}${attr("data-title", title)}`)
    .waitFor({ state: "attached", timeout: HYDRATION_TIMEOUT })
})

Then("the shown browser tab in pane {int} is titled {string}", async function (this: OlaiWorld, index: number, title: string) {
  await pageIn(this, index).locator(`${id(TESTID.browserTab)}${attr("data-active", "true")}${attr("data-title", title)}`)
    .waitFor({ state: "attached", timeout: HYDRATION_TIMEOUT })
})

const frameIn = (world: OlaiWorld, index: number) => pageIn(world, index).locator(id(TESTID.browserFrame))

Then("pane {int} draws a picture of the page", async function (this: OlaiWorld, index: number) {
  const frame = frameIn(this, index)
  await frame.waitFor({ state: "visible", timeout: HYDRATION_TIMEOUT })
  const seen = () => frame.evaluate((img: HTMLImageElement) =>
    ({ complete: img.complete, width: img.naturalWidth, src: `${img.src.slice(0, 40)}… (${img.src.length} chars)` }))
  await this.waitUntil(async () => {
    const now = await seen()
    return now.complete && now.width > 0 && now.src.startsWith("blob:")
  }, "a decoded frame", HYDRATION_TIMEOUT).catch(async (cause) => {
    throw new Error(`${String(cause)}; the picture holds ${JSON.stringify(await seen())}`)
  })
})

const noted = new WeakMap<OlaiWorld, Map<number, string>>()
When("I note the picture in pane {int}", async function (this: OlaiWorld, index: number) {
  const src = await frameIn(this, index).getAttribute("src")
  assert.ok(src)
  noted.set(this, new Map([...(noted.get(this) ?? []), [index, src]]))
})
Then("the picture in pane {int} changes", async function (this: OlaiWorld, index: number) {
  const before = noted.get(this)?.get(index)
  assert.ok(before, `note the picture in pane ${index} first`)
  await this.waitUntil(async () => (await frameIn(this, index).getAttribute("src").catch(() => before)) !== before,
    `pane ${index}'s picture to move`, HYDRATION_TIMEOUT)
})

const address = (world: OlaiWorld) => pageIn(world, 0).locator(id(TESTID.browserAddress))
const goTo = async (world: OlaiWorld, url: string) => {
  const box = address(world)
  await box.waitFor({ state: "visible", timeout: HYDRATION_TIMEOUT })
  await box.click()
  await box.fill(url)
  await box.press("Enter")
}

When("I go to the site's {string} page in the browser's address bar", async function (this: OlaiWorld, page: string) {
  await goTo(this, `${siteOf(this)}/${page}`)
})

Then("the browser's address bar shows the site's {string} page", async function (this: OlaiWorld, page: string) {
  const want = `${siteOf(this)}/${page}`
  await this.waitUntil(async () => (await address(this).inputValue().catch(() => "")) === want, `the address bar to show ${want}`, HYDRATION_TIMEOUT)
})

/** A press on the picture at a fraction of its drawn box. */
const pressAt = async (world: OlaiWorld, index: number, fx: number, fy: number, modifiers: Array<"Alt"> = []) => {
  const frame = frameIn(world, index)
  await frame.waitFor({ state: "visible", timeout: HYDRATION_TIMEOUT })
  const box = await frame.boundingBox()
  assert.ok(box, "the picture has no box")
  await frame.click({ position: { x: box.width * fx, y: box.height * fy }, modifiers })
}

When("I press the page's button through pane {int}", async function (this: OlaiWorld, index: number) {
  await pressAt(this, index, 0.25, 0.15)
})

When("I type {string} into the page's box through pane {int}", async function (this: OlaiWorld, text: string, index: number) {
  await pressAt(this, index, 0.25, 0.5)
  await pageIn(this, index).locator(`${id(TESTID.browserViewer)}${attr("data-keys", "page")}`).waitFor({ state: "attached", timeout: POLL_TIMEOUT })
  await this.page.keyboard.type(text, { delay: 20 })
})

When("I paste {string} into pane {int}", async function (this: OlaiWorld, text: string, index: number) {
  await pageIn(this, index).locator(id(TESTID.browserViewer)).evaluate((viewer, words) => {
    const data = new DataTransfer()
    data.setData("text/plain", words)
    viewer.dispatchEvent(new ClipboardEvent("paste", { clipboardData: data, bubbles: true, cancelable: true }))
  }, text)
})

When("I press Escape in the browser pane", async function (this: OlaiWorld) {
  await this.page.keyboard.press("Escape")
})

Then("keys in pane {int} go to the {word}", async function (this: OlaiWorld, index: number, where: string) {
  const want = where === "page" ? "page" : "app"
  await pageIn(this, index).locator(`${id(TESTID.browserViewer)}${attr("data-keys", want)}`).waitFor({ state: "attached", timeout: POLL_TIMEOUT })
})

When("I open a new browser tab from the pane", async function (this: OlaiWorld) {
  await this.press(pageIn(this, 0).locator(id(TESTID.browserNewTab)))
})

When("I close the browser tab titled {string}", async function (this: OlaiWorld, title: string) {
  await this.press(pageIn(this, 0).locator(`${id(TESTID.browserTab)}${attr("data-title", title)} ${id(TESTID.browserTabClose)}`))
})

When("I Alt-press the browser tab titled {string} in pane {int}", async function (this: OlaiWorld, title: string, index: number) {
  await pageIn(this, index).locator(`${id(TESTID.browserTab)}${attr("data-title", title)} a`).click({ modifiers: ["Alt"] })
})

const pids = new WeakMap<OlaiWorld, number>()
const pidShown = async (world: OlaiWorld): Promise<number> => {
  const page = pageIn(world, 0)
  await page.locator(`xpath=self::*[@data-pid]`).waitFor({ state: "attached", timeout: HYDRATION_TIMEOUT })
  return Number(await page.getAttribute("data-pid"))
}
const alive = (pid: number): boolean => {
  try { process.kill(pid, 0); return true } catch { return false }
}

When("I remember the browser's process", async function (this: OlaiWorld) {
  pids.set(this, await pidShown(this))
})

Then("the remembered browser process is {word}", async function (this: OlaiWorld, state: string) {
  const pid = pids.get(this)
  assert.ok(pid !== undefined, "remember the browser's process first")
  await this.waitUntil(async () => alive(pid) === (state === "running"), `browser process ${pid} to be ${state}`, HYDRATION_TIMEOUT)
})

Then("the browser runs as a different process", async function (this: OlaiWorld) {
  const before = pids.get(this)
  const now = await pidShown(this)
  assert.notEqual(now, before)
  assert.ok(alive(now))
})

When("I forget the browser's sign-ins", async function (this: OlaiWorld) {
  await this.press(pageIn(this, 0).locator(id(TESTID.browserForget)))
  await this.press(pageIn(this, 0).locator(id(TESTID.browserForgetConfirm)))
})

Then("the chat's browser chip links to the browser pane", async function (this: OlaiWorld) {
  const chip = this.chatLine().getByTestId(CHAT.chatServer).and(this.page.locator(attr("data-server", "browser")))
  await chip.waitFor({ state: "attached", timeout: HYDRATION_TIMEOUT })
  assert.equal(await chip.getAttribute("data-at"), "/browser")
  assert.equal(await chip.locator("a").getAttribute("href"), "/browser")
})

When("I press the chat's browser chip", async function (this: OlaiWorld) {
  await this.press(this.chatLine().getByTestId(CHAT.chatServer).and(this.page.locator(attr("data-server", "browser"))).locator("a"))
})

When("I ask the agent to open the site's {string} page with its browser tools", async function (this: OlaiWorld, page: string) {
  const input = this.chat(id(CHAT.chatInput))
  await input.waitFor({ state: "visible", timeout: POLL_TIMEOUT })
  await input.fill(`external browser browser_navigate ${JSON.stringify({ url: `${siteOf(this)}/${page}` })}`)
  await this.chat(id(CHAT.chatSend)).click()
})

When("I ask the agent to close its browser", async function (this: OlaiWorld) {
  const input = this.chat(id(CHAT.chatInput))
  await input.waitFor({ state: "visible", timeout: POLL_TIMEOUT })
  await input.fill("external browser browser_close {}")
  await this.chat(id(CHAT.chatSend)).click()
})

Then("the address is a browser tab's own", async function (this: OlaiWorld) {
  await this.waitUntil(async () => /^\/browser\/[\w-]+$/.test(this.place()), "the address to name one browser tab", HYDRATION_TIMEOUT)
})
