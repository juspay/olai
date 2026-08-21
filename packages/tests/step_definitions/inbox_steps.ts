/**
 * The sidebar's INBOX entry: the door onto the outline a `⌘K` `+` captures
 * into, beside Agenda at the top of the directory column.
 *
 * It is a file page and not a page of its own — unlike the Trash — so these
 * steps assert on the ADDRESS it lands at rather than on a view: whichever
 * outline the directory's inbox is, the door has to open that one, and a
 * vault keeping its own `notes/inbox.olai` is exactly where a composed path
 * would be wrong.
 */

import * as assert from "node:assert";
import { Then, When } from "@cucumber/cucumber";

import {
  AGENDA_LINK,
  HYDRATION_TIMEOUT,
  INBOX_COUNT,
  INBOX_LINK,
  OUTLINE_TREE,
  POLL_TIMEOUT,
  SIDEBAR_BODY,
  TRASH_LINK,
} from "../support/world.ts";
import type { OlaiWorld } from "../support/world.ts";

Then("the sidebar offers the Inbox", async function (this: OlaiWorld) {
  await this.showSidebar();
  await this.page
    .locator(INBOX_LINK)
    .waitFor({ state: "visible", timeout: HYDRATION_TIMEOUT });
});

/** No entry at all — a directory that has never captured has no inbox, and
 *  minting one is the capture's job. The COLUMN is waited for first: asking a
 *  locator for a count before the sidebar is painted answers zero for an entry
 *  that is about to be drawn. */
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

/** The ⚠ ON THE DOOR, and deliberately not on a tree row.
 *
 *  With the hiding rule in force this entry is the ONLY way in to
 *  `_olai/Inbox.olai` — the tree does not draw it — so the mark every
 *  unreadable outline gets has to be here. A step that read
 *  `OUTLINE_LINK[data-broken="true"]` (`live_steps.ts`) would be asking about
 *  a row this scenario has no reason to expect, and would stay green with the
 *  door's own mark dropped. The literal attribute is spelled the way that
 *  step spells it: nothing is interpolated, so there is no value to escape.
 */
Then("the Inbox door is marked unreadable", async function (this: OlaiWorld) {
  await this.showSidebar();
  await this.page
    .locator(`${INBOX_LINK}[data-broken="true"]`)
    .waitFor({ state: "visible", timeout: POLL_TIMEOUT });
});

/**
 * THE POSITION, asked as the order of the three named doors in the column —
 * Agenda, then Inbox, then Trash — rather than as a pixel or a class. Calendar
 * day-links sit between them and are not these three, so a query that names
 * only the doors cannot pass with Inbox still parked above Trash.
 */
Then("Inbox sits beside Agenda", async function (this: OlaiWorld) {
  await this.showSidebar();
  await this.page
    .locator(INBOX_LINK)
    .waitFor({ state: "visible", timeout: HYDRATION_TIMEOUT });
  const doors = `${SIDEBAR_BODY} ${AGENDA_LINK}, ${SIDEBAR_BODY} ${INBOX_LINK}, ${SIDEBAR_BODY} ${TRASH_LINK}`;
  const order = await this.page
    .locator(doors)
    .evaluateAll((all) => all.map((one) => one.getAttribute("data-testid")));
  assert.deepEqual(
    order,
    ["agenda-link", "inbox-link", "trash-link"],
    `the directory doors are ${JSON.stringify(order)}, not Agenda then Inbox then Trash`,
  );
});

/**
 * The number ON the door, asked as TEXT — "1" being on screen is the half a
 * `data-` attribute cannot promise. Waited, because a capture's frame has to
 * land before the chip does.
 */
Then(
  "the Inbox wears a count of {int}",
  async function (this: OlaiWorld, count: number) {
    await this.showSidebar();
    await this.page
      .locator(INBOX_LINK)
      .waitFor({ state: "visible", timeout: HYDRATION_TIMEOUT });
    const chip = this.page.locator(INBOX_COUNT).first();
    await this.waitUntil(
      async () => (await chip.innerText().catch(() => "")).trim() === String(count),
      `the Inbox to show "${count}"`,
    );
  },
);

/**
 * No chip at all — an empty inbox wears no mark, not a zero. The door is
 * waited for first: an absence checked against a column that has not drawn
 * its answer yet is an absence of everything.
 */
Then("the Inbox wears no count", async function (this: OlaiWorld) {
  await this.showSidebar();
  await this.page
    .locator(INBOX_LINK)
    .waitFor({ state: "visible", timeout: HYDRATION_TIMEOUT });
  await this.waitUntil(
    async () => (await this.page.locator(INBOX_COUNT).count()) === 0,
    "the Inbox to wear no count",
  );
});

When("I open the Inbox from the sidebar", async function (this: OlaiWorld) {
  await this.showSidebar();
  const link = this.page.locator(INBOX_LINK);
  await link.waitFor({ state: "visible", timeout: HYDRATION_TIMEOUT });
  await link.click();
  // The tree is the app's answer to the click, exactly as it is for a click in
  // the file list: waiting for it here means the address step after this one
  // reads a page that has arrived.
  await this.page
    .locator(OUTLINE_TREE)
    .waitFor({ state: "visible", timeout: POLL_TIMEOUT });
  await this.waitForFrame();
});
