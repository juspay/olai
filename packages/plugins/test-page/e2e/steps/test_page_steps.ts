/**
 * The scenario's hand on the self-drawn page fixture (`../../src/browser.tsx`):
 * read which word a pane's fixture page shows, and press its links with the
 * gestures navigation's link listener reads.
 */
import * as assert from "node:assert";
import { Then, When } from "@olai/tests/harness/runner.ts";
import { attr } from "@olai/tests/harness/selectors.ts";
import { POLL_TIMEOUT } from "@olai/tests/harness/world.ts";
import type { OlaiWorld } from "@olai/tests/harness/world.ts";

const PAGE = 'section[aria-label="Fixture page"]';
const paneAt = (world: OlaiWorld, index: number) =>
  world.frontLane().locator(`[data-testid="pane"]${attr("data-pane", String(index))}`);

Then("pane {int} draws the fixture page for {string}", async function (this: OlaiWorld, index: number, word: string) {
  await paneAt(this, index).locator(`${PAGE}${attr("data-word", word)}`)
    .waitFor({ state: "visible", timeout: POLL_TIMEOUT });
  assert.strictEqual(
    await paneAt(this, index).getByLabel("Fixture word").innerText(),
    word,
  );
});

Then("no fixture page is drawn", async function (this: OlaiWorld) {
  await this.waitUntil(
    async () => (await this.page.locator(PAGE).count()) === 0,
    "every fixture page to leave",
  );
});

When(
  "in pane {int} I press the fixture link {string} with {string}",
  async function (this: OlaiWorld, index: number, label: string, gesture: string) {
    const anchor = paneAt(this, index).getByRole("link", { name: label, exact: true });
    await anchor.waitFor({ state: "visible", timeout: POLL_TIMEOUT });
    if (gesture === "Enter") {
      await anchor.focus();
      await anchor.press("Enter");
      return;
    }
    assert.ok(["click", "Alt", "Alt-Shift"].includes(gesture), `unknown gesture ${gesture}`);
    await anchor.click({ modifiers: gesture === "Alt" ? ["Alt"] : gesture === "Alt-Shift" ? ["Alt", "Shift"] : [] });
  },
);

const filterIn = (world: OlaiWorld, index: number) => paneAt(world, index).getByLabel("Fixture filter");

When("I type {string} into the fixture filter in pane {int}", async function (this: OlaiWorld, text: string, index: number) {
  const box = filterIn(this, index);
  await box.waitFor({ state: "visible", timeout: POLL_TIMEOUT });
  await box.click();
  // A key at a time: each keystroke narrows the address, and a face remounted
  // by one would lose the caret before the next.
  await box.pressSequentially(text);
});

When("I clear the fixture filter in pane {int}", async function (this: OlaiWorld, index: number) {
  const box = filterIn(this, index);
  await box.click();
  await box.press("ControlOrMeta+a");
  await box.press("Backspace");
});

Then("pane {int}'s fixture page is narrowed by {string}", async function (this: OlaiWorld, index: number, filter: string) {
  const shown = paneAt(this, index).getByLabel("Fixture narrowing");
  await this.waitUntil(
    async () => (await shown.textContent()) === filter && (await filterIn(this, index).inputValue()) === filter,
    `pane ${index}'s fixture page to be narrowed by ${JSON.stringify(filter)}`,
  );
});

Then("the fixture filter in pane {int} has the caret", async function (this: OlaiWorld, index: number) {
  assert.ok(await filterIn(this, index).evaluate((box) => box === document.activeElement), "the fixture filter lost the caret");
});

/** A DOM-identity probe on one pane's page element: a page that was torn
 *  down and drawn again is a new element, without the tag. */
When("I tag the page drawn in pane {int}", async function (this: OlaiWorld, index: number) {
  await paneAt(this, index).first().evaluate((page) => { (page as HTMLElement & { olaiTagged?: true }).olaiTagged = true; });
});

Then("pane {int} still draws the page it was tagged on", async function (this: OlaiWorld, index: number) {
  assert.ok(
    await paneAt(this, index).first().evaluate((page) => (page as HTMLElement & { olaiTagged?: true }).olaiTagged === true),
    `pane ${index}'s page was drawn again`,
  );
});
