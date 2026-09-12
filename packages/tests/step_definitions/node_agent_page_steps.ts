import { readFileSync } from "node:fs";
import { join } from "node:path";
import assert from "node:assert/strict";
import { Given, Then, When } from "@cucumber/cucumber";
import { PLUGIN_TESTID } from "@olai/bundle/testids";
import { selector } from "@olai/web/testlib";
import { attr, CHAT_INPUT, CHAT_SEND, CHAT_PANEL, CHAT_TRANSCRIPT, PROP, POLL_TIMEOUT, HYDRATION_TIMEOUT } from "../support/world.ts";
import type { OlaiWorld } from "../support/world.ts";

const plain = selector(PLUGIN_TESTID.agentPlainComposer);
const input = selector(PLUGIN_TESTID.agentPlainInput);
const send = selector(PLUGIN_TESTID.agentPlainSend);
const head = selector(PLUGIN_TESTID.agentPageHead);
const foot = selector(PLUGIN_TESTID.agentPageFoot);

When("I follow the agent's open-page link", async function(this: OlaiWorld) {
  await this.chatRoot().getByRole("link", { name: "open the page ›" }).click();
});
Given("I open the plain node composer for {string}", async function(this: OlaiWorld, node: string) {
  await this.openNode(node);
  this.activeAgent = node;
  await this.page.locator(plain).waitFor({ state: "visible", timeout: HYDRATION_TIMEOUT });
});
Then("the node page conversation is ready for {string}", async function(this: OlaiWorld, node: string) {
  this.activeAgent = node;
  await this.page.locator(`${head}${attr("data-agent", this.nodeId(node))}`).waitFor({ state: "visible", timeout: HYDRATION_TIMEOUT });
  await this.chat(CHAT_INPUT).waitFor({ state: "visible", timeout: HYDRATION_TIMEOUT });
  await this.waitUntil(async () => await this.chat(CHAT_PANEL).getAttribute("data-session-id") !== null, "the page's conversation identity", HYDRATION_TIMEOUT);
});
Then("the agent page puts its line before properties and memory before conversation", async function(this: OlaiWorld) {
  assert.ok(this.activeAgent);
  const line = await this.box(this.page.locator(head), "the agent line");
  const properties = await this.box(this.node(this.activeAgent).locator(PROP).first(), "the property drawer");
  const memory = await this.box(this.node("hinges"), "the memory row");
  const conversation = await this.box(this.page.locator(foot), "the conversation");
  assert.ok(line.y < properties.y && properties.y < memory.y && memory.y < conversation.y);
  assert.equal(await this.page.getByRole("link", { name: "open the page ›" }).count(), 0);
  assert.equal(await this.chat(CHAT_PANEL).count(), 1);
});
Then("the plain node composer says {string} and {string}", async function(this: OlaiWorld, placeholder: string, notice: string) {
  assert.equal(await this.page.locator(input).getAttribute("placeholder"), placeholder);
  assert.ok((await this.page.locator(plain).innerText()).includes(notice));
});
When("I send {string} from the plain node composer", async function(this: OlaiWorld, text: string) {
  await this.page.locator(input).fill(text);
  await this.page.locator(send).click();
});
Then("the plain node composer is starting", async function(this: OlaiWorld) {
  await this.page.locator(send).filter({ hasText: "starting…" }).waitFor({ state: "visible", timeout: POLL_TIMEOUT });
  assert.equal(await this.page.locator(send).isDisabled(), true);
});
When("I choose {string} in the plain node composer", async function(this: OlaiWorld, engine: string) {
  await this.page.locator(selector(PLUGIN_TESTID.agentPlainEngine)).selectOption(engine);
});
When("I ask for a tall page answer", async function(this: OlaiWorld) {
  await this.chat(CHAT_INPUT).fill(Array.from({ length: 80 }, (_, i) => `page line ${i}`).join("\n\n"));
  await this.chat(CHAT_SEND).click();
});
Then("the page transcript is unbounded and its composer is on screen", async function(this: OlaiWorld) {
  await this.waitUntil(async () => {
    const box = await this.chat(CHAT_TRANSCRIPT).boundingBox();
    const composer = await this.chat(CHAT_INPUT).boundingBox();
    return box !== null && composer !== null && box.height > 384 && composer.y >= 0 && composer.y + composer.height <= this.viewport().height;
  }, "the page to follow its unbounded answer", HYDRATION_TIMEOUT);
  assert.equal(await this.chat(CHAT_TRANSCRIPT).evaluate(el => getComputedStyle(el).maxHeight), "none");
});
Then("the plain node composer has no available engine", async function(this: OlaiWorld) {
  assert.ok((await this.page.locator(plain).innerText()).includes("No agent engine is available."));
  assert.equal(await this.page.locator(send).count(), 0);
});

