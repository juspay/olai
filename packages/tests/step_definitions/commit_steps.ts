/**
 * The Commit button, driven the way a person drives it.
 *
 * These are the only scenarios in the suite whose served directory is a git
 * repository (`@git`, `support/hooks.ts`), and that is the point: what is
 * waiting to be committed is DERIVED from git rather than counted, so the only
 * honest way to test it is to have one and then to look in its log afterwards.
 *
 * Everything asserted here is either a `data-` fact on the chrome or a line out
 * of `git log`. Nothing reads the words in the panel: which phrase stands for
 * "marked done" is the view's to reword, and `data-sort` is the contract.
 */

import * as assert from "node:assert";
import { Then, When } from "@cucumber/cucumber";

import {
  COMMIT_BLOCKED,
  COMMIT_CHANGE,
  COMMIT_MESSAGE,
  COMMIT_NOW,
  COMMIT_PANEL,
  COMMIT_PILL,
  POLL_TIMEOUT,
} from "../support/world.ts";
import type { OlaiWorld } from "../support/world.ts";

// ── the chrome ─────────────────────────────────────────────────────────

Then(
  "the commit pill says {int} uncommitted",
  async function (this: OlaiWorld, count: number) {
    await this.expectAttribute(
      COMMIT_PILL,
      "data-uncommitted",
      String(count),
      "the commit pill",
    );
  },
);

/** Nothing pending, nothing shown — so this is an assertion about ABSENCE, and
 *  it has to wait for one: the page may not have heard about the commit yet. */
Then("there is nothing to commit", async function (this: OlaiWorld) {
  await this.page
    .locator(COMMIT_PILL)
    .waitFor({ state: "detached", timeout: POLL_TIMEOUT });
});

When("I open the commit panel", async function (this: OlaiWorld) {
  await this.page.locator(COMMIT_PILL).click();
  await this.page
    .locator(COMMIT_PANEL)
    .waitFor({ state: "visible", timeout: POLL_TIMEOUT });
});

Then(
  "the change to {string} is {string}",
  async function (this: OlaiWorld, id: string, sort: string) {
    await this.expectAttribute(
      `${COMMIT_CHANGE}[data-node-id="${id}"]`,
      "data-sort",
      sort,
      `the pending change to "${id}"`,
    );
  },
);

Then("the commit button is disabled", async function (this: OlaiWorld) {
  const disabled = await this.page.locator(COMMIT_NOW).isDisabled();
  assert.ok(disabled, "expected the commit button to be disabled");
});

Then(
  "the panel says the repository is {string}",
  async function (this: OlaiWorld, reason: string) {
    const said = await this.page
      .locator(COMMIT_BLOCKED)
      .textContent({ timeout: POLL_TIMEOUT });
    assert.ok(
      (said ?? "").includes(reason),
      `expected the panel to explain "${reason}", but it says "${said}"`,
    );
  },
);

When(
  "I commit with the message {string}",
  async function (this: OlaiWorld, message: string) {
    await this.page.locator(COMMIT_MESSAGE).fill(message);
    await this.page.locator(COMMIT_NOW).click();
  },
);

// ── what ended up in the repository ────────────────────────────────────

Then(
  "the last commit is {string} by {string}",
  function (this: OlaiWorld, subject: string, writer: string) {
    assert.strictEqual(this.git("log", "--format=%s", "-1").trim(), subject);
    // The trailer is the permanent half of "who wrote this": git records only
    // the repository's own user, which every commit in it already has.
    assert.strictEqual(
      this.git(
        "log",
        "--format=%(trailers:key=X-Olai-Writer,valueonly)",
        "-1",
      ).trim(),
      writer,
    );
  },
);

Then("the repository is clean", function (this: OlaiWorld) {
  assert.strictEqual(this.git("status", "--porcelain").trim(), "");
});

When("HEAD is detached in the served repository", function (this: OlaiWorld) {
  this.git("checkout", "--quiet", "--detach", "HEAD");
});
