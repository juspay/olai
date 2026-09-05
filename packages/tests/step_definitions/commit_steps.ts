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
import { Given, Then, When } from "@cucumber/cucumber";
import { PLUGIN_TESTID } from "@olai/bundle/testids";
import { selector } from "@olai/web/testlib";

import {
  APP_CHROME,
  APP_HEADER,
  attr,
  COMMIT_AUTO_ARMED,
  COMMIT_AUTO_PAUSED,
  COMMIT_BLOCKED,
  COMMIT_CHANGE,
  COMMIT_LAST,
  COMMIT_MESSAGE,
  COMMIT_NOW,
  COMMIT_OTHER,
  COMMIT_PANEL,
  COMMIT_PILL,
  COMMIT_PUSH,
  COMMIT_PUSH_REFUSED,
  COMMIT_RESUME,
  COMMIT_SCOPE,
  COMMIT_TICK,
  COMMIT_UNPUSHED,
  HYDRATION_TIMEOUT,
  oneLine,
  PAST_QUIET_WINDOW,
  POLL_TIMEOUT,
  QUIET_WINDOW_STEP_TIMEOUT,
  QUIET_WINDOW_TIMEOUT,
  RETIRED_GIT_READOUT,
  TIP,
} from "../support/world.ts";
import type { OlaiWorld } from "../support/world.ts";

const COMMIT_BANNER = selector(PLUGIN_TESTID.gitNews);

Then("the phone commit banner says {int} uncommitted", async function (this: OlaiWorld, count: number) {
  await this.expectAttribute(COMMIT_BANNER, "data-uncommitted", String(count), "the phone commit banner");
});

When("I tap the commit banner", async function (this: OlaiWorld) {
  await this.press(this.page.locator(COMMIT_BANNER), "tap");
});

Then("the phone commit banner is gone", async function (this: OlaiWorld) {
  await this.page.locator(COMMIT_BANNER).waitFor({ state: "hidden", timeout: POLL_TIMEOUT });
});

