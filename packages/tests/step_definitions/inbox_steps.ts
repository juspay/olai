/**
 * The sidebar's INBOX entry: the door onto the outline a `⌘K` `+` captures
 * into, at the foot of the directory column above the Trash.
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
  HYDRATION_TIMEOUT,
  INBOX_LINK,
  OUTLINE_TREE,
  POLL_TIMEOUT,
  SIDEBAR_BODY,
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
