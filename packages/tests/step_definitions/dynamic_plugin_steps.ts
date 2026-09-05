/**
 * A PLUGIN THE VAULT DEFINES, as a person meets it — the panel block, the two
 * verbs, and what the chip does afterwards.
 *
 * ## What is asserted here that no unit test can be
 *
 * The server half of this phase is benched thoroughly one package over
 * (`@olai/server`'s `dynamic/`): written, pending, approved, mounted, edited,
 * stopped, and every way a build can fail. What none of it reaches is the last
 * inch — the chunk this serve compiled being FETCHED by a tab, and the face
 * inside it DRAWING, with no reload. That is what these steps are for.
 *
 * ## THE CHIP IS THE PLUGIN'S OWN, and so is the attribute it is found by
 *
 * Everything else in this suite is located by a testid out of the merged table,
 * which is the build's. A vault-defined plugin is by definition not in that
 * table — its face did not exist when the bundle was built — so the fixture's
 * own source draws `data-swatch`, and that is what these steps look for. The
 * fixture IS the subject: what is being asserted is that source somebody wrote
 * into a directory reached the page.
 */

import * as assert from "node:assert";
import * as fs from "node:fs";
import * as path from "node:path";
import { Then, When } from "@cucumber/cucumber";

import {
  attr,
  PLUGINS_APPROVE,
  PLUGINS_MOVED,
  PLUGINS_PANEL,
  PLUGINS_SOURCE,
  PREFS_ROW,
  nodeSelector,
  POLL_TIMEOUT,
} from "../support/world.ts";
import type { OlaiWorld } from "../support/world.ts";

/** The file the fixture's definition lives in — one place, because a step that
 *  edits it and a step that asserts about it have to mean the same file. */
const DEFINITION = "swatch.olai";

/** ONE DEFINITION'S BLOCK on the panel, by the word its `plugin` property
 *  carries — the same way a person finds it and the same way `--plugins` would
 *  name it if it were a built row. */
const blockFor = (world: OlaiWorld, plugin: string) =>
  world.page.locator(`${PLUGINS_PANEL} ${PLUGINS_SOURCE}${attr("data-plugin", plugin)}`);

Then(
  "the plugins panel shows the source of {string}",
  async function (this: OlaiWorld, plugin: string) {
    const block = blockFor(this, plugin);
    await block.waitFor({ state: "visible", timeout: POLL_TIMEOUT });
    const said = await block.innerText();
    // BOTH HALVES, in full. Approving is READING, which is the whole reason the
    // source travels on the roster at all rather than a content hash.
    assert.ok(
      said.includes("server.ts") && said.includes("browser.tsx"),
      `the block for "${plugin}" does not draw both halves:\n${said}`,
    );
  },
);

/**
 * SAY YES TO IT, the way a person does.
 *
 * `Approve this version` rather than `Approve always`, because the version is
 * what the rest of these scenarios are about: the second press exists for
 * somebody iterating with an agent and is a different claim.
 */
When("I approve the plugin {string}", async function (this: OlaiWorld, plugin: string) {
  await this.press(blockFor(this, plugin).locator(PLUGINS_APPROVE));
});

/** ...and the press that arms them again after the definition moved under the
 *  reader — which is a press of its own, and that is the point of it. */
When("I read the plugin {string} again", async function (this: OlaiWorld, plugin: string) {
  await this.press(blockFor(this, plugin).locator(PLUGINS_MOVED).locator("button"));
});

/**
 * THE VERBS ARE ARMED, or they are not — and the difference is whether this
 * reader has been shown the version that is on the wire NOW.
 *
 * The roster is live, so an edit replaces the source under somebody with the
 * panel open. A verb that stayed armed across that would approve what is there
 * now rather than what was read, which is the one gesture in this product where
 * that distinction is the whole point.
 */
Then(
  "the plugins panel offers to approve {string}",
  async function (this: OlaiWorld, plugin: string) {
    await blockFor(this, plugin).locator(PLUGINS_APPROVE)
      .waitFor({ state: "visible", timeout: POLL_TIMEOUT });
  },
);

/**
 * THE ROW IS GONE, not merely waiting. A trashed definition used to stay on
 * the panel with `_olai/Trash.olai` as its file; the assertion is the absence
 * of both the row and the source block, because either remaining would be
 * the same bug under a different heading.
 */
Then(
  "the plugins panel does not list {string}",
  async function (this: OlaiWorld, plugin: string) {
    await this.page
      .locator(`${PLUGINS_PANEL} ${PREFS_ROW}${attr("data-pref", `plugin-${plugin}`)}`)
      .waitFor({ state: "detached", timeout: POLL_TIMEOUT });
  },
);

