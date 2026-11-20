import * as assert from "node:assert";
import { Then, When } from "@olai/tests/harness/runner.ts";

import {
  AGENDA_LINK,
  HYDRATION_TIMEOUT,
  OUTLINE_TREE,
  POLL_TIMEOUT,
  SIDEBAR,
  SIDEBAR_BODY,
  TRASH_LINK,
} from "@olai/tests/harness/world.ts";
import {
  INBOX_COUNT,
  INBOX_HELD,
  INBOX_LINK,
} from "../selectors.ts";
import type { OlaiWorld } from "@olai/tests/harness/world.ts";

Then("the sidebar offers the Inbox", async function (this: OlaiWorld) {
  await this.showSidebar();
  await this.page
    .locator(INBOX_LINK)
    .waitFor({ state: "visible", timeout: HYDRATION_TIMEOUT });
});

Then("the sidebar offers no Inbox", async function (this: OlaiWorld) {
  await this.showSidebar();
  await this.page
    .locator(SIDEBAR_BODY)
    .waitFor({ state: "visible", timeout: HYDRATION_TIMEOUT });
  assert.strictEqual(
    await this.page.locator(INBOX_LINK).count(),
    0,
    "the sidebar draws an Inbox entry for a directory that has no inbox",
  );
});

Then("the Inbox door is marked unreadable", async function (this: OlaiWorld) {
  await this.showSidebar();
  await this.page
    .locator(`${INBOX_LINK}[data-broken="true"]`)
    .waitFor({ state: "visible", timeout: POLL_TIMEOUT });
});

Then("Inbox sits beside Agenda", async function (this: OlaiWorld) {
  await this.showSidebar();
  await this.page
    .locator(INBOX_LINK)
    .waitFor({ state: "visible", timeout: HYDRATION_TIMEOUT });
  const doors = `${SIDEBAR} ${AGENDA_LINK}, ${SIDEBAR} ${INBOX_LINK}, ${SIDEBAR} ${TRASH_LINK}`;
  const order = await this.page
    .locator(doors)
    .evaluateAll((all) => all.map((one) => one.getAttribute("data-testid")));
  assert.deepEqual(
    order,
    ["agenda-link", "inbox-link", "trash-link"],
    `the directory doors are ${JSON.stringify(order)}, not Agenda then Inbox then Trash`,
  );
});

Then(
  "the Inbox wears a count of {int}",
  async function (this: OlaiWorld, count: number) {
    await this.showSidebar();
    await this.page
      .locator(INBOX_LINK)
      .waitFor({ state: "visible", timeout: HYDRATION_TIMEOUT });
    const shown = String(count);
    const chip = this.page.locator(INBOX_COUNT).first();
    await this.waitUntil(
      async () => (await chip.innerText().catch(() => "")).trim() === shown,
      `the Inbox to show "${shown}"`,
    );
    await this.expectChromeAttribute(INBOX_HELD, "data-count", shown, "the Inbox");
  },
);

Then("the Inbox wears no count", async function (this: OlaiWorld) {
  await this.showSidebar();
  await this.page
    .locator(INBOX_LINK)
    .waitFor({ state: "visible", timeout: HYDRATION_TIMEOUT });
  await this.waitUntil(
    async () => (await this.page.locator(INBOX_COUNT).count()) === 0,
    "the Inbox to wear no count",
  );
  await this.expectChromeAttribute(INBOX_HELD, "data-count", "0", "the Inbox");
});

When("I open the Inbox from the sidebar", async function (this: OlaiWorld) {
  await this.showSidebar();
  const link = this.page.locator(INBOX_LINK);
  await link.waitFor({ state: "visible", timeout: HYDRATION_TIMEOUT });
  await link.click();
  await this.frontLane()
    .locator(OUTLINE_TREE)
    .waitFor({ state: "visible", timeout: POLL_TIMEOUT });
  await this.waitForFrame();
});
