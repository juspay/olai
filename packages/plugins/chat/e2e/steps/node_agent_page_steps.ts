import { readFileSync } from "node:fs";
import { join } from "node:path";
import assert from "node:assert/strict";
import { Given, Then, When } from "@olai/tests/harness/runner.ts";
import { PLUGIN_TESTID } from "@olai/tests/harness/testids.ts";
import { selector } from "@olai/web/testlib";
import {
  attr,
  CHAT_INPUT,
  CHAT_PANEL,
  PROP,
  POLL_TIMEOUT,
  HYDRATION_TIMEOUT,
  APP_HEADER,
  ZOOM_TITLE,
} from "@olai/tests/harness/world.ts";
import {
  CHAT_PREVIEW,
  CHAT_ROSTER,
  CHAT_SEND,
  CHAT_TRANSCRIPT,
  CHAT_WATCHING,
} from "../selectors.ts";
import type { OlaiWorld } from "@olai/tests/harness/world.ts";

const plain = selector(PLUGIN_TESTID.agentPlainComposer);
const input = selector(PLUGIN_TESTID.agentPlainInput);
const send = selector(PLUGIN_TESTID.agentPlainSend);
const head = selector(PLUGIN_TESTID.agentPageHead);
const foot = selector(PLUGIN_TESTID.agentPageFoot);
const PINNED_TITLE = selector(PLUGIN_TESTID.zoomPinnedTitle);
/** The pinned name is always laid out on a phone; the head painting over it is
 *  what hides it, so "shown" is a question about what a finger would reach. */
const pinnedShows = async (world: OlaiWorld) =>
  await world.topmostTestidOver(world.page.locator(PINNED_TITLE), "the pinned node name") === PLUGIN_TESTID.zoomPinnedTitle;

