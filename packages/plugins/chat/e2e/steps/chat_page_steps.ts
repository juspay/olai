import assert from "node:assert/strict";
import { Given, Then, When } from "@olai/tests/harness/runner.ts";
import { selector } from "@olai/web/testlib";
import {
  APP_HEADER,
  attr,
  BREADCRUMBS,
  CHAT_PANEL,
  CHAT_SAID,
  HYDRATION_TIMEOUT,
  PANE_TABS,
  POLL_TIMEOUT,
  ZOOM_TITLE,
} from "@olai/tests/harness/world.ts";
import type { Locator } from "@olai/tests/harness/playwright.ts";
import type { OlaiWorld } from "@olai/tests/harness/world.ts";

import { TESTID } from "../../src/testids.ts";
import {
  ASK_INPUT,
  ASK_SEND,
  CHAT_ABOUT,
  CHAT_FILE_MARK,
  CHAT_OPEN_BESIDE,
  CHAT_OPENS,
  CHAT_OPENS_SWITCH,
  CHAT_PAGE,
  CHAT_PAGE_GONE,
  CHAT_PAGE_HEAD,
  CHAT_PAGE_STANDING,
  CHAT_PAGE_TITLE,
  CHAT_PAGE_UNTIED,
  CHAT_PAGE_WHERE,
  CHAT_RETIE,
  CHAT_SEND,
  CHAT_TRANSCRIPT,
} from "../selectors.ts";
import { matterOf } from "./chat_about_steps.ts";

const page = (world: OlaiWorld): Locator => world.frontLane().locator(CHAT_PAGE);

const pageOf = (world: OlaiWorld, item: string): Locator =>
  world.frontLane().locator(`${CHAT_PAGE}${attr("data-item", item)}`);

Then("the page is the agent {string}", async function (this: OlaiWorld, node: string) {
  const id = this.nodeId(node);
  await this.frontLane()
    .locator(`${ZOOM_TITLE}${attr("data-node-id", id)}, ${CHAT_PAGE}${attr("data-item", id)}`)
    .first()
    .waitFor({ state: "visible", timeout: POLL_TIMEOUT });
});

const heads = async (world: OlaiWorld, item: string, kind: string, name: string, where: string): Promise<void> => {
  const here = pageOf(world, item);
  await here.waitFor({ state: "visible", timeout: HYDRATION_TIMEOUT });
  assert.equal(await here.getAttribute("data-kind"), kind, `the chat page of ${item} is not about a ${kind}`);
  await world.waitUntil(async () => (await here.locator(CHAT_PAGE_TITLE).innerText()).trim() === name,
    `the chat page to be titled ${JSON.stringify(name)}`, HYDRATION_TIMEOUT);
  await world.waitUntil(async () => (await here.locator(CHAT_PAGE_WHERE).innerText()).trim() === where,
    `the chat page to say it is at ${JSON.stringify(where)}`, HYDRATION_TIMEOUT);
};

Then("the chat page is about the note {string} named {string}", async function (this: OlaiWorld, note: string, name: string) {
  await heads(this, `/${note}`, "note", name, note);
  assert.equal(await pageOf(this, `/${note}`).locator(CHAT_FILE_MARK).count(), 1, "the chat page wears no file mark");
});

Then("the chat page is about the node {string} named {string} in {string}", async function (this: OlaiWorld, node: string, name: string, file: string) {
  await heads(this, this.nodeId(node), "node", name, file);
});

Then("the chat page shows no breadcrumb", async function (this: OlaiWorld) {
  await page(this).waitFor({ state: "visible", timeout: HYDRATION_TIMEOUT });
  assert.equal(await this.frontLane().locator(BREADCRUMBS).count(), 0, "the chat page drew a breadcrumb");
});

Then("the chat page stands {string}", async function (this: OlaiWorld, standing: string) {
  const mark = page(this).locator(CHAT_PAGE_STANDING);
  await mark.waitFor({ state: "visible", timeout: HYDRATION_TIMEOUT });
  await this.waitUntil(async () => await mark.getAttribute("data-standing") === standing,
    `the chat page to stand ${standing}`, HYDRATION_TIMEOUT);
});

Then("the chat page offers to put the chat to sleep", async function (this: OlaiWorld) {
  await page(this).locator(selector(TESTID.chatSleeping)).waitFor({ state: "visible", timeout: HYDRATION_TIMEOUT });
});

