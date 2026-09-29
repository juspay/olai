/**
 * The steps that belong to no one feature: opening the app, proving nothing
 * blew up in the console, and proving a later assertion ran against the same
 * document as an earlier one.
 */

import * as assert from "node:assert";
import { mkdirSync, readdirSync, rmSync } from "node:fs";
import { join } from "node:path";
import { Given, Then, When } from "@cucumber/cucumber";

import { CONFIGURATION_FILE } from "@olai/plugin-api/configuration";

import { emptyPage, HYDRATION_TIMEOUT, oneLine, ROOT } from "../support/world.ts";
import type { OlaiWorld } from "../support/world.ts";

When("I open the app", async function (this: OlaiWorld) {
  await this.open("/");
  // The mount point is the one thing every shape of the app shares, so this
  // separates "the bundle never ran" from "the app rendered the wrong thing".
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
  // `pageErrors` rather than the raw ledger: the wire this suite cut on purpose
  // is not the page's error (`OlaiWorld.offlineFrom`).
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

/**
 * Start counting what this tab asks the surface, so a later step can say what a
 * gesture COST — not what it drew.
 *
 * Here rather than in one feature's file because the two features that count
 * are about different gestures and the same claim: a client that re-asks when
 * nothing it asked about changed. What each of them counts is its own step,
 * named in its own words (`chat_steps.ts`, `move_steps.ts`); this is only the
 * mark, and it needs `@wire` for the reason `world.socketAsks` gives.
 */
Given("I mark the wire", function (this: OlaiWorld) {
  this.markWire();
});

/**
 * Nothing on the page may make it pan sideways — a whole-app invariant, and
 * here because everything that can break it is shared: one markdown pipeline
 * draws a note, a document and an agent's reply, so any of the three can
 * regress it and a rule that lived under one of them would only be asked about
 * that one.
 *
 * It is asked of the SCROLL CONTAINERS, not of `documentElement`. The main
 * pane is `overflow-x-auto` (App.tsx) precisely so a runaway block cannot
 * reach the window — which means the window's own `scrollWidth` says nothing,
 * and a step that read it would pass over a page the reader has to pan. What
 * over-wide content is allowed to do is scroll WITHIN itself: a fence, a
 * table. What it may not do is make the pane it is written in scroll, and the
 * pane is what is measured.
 */
Then("nothing overflows the pane", async function (this: OlaiWorld) {
  await this.page.locator(ROOT).waitFor({ state: "attached", timeout: HYDRATION_TIMEOUT });
  const panned = await this.page.evaluate(() =>
    [...document.querySelectorAll("main, aside")]
      .filter((pane) => pane.scrollWidth > pane.clientWidth)
      .map((pane) => `${pane.tagName.toLowerCase()}: ${pane.scrollWidth}>${pane.clientWidth}`)
  );
  assert.deepStrictEqual(panned, [], "these panes have to be panned sideways to be read");
});

/** A genuine reload of whatever is open — the page comes back cold, from the
 *  server, with only what this browser stored to carry anything across. Here
 *  rather than in a feature's own steps because nothing about it is any one
 *  feature's, and a second copy would make Cucumber fail the whole run on an
 *  ambiguous definition.
 *
 *  The WHOLE address, query and all: a filtered page's `?q=` is part of what a
 *  reader would have in the bar (`client/routes.ts`), so reloading the path
 *  alone would be this step quietly opening a different page than the one that
 *  was open. */
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


// ── an empty page ──────────────────────────────────────────────────────
//
// Every page with nothing on it draws one shared component
// (`@olai/web/client/Empty.tsx`): the leaf, a line saying what is empty, a
// quieter line under it saying what will appear here, and at most one button
// doing the obvious next thing. Here rather than in each plugin's steps
// because the SHAPE is shared; what each page says is the scenario's.

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
    const buttons = (await block.getByRole("button").allInnerTexts()).map(oneLine);
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
    await this.press(block.getByRole("button", { name: action, exact: true }));
  },
);

/**
 * A DIRECTORY WITH NOTHING IN IT — not even the settings file this harness
 * authors into every served copy (`support/hooks.ts`, `writeFixturePolicy`,
 * which pins the log format). The front page falls back to a convention
 * outline when it is the only one (`@olai/format`'s `page.ts`, held by its
 * `page.test.ts`), so while that file is there the front page is the
 * settings outline, and a scenario about a directory holding nothing would be
 * asking about one that holds something. Removed before the app opens; the
 * serve follows the file live.
 */
Given("the served directory holds no file at all", function (this: OlaiWorld) {
  rmSync(join(this.scratch(), CONFIGURATION_FILE), { force: true });
  // A dotfile is nothing a page draws (the fixture's own `.gitkeep`).
  const left = readdirSync(this.scratch(), { recursive: true, withFileTypes: true })
    .filter((one) => one.isFile() && !one.name.startsWith("."));
  assert.deepStrictEqual(left.map((one) => one.name), [], "the served directory still holds files");
});

/** Close the app's live connections before a persistence-only server restart.
 * Reconnect workflows keep their tab open and exercise the connection overlay. */
When("I leave the app", async function (this: OlaiWorld) {
  await this.page.goto("about:blank");
});