When("I follow the agent's open-page link", async function(this: OlaiWorld) {
  await this.chatRoot().getByRole("link", { name: "Open the page ›" }).click();
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
  assert.equal(await this.page.getByRole("link", { name: "Open the page ›" }).count(), 0);
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
  await this.page.locator(send).filter({ hasText: "Starting…" }).waitFor({ state: "visible", timeout: POLL_TIMEOUT });
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
Then("the page title has the phone's whole line", async function(this: OlaiWorld) {
  const title = this.page.locator(ZOOM_TITLE);
  // A page follows its newest line, so the head may be scrolled away already.
  await title.scrollIntoViewIfNeeded();
  const standing = this.page.locator(`${selector(PLUGIN_TESTID.agentStanding)}${attr("data-agent", this.nodeId(this.activeAgent!))}`).first();
  const [own, row] = await title.evaluate(el => [el.getBoundingClientRect().width, el.parentElement!.getBoundingClientRect().width]);
  assert.ok(own! >= row! - 1, `the title is squeezed beside its asides: ${own} of ${row}`);
  const heading = await this.box(title, "the page title");
  const aside = await this.box(standing, "the agent's standing");
  assert.ok(aside.y >= heading.y + heading.height - 1, "the standing shares the title's line");
  assert.equal(await pinnedShows(this), false, "the pinned name shows over the page head");
});
Then("the node's name is pinned on one line under the chrome", async function(this: OlaiWorld) {
  const pinned = this.page.locator(PINNED_TITLE);
  assert.ok(await pinnedShows(this), "the pinned name is covered");
  assert.equal((await pinned.innerText()).trim(), (await this.page.locator(ZOOM_TITLE).innerText()).trim());
  const box = await this.box(pinned, "the pinned node name");
  const bar = await this.box(this.page.locator(APP_HEADER), "the app header");
  assert.ok(Math.abs(box.y - (bar.y + bar.height)) <= 1, `the pinned name is at ${box.y}, not under the header`);
  const oneLine = await pinned.evaluate(el => el.scrollHeight <= el.clientHeight + 1 && getComputedStyle(el).whiteSpace === "nowrap");
  assert.ok(oneLine, "the pinned name wraps");
});
Then("the page head has scrolled away and the transcript has most of the screen", async function(this: OlaiWorld) {
  const head = await this.box(this.page.locator(ZOOM_TITLE), "the page title");
  assert.ok(head.y + head.height <= 0, `the page head is still on screen at ${head.y}`);
  const composer = await this.box(this.chat(CHAT_INPUT), "the composer");
  const transcript = await this.box(this.chat(CHAT_TRANSCRIPT), "the transcript");
  const { height } = this.viewport();
  const below = await this.box(this.page.locator(PINNED_TITLE), "the pinned node name");
  const reading = Math.min(composer.y, transcript.y + transcript.height) - Math.max(below.y + below.height, transcript.y);
  assert.ok(reading >= height / 2, `the transcript reads through ${reading}px of a ${height}px screen: ${JSON.stringify({ below, transcript, composer })}`);
});
Then("the page's standing strips are on screen in its pinned head", async function(this: OlaiWorld) {
  const bar = await this.box(this.page.locator(APP_HEADER), "the app header");
  const composer = await this.box(this.chat(CHAT_INPUT), "the composer");
  for (const [strip, name] of [[CHAT_ROSTER, "the tools strip"], [CHAT_WATCHING, "the still-running strip"]] as const) {
    assert.equal(await this.page.locator(`${head} ${strip}`).count(), 1, `${name} is not in the page head`);
    assert.equal(await this.page.locator(`${foot} ${strip}`).count(), 0, `${name} is drawn in the scroll as well`);
    const box = await this.box(this.page.locator(`${head} ${strip}`), name);
    assert.ok(box.y >= bar.y + bar.height - 1 && box.y + box.height <= composer.y,
      `${name} is not on screen between the bar and the composer: ${JSON.stringify({ box, bar, composer })}`);
  }
});
Then("the agent's work is on screen under the pinned head", async function(this: OlaiWorld) {
  await this.waitUntil(async () => {
    const shelf = await this.chat(CHAT_PREVIEW).boundingBox();
    const pinned = await this.page.locator(head).boundingBox();
    return shelf !== null && pinned !== null && shelf.y >= pinned.y + pinned.height - 1 && shelf.y < this.viewport().height / 2;
  }, "the shelf to come up under the pinned head", POLL_TIMEOUT);
});
Then("the plain node composer has no available engine", async function(this: OlaiWorld) {
  await this.page.locator(plain).locator(selector(PLUGIN_TESTID.chatNoAgent)).waitFor({ state: "visible", timeout: POLL_TIMEOUT });
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
  assert.equal((await fresh.innerText()).trim(), "Fresh start");
  assert.ok((await fresh.getAttribute("title"))?.includes("keeping memory in"));
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

When("I resize the split window to {int} by {int}", async function(this: OlaiWorld, width: number, height: number) {
  await this.page.setViewportSize({ width, height })
})

Then("the split workspace stays within the window", async function(this: OlaiWorld) {
  const geometry = await this.page.evaluate(() => {
    window.scrollTo(0, document.documentElement.scrollHeight)
    return { top: window.scrollY, height: document.documentElement.scrollHeight, viewport: window.innerHeight }
  })
  assert.equal(geometry.top, 0, JSON.stringify(geometry))
  assert.ok(geometry.height <= geometry.viewport + 1, JSON.stringify(geometry))
  for (const index of [0, 1]) {
    const box = await this.pane(index).evaluate(root => {
      let host = root.parentElement
      while (host && !/auto|scroll/.test(getComputedStyle(host).overflowY)) host = host.parentElement
      const rect = host?.getBoundingClientRect()
      return rect && { top: rect.top, bottom: rect.bottom }
    })
    assert.ok(box && box.top >= 0 && Math.abs(box.bottom - geometry.viewport) <= 1,
      `pane ${index} left empty space beneath it: ${JSON.stringify(box)}`)
  }
})