Then("the chat page never offers sleep or tidying", async function (this: OlaiWorld) {
  const here = page(this);
  await here.waitFor({ state: "visible", timeout: HYDRATION_TIMEOUT });
  await here.locator(selector(TESTID.agentPageHead)).waitFor({ state: "visible", timeout: HYDRATION_TIMEOUT });
  assert.equal(await here.locator(selector(TESTID.chatSleeping)).count(), 0, "a note's chat page offered sleep");
  assert.equal(await here.locator(selector(TESTID.chatTidyMemory)).count(), 0, "a note's chat page offered tidying");
  assert.ok(!(await here.innerText()).includes("Memory"), "a note's chat page says Memory");
});

Then("the chat page conversation is ready", async function (this: OlaiWorld) {
  const here = page(this);
  await here.waitFor({ state: "visible", timeout: HYDRATION_TIMEOUT });
  const item = await here.getAttribute("data-item");
  assert.ok(item, "the chat page names no item");
  await here.locator(`${selector(TESTID.agentPageFoot)}${attr("data-agent", item)}`)
    .waitFor({ state: "visible", timeout: HYDRATION_TIMEOUT });
  const panel = here.locator(`${selector(TESTID.agentPageFoot)}${attr("data-agent", item)} ${CHAT_PANEL}`);
  await this.waitUntil(async () => await panel.getAttribute("data-session-id") !== null,
    "the chat page's conversation identity", HYDRATION_TIMEOUT);
});

Then("the chat page offers to chat about {string}", async function (this: OlaiWorld, name: string) {
  const door = page(this).locator(`${CHAT_ABOUT}${attr("data-where", "page")}`);
  await door.waitFor({ state: "visible", timeout: HYDRATION_TIMEOUT });
  assert.equal(await door.locator(ASK_INPUT).getAttribute("placeholder"), `Ask about ${name}…`);
});

Then("the chat page offers no chat box", async function (this: OlaiWorld) {
  await this.waitUntil(async () => await page(this).locator(CHAT_ABOUT).count() === 0,
    "the chat page to stop offering a box", HYDRATION_TIMEOUT);
});

Then("the chat page says the note is gone", async function (this: OlaiWorld) {
  const said = page(this).locator(CHAT_PAGE_GONE);
  await said.waitFor({ state: "visible", timeout: HYDRATION_TIMEOUT });
  assert.ok((await said.innerText()).includes("This note is gone"),
    `the chat page did not say the note is gone: ${JSON.stringify(await said.innerText())}`);
});

Then("the chat page says {string} no longer names this conversation", async function (this: OlaiWorld, name: string) {
  const said = page(this).locator(CHAT_PAGE_UNTIED);
  await said.waitFor({ state: "visible", timeout: HYDRATION_TIMEOUT });
  const words = await said.innerText();
  assert.ok(words.includes(`${name} no longer names this conversation`),
    `the chat page did not say ${JSON.stringify(name)} lost the tie: ${JSON.stringify(words)}`);
  await said.locator(CHAT_RETIE).waitFor({ state: "visible", timeout: HYDRATION_TIMEOUT });
});

When("I press tie it again", async function (this: OlaiWorld) {
  const button = page(this).locator(CHAT_RETIE);
  await button.waitFor({ state: "visible", timeout: HYDRATION_TIMEOUT });
  await this.press(button);
});

When("I close the chat from the chat page", async function (this: OlaiWorld) {
  const close = page(this).locator(selector(TESTID.chatCloseAgent));
  await close.waitFor({ state: "visible", timeout: HYDRATION_TIMEOUT });
  await this.press(close);
});

Then("the chat page never offers to tie it again", async function (this: OlaiWorld) {
  const here = page(this);
  await here.waitFor({ state: "visible", timeout: HYDRATION_TIMEOUT });
  await this.waitUntil(async () => await here.locator(CHAT_RETIE).count() === 0,
    "the chat page to offer no way back", HYDRATION_TIMEOUT);
  assert.equal(await here.locator(CHAT_PAGE_UNTIED).count(), 0, "the chat page drew the untied face");
  const words = await here.innerText();
  assert.ok(!words.includes("no longer names this conversation") && !words.includes("the tie has gone"),
    `the chat page said an outside writer took the tie: ${JSON.stringify(words)}`);
});

