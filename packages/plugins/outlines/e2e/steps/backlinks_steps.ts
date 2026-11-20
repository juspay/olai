import * as assert from "node:assert";
import { Then, When } from "@olai/tests/harness/runner.ts";

import {
  attr,
  backlinkRow,
  detailsOpen,
  NODE_REF,
  POLL_TIMEOUT,
  rowReads,
  ZOOM_TITLE,
} from "@olai/tests/harness/world.ts";
import {
  BACKLINKS,
  BACKLINKS_SUMMARY,
} from "../selectors.ts";
import type { OlaiWorld } from "@olai/tests/harness/world.ts";

Then(
  "the page says it is referenced by {int} things",
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

Then("the referenced-by section is collapsed", async function (this: OlaiWorld) {
  const section = this.page.locator(BACKLINKS).first();
  await section.waitFor({ state: "attached", timeout: POLL_TIMEOUT });
  assert.strictEqual(
    await detailsOpen(section),
    false,
    "the referenced-by section is open before anybody asked it to be",
  );
});

When("I open the referenced-by section", async function (this: OlaiWorld) {
  await this.press(this.page.locator(BACKLINKS_SUMMARY).first());
  await this.waitUntil(
    async () => await detailsOpen(this.page.locator(BACKLINKS)),
    "the referenced-by section to be open",
  );
});

Then(
  "the referenced-by section is still open",
  async function (this: OlaiWorld) {
    assert.ok(
      await detailsOpen(this.page.locator(BACKLINKS)),
      "the referenced-by section shut under the reader when the set moved",
    );
  },
);

Then(
  "the referenced-by {string} row reads {string}",
  async function (this: OlaiWorld, label: string, titles: string) {
    await rowReads(
      this,
      this.page.locator(backlinkRow(label)).first(),
      titles,
      `the referenced-by \`${label}\` row`,
    );
  },
);

When(
  "I follow the referenced-by link to {string}",
  async function (this: OlaiWorld, id: string) {
    await this.press(
      this.page
        .locator(`${BACKLINKS} ${NODE_REF}:has(${attr("data-ref", id)})`)
        .first(),
    );
    await this.page
      .locator(`${attr("data-node-id", id)}[data-focused="true"]`).first()
      .waitFor({ state: "visible", timeout: POLL_TIMEOUT });
  },
);

Then(
  "the referenced-by section draws no {string} row",
  async function (this: OlaiWorld, label: string) {
    await this.waitUntil(
      async () => (await this.page.locator(backlinkRow(label)).count()) === 0,
      `the referenced-by \`${label}\` row to be absent`,
    );
  },
);
