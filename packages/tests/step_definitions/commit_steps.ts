/**
 * The Commit pill, driven the way a person drives it — and it is the header's
 * ONE indicator for git, so the steps that used to drive the `● git` readout
 * beside it are here too (`one-git-indicator` retired that chip and this file
 * inherited its three assertions).
 *
 * The scenarios that WRITE are the only ones in the suite whose served
 * directory is a git repository (`@git`, `support/hooks.ts`), and that is the
 * point: what is waiting to be committed is DERIVED from git rather than
 * counted, so the only honest way to test it is to have one and then to look in
 * its log afterwards. WHICH situation a server was started into — a repository,
 * a directory that is not one, a git that fails when it is asked — is the
 * scenario's tag rather than a step, because the claim being made is that the
 * page knows before anybody writes anything.
 *
 * Everything asserted here is either a `data-` fact on the chrome, the words on
 * it, the sentence a reader with no pointer gets, or a line out of `git log`.
 * Nothing reads the words in the panel: which phrase stands for "marked done"
 * is the view's to reword, and `data-sort` is the contract.
 */

import * as assert from "node:assert";
import { Then, When } from "@cucumber/cucumber";

import {
  APP_CHROME,
  APP_CHROME_CONTROLS,
  APP_HEADER,
  COMMIT_BLOCKED,
  COMMIT_CHANGE,
  COMMIT_LAST,
  COMMIT_MESSAGE,
  COMMIT_NOW,
  COMMIT_PANEL,
  COMMIT_PILL,
  HYDRATION_TIMEOUT,
  oneLine,
  POLL_TIMEOUT,
  RETIRED_GIT_READOUT,
  TIP,
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

/** WHICH of the eight faces the pill is wearing. It is never absent — this
 *  feature is an audit trail, so "there is no audit trail here" is the most
 *  important thing it can say — which is why every assertion here is about the
 *  state it reports rather than about whether it is on screen.
 *
 *  The HYDRATION budget: the faces that come from the server's first survey
 *  arrive with the first frames of the subscription rather than after a click. */
Then(
  "the commit pill says {string}",
  async function (this: OlaiWorld, state: string) {
    await this.expectAttribute(
      COMMIT_PILL,
      "data-state",
      state,
      "the commit pill",
      HYDRATION_TIMEOUT,
    );
  },
);

/** The WORDS on it, which are not the same claim as the state behind them: a
 *  face renamed in the table and left saying the old thing is a page that reads
 *  wrong while every attribute passes. Contains rather than equals, because the
 *  mark and the caret beside the words are `aria-hidden` decoration. */
Then(
  "the commit pill reads {string}",
  async function (this: OlaiWorld, words: string) {
    const pill = this.page.locator(COMMIT_PILL);
    await pill.waitFor({ state: "visible", timeout: POLL_TIMEOUT });
    const shown = oneLine(await pill.innerText());
    assert.ok(
      shown.includes(words),
      `the commit pill says "${shown}", which does not read "${words}"`,
    );
  },
);

/** The REASON, off the `aria-label` — because it has to be readable without a
 *  pointer. The tip a pointer does open is checked by the step that already
 *  owns tips; this asserts the copy everybody else gets. */
Then(
  "the commit pill explains {string}",
  async function (this: OlaiWorld, reason: string) {
    const pill = this.page.locator(COMMIT_PILL);
    await pill.waitFor({ state: "visible", timeout: POLL_TIMEOUT });
    const said = (await pill.getAttribute("aria-label")) ?? "";
    assert.ok(
      said.includes(reason),
      `the commit pill's own sentence is "${said}", which does not mention ` +
        `"${reason}" — and it is the copy a reader with no pointer gets`,
    );
  },
);

/** Quiet: no warning mark at all. The healthy directory is the ordinary case,
 *  and chrome that cries in the ordinary case is chrome nobody reads in the
 *  rare one. */
Then("the commit pill is not alarming", async function (this: OlaiWorld) {
  const shown = oneLine(await this.page.locator(COMMIT_PILL).innerText());
  assert.ok(
    !shown.includes("⚠"),
    `the commit pill says "${shown}", which wears a warning it has no cause for`,
  );
});

/** And the other direction, which is the half that matters on a fault: the
 *  mark is what a reader SCANS for, and a face that lost its glyph would still
 *  pass every attribute and word assertion beside this one. */
Then("the commit pill is alarming", async function (this: OlaiWorld) {
  const pill = this.page.locator(COMMIT_PILL);
  await pill.waitFor({ state: "visible", timeout: POLL_TIMEOUT });
  const shown = oneLine(await pill.innerText());
  assert.ok(
    shown.includes("⚠"),
    `the commit pill says "${shown}", with no warning mark on a state that is one`,
  );
});

/** Open the tip, and leave the assertion to the step that already owns tips
 *  (`navigation_steps.ts`'s `a tip says …`, which also holds the rule this app
 *  learnt the hard way: exactly one tip on screen, ever). */
When("I hover the commit pill", async function (this: OlaiWorld) {
  const pill = this.page.locator(COMMIT_PILL);
  await pill.waitFor({ state: "visible", timeout: POLL_TIMEOUT });
  await pill.hover();
  await this.page
    .locator(TIP)
    .first()
    .waitFor({ state: "visible", timeout: POLL_TIMEOUT });
});

/**
 * The human's bug, as an assertion: ONE control in the header answers for git.
 *
 * There were two — this pill and the `● git` readout beside it — and the claim
 * is about the ROW rather than about the chip that went. "The old one is
 * absent" would pass for a twin under a new name, so the row's whole inventory
 * is named (`support/world.ts`'s `APP_CHROME_CONTROLS`) and anything else in it
 * fails here. The attribute the readout carried is checked too, which is the
 * case the inventory cannot see: a chip that arrives with no test id.
 *
 * Settle first: an absent element and a frame that has not arrived look
 * identical, and only one of them is the claim.
 */
Then("the header shows one git indicator", async function (this: OlaiWorld) {
  await this.waitForFrame();
  const header = this.page.locator(APP_HEADER);
  const chrome = header.locator(APP_CHROME);
  await chrome.waitFor({ state: "visible", timeout: POLL_TIMEOUT });

  const inside = await chrome.evaluate((row) =>
    [...row.querySelectorAll("[data-testid]")].map((el) =>
      el.getAttribute("data-testid") ?? ""
    )
  );
  assert.deepEqual(
    inside,
    [...APP_CHROME_CONTROLS],
    `the app's chrome row holds ${JSON.stringify(inside)}, and it is supposed to ` +
      `hold ${JSON.stringify(APP_CHROME_CONTROLS)} — one of those answers for git ` +
      "(the Commit pill) and a second one is the redundancy `one-git-indicator` closed",
  );
  assert.equal(
    await header.locator(RETIRED_GIT_READOUT).count(),
    0,
    "something in the header is reporting a git state of its own, beside the pill " +
      "that already does",
  );
});

Then("the commit pill cannot be pressed", async function (this: OlaiWorld) {
  // `aria-disabled`, not the `disabled` property: the pill stays focusable in
  // its inert faces on purpose, because the sentence explaining why nothing is
  // being recorded is the whole of the control in exactly those states, and a
  // disabled button takes no focus and so cannot be asked.
  await this.expectAttribute(
    COMMIT_PILL,
    "aria-disabled",
    "true",
    "the commit pill",
  );
});

Then(
  "the panel says the last commit was {string}",
  async function (this: OlaiWorld, said: string) {
    const last = await this.page
      .locator(COMMIT_LAST)
      .textContent({ timeout: POLL_TIMEOUT });
    assert.ok(
      (last ?? "").includes(said),
      `expected the last commit line to mention "${said}", but it says "${last}"`,
    );
  },
);

/** Open it, or leave it open. The pill TOGGLES — a step that clicked
 *  unconditionally would shut a panel that was already up, which is what a
 *  scenario asking twice actually meant to avoid. */
When("I open the commit panel", async function (this: OlaiWorld) {
  const panel = this.page.locator(COMMIT_PANEL);
  if (!(await panel.isVisible())) await this.page.locator(COMMIT_PILL).click();
  await panel.waitFor({ state: "visible", timeout: POLL_TIMEOUT });
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