Then("the phone commit banner sits below the header", async function (this: OlaiWorld) {
  const header = await this.box(this.page.locator(APP_HEADER), "app header");
  const banner = await this.box(this.page.locator(COMMIT_BANNER), "commit banner");
  assert.ok(Math.abs(banner.y - header.y - header.height) <= 1,
    `commit banner starts at ${banner.y}, header ends at ${header.y + header.height}`);
});

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
 * There were two — this pill and the `● git` readout beside it. The claim is
 * that count, not the chrome row's whole membership: plugin Headers grow in
 * registry order with no bar edit (`web`'s `plugins/Chrome.tsx`), so a closed
 * set of every testid in the row breaks on a legitimate new pill (spaces,
 * the next one). "The old one is absent" would still pass for a twin under
 * a new name, so the retired readout's attribute is checked too — a chip
 * that arrives with no test id of its own.
 *
 * Settle first: an absent element and a frame that has not arrived look
 * identical, and only one of them is the claim.
 */
Then("the header has no git indicator", async function (this: OlaiWorld) {
  await this.waitForFrame();
  const header = this.page.locator(APP_HEADER);
  const chrome = header.locator(APP_CHROME);
  await chrome.waitFor({ state: "visible", timeout: POLL_TIMEOUT });
  assert.equal(
    await header.locator(COMMIT_PILL).count(),
    0,
    "the commit pill is still in the header of a serve that did not mount git",
  );
});

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
  const git = inside.filter((id) => id === PLUGIN_TESTID.commitPill);
  assert.equal(
    git.length,
    1,
    `the chrome row holds ${JSON.stringify(inside)}; exactly one of those is ` +
      "the Commit pill — a second one is the redundancy `one-git-indicator` closed",
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
Then(
  "the commit panel offers to resume auto-commit",
  async function (this: OlaiWorld) {
    const panel = this.page.locator(COMMIT_PANEL);
    if (!(await panel.isVisible())) await this.page.locator(COMMIT_PILL).click();
    await panel.waitFor({ state: "visible", timeout: POLL_TIMEOUT });
    await this.page
      .locator(COMMIT_RESUME)
      .waitFor({ state: "visible", timeout: POLL_TIMEOUT });
  },
);

Then(
  "the commit panel does not offer to resume auto-commit",
  async function (this: OlaiWorld) {
    const panel = this.page.locator(COMMIT_PANEL);
    if (!(await panel.isVisible())) await this.page.locator(COMMIT_PILL).click();
    await panel.waitFor({ state: "visible", timeout: POLL_TIMEOUT });
    assert.equal(
      await this.page.locator(COMMIT_RESUME).count(),
      0,
      "the commit panel offers to resume a loop that is not stopped",
    );
  },
);

When("I resume auto-commit", async function (this: OlaiWorld) {
  const panel = this.page.locator(COMMIT_PANEL);
  if (!(await panel.isVisible())) await this.page.locator(COMMIT_PILL).click();
  await panel.waitFor({ state: "visible", timeout: POLL_TIMEOUT });
  const resume = this.page.locator(COMMIT_RESUME);
  await resume.waitFor({ state: "visible", timeout: POLL_TIMEOUT });
  await this.press(resume);
});

When("I open the commit panel", async function (this: OlaiWorld) {
  const panel = this.page.locator(COMMIT_PANEL);
  if (!(await panel.isVisible())) await this.page.locator(`${COMMIT_PILL}, ${COMMIT_BANNER}`).click();
  await panel.waitFor({ state: "visible", timeout: POLL_TIMEOUT });
});

/** Unconditionally, unlike the step above: the scenario that presses it a
 *  SECOND time is asking what that press does. */
When("I press the commit pill", async function (this: OlaiWorld) {
  await this.press(this.page.locator(COMMIT_PILL));
});

Then("the commit panel is shut", async function (this: OlaiWorld) {
  await this.page
    .locator(COMMIT_PANEL)
    .waitFor({ state: "hidden", timeout: POLL_TIMEOUT });
});

Then(
  "the change to {string} is {string}",
  async function (this: OlaiWorld, id: string, sort: string) {
    await this.expectAttribute(
      `${COMMIT_CHANGE}${attr("data-node-id", id)}`,
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

When("I draft the commit message {string}", async function (this: OlaiWorld, message: string) {
  await this.page.locator(COMMIT_MESSAGE).fill(message);
});

Then("the commit message still reads {string}", async function (this: OlaiWorld, message: string) {
  await this.page.locator(COMMIT_MESSAGE).waitFor({ state: "visible", timeout: POLL_TIMEOUT });
  assert.strictEqual(await this.page.locator(COMMIT_MESSAGE).inputValue(), message);
});

When("I submit the drafted commit", async function (this: OlaiWorld) {
  await this.page.locator(COMMIT_NOW).click();
});

Given("git signing cannot run in this repository", function (this: OlaiWorld) {
  this.git("config", "commit.gpgsign", "true");
  this.git("config", "gpg.program", `${this.scratch()}/no-such-signing-program`);
});

When("I turn off signing in this repository", function (this: OlaiWorld) {
  this.git("config", "commit.gpgsign", "false");
});

When("I tick {string}", async function (this: OlaiWorld, file: string) {
  await this.page.locator(`${COMMIT_TICK}${attr("data-path", file)}`).check({ timeout: POLL_TIMEOUT });
});

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

// ── Auto-commit ────────────────────────────────────────────────────────

/**
 * What the loop is doing IN THIS BROWSER — `off`, `armed`, `paused`.
 *
 * Its own attribute rather than one of the pill's eight faces, and the steps
 * follow the app: the faces are claims about the DIRECTORY, and this is a claim
 * about the reader, so a scenario that asserted "the pill says auto-commit" for
 * a state two tabs could disagree about would be asserting the wrong thing.
 */
Then(
  "the commit pill says auto-commit is {string}",
  async function (this: OlaiWorld, state: string) {
    await this.expectAttribute(
      COMMIT_PILL,
      "data-auto",
      state,
      "the commit pill",
      HYDRATION_TIMEOUT,
    );
  },
);

/**
 * WHETHER THE LAST PUSH WAS REFUSED — the fact `push-failure-invisible` was
 * filed about, as an attribute rather than a sentence.
 *
 * Its own attribute beside the eight faces for the reason the pause has one: a
 * repository whose commits all land and whose push will not go is healthy on
 * one question and broken on the other, and one word could not say both. What
 * the reader SEES of it — the ⚠ instead of the ✓, git's own words on the label
 * — is asserted by the alarming/reads/explains steps above.
 */
Then(
  "the commit pill says the push was refused",
  async function (this: OlaiWorld) {
    await this.expectAttribute(
      COMMIT_PILL,
      "data-push-refused",
      "true",
      "the commit pill",
      HYDRATION_TIMEOUT,
    );
  },
);

/**
 * The flurry landing — the one step in this suite that waits out the SERVER's
 * quiet window.
 *
 * Its own budget (`QUIET_WINDOW_TIMEOUT`) and its own step envelope, for the
 * reason the world file gives: the window is a claim about the product and is
 * not shortened to suit a test, and no other step should inherit a wait this
 * wide.
 */
Then(
  "the flurry records itself",
  { timeout: QUIET_WINDOW_STEP_TIMEOUT },
  async function (this: OlaiWorld) {
    await this.expectAttribute(
      COMMIT_PILL,
      "data-state",
      "committed",
      "the commit pill",
      QUIET_WINDOW_TIMEOUT,
    );
  },
);

/**
 * Give the quiet window its full run and look afterwards — the only way to say
 * a timer did NOT fire.
 *
 * A bare wait, and it is named as one: what follows it is whatever the scenario
 * wanted to still be true, and the value of the step is that the window has
 * demonstrably had its chance. The one scenario that needs it is the stop —
 * "nothing goes round again" is a claim about a timer nobody re-armed, and an
 * assertion made a moment after the edit would pass just as well against a loop
 * that was about to record.
 */
When(
  "the quiet window is given its full run",
  { timeout: QUIET_WINDOW_STEP_TIMEOUT },
  async function (this: OlaiWorld) {
    await this.page.waitForTimeout(PAST_QUIET_WINDOW);
  },
);

/**
 * How many commits olai has made here — the whole claim of the debounce.
 *
 * Counted out of the log by the prefix every olai commit carries, because "one
 * commit and not five" is the thing a burst of edits is being asked, and no
 * amount of chrome can answer it.
 */
Then(
  "olai has recorded {int} commit(s) here",
  function (this: OlaiWorld, count: number) {
    const log = this.git("log", "--format=%s", "--grep", "^olai").trim();
    const commits = log === "" ? [] : log.split("\n");
    assert.strictEqual(
      commits.length,
      count,
      `olai's commits here are ${JSON.stringify(commits)}`,
    );
  },
);

/** The panel's promise while the loop is armed and something is waiting. */
Then("the panel promises to record it on its own", async function (this: OlaiWorld) {
  await this.page
    .locator(COMMIT_AUTO_ARMED)
    .waitFor({ state: "visible", timeout: POLL_TIMEOUT });
});

/**
 * ... and its absence, which is the half that regressed.
 *
 * The promise is the SERVER's own gate asked by the panel, and the term the
 * panel's shorter copy of it had lost is that something is waiting: on a clean
 * tree under `--commit=auto` the policy is still the window and the repository
 * is still ready, so it printed "Auto-commit will record all of this as one
 * commit once the edits stop" over an empty list.
 */
Then("the panel promises nothing", async function (this: OlaiWorld) {
  assert.equal(
    await this.page.locator(COMMIT_AUTO_ARMED).count(),
    0,
    "the panel promises to record a list it has nothing in",
  );
});

/**
 * ... and the line a STOPPED loop leaves in the panel.
 *
 * It asserts the GESTURE rather than git's words, and that is the app's shape
 * rather than a weaker test: git's refusal is a line of its own further down,
 * beside the verb that produced it, and the header's own sentence carries it
 * for a reader with no pointer — which is what "the commit pill explains" asks
 * for. What is unique to this line is that a stopped loop can be started again.
 */
Then("the panel says auto-commit is paused", async function (this: OlaiWorld) {
  const line = this.page.locator(COMMIT_AUTO_PAUSED);
  await line.waitFor({ state: "visible", timeout: POLL_TIMEOUT });
  const said = oneLine(await line.innerText());
  assert.ok(
    said.includes("Resume"),
    `the paused line says "${said}", which never says how to resume it`,
  );
});

/** ... and git's own account of the push it refused, in the panel, verbatim.
 *  It comes off the CELL, so it is readable by whoever opens the panel rather
 *  than only by the tab that happened to make the request. */
Then("the panel says a push was refused", async function (this: OlaiWorld) {
  const line = this.page.locator(COMMIT_PUSH_REFUSED);
  await line.waitFor({ state: "visible", timeout: POLL_TIMEOUT });
  const said = oneLine(await line.innerText());
  assert.ok(
    said.includes("reject"),
    `the refused-push line says "${said}", which is not git's own refusal`,
  );
});

/** THE CONFLICT, in the only shape a single user meets it: another machine —
 *  or a colleague — has pushed, so this branch's upstream has moved and a push
 *  from here is a non-fast-forward. Real git, a real bare remote, and no
 *  network. */
Given(
  "somebody else has pushed to the remote",
  function (this: OlaiWorld) {
    this.advanceRemote("somebody else's work");
  },
);

Then("the repository is clean", function (this: OlaiWorld) {
  assert.strictEqual(this.git("status", "--porcelain").trim(), "");
});

When("HEAD is detached in the served repository", function (this: OlaiWorld) {
  this.git("checkout", "--quiet", "--detach", "HEAD");
});

// ── the whole repository ───────────────────────────────────────────────

/**
 * A file that is NOT an outline, waiting in the panel — the bug this feature
 * was filed for, as an assertion.
 *
 * `data-how` rather than the chip's words: which phrase stands for a file git
 * has never seen is the view's to reword, and the status is the contract.
 */
Then(
  "the panel lists {string} as {string}",
  async function (this: OlaiWorld, file: string, how: string) {
    await this.expectAttribute(
      `${COMMIT_OTHER}${attr("data-path", file)}`,
      "data-how",
      how,
      `the pending file "${file}"`,
    );
  },
);

/** The scope the panel reports on. New because the scope is new: a `README.md`
 *  above the outlines is a row in that list, and a reader who is not told that
 *  has to work out why. */
Then(
  "the panel says it covers the whole repository",
  async function (this: OlaiWorld) {
    const said = await this.page
      .locator(COMMIT_SCOPE)
      .textContent({ timeout: POLL_TIMEOUT });
    assert.ok(
      (said ?? "").includes("whole repository"),
      `expected the scope line to say what it covers, but it says "${said}"`,
    );
  },
);

/** Leave one file OUT of this commit. What is unticked stays waiting, for its
 *  own commit and its own message. */
When(
  "I untick {string}",
  async function (this: OlaiWorld, file: string) {
    await this.page
      .locator(`${COMMIT_TICK}${attr("data-path", file)}`)
      .uncheck({ timeout: POLL_TIMEOUT });
  },
);

/** What the button is offering to do, which follows the ticks: unticking a
 *  file has to change the offer, or the piecemeal selection is a lie about what
 *  pressing it will record. */
Then(
  "the commit button offers {string}",
  async function (this: OlaiWorld, words: string) {
    const button = this.page.locator(COMMIT_NOW);
    await button.waitFor({ state: "visible", timeout: POLL_TIMEOUT });
    await this.page.waitForFunction(
      ([selector, expected]) =>
        (document.querySelector(selector!)?.textContent ?? "").includes(expected!),
      [COMMIT_NOW, words] as const,
      { timeout: POLL_TIMEOUT },
    );
  },
);

/** Exactly which files the commit named — the whole point of a piecemeal
 *  commit, and the one thing about it that is permanent. */
Then(
  "the last commit touched exactly {string}",
  function (this: OlaiWorld, files: string) {
    const wanted = files.split(",").map((file) => file.trim()).sort();
    const touched = this.git("show", "--name-only", "--format=", "HEAD")
      .trim()
      .split("\n")
      .filter((line) => line !== "")
      .sort();
    assert.deepEqual(touched, wanted);
  },
);
Then(
  "{string} is still waiting in the repository",
  function (this: OlaiWorld, file: string) {
    const waiting = this.git("status", "--porcelain", "--", file).trim();
    assert.ok(
      waiting !== "",
      `expected "${file}" to be left uncommitted, but git says the tree is clean for it`,
    );
  },
);

// ── pushing ────────────────────────────────────────────────────────────

/** Somewhere to push to: a bare repository on disk, wired up as `origin` with
 *  the branch tracking it. Real git, no network. */
Given("the served repository has a remote", function (this: OlaiWorld) {
  this.giveRemote();
});

/** The header's own count of what is recorded here and nowhere else — the
 *  human's ruling at dispatch: one indicator, and the unpushed count is on it
 *  rather than only inside the panel. */
Then(
  "the commit pill says {int} unpushed",
  async function (this: OlaiWorld, count: number) {
    await this.expectAttribute(
      COMMIT_PILL,
      "data-unpushed",
      String(count),
      "the commit pill",
    );
  },
);

Then(
  "the panel offers to push {int} commits",
  async function (this: OlaiWorld, count: number) {
    await this.expectAttribute(
      COMMIT_UNPUSHED,
      "data-commits",
      String(count),
      "the unpushed line",
    );
  },
);

When("I push", async function (this: OlaiWorld) {
  await this.page.locator(COMMIT_PUSH).click({ timeout: POLL_TIMEOUT });
});

/** What actually arrived at the other end. The whole reason the button exists
 *  is that a person should not have to check this by hand — so the test does. */
Then(
  "the remote has {string}",
  function (this: OlaiWorld, subject: string) {
    assert.strictEqual(
      this.remoteGit("log", "--format=%s", "-1", "main").trim(),
      subject,
    );
  },
);