Then("the page has fresh start above its fold history", async function(this: OlaiWorld) {
  // Compare document order at the top; a pinned head can overlap history
  // that has already scrolled away while following the newest answer.
  await this.page.evaluate(async () => {
    window.scrollTo(0, 0)
    await new Promise<void>(resolve => requestAnimationFrame(() => requestAnimationFrame(() => resolve())))
  })
  const fresh = this.chat(selector(PLUGIN_TESTID.chatFreshSession));
  const history = this.chat(selector(PLUGIN_TESTID.chatSessions));
  assert.equal((await fresh.innerText()).trim(), "fresh start");
  assert.ok((await fresh.getAttribute("title"))?.includes("the transcript becomes history"));
  const top = await this.box(fresh, "fresh start");
  const line = await this.box(history, "the fold history");
  const transcript = await this.box(this.chat(CHAT_TRANSCRIPT), "the transcript");
  assert.ok(top.y < line.y && line.y < transcript.y);
  assert.equal(await this.chat(selector(PLUGIN_TESTID.chatSessionList)).count(), 0);
  assert.ok(!(await history.innerText()).includes("sessions ("));
});


Then("pane {int} has one agent page scroller with pinned head and send", async function(this: OlaiWorld, index: number) {
  const pane = this.pane(index)
  await this.waitUntil(async () => pane.evaluate((root, ids) => {
    let ancestor = root.parentElement
    while (ancestor && !/auto|scroll/.test(getComputedStyle(ancestor).overflowY)) ancestor = ancestor.parentElement
    const scrolling = [ancestor, ...root.querySelectorAll<HTMLElement>("*")].filter((el): el is HTMLElement => el !== null).filter(el =>
      /auto|scroll/.test(getComputedStyle(el).overflowY) && el.scrollHeight > el.clientHeight + 1)
    if (scrolling.length !== 1) return false
    const host = scrolling[0]!
    const viewport = host.getBoundingClientRect()
    const title = root.querySelector(ids.head)?.getBoundingClientRect()
    const send = root.querySelector(ids.send)?.getBoundingClientRect()
    return title !== undefined && send !== undefined && title.top >= viewport.top - 1
      && title.bottom <= viewport.bottom && send.top >= viewport.top && send.bottom <= viewport.bottom + 1
  }, { head, send: CHAT_SEND }), "the pane's single scroll and pinned conversation controls", HYDRATION_TIMEOUT)
})
When("I scroll pane {int} back to its memory", async function(this: OlaiWorld, index: number) {
  await this.pane(index).evaluate(root => {
    let host = root.parentElement
    while (host && !/auto|scroll/.test(getComputedStyle(host).overflowY)) host = host.parentElement
    assertScroll(host ?? undefined)
    function assertScroll(host: HTMLElement | undefined) { if (host === undefined) throw new Error("no pane scroller"); host.scrollTop = 0 }
  })
})
Then("the agent page memory is visible below its pinned head", async function(this: OlaiWorld) {
  const title = await this.page.locator(head).boundingBox()
  const memory = await this.node("hinges").last().boundingBox()
  assert.ok(title && memory && memory.y >= title.y + title.height && memory.y < this.viewport().height)
})


Then("pane {int} stays on its memory while the agent streams", async function(this: OlaiWorld, index: number) {
  const before = await this.chat(CHAT_TRANSCRIPT).innerText()
  await this.waitUntil(async () => (await this.chat(CHAT_TRANSCRIPT).innerText()).length > before.length, "more streamed prose")
  const top = await this.pane(index).evaluate(root => {
    let host = root.parentElement
    while (host && !/auto|scroll/.test(getComputedStyle(host).overflowY)) host = host.parentElement
    return host?.scrollTop
  })
  assert.equal(top, 0, "streaming moved the pane away from memory")
})

Then("pane {int} follows new agent text at the bottom", async function(this: OlaiWorld, index: number) {
  const before = await this.chat(CHAT_TRANSCRIPT).innerText()
  await this.waitUntil(async () => {
    if ((await this.chat(CHAT_TRANSCRIPT).innerText()).length <= before.length) return false
    return this.pane(index).evaluate(root => {
      let host = root.parentElement
      while (host && !/auto|scroll/.test(getComputedStyle(host).overflowY)) host = host.parentElement
      return host !== null && host.scrollHeight - host.scrollTop - host.clientHeight < 2
    })
  }, "new streamed text to remain at the pane bottom")
})

Then("the held agent process has exited", async function(this: OlaiWorld) {
  const pid = Number(readFileSync(join(this.scratch(), ".agent-held-pid"), "utf8"))
  assert.ok(Number.isInteger(pid) && pid > 0)
  await this.waitUntil(async () => {
    try { process.kill(pid, 0); return false }
    catch (error) { if ((error as NodeJS.ErrnoException).code === "ESRCH") return true; throw error }
  }, "the trashed node's working process to exit")
})

Then("the page's agent shelf uses the pane scroll", async function(this: OlaiWorld) {
  const shelf = this.chat(selector(PLUGIN_TESTID.chatPreview))
  assert.equal(await shelf.evaluate(root => [...root.querySelectorAll("*")].some(el =>
    /auto|scroll/.test(getComputedStyle(el).overflowY))), false)
})

When("I scroll pane {int} to the bottom", async function(this: OlaiWorld, index: number) {
  await this.pane(index).evaluate(async root => {
    let host = root.parentElement
    while (host && !/auto|scroll/.test(getComputedStyle(host).overflowY)) host = host.parentElement
    if (host === null) throw new Error("no pane scroller")
    host.scrollTop = host.scrollHeight
    await new Promise<void>(resolve => requestAnimationFrame(() => requestAnimationFrame(() => resolve())))
  })
})
