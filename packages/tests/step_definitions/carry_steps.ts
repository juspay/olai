import { When, Then } from "@cucumber/cucumber";
import type { OlaiWorld } from "../support/world.ts";
import { CHAT_DIFF, NODE_TITLE, attr, CHAT_GRIP, CHAT_INPUT, CHAT_ENTRY, CHAT_DROP, POLL_TIMEOUT } from "../support/world.ts";
import { carryPointer, titleOf, pressBullet } from "../support/dragging.ts";

When("I carry row {string} over the conversation", async function(this: OlaiWorld, id: string) {
  const box = await this.box(this.chat(CHAT_INPUT), "composer");
  await pressBullet(this, this.everywhere(), id);
  await this.page.mouse.move(box.x + box.width / 2, box.y + box.height / 2, { steps: 12 });
  await this.chat(CHAT_DROP).waitFor({ state: "visible", timeout: POLL_TIMEOUT });
});
When("I drop row {string} into the conversation", async function(this: OlaiWorld, id: string) {
  const box = await this.box(this.chat(CHAT_INPUT), "composer");
  await pressBullet(this, this.everywhere(), id);
  await this.page.mouse.move(box.x + box.width / 2, box.y + box.height / 2, { steps: 12 });
  await this.chat(CHAT_DROP).waitFor({ state: "visible", timeout: POLL_TIMEOUT });
  await this.page.mouse.up();
});
When("I release the carry", async function(this: OlaiWorld) { await this.page.mouse.up(); });
When("I cancel the carry", async function(this: OlaiWorld) { await this.page.keyboard.press("Escape"); await this.page.mouse.up(); });
Then("the conversation offers {string}", async function(this: OlaiWorld, sentence: string) {
  await this.waitUntil(async () => (await this.chat(CHAT_DROP).textContent())?.trim() === sentence, sentence);
});
Then("no conversation is lit for a carry", async function(this: OlaiWorld) {
  await this.page.locator(`${CHAT_DROP}[data-carrying]`).waitFor({ state: "hidden", timeout: POLL_TIMEOUT });
});
When("I quote the last {string} row into the conversation", async function(this: OlaiWorld, kind: string) {
  const entry = this.chat(`${CHAT_ENTRY}${attr("data-kind", kind)}`).last();
  const grip = entry.locator("..").locator(CHAT_GRIP).first();
  await entry.hover();
  const source = await this.box(grip, "transcript grip"), target = await this.box(this.chat(CHAT_INPUT), "composer");
  await carryPointer(this, { x: source.x + source.width / 2, y: source.y + source.height / 2 }, { x: target.x + target.width / 2, y: target.y + target.height / 2 });
  await this.chat(CHAT_DROP).waitFor({ state: "visible", timeout: POLL_TIMEOUT });
  await this.page.mouse.up();
});
When("I drop sidebar file {string} into the conversation", async function(this: OlaiWorld, path: string) {
  const source = await this.box(this.outlineLink(path), "file row");
  const target = await this.box(this.chat(CHAT_INPUT), "composer");
  await carryPointer(this, { x: source.x + source.width / 2, y: source.y + source.height / 2 }, { x: target.x + target.width / 2, y: target.y + target.height / 2 });
  await this.chat(CHAT_DROP).waitFor({ state: "visible", timeout: POLL_TIMEOUT });
  await this.page.mouse.up();
});
Then("the composer contains exactly:", async function(this: OlaiWorld, text: string) {
  await this.waitUntil(async () => (await this.chat(CHAT_INPUT).inputValue()).trimEnd() === text, "carried text in composer");
});
When("I drag the held finger into the conversation", async function(this: OlaiWorld) {
  const box = await this.box(this.chat(CHAT_INPUT), "composer");
  await this.dragFinger({ x: box.x + box.width / 2, y: box.y + box.height / 2 });
  await this.chat(CHAT_DROP).waitFor({ state: "visible", timeout: POLL_TIMEOUT });
});
When("I hold the last {string} transcript row", async function(this: OlaiWorld, kind: string) {
  const row = this.chat(`${CHAT_ENTRY}${attr("data-kind", kind)}`).last();
  await row.evaluate(element => element.scrollIntoView({ block: "center" }));
  await this.waitForFrame();
  await this.holdDown(row);
});
When("I hold sidebar file {string}", async function(this: OlaiWorld, path: string) {
  await this.outlineLink(path).scrollIntoViewIfNeeded();
  await this.holdDown(this.outlineLink(path));
});
When("I drop the last message above outline row {string}", async function(this: OlaiWorld, id: string) {
  const entry = this.chat(`${CHAT_ENTRY}${attr("data-kind", "user")}`).last();
  await entry.hover();
  const grip = entry.locator("..").locator(CHAT_GRIP).first();
  const source = await this.box(grip, "grip"), target = await this.box(this.nodeTitle(id), "outline row");
  await carryPointer(this, { x: source.x + source.width / 2, y: source.y + source.height / 2 }, { x: target.x + 4, y: target.y - 2 });
  await this.page.mouse.up();
});
Then("the outline contains {string}", async function(this: OlaiWorld, title: string) {
  await this.page.locator(NODE_TITLE).filter({ hasText: title }).first().waitFor({ state: "visible", timeout: POLL_TIMEOUT });
});
Then("the outline does not contain {string}", async function(this: OlaiWorld, title: string) {
  await this.page.locator(NODE_TITLE).filter({ hasText: title }).waitFor({ state: "hidden", timeout: POLL_TIMEOUT });
});
When("I carry the last {string} row over the conversation", async function(this: OlaiWorld, kind: string) {
  const entry = this.chat(`${CHAT_ENTRY}${attr("data-kind", kind)}`).last();
  await entry.hover();
  const source = await this.box(entry.locator("..").locator(CHAT_GRIP).first(), "grip"), target = await this.box(this.chat(CHAT_INPUT), "composer");
  await carryPointer(this, { x: source.x + source.width / 2, y: source.y + source.height / 2 }, { x: target.x + target.width / 2, y: target.y + target.height / 2 });
  await this.chat(CHAT_DROP).waitFor({ state: "visible", timeout: POLL_TIMEOUT });
});
When("I press the last transcript grip without travelling", async function(this: OlaiWorld) {
  const entry = this.chat(CHAT_ENTRY).last();
  await entry.hover();
  await entry.locator("..").locator(CHAT_GRIP).first().click();
});
When("I flick the last transcript row", async function(this: OlaiWorld) { await this.flick(this.chat(CHAT_ENTRY).last()); });
When("I carry the row away from the conversation above {string}", async function(this: OlaiWorld, id: string) {
  const target = await this.box(this.nodeTitle(id), "outline row");
  await this.page.mouse.move(target.x + 4, target.y - 2, { steps: 12 });
});
When("I drop row {string} from pane {int} into the conversation", async function(this: OlaiWorld, id: string, pane: number) {
  const target = await this.box(this.chat(CHAT_INPUT), "composer");
  await pressBullet(this, this.pane(pane), id);
  await this.page.mouse.move(target.x + target.width / 2, target.y + target.height / 2, { steps: 12 });
  await this.chat(CHAT_DROP).waitFor({ state: "visible", timeout: POLL_TIMEOUT });
  await this.page.mouse.up();
});
When("I quote the answer from node {string} into this conversation", async function(this: OlaiWorld, node: string) {
  const destination = this.activeAgent;
  this.activeAgent = node;
  const entry = this.chat(`${CHAT_ENTRY}${attr("data-kind", "agent")}`).last();
  this.activeAgent = destination;
  await entry.hover();
  const source = await this.box(entry.locator("..").locator(CHAT_GRIP).first(), "source answer grip"), target = await this.box(this.chat(CHAT_INPUT), "destination composer");
  await carryPointer(this, { x: source.x + source.width / 2, y: source.y + source.height / 2 }, { x: target.x + target.width / 2, y: target.y + target.height / 2 });
  await this.chat(CHAT_DROP).waitFor({ state: "visible", timeout: POLL_TIMEOUT });
  await this.page.mouse.up();
});
Then("the quote contains {string}", async function(this: OlaiWorld, words: string) {
  await this.waitUntil(async () => (await this.chat(CHAT_INPUT).inputValue()).includes(words), "quoted source words");
});
When("I quote the last diff into the conversation", async function(this: OlaiWorld) {
  const block = this.chat(CHAT_DIFF).last();
  await block.hover();
  const source = await this.box(block.locator(CHAT_GRIP), "diff grip"), target = await this.box(this.chat(CHAT_INPUT), "composer");
  await carryPointer(this, { x: source.x + source.width / 2, y: source.y + source.height / 2 }, { x: target.x + target.width / 2, y: target.y + target.height / 2 });
  await this.chat(CHAT_DROP).waitFor({ state: "visible", timeout: POLL_TIMEOUT });
  await this.page.mouse.up();
});
Then("the streaming answer has no grip", async function(this: OlaiWorld) {
  const row = this.chat(`${CHAT_ENTRY}${attr("data-streaming", "true")}`).first();
  await row.waitFor({ state: "visible", timeout: POLL_TIMEOUT });
  await row.locator("..").locator(CHAT_GRIP).waitFor({ state: "detached", timeout: POLL_TIMEOUT });
});
When("I carry sidebar file {string} over the conversation", async function(this: OlaiWorld, path: string) {
  const source = await this.box(this.outlineLink(path), "file row"), target = await this.box(this.chat(CHAT_INPUT), "composer");
  await carryPointer(this, { x: source.x + source.width / 2, y: source.y + source.height / 2 }, { x: target.x + target.width / 2, y: target.y + target.height / 2 });
  await this.chat(CHAT_DROP).waitFor({ state: "visible", timeout: POLL_TIMEOUT });
});
When("I send these words to the agent:", async function(this: OlaiWorld, text: string) {
  await this.chat(CHAT_INPUT).fill(text);
  await this.chat(CHAT_INPUT).press("Enter");
});
Then("the carried node has the note {string}", async function(this: OlaiWorld, note: string) {
  await this.page.getByText(note, { exact: true }).first().waitFor({ state: "visible", timeout: POLL_TIMEOUT });
});
When("I drop the message from pane {int} above row {string} in pane {int}", async function(this: OlaiWorld, sourcePane: number, id: string, targetPane: number) {
  const entry = this.pane(sourcePane).locator(`${CHAT_ENTRY}${attr("data-kind", "user")}`).last();
  await entry.hover();
  const source = await this.box(entry.locator("..").locator(CHAT_GRIP).first(), "grip"), target = await this.box(titleOf(this.pane(targetPane), id), "outline gap");
  await carryPointer(this, { x: source.x + source.width / 2, y: source.y + source.height / 2 }, { x: target.x + 4, y: target.y - 2 });
  await this.page.mouse.up();
});
When("I quote the message from pane {int} into pane {int}", async function(this: OlaiWorld, sourcePane: number, targetPane: number) {
  const entry = this.pane(sourcePane).locator(`${CHAT_ENTRY}${attr("data-kind", "user")}`).last();
  await entry.hover();
  const source = await this.box(entry.locator("..").locator(CHAT_GRIP).first(), "grip"), target = await this.box(this.pane(targetPane).locator(CHAT_INPUT), "composer");
  await carryPointer(this, { x: source.x + source.width / 2, y: source.y + source.height / 2 }, { x: target.x + target.width / 2, y: target.y + target.height / 2 });
  await this.pane(targetPane).locator(CHAT_DROP).waitFor({ state: "visible", timeout: POLL_TIMEOUT });
  await this.page.mouse.up();
  await this.waitUntil(async () => this.pane(targetPane).locator(CHAT_INPUT).evaluate(element => element === document.activeElement), "the receiving composer's focus");
});