When("I ask from the chat page {string}", async function (this: OlaiWorld, text: string) {
  const door = page(this).locator(`${CHAT_ABOUT}${attr("data-where", "page")}`);
  await door.waitFor({ state: "visible", timeout: HYDRATION_TIMEOUT });
  await door.locator(ASK_INPUT).fill(text);
  await door.locator(ASK_SEND).click();
});

Then("the chat page's first message names the note {string}", async function (this: OlaiWorld, note: string) {
  await this.waitUntil(async () => (await page(this).innerText()).includes(`\`${note}\``),
    `the first message to name the note ${note}`, HYDRATION_TIMEOUT);
});

Then("the agent has said nothing yet", async function (this: OlaiWorld) {
  assert.equal(await page(this).locator(CHAT_SAID).count(), 0, "the agent answered something nobody sent");
});

Then("the chat page says it opens {string}", async function (this: OlaiWorld, words: string) {
  const line = page(this).locator(CHAT_OPENS);
  await line.waitFor({ state: "visible", timeout: HYDRATION_TIMEOUT });
  await this.waitUntil(async () => (await line.locator(CHAT_OPENS_SWITCH).innerText()).trim() === words,
    `the switch to read ${JSON.stringify(words)}`, HYDRATION_TIMEOUT);
  assert.equal(await line.getAttribute("data-beside"), String(words !== "alone"));
});

Then("the chat page has no opens switch", async function (this: OlaiWorld) {
  const here = page(this);
  await here.locator(selector(TESTID.agentPageHead)).waitFor({ state: "visible", timeout: HYDRATION_TIMEOUT });
  assert.equal(await here.locator(CHAT_OPENS).count(), 0, "a node's chat page drew an opens switch");
});

When("I press the opens switch", async function (this: OlaiWorld) {
  const control = page(this).locator(CHAT_OPENS_SWITCH);
  await control.waitFor({ state: "visible", timeout: HYDRATION_TIMEOUT });
  await this.press(control);
});

Then("the note {string} says it opens {string}", async function (this: OlaiWorld, note: string, answer: string) {
  await this.waitUntil(async () => matterOf(this, note)["chat-opens"] === answer,
    `${note} to say \`chat-opens: ${answer}\``, POLL_TIMEOUT);
});

When("I press Open beside on the chat page", async function (this: OlaiWorld) {
  const button = page(this).locator(CHAT_OPEN_BESIDE);
  await button.waitFor({ state: "visible", timeout: HYDRATION_TIMEOUT });
  await this.press(button);
});

Then("the chat page offers to open {string} beside", async function (this: OlaiWorld, name: string) {
  const button = page(this).locator(CHAT_OPEN_BESIDE);
  await button.waitFor({ state: "visible", timeout: HYDRATION_TIMEOUT });
  await this.waitUntil(async () => (await button.innerText()).trim() === `Open ${name} beside ›`,
    `the button to offer to open ${name} beside`, HYDRATION_TIMEOUT);
});

Then("the chat page offers to open {string}", async function (this: OlaiWorld, name: string) {
  const button = page(this).locator(CHAT_OPEN_BESIDE);
  await button.waitFor({ state: "visible", timeout: HYDRATION_TIMEOUT });
  await this.waitUntil(async () => (await button.innerText()).trim() === `Open ${name} ›`,
    `the button to offer to open ${name}`, HYDRATION_TIMEOUT);
});

Then("the chat page says the item is shown beside", async function (this: OlaiWorld) {
  const button = page(this).locator(CHAT_OPEN_BESIDE);
  await button.waitFor({ state: "visible", timeout: HYDRATION_TIMEOUT });
  await this.waitUntil(async () => await button.getAttribute("data-beside") === "true"
    && (await button.innerText()).trim() === "Shown beside",
    "the button to read Shown beside", HYDRATION_TIMEOUT);
});

