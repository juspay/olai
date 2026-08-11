/**
 * The git readout: what the header says about whether writes are being kept.
 *
 * Everything here asks the page and nothing else. WHICH situation the server was
 * started into — a repository, a directory that is not one, a git that fails —
 * is the scenario's `@git:` tag (`support/hooks.ts`), because the claim being
 * made is that the page knows before anyone writes anything; a step that set it
 * up would be testing a write path instead.
 *
 * The three assertions are the three halves a reader gets, and they are
 * deliberately not one: the STATE is an attribute (never a colour), the WORDS
 * are what is on screen, and the REASON is the accessible sentence — asserted
 * off `aria-label`, because it has to be readable without a pointer. The tip a
 * pointer DOES open is checked by the step that already owns tips; this file
 * only opens it.
 */

import * as assert from "node:assert/strict";

import { Then, When } from "@cucumber/cucumber";

import { GIT, HYDRATION_TIMEOUT, oneLine, POLL_TIMEOUT, TIP } from "../support/world.ts";
import type { OlaiWorld } from "../support/world.ts";

Then("the git readout says {string}", async function (this: OlaiWorld, state: string) {
  // The HYDRATION budget: the cell arrives with the first frames of the
  // subscription rather than a render after a click.
  await this.expectAttribute(
    GIT,
    "data-git",
    state,
    "the git readout",
    HYDRATION_TIMEOUT,
  );
});

Then("the git readout reads {string}", async function (this: OlaiWorld, words: string) {
  const readout = this.page.locator(GIT);
  await readout.waitFor({ state: "visible", timeout: POLL_TIMEOUT });
  const shown = oneLine(await readout.innerText());
  assert.equal(
    shown,
    words,
    `the git readout says "${shown}", not "${words}"`,
  );
});

Then("the git readout explains {string}", async function (this: OlaiWorld, reason: string) {
  const readout = this.page.locator(GIT);
  await readout.waitFor({ state: "visible", timeout: POLL_TIMEOUT });
  const said = (await readout.getAttribute("aria-label")) ?? "";
  assert.ok(
    said.includes(reason),
    `the git readout's own sentence is "${said}", which does not mention "${reason}" — ` +
      "and it is the copy a reader with no pointer gets",
  );
});

/** Open the tip, and leave the assertion to the step that already owns tips
 *  (`navigation_steps.ts`'s `a tip says …`, which also holds the rule this app
 *  learnt the hard way: exactly one tip on screen, ever). */
When("I hover the git readout", async function (this: OlaiWorld) {
  const readout = this.page.locator(GIT);
  await readout.waitFor({ state: "visible", timeout: POLL_TIMEOUT });
  await readout.hover();
  await this.page
    .locator(TIP)
    .first()
    .waitFor({ state: "visible", timeout: POLL_TIMEOUT });
});

Then("there is no git readout", async function (this: OlaiWorld) {
  // Settle first: `--no-commit` and "the frame has not arrived yet" both look
  // like an absent element, and only one of them is the claim. The header is
  // already on screen by the time a scenario reaches here (the background opens
  // an outline), so a frame's wait is enough to tell them apart.
  await this.waitForFrame();
  assert.equal(
    await this.page.locator(GIT).count(),
    0,
    "a --no-commit serve drew a git readout, which is a setting reported as a condition",
  );
});
