import * as assert from "node:assert";
import { mkdirSync, readdirSync, rmSync } from "node:fs";
import { join } from "node:path";
import { Given, Then, When } from "@cucumber/cucumber";

import { CONFIGURATION_FILE } from "@olai/plugin-api/configuration";

import { emptyPage, HYDRATION_TIMEOUT, oneLine, ROOT } from "../support/world.ts";
import type { OlaiWorld } from "../support/world.ts";

When("I open the app", async function (this: OlaiWorld) {
  await this.open("/");
  await this.page
    .locator(ROOT)
    .waitFor({ state: "attached", timeout: HYDRATION_TIMEOUT });
});

Then(
  "I save a screenshot as {string}",
  async function (this: OlaiWorld, name: string) {
    const evidence = process.env.OLAI_E2E_EVIDENCE
    const attempt = process.env.OLAI_E2E_ATTEMPT
    const dir = process.env.OLAI_SHOTS ?? (evidence && attempt ? join(evidence, attempt, "screenshots") : undefined)
    if (dir === undefined || dir === "") return
    mkdirSync(dir, { recursive: true })
    // Full-page capture must start at the top, or Chromium places fixed chrome
    // at the old viewport offset in the stitched image.
    await this.page.evaluate(() => window.scrollTo({ top: 0, behavior: "instant" }))
    await this.waitForFrame()
    await this.page.screenshot({ path: join(dir, name), fullPage: true })
  },
)

Then("there should be no page errors", function (this: OlaiWorld) {
  const errors = this.pageErrors();
  assert.deepStrictEqual(
    errors,
    [],
    `the page reported ${errors.length} error(s):\n  ${errors.join("\n  ")}`,
  );
});

Then("the browser mount has no rendered application", async function (this: OlaiWorld) {
  await this.page.waitForFunction((selector) => {
    const mount = document.querySelector(selector);
    return mount !== null && mount.childElementCount === 0;
  }, ROOT, { timeout: HYDRATION_TIMEOUT });
});

Given("I mark the page", async function (this: OlaiWorld) {
  await this.markPage();
});

Given("I mark the wire", function (this: OlaiWorld) {
  this.markWire();
});

Then("nothing overflows the pane", async function (this: OlaiWorld) {
  await this.page.locator(ROOT).waitFor({ state: "attached", timeout: HYDRATION_TIMEOUT });
  const panned = await this.page.evaluate(() =>
    [...document.querySelectorAll("main, aside")]
      .filter((pane) => pane.scrollWidth > pane.clientWidth)
      .map((pane) => `${pane.tagName.toLowerCase()}: ${pane.scrollWidth}>${pane.clientWidth}`)
  );
  assert.deepStrictEqual(panned, [], "these panes have to be panned sideways to be read");
});

When("I reload the page", async function (this: OlaiWorld) {
  await this.open(this.address());
});

Then("the page has not reloaded", async function (this: OlaiWorld) {
  assert.ok(
    await this.pageStillMarked(),
    "the marker planted on `window` is gone, so the document was replaced — " +
      "something navigated when it should have re-rendered in place",
  );
});


const emptyLines = async (world: OlaiWorld, line: string): Promise<string[]> => {
  const { said, lines } = emptyPage(world.page, line);
  await said.waitFor({ state: "visible", timeout: HYDRATION_TIMEOUT });
  return (await lines.allInnerTexts()).map(oneLine);
};

Then(
  "the empty page says {string} over {string}",
  async function (this: OlaiWorld, line: string, detail: string) {
    const lines = await emptyLines(this, line);
    assert.deepStrictEqual(lines, [line, detail], `the empty page reads ${JSON.stringify(lines)}`);
  },
);

Then("the empty page says {string} and nothing more", async function (this: OlaiWorld, line: string) {
  const lines = await emptyLines(this, line);
  assert.deepStrictEqual(lines, [line], `the empty page reads ${JSON.stringify(lines)}`);
});

Then(
  "the empty page {string} offers {string}",
  async function (this: OlaiWorld, line: string, action: string) {
    const { said, block } = emptyPage(this.page, line);
    await said.waitFor({ state: "visible", timeout: HYDRATION_TIMEOUT });
    const buttons = (await block.locator("button, a[href]").allInnerTexts()).map(oneLine);
    assert.deepStrictEqual(buttons, [action], `the empty page offers ${JSON.stringify(buttons)}`);
  },
);

Then("the empty page {string} offers nothing to press", async function (this: OlaiWorld, line: string) {
  const { said, block } = emptyPage(this.page, line);
  await said.waitFor({ state: "visible", timeout: HYDRATION_TIMEOUT });
  assert.equal(await block.getByRole("button").count(), 0, "an empty page with nothing to do offers a button");
});

When(
  "I press {string} on the empty page {string}",
  async function (this: OlaiWorld, action: string, line: string) {
    const { said, block } = emptyPage(this.page, line);
    await said.waitFor({ state: "visible", timeout: HYDRATION_TIMEOUT });
    await this.press(block.getByRole("button", { name: action, exact: true }).or(block.getByRole("link", { name: action, exact: true })));
  },
);

Given("the served directory holds no file at all", function (this: OlaiWorld) {
  rmSync(join(this.scratch(), CONFIGURATION_FILE), { force: true });
  const left = readdirSync(this.scratch(), { recursive: true, withFileTypes: true })
    .filter((one) => one.isFile() && !one.name.startsWith("."));
  assert.deepStrictEqual(left.map((one) => one.name), [], "the served directory still holds files");
});

When("I leave the app", async function (this: OlaiWorld) {
  await this.page.goto("about:blank");
});