Then(
  "the plugins panel does not show the source of {string}",
  async function (this: OlaiWorld, plugin: string) {
    await blockFor(this, plugin).waitFor({ state: "detached", timeout: POLL_TIMEOUT });
  },
);

Then(
  "the plugins panel says {string} changed while I was reading it",
  async function (this: OlaiWorld, plugin: string) {
    const block = blockFor(this, plugin);
    await block.locator(PLUGINS_MOVED).waitFor({ state: "visible", timeout: POLL_TIMEOUT });
    // ...AND THE VERBS ARE GONE, which is the half that matters: a warning
    // beside a live button would be a sentence somebody clicks past.
    assert.strictEqual(
      await block.locator(PLUGINS_APPROVE).count(),
      0,
      `"${plugin}" still offers to approve a version this reader has not been shown`,
    );
  },
);

/**
 * EDIT ONE HALF, on the disk, the way the agent that wrote it would.
 *
 * A definition is ordinary vault content, so this is an ordinary write to an
 * ordinary outline: the store's watcher sees it, the revision publishes, and
 * every consequence — the version moving, the row returning to `pending`, the
 * fiber coming down — is the product doing what it does rather than anything
 * this step arranged.
 *
 * The edit is to the FACE and it is visible: the chip goes from a square to a
 * circle, so a scenario can tell the version that mounted from the one that
 * did.
 */
When("the plugin's face is edited", function (this: OlaiWorld) {
  const file = path.join(this.scratch(), DEFINITION);
  const was = fs.readFileSync(file, "utf8");
  const now = was.replaceAll("w-3 rounded", "w-3 rounded-full");
  assert.notStrictEqual(now, was, `nothing in ${DEFINITION} matched the face this step edits`);
  fs.writeFileSync(file, now);
});

/**
 * THE CHIP THE PLUGIN DRAWS — found by the attribute its own source writes, for
 * the reason this file's header gives.
 *
 * WAITED FOR rather than read once, and the wait is the assertion: an approval
 * publishes a revision, the definition is followed, the fiber mounts, the
 * roster moves, the tab redials and fetches a chunk this serve compiled a
 * moment ago. None of that is a reload, and all of it takes frames.
 */
Then(
  "the row {string} wears a swatch for {string}",
  async function (this: OlaiWorld, node: string, value: string) {
    await this.page
      // `attr` rather than the selector written out, which is this suite's own
      // rule and is checked (`../selectors.test.ts`): a value interpolated into
      // a selector by hand is a value nothing escaped, and a colour is one of
      // the few that could plausibly arrive carrying a quote.
      .locator(`${nodeSelector(node)} ${attr("data-swatch", value)}`)
      .first()
      .waitFor({ state: "visible", timeout: POLL_TIMEOUT });
  },
);

Then("that swatch is round", async function (this: OlaiWorld) {
  await this.page
    .locator(`[data-swatch].rounded-full`)
    .first()
    .waitFor({ state: "visible", timeout: POLL_TIMEOUT });
});

Then("no row wears a swatch", async function (this: OlaiWorld) {
  // The panel reads the server's approval state. Browser teardown follows the
  // roster asynchronously, so that sentence is not a barrier for slot removal.
  // As with appearance above, require the whole DOM outcome to settle.
  await this.waitUntil(
    async () => await this.page.locator("[data-swatch]").count() === 0,
    "every swatch to leave after the plugin is stopped or loses approval",
  );
});

When("the palette provider is replaced", function (this: OlaiWorld) {
  const file = path.join(this.scratch(), "palette.olai");
  const source = fs.readFileSync(file, "utf8");
  fs.writeFileSync(file, source.replace("[0-9a-f]{6}", "(?:ff8800|00ff00)"));
});

Then("the agent service catalog {word} {string}", async function (this: OlaiWorld, presence: string, key: string) {
  const { callTool, connectTerminalAgent } = await import("../support/mcp.ts");
  this.terminalAgent ??= await connectTerminalAgent(`${this.baseUrl}/mcp`);
  const answer = await callTool(this.terminalAgent, "inspect_plugins", {});
  const catalog = answer["structuredContent"] as { services: Array<string> };
  assert.ok(catalog.services.includes("vault"), "core services remain discoverable");
  assert.strictEqual(catalog.services.includes(key), presence === "includes");
});

Then("the palette {word} the colour {string}", async function (this: OlaiWorld, verdict: string, value: string) {
  const { connectTerminalAgent, tryTool } = await import("../support/mcp.ts");
  this.terminalAgent ??= await connectTerminalAgent(`${this.baseUrl}/mcp`);
  const answer = await tryTool(this.terminalAgent, "set_prop", { id: "amber", key: "swatch-hex", value });
  assert.strictEqual(answer["isError"] === true, verdict === "rejects", JSON.stringify(answer));
});