Then("the chat page fills the phone screen", async function (this: OlaiWorld) {
  const here = page(this);
  await here.waitFor({ state: "visible", timeout: HYDRATION_TIMEOUT });
  await here.locator(CHAT_SEND).waitFor({ state: "visible", timeout: HYDRATION_TIMEOUT });
  await here.locator(CHAT_TRANSCRIPT).waitFor({ state: "visible", timeout: HYDRATION_TIMEOUT });
  const { width, height } = this.viewport();
  const seen = await here.evaluate((root, ids) => {
    let host: HTMLElement | null = root as HTMLElement;
    while (host !== null && !/auto|scroll/.test(getComputedStyle(host).overflowY)) host = host.parentElement;
    if (host !== null) host.scrollTop = 0;
    window.scrollTo(0, 0);
    const box = (id: string) => {
      const rect = root.querySelector(id)?.getBoundingClientRect();
      return rect === undefined ? null : { x: rect.x, y: rect.y, width: rect.width, height: rect.height };
    };
    return { head: box(ids.head), body: box(ids.body), composer: box(ids.composer) };
  }, { head: CHAT_PAGE_TITLE, body: CHAT_TRANSCRIPT, composer: CHAT_SEND });
  const said = JSON.stringify({ ...seen, screen: [width, height] });
  const inside = (box: { x: number; y: number; width: number; height: number } | null): boolean => box !== null
    && box.x >= -1 && box.y >= -1 && box.x + box.width <= width + 1 && box.y + box.height <= height + 1;
  assert.ok(inside(seen.head), `the chat page's head is not on the phone's screen: ${said}`);
  assert.ok(inside(seen.body), `the conversation is not on the phone's screen: ${said}`);
  assert.ok(inside(seen.composer), `the composer is not on the phone's screen: ${said}`);
  assert.ok(seen.composer !== null && seen.body !== null
    && seen.composer.y >= seen.body.y && seen.composer.y > height * 0.75,
    `the composer is not at the bottom of the phone's screen: ${said}`);
});

Then("the chat page's head stays in view", async function (this: OlaiWorld) {
  const head = page(this).locator(CHAT_PAGE_HEAD);
  await head.waitFor({ state: "visible", timeout: HYDRATION_TIMEOUT });
  const scrolled = await this.page.evaluate(() => window.scrollY);
  assert.ok(scrolled > 0, "the page is not scrolled, so nothing here is about staying in view");
  const tabs = this.frontLane().locator(PANE_TABS);
  const above = (await tabs.count()) > 0
    ? await tabs.boundingBox()
    : await this.page.locator(APP_HEADER).boundingBox();
  const box = await head.boundingBox();
  assert.ok(above && box && Math.abs(box.y - above.y - above.height) <= 1,
    `the chat page's head scrolled away: ${JSON.stringify({ above, box, scrolled })}`);
});

Then("the conversation gets at least {int}% of the screen", async function (this: OlaiWorld, share: number) {
  const here = page(this);
  await here.waitFor({ state: "visible", timeout: HYDRATION_TIMEOUT });
  const box = here.locator(selector(TESTID.chatInput)).first();
  await box.waitFor({ state: "visible", timeout: HYDRATION_TIMEOUT });
  const { width, height } = this.viewport();
  const bottomOf = async (locator: Locator): Promise<number | null> => {
    if (await locator.count() === 0) return null;
    const box = await locator.first().boundingBox();
    return box === null ? null : box.y + box.height;
  };
  const chrome = Math.max(...[
    await bottomOf(this.page.locator(APP_HEADER)),
    await bottomOf(this.frontLane().locator(PANE_TABS)),
    await bottomOf(here.locator(CHAT_PAGE_HEAD)),
  ].filter((edge): edge is number => edge !== null));
  const typed = await box.boundingBox();
  assert.ok(typed !== null, "the chat page draws no box to measure against");
  const room = Math.min(typed.y, height) - Math.max(chrome, 0);
  const got = Math.round((room / height) * 100);
  const said = JSON.stringify({ chrome: Math.round(chrome), box: Math.round(typed.y), room: Math.round(room), screen: [width, height] });
  assert.ok(got >= share,
    `the conversation gets ${got}% of a ${width}×${height} screen (${Math.round(room)}px), under the ${share}% this asks for: ${said}`);
});

When("I turn the phone on its side", async function (this: OlaiWorld) {
  const { width, height } = this.viewport();
  await this.page.setViewportSize({ width: height, height: width });
  await this.waitForFrame();
});

Given("the vault holds the row {string} titled {string} with no chat", function (this: OlaiWorld, id: string, title: string) {
  this.writeServed(`${id}.olai`, `${JSON.stringify({ id, ord: "a0", title })}\n`);
});
