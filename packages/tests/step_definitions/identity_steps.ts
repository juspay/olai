/**
 * Who is looking: the header chip, present with a mocked Tailscale login
 * and honestly absent without.
 *
 * The Given writes the header onto THIS scenario's context before the
 * first navigation — Playwright sends it on every HTTP request, which is
 * how `tailscale serve` injects it and how the chip's `GET /olai/who`
 * sees it.
 */

import * as assert from "node:assert";
import { Given, Then } from "@cucumber/cucumber";

import { gravatarOf } from "@olai/identity";
import { selector, TESTID } from "@olai/web/src/client/testids.ts";

import { POLL_TIMEOUT } from "../support/world.ts";
import type { OlaiWorld } from "../support/world.ts";

const IDENTITY = selector(TESTID.identity);

Given(
  "I am the Tailscale user {string}",
  async function (this: OlaiWorld, login: string) {
    await this.context.setExtraHTTPHeaders({
      "Tailscale-User-Login": login,
    });
  },
);

Then("the header has no identity chip", async function (this: OlaiWorld) {
  const slot = this.page.locator(IDENTITY);
  await slot.waitFor({ state: "attached", timeout: POLL_TIMEOUT });
  await this.page.waitForFunction(
    (sel) => {
      const el = document.querySelector(sel);
      return el?.getAttribute("data-who") === "none";
    },
    IDENTITY,
    { timeout: POLL_TIMEOUT },
  );
  assert.equal(
    await slot.locator("img").count(),
    0,
    "the identity slot drew a picture for a connection that named nobody",
  );
});

Then(
  "the header shows the identity {string}",
  async function (this: OlaiWorld, login: string) {
    const slot = this.page.locator(IDENTITY);
    await slot.waitFor({ state: "attached", timeout: POLL_TIMEOUT });
    await this.expectAttribute(IDENTITY, "data-who", "yes", "the identity chip");
    await this.expectAttribute(IDENTITY, "data-login", login, "the identity chip");
    const img = slot.locator("img");
    await img.waitFor({ state: "visible", timeout: POLL_TIMEOUT });
  },
);

Then(
  "the identity gravatar is hashed from {string}",
  async function (this: OlaiWorld, email: string) {
    const src = await this.page
      .locator(`${IDENTITY} img`)
      .getAttribute("src", { timeout: POLL_TIMEOUT });
    assert.ok(src, "the identity chip drew no picture");
    assert.equal(
      src,
      gravatarOf(email),
      `the identity picture is ${src}, not the gravatar of ${email}`,
    );
  },
);
