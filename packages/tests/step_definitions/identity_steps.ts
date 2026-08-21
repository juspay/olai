/**
 * Who is looking: every answer has a face — anonymous, the person, a
 * failed door. Last in the chrome row.
 *
 * The Given writes the header onto THIS scenario's context before the
 * first navigation — Playwright sends it on every HTTP request, which is
 * how `tailscale serve` injects it and how the chip's `GET /olai/who`
 * sees it. A failed door is aborted the same way, so a fetch error is
 * not the honest absence.
 */

import * as assert from "node:assert";
import { Given, Then } from "@cucumber/cucumber";

import { gravatarOf } from "@olai/identity";
import { WHO_PATH } from "@olai/surface";
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

Given("asking who you are will fail", async function (this: OlaiWorld) {
  // 500, not abort: Chromium logs net::ERR_FAILED on abort as a page
  // error, which is a different claim than "the door answered badly".
  await this.page.route(`**${WHO_PATH}`, (route) =>
    route.fulfill({ status: 500, body: "nope" }),
  );
});

Then(
  "the header identity could not be asked",
  async function (this: OlaiWorld) {
    const slot = this.page.locator(IDENTITY);
    await slot.waitFor({ state: "attached", timeout: POLL_TIMEOUT });
    await this.expectAttribute(
      IDENTITY,
      "data-who",
      "error",
      "the identity slot",
    );
    assert.equal(
      await slot.locator("[aria-label]").getAttribute("aria-label"),
      "could not tell who is looking",
    );
    assert.equal(
      await slot.locator("img").count(),
      0,
      "a failed who fetch drew a person",
    );
  },
);

Then("the header shows anonymous", async function (this: OlaiWorld) {
  const slot = this.page.locator(IDENTITY);
  await slot.waitFor({ state: "attached", timeout: POLL_TIMEOUT });
  await this.expectAttribute(
    IDENTITY,
    "data-who",
    "none",
    "the identity slot",
  );
  assert.equal(
    await slot.getAttribute("aria-label")
      ?? await slot.locator("[aria-label]").getAttribute("aria-label"),
    "anonymous",
    "anonymous must be a spoken face, not an empty slot",
  );
  assert.equal(
    await slot.locator("img").count(),
    0,
    "anonymous drew a gravatar, which is a person",
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
