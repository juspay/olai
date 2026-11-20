import assert from "node:assert/strict";
import { Given, Then, When } from "@olai/tests/harness/runner.ts";
import { DOCUMENT_BODY, HYDRATION_TIMEOUT, POLL_TIMEOUT } from "@olai/tests/harness/world.ts";
import type { OlaiWorld } from "@olai/tests/harness/world.ts";

const DOWN_PX = 240;

const NEAR = 48;

const scrollport = (
  world: OlaiWorld,
  pane: number,
  to: number | null = null,
): Promise<{ top: number; room: number }> =>
  world.pane(pane).evaluate((element, down: number | null) => {
    let host: HTMLElement | null = element.parentElement;
    while (host !== null && !/auto|scroll/.test(getComputedStyle(host).overflowY)) {
      host = host.parentElement;
    }
    if (host === null) throw new Error("the pane is drawn in nothing that scrolls");
    if (down !== null) host.scrollTo({ top: down, behavior: "instant" });
    return { top: host.scrollTop, room: host.scrollHeight - host.clientHeight };
  }, to);

const remembered = new WeakMap<OlaiWorld, { top: number; room: number; words: string }>();

Given("the vault holds a note long enough to scroll {string}", function (this: OlaiWorld, note: string) {
  const lines = Array.from({ length: 120 }, (_, at) => `Paragraph ${at + 1} of the plan, which the cabinets wait on.`);
  this.writeServed(note, `# Plan\n\n${lines.join("\n\n")}\n`);
});

When("I scroll the note beside the chat down", async function (this: OlaiWorld) {
  await this.waitUntil(async () => (await scrollport(this, 0)).room > DOWN_PX,
    "the note to be taller than the pane it is drawn in", HYDRATION_TIMEOUT);
  await scrollport(this, 0, DOWN_PX);
  await this.waitUntil(async () => (await scrollport(this, 0)).top === DOWN_PX,
    "the note to be scrolled down", POLL_TIMEOUT);
});

When("I remember where the note stands", async function (this: OlaiWorld) {
  const at = await scrollport(this, 0);
  remembered.set(this, { ...at, words: await this.pane(0).locator(DOCUMENT_BODY).first().innerText() });
});

Then("the chat beside it has scrolled to its newest line", async function (this: OlaiWorld) {
  await this.waitUntil(async () => {
    const at = await scrollport(this, 1);
    return at.room > 0 && at.room - at.top < NEAR;
  }, "the chat's pane to be following its newest line", HYDRATION_TIMEOUT);
});

Then("the note beside it stands exactly where it was, word for word", async function (this: OlaiWorld) {
  const was = remembered.get(this);
  assert.ok(was, "no scenario remembered where the note stood");
  const now = await scrollport(this, 0);
  assert.strictEqual(
    now.top,
    was.top,
    `the chat beside the note scrolled it from ${was.top} to ${now.top}: a conversation that ` +
      "grows must not take the page somebody is reading with it",
  );
  assert.strictEqual(
    await this.pane(0).locator(DOCUMENT_BODY).first().innerText(),
    was.words,
    "the note's own words changed while its chat grew",
  );
  assert.ok(now.room > DOWN_PX, "the note stopped being taller than its pane, so it could no longer have moved");
});
