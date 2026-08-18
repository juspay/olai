/**
 * What refers to a zoomed node, read backwards — the section, its count, and
 * the two rows inside it.
 *
 * Its own file rather than more of `edge_steps.ts`, and the reason is the
 * division that file already draws: those steps are about WRITING a relation
 * and reading the file afterwards, and these are about a DERIVED reading with
 * nothing to write. Nothing here touches the disk; what it asserts is that a
 * reference somebody made elsewhere reaches this page.
 *
 * The count and the rows are asked separately on purpose. `data-count` is the
 * whole of what a SHUT section says, so a scenario about live updating can read
 * it without unfolding anything — which is the honest shape of the claim, since
 * a section that only grew once opened would be a section that had not updated.
 */

import * as assert from "node:assert";
import { Then, When } from "@cucumber/cucumber";

import {
  attr,
  backlinkRow,
  BACKLINKS,
  BACKLINKS_SUMMARY,
  NODE_REF,
  oneLine,
  POLL_TIMEOUT,
  ZOOM_TITLE,
} from "../support/world.ts";
import type { OlaiWorld } from "../support/world.ts";

/** Which row a scenario means, by the LABEL a reader sees on it — a relation is
 *  read in the reader's language rather than as a field name in a slot
 *  (`edge_steps.ts`' own rule). The pairing of a label with its testid is the
 *  client's (`backlinks/way.ts`, through `world.ts`), so a row renamed there is
 *  a scenario that fails saying so rather than one that quietly looks at
 *  nothing. */
const rowOf = (label: string): string => {
  const row = backlinkRow(label);
  if (row === undefined) {
    throw new Error(`the referenced-by section draws no \`${label}\` row`);
  }
  return row;
};

Then(
  "the page says it is referenced by {int} nodes",
  async function (this: OlaiWorld, many: number) {
    await this.expectAttribute(
      BACKLINKS,
      "data-count",
      String(many),
      "the referenced-by section",
    );
  },
);

Then(
  "the page draws no referenced-by section",
  async function (this: OlaiWorld) {
    await this.waitUntil(
      async () => (await this.page.locator(BACKLINKS).count()) === 0,
      "the referenced-by section to be absent",
    );
  },
);

/** SHUT, which is the default and therefore the thing worth asserting: a
 *  `<details>` carries its own `open`, so this is the browser's answer rather
 *  than a class name. */
Then("the referenced-by section is collapsed", async function (this: OlaiWorld) {
  const section = this.page.locator(BACKLINKS).first();
  await section.waitFor({ state: "attached", timeout: POLL_TIMEOUT });
  assert.strictEqual(
    await section.evaluate((el) => (el as HTMLDetailsElement).open),
    false,
    "the referenced-by section is open before anybody asked it to be",
  );
});

When("I open the referenced-by section", async function (this: OlaiWorld) {
  await this.press(this.page.locator(BACKLINKS_SUMMARY).first());
  await this.waitUntil(
    async () =>
      await this.page
        .locator(BACKLINKS)
        .first()
        .evaluate((el) => (el as HTMLDetailsElement).open),
    "the referenced-by section to be open",
  );
});

Then(
  "the referenced-by section is still open",
  async function (this: OlaiWorld) {
    assert.ok(
      await this.page
        .locator(BACKLINKS)
        .first()
        .evaluate((el) => (el as HTMLDetailsElement).open),
      "the referenced-by section shut under the reader when the set moved",
    );
  },
);

/** One row, WHOLE and in order — never membership: corpus order is what the
 *  reading promises, and a row that had gained an entry somewhere else would
 *  satisfy a contains. */
Then(
  "the referenced-by {string} row reads {string}",
  async function (this: OlaiWorld, way: string, titles: string) {
    const row = this.page.locator(rowOf(way)).first();
    await this.waitUntil(
      async () =>
        (await row.count()) > 0 &&
        (await row.locator(NODE_REF).allInnerTexts()).map(oneLine).join(", ") ===
          titles,
      `the referenced-by \`${way}\` row to read ${JSON.stringify(titles)}`,
    );
  },
);

/** ...and each entry NAVIGATES, which is half of what the section is for.
 *  Selected by `data-ref` rather than by text, for `navigation_steps.ts`'
 *  reason: titles change under a live page and ids do not. */
When(
  "I follow the referenced-by link to {string}",
  async function (this: OlaiWorld, id: string) {
    await this.press(
      this.page
        .locator(`${BACKLINKS} ${NODE_REF}:has(${attr("data-ref", id)})`)
        .first(),
    );
    await this.page
      .locator(ZOOM_TITLE)
      .waitFor({ state: "visible", timeout: POLL_TIMEOUT });
  },
);

Then(
  "the referenced-by section draws no {string} row",
  async function (this: OlaiWorld, way: string) {
    await this.waitUntil(
      async () => (await this.page.locator(rowOf(way)).count()) === 0,
      `the referenced-by \`${way}\` row to be absent`,
    );
  },
);
