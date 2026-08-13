/**
 * The trash: opening it, what it lists, putting a row back, and what a
 * put-back that could not land said.
 *
 * Its own file for the menu's reason: the trash is not the outline tree — its
 * rows are archived nodes with one verb on them, not editable rows — so none
 * of the tree's steps apply and none of its selectors match. What every
 * writing step here asserts AFTERWARDS is the outline's state on disk
 * (`editing_steps.ts`'s holds/no-longer-holds), because "put back" is a claim
 * about the file, not about a row disappearing from a panel.
 */

import * as assert from "node:assert";
import { Then, When } from "@cucumber/cucumber";

import {
  oneLine,
  POLL_TIMEOUT,
  TRASH_EMPTY,
  TRASH_LINK,
  TRASH_PAGE,
  TRASH_PUT_BACK,
  TRASH_ROW,
  TRASH_SAID,
} from "../support/world.ts";
import type { OlaiWorld } from "../support/world.ts";

/** One trash row, by the archived node it draws. A selector string for the
 *  same reason `nodeSelector` is one. */
const trashRow = (id: string): string => `${TRASH_ROW}[data-node-id="${id}"]`;

When("I open the Trash", async function (this: OlaiWorld) {
  await this.showSidebar();
  await this.page.locator(TRASH_LINK).click();
  await this.page
    .locator(TRASH_PAGE)
    .waitFor({ state: "visible", timeout: POLL_TIMEOUT });
});

Then(
  "the Trash lists the node {string}",
  async function (this: OlaiWorld, id: string) {
    await this.page
      .locator(trashRow(id))
      .waitFor({ state: "visible", timeout: POLL_TIMEOUT });
  },
);

Then("the Trash is empty", async function (this: OlaiWorld) {
  // The empty line is the assertion, not a zero row count: a trash that
  // failed to draw at all has no rows either.
  await this.page
    .locator(TRASH_EMPTY)
    .waitFor({ state: "visible", timeout: POLL_TIMEOUT });
});

When(
  "I put back {string} from the Trash",
  async function (this: OlaiWorld, id: string) {
    const row = this.page.locator(trashRow(id)).first();
    // The verb is hover-revealed on a pointer device, the gutter's own
    // manner; the hover is what a person does to reach it.
    await row.hover();
    await row
      .locator(TRASH_PUT_BACK)
      .first()
      .click();
    await this.waitForFrame();
  },
);

/** The signpost rows the archive minted carry no id a scenario chose — they
 *  are the ancestor TITLES — so they are reached the way a reader reaches
 *  them: by the words on the row. */
const titledRow = (world: OlaiWorld, title: string) =>
  world.page
    .locator(TRASH_ROW)
    .filter({ has: world.page.getByText(title, { exact: true }) })
    .last();

When(
  "I put back the row titled {string} from the Trash",
  async function (this: OlaiWorld, title: string) {
    const row = titledRow(this, title);
    await row.hover();
    await row.locator(TRASH_PUT_BACK).first().click();
    await this.waitForFrame();
  },
);

/** The signpost refusal, in the ops layer's own words. A substring rather than
 *  the whole sentence: what this pins is that the REASON reached the row it
 *  was pressed on, in the alarm tone — the sentence itself is the planner's
 *  and is pinned verbatim where it is written (`plan.test.ts`). */
Then(
  "the Trash says under the row titled {string} that it is a signpost",
  async function (this: OlaiWorld, title: string) {
    const line = titledRow(this, title).locator(TRASH_SAID).first();
    await line.waitFor({ state: "visible", timeout: POLL_TIMEOUT });
    const text = oneLine(await line.innerText());
    assert.match(
      text,
      /is the title `archive` wrote above what was put away/,
      `the line under ${JSON.stringify(title)} reads ${JSON.stringify(text)}`,
    );
    assert.strictEqual(await line.getAttribute("data-tone"), "alarm");
  },
);

/** Exactly one, which is the whole of MUST-FIX 1: restoring a signpost used to
 *  mint a SECOND live node carrying a title the set already had. */
Then(
  "{string} holds one node titled {string}",
  async function (this: OlaiWorld, file: string, title: string) {
    await this.waitUntil(
      async () =>
        this.servedNodes(file).filter((node) => node["title"] === title).length === 1,
      `${file} to hold exactly one node titled ${JSON.stringify(title)}`,
    );
  },
);

/** A put-back that could not land, in the ops layer's own words — VERBATIM
 *  and in the alarm tone, the same contract every other refusal line keeps.
 *  The row it is about is named, because a trash holds many rows and a
 *  refusal under the wrong one would pass a substring check. */
Then(
  "the Trash under {string} says {string}",
  async function (this: OlaiWorld, id: string, text: string) {
    const line = this.page.locator(`${trashRow(id)} ${TRASH_SAID}`).first();
    await line.waitFor({ state: "visible", timeout: POLL_TIMEOUT });
    assert.strictEqual(oneLine(await line.innerText()), text);
    assert.strictEqual(
      await line.getAttribute("data-tone"),
      "alarm",
      "a refusal is an alarm",
    );
  },
);

/** WHERE a node sits, which "holds the node" cannot say: a put-back that
 *  landed the subtree at top level instead of under its old parent still
 *  holds every id. Read off the disk like its siblings in
 *  `editing_steps.ts`, and waited for, because the write is a round trip. */
Then(
  "the node {string} in {string} sits under {string}",
  async function (this: OlaiWorld, id: string, file: string, parent: string) {
    await this.waitUntil(
      async () =>
        this.servedNodes(file).some(
          (node) => node["id"] === id && node["parent"] === parent,
        ),
      `${file} to hold ${JSON.stringify(id)} under ${JSON.stringify(parent)}`,
    );
  },
);
