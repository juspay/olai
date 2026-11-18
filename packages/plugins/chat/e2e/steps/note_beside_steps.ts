/**
 * THE PAGE BESIDE A CONVERSATION, AND WHETHER IT MOVED.
 *
 * The complaint this work began with was a chat that pushed the thing it was
 * about around: an answer arriving while somebody was reading took the page
 * with it. A conversation in a PANE is the answer to that, and this is the
 * vocabulary that holds it — where the note stands, remembered, and read back
 * after the chat beside it has grown past its own window.
 *
 * A PANE'S SCROLLPORT IS NOT THE PANE, which is the one piece of markup
 * knowledge here. A column is its own scroll (`olai-plugin-layout`'s
 * `Panes.tsx` puts `overflow-y-auto` on the box the page is drawn in), and the
 * page's own element is a child of it — so "where the note stands" is read off
 * the nearest ancestor that scrolls, found the way the browser finds it rather
 * than by a class name this file would then have to be kept in step with.
 *
 * WHAT THE NOTE SAYS is read off the DOCUMENT alone and not off the pane: the
 * line at the top of a note reports how its chat STANDS, so it says `working`
 * while the agent is answering and `idle` after — a true change, and one a
 * claim about the whole pane's words would trip over.
 */
import assert from "node:assert/strict";
import { Given, Then, When } from "@olai/tests/harness/runner.ts";
import { DOCUMENT_BODY, HYDRATION_TIMEOUT, POLL_TIMEOUT } from "@olai/tests/harness/world.ts";
import type { OlaiWorld } from "@olai/tests/harness/world.ts";

/** How far down a scrolled note is put: past the top, and nowhere near the
 *  bottom, so a page that was snapped to either end is a failure and not a
 *  coincidence. */
const DOWN_PX = 240;

/** How near the bottom counts as following the newest line. The transcript's
 *  own steps use the same slack for the same reason (`./chat_steps.ts`). */
const NEAR = 48;

/**
 * Where a pane's page stands — and, when `to` is a number, put there first.
 *
 * One helper for the reading and the gesture because they are one walk: the
 * scrollport has to be found the same way both times, and two copies of that
 * walk are two answers to "which box scrolls" waiting to disagree. What comes
 * back is the position AND the room it has, which is what makes "it has not
 * moved" a claim about a page that HAD somewhere to move to.
 */
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

/** What a scenario remembered, per scenario: a world is one per scenario, so
 *  nothing here outlives the run that put it there. */
const remembered = new WeakMap<OlaiWorld, { top: number; room: number; words: string }>();

/**
 * A NOTE TALLER THAN ITS PANE, because no fixture in this corpus is: the one
 * thing a scenario about a page NOT moving needs is a page that could have.
 * Numbered lines, so what is read back is a reading of the note and not of a
 * blank.
 */
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

/** THE CHAT DID GROW AND DID SCROLL — the half without which the claim below
 *  is about a page that was never asked to move. The chat's pane is its scroll
 *  (a chat page's transcript is uncapped), so this is the same reading as the
 *  note's, taken of the other column. */
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
