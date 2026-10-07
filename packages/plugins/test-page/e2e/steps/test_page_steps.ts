/**
 * The scenario's hand on the self-drawn page fixture (`../../src/browser.tsx`):
 * read which word a pane's fixture page shows, and press its links with the
 * gestures navigation's link listener reads.
 */
import * as assert from "node:assert";
import { Then, When } from "@olai/tests/harness/runner.ts";
import { POLL_TIMEOUT } from "@olai/tests/harness/world.ts";
import type { OlaiWorld } from "@olai/tests/harness/world.ts";

const PAGE = 'section[aria-label="Fixture page"]';
const paneAt = (world: OlaiWorld, index: number) =>
  world.frontLane().locator(`[data-testid="pane"][data-pane="${index}"]`);

Then("pane {int} draws the fixture page for {string}", async function (this: OlaiWorld, index: number, word: string) {
  await paneAt(this, index).locator(`${PAGE}[data-word="${word}"]`)
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
