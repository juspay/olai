/**
 * READING OLAI FROM ANOTHER MACHINE — the page that is not a secure context.
 *
 * `../support/lan.ts` says why the suite needs a second name for its own
 * server; these are the steps that read through it, and the one fact about
 * such a page a scenario has to see for itself — that it really IS held to
 * less, so a scenario passing on it proves something.
 */

import * as assert from "node:assert";
import { Given, Then } from "@cucumber/cucumber";
import { onLan } from "../support/lan.ts";
import type { OlaiWorld } from "../support/world.ts";

/** The prompts the page raised, oldest first — what `window.prompt` offered. */
const prompted = new WeakMap<OlaiWorld, Array<{ message: string; value: string }>>();

Given("I read olai from another machine over plain http", async function (this: OlaiWorld) {
  // Before the first navigation: every later `open` resolves against this.
  this.baseUrl = onLan(this.baseUrl);
  // A prompt blocks the page until something answers it, and Playwright
  // dismisses one nobody is listening for — so the listener is here, before
  // any gesture can raise one, and records what was offered.
  const seen: Array<{ message: string; value: string }> = [];
  prompted.set(this, seen);
  this.page.on("dialog", (dialog) => {
    seen.push({ message: dialog.message(), value: dialog.defaultValue() });
    void dialog.dismiss();
  });
});

Then("this page is not a secure context", async function (this: OlaiWorld) {
  const held = await this.page.evaluate(() => ({
    secure: window.isSecureContext,
    randomUUID: typeof (crypto as { randomUUID?: unknown }).randomUUID,
    clipboard: typeof (navigator as { clipboard?: unknown }).clipboard,
  }));
  assert.deepStrictEqual(held, { secure: false, randomUUID: "undefined", clipboard: "undefined" });
});

Then("the page offers the link to {string} to copy by hand", async function (this: OlaiWorld, href: string) {
  const wanted = new URL(href, this.page.url()).href;
  const seen = prompted.get(this) ?? [];
  await this.waitUntil(async () => seen.some((one) => one.value === wanted),
    `a prompt offering ${wanted} (prompts so far: ${JSON.stringify(seen)})`);
});
