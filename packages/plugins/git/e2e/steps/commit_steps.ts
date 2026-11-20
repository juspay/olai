import * as assert from "node:assert";
import * as fs from "node:fs";
import * as path from "node:path";
import { Given, Then, When } from "@olai/tests/harness/runner.ts";
import { PLUGIN_TESTID } from "@olai/tests/harness/testids.ts";
import { selector } from "@olai/web/testlib";

import {
  APP_CHROME,
  APP_HEADER,
  attr,
  COMMIT_PANEL,
  COMMIT_PILL,
  COMMIT_RESUME,
  HEALTH_PANEL,
  HYDRATION_TIMEOUT,
  oneLine,
  PAST_QUIET_WINDOW,
  POLL_TIMEOUT,
  QUIET_WINDOW_STEP_TIMEOUT,
  QUIET_WINDOW_TIMEOUT,
  RETIRED_GIT_READOUT,
  TIP,
} from "@olai/tests/harness/world.ts";
import {
  COMMIT_AUTO_ARMED,
  COMMIT_AUTO_PAUSED,
  COMMIT_BLOCKED,
  COMMIT_CHANGE,
  COMMIT_LAST,
  COMMIT_MESSAGE,
  COMMIT_NOW,
  COMMIT_OTHER,
  COMMIT_PUSH,
  COMMIT_PUSH_REFUSED,
  COMMIT_REFUSED,
  COMMIT_LOCK_HELD,
  COMMIT_UNLOCK,
  COMMIT_UNLOCK_REFUSED,
  COMMIT_SCOPE,
  COMMIT_TICK,
  COMMIT_UNPUSHED,
} from "../selectors.ts";
import type { OlaiWorld } from "@olai/tests/harness/world.ts";
import { isRoot } from "../../src/git/fixtures.testlib.ts";

const COMMIT_BANNER = selector(PLUGIN_TESTID.gitNews);

Then("the phone commit banner says {int} uncommitted", async function (this: OlaiWorld, count: number) {
  await this.expectChromeAttribute(COMMIT_BANNER, "data-uncommitted", String(count), "the phone commit banner");
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

Then(
  "the commit pill says {int} uncommitted",
  async function (this: OlaiWorld, count: number) {
    await this.readStatus(() => this.expectChromeAttribute(
      COMMIT_PILL,
      "data-uncommitted",
      String(count),
      "the commit pill",
    ));
  },
);

Then(
  "the commit pill says {string}",
  async function (this: OlaiWorld, state: string) {
    await this.readStatus(() => this.expectChromeAttribute(
      COMMIT_PILL,
      "data-state",
      state,
      "the commit pill",
      HYDRATION_TIMEOUT,
    ));
  },
);

Then("the commit pill is live", async function (this: OlaiWorld) {
  await this.readStatus(async () => {
    const pill = this.page.locator(COMMIT_PILL);
    await pill.waitFor({ state: "visible", timeout: POLL_TIMEOUT });
    await this.waitUntil(
      async () => {
        const state = await pill.getAttribute("data-state");
        return state !== null && state !== "off" && state !== "unknown";
      },
      "the commit pill to read a live git state",
      HYDRATION_TIMEOUT,
    );
  });
});

Then(
  "the commit pill reads {string}",
  async function (this: OlaiWorld, words: string) {
    const shown = await this.readStatus(async () => {
      const pill = this.page.locator(COMMIT_PILL);
      await pill.waitFor({ state: "visible", timeout: POLL_TIMEOUT });
      return oneLine(await pill.innerText());
    });
    assert.ok(
      shown.includes(words),
      `the commit pill says "${shown}", which does not read "${words}"`,
    );
  },
);

Then(
  "the commit pill explains {string}",
  async function (this: OlaiWorld, reason: string) {
    const said = await this.readStatus(async () => {
      const pill = this.page.locator(COMMIT_PILL);
      await pill.waitFor({ state: "visible", timeout: POLL_TIMEOUT });
      return (await pill.getAttribute("aria-label")) ?? "";
    });
    assert.ok(
      said.includes(reason),
      `the commit pill's own sentence is "${said}", which does not mention ` +
        `"${reason}" — and it is the copy a reader with no pointer gets`,
    );
  },
);

const pillTone = (world: OlaiWorld): Promise<string | null> =>
  world.readStatus(async () => {
    const pill = world.page.locator(COMMIT_PILL);
    await pill.waitFor({ state: "visible", timeout: POLL_TIMEOUT });
    return pill.locator("[data-health]").getAttribute("data-health");
  });

Then("the commit pill is not alarming", async function (this: OlaiWorld) {
  const tone = await pillTone(this);
  assert.ok(
    tone !== "alarm" && tone !== "notice",
    `the commit pill's dot is "${tone}", a warning it has no cause for`,
  );
});

Then("the commit pill is alarming", async function (this: OlaiWorld) {
  const tone = await pillTone(this);
  assert.equal(tone, "alarm", `the commit pill's dot is "${tone}", on a state that is an alarm`);
});

When("I hover the commit pill", async function (this: OlaiWorld) {
  await this.openStatus();
  const pill = this.page.locator(COMMIT_PILL);
  await pill.waitFor({ state: "visible", timeout: POLL_TIMEOUT });
  await pill.hover();
  await this.page
    .locator(TIP)
    .first()
    .waitFor({ state: "visible", timeout: POLL_TIMEOUT });
});

Then("the header has no git indicator", async function (this: OlaiWorld) {
  await this.waitForFrame();
  const header = this.page.locator(APP_HEADER);
  const chrome = header.locator(APP_CHROME);
  await chrome.waitFor({ state: "visible", timeout: POLL_TIMEOUT });
  const rows = await this.readStatus(async () => {
    await this.page.locator(HEALTH_PANEL).waitFor({ state: "visible", timeout: POLL_TIMEOUT });
    return this.page.locator(`${HEALTH_PANEL} ${COMMIT_PILL}`).count();
  });
  assert.equal(
    await this.page.locator(COMMIT_PILL).count() + rows,
    0,
    "the commit readout is still in the chrome of a serve that did not mount git",
  );
});

Then("the header shows one git indicator", async function (this: OlaiWorld) {
  await this.waitForFrame();
  const header = this.page.locator(APP_HEADER);
  const chrome = header.locator(APP_CHROME);
  await chrome.waitFor({ state: "visible", timeout: POLL_TIMEOUT });
  assert.equal(
    await chrome.locator(COMMIT_PILL).count(),
    0,
    "a git chip is standing in the bar itself, beside the health dot that already folds it in",
  );
  const inside = await this.readStatus(async () => {
    const panel = this.page.locator(HEALTH_PANEL);
    await panel.waitFor({ state: "visible", timeout: POLL_TIMEOUT });
    return panel.evaluate((box) =>
      [...box.querySelectorAll("[data-testid]")].map((el) => el.getAttribute("data-testid") ?? "")
    );
  });
  const git = inside.filter((id) => id === PLUGIN_TESTID.commitPill);
  assert.equal(
    git.length,
    1,
    `the health popover holds ${JSON.stringify(inside)}; exactly one of those is ` +
      "the Commit readout — a second one is the redundancy `one-git-indicator` closed",
  );
  assert.equal(
    await header.locator(RETIRED_GIT_READOUT).count(),
    0,
    "something in the header is reporting a git state of its own, beside the readout " +
      "that already does",
  );
});

Then("the commit pill cannot be pressed", async function (this: OlaiWorld) {
  await this.readStatus(() => this.expectChromeAttribute(
      COMMIT_PILL,
    "aria-disabled",
    "true",
    "the commit pill",
  ));
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

Then(
  "the commit panel offers to resume auto-commit",
  async function (this: OlaiWorld) {
    const panel = this.page.locator(COMMIT_PANEL);
    if (!(await panel.isVisible())) {
      await this.openStatus();
      await this.page.locator(COMMIT_PILL).click();
    }
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
    if (!(await panel.isVisible())) {
      await this.openStatus();
      await this.page.locator(COMMIT_PILL).click();
    }
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
  if (!(await panel.isVisible())) {
      await this.openStatus();
      await this.page.locator(COMMIT_PILL).click();
    }
  await panel.waitFor({ state: "visible", timeout: POLL_TIMEOUT });
  const resume = this.page.locator(COMMIT_RESUME);
  await resume.waitFor({ state: "visible", timeout: POLL_TIMEOUT });
  await this.press(resume);
});

When("I open the commit panel", async function (this: OlaiWorld) {
  const panel = this.page.locator(COMMIT_PANEL);
  if (!(await panel.isVisible())) {
    await this.openStatus();
    await this.page.locator(`${COMMIT_PILL}, ${COMMIT_BANNER}`).click();
  }
  await panel.waitFor({ state: "visible", timeout: POLL_TIMEOUT });
});

When("I press the commit pill", async function (this: OlaiWorld) {
  await this.openStatus();
  await this.press(this.page.locator(COMMIT_PILL));
});

Then("the commit panel is shut", async function (this: OlaiWorld) {
  await this.page
    .locator(COMMIT_PANEL)
    .waitFor({ state: "hidden", timeout: POLL_TIMEOUT });
});

Then("the commit panel is open", async function (this: OlaiWorld) {
  await this.page
    .locator(COMMIT_PANEL)
    .waitFor({ state: "visible", timeout: POLL_TIMEOUT });
});

Then(
  "the change to {string} is {string}",
  async function (this: OlaiWorld, id: string, sort: string) {
    await this.expectChromeAttribute(
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

Then(
  "the last commit is {string} by {string}",
  async function (this: OlaiWorld, subject: string, writer: string) {
    await this.waitUntil(
      async () => this.git("log", "--format=%s", "-1").trim() === subject,
      `the last commit to be ${JSON.stringify(subject)}`,
    );
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

Then(
  "the commit pill says auto-commit is {string}",
  async function (this: OlaiWorld, state: string) {
    await this.readStatus(() => this.expectChromeAttribute(
      COMMIT_PILL,
      "data-auto",
      state,
      "the commit pill",
      HYDRATION_TIMEOUT,
    ));
  },
);

Then(
  "the commit pill says the push was refused",
  async function (this: OlaiWorld) {
    await this.readStatus(() => this.expectChromeAttribute(
      COMMIT_PILL,
      "data-push-refused",
      "true",
      "the commit pill",
      HYDRATION_TIMEOUT,
    ));
  },
);

Then(
  "the flurry records itself",
  { timeout: QUIET_WINDOW_STEP_TIMEOUT },
  async function (this: OlaiWorld) {
    await this.readStatus(() => this.expectChromeAttribute(
      COMMIT_PILL,
      "data-state",
      "committed",
      "the commit pill",
      QUIET_WINDOW_TIMEOUT,
    ));
  },
);

When(
  "the quiet window is given its full run",
  { timeout: QUIET_WINDOW_STEP_TIMEOUT },
  async function (this: OlaiWorld) {
    await this.page.waitForTimeout(PAST_QUIET_WINDOW);
  },
);

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

Then("the panel promises to record it on its own", async function (this: OlaiWorld) {
  await this.page
    .locator(COMMIT_AUTO_ARMED)
    .waitFor({ state: "visible", timeout: POLL_TIMEOUT });
});

Then("the panel promises nothing", async function (this: OlaiWorld) {
  assert.equal(
    await this.page.locator(COMMIT_AUTO_ARMED).count(),
    0,
    "the panel promises to record a list it has nothing in",
  );
});

Then("the panel says auto-commit is paused", async function (this: OlaiWorld) {
  const line = this.page.locator(COMMIT_AUTO_PAUSED);
  await line.waitFor({ state: "visible", timeout: POLL_TIMEOUT });
  const said = oneLine(await line.innerText());
  assert.ok(
    said.includes("Resume"),
    `the paused line says "${said}", which never says how to resume it`,
  );
});

Then("the panel says a push was refused", async function (this: OlaiWorld) {
  const line = this.page.locator(COMMIT_PUSH_REFUSED);
  await line.waitFor({ state: "visible", timeout: POLL_TIMEOUT });
  const said = oneLine(await line.innerText());
  assert.ok(
    said.includes("reject") || said.includes("CONFLICT"),
    `the refused-push line says "${said}", which is not git's own refusal`,
  );
});

Given(
  "somebody else has pushed {string} to the remote",
  function (this: OlaiWorld, subject: string) {
    this.advanceRemote(subject, { file: "their-file.md", content: `${subject}\n` });
  },
);

Given(
  "somebody else has rewritten {string} as:",
  function (this: OlaiWorld, file: string, contents: string) {
    this.advanceRemote("somebody else's work", { file, content: contents });
  },
);
Given(
  "somebody else has pushed a conflicting edit to {string}",
  function (this: OlaiWorld, file: string) {
    this.advanceRemote("somebody else's work", { file, content: "\"somebody else's\"\n" });
  },
);


Then("the served directory has {string}", function (this: OlaiWorld, file: string) {
  assert.ok(
    fs.existsSync(path.join(this.scratch(), file)),
    `the served directory has no ${file}`,
  );
});

Then("the repository is clean", function (this: OlaiWorld) {
  assert.strictEqual(this.git("status", "--porcelain").trim(), "");
});

When("HEAD is detached in the served repository", function (this: OlaiWorld) {
  this.git("checkout", "--quiet", "--detach", "HEAD");
});

const gitDirIn = (world: OlaiWorld): string =>
  world.git("rev-parse", "--absolute-git-dir").trim();

const plantLock = (world: OlaiWorld, ageMs: number): void => {
  const at = path.join(gitDirIn(world), "index.lock");
  fs.writeFileSync(at, "");
  const stamp = (Date.now() - ageMs) / 1000;
  fs.utimesSync(at, stamp, stamp);
};

Given("a stale lock file sits in the repository", function (this: OlaiWorld) {
  plantLock(this, 10 * 60_000);
});

Given("a fresh lock file sits in the repository", function (this: OlaiWorld) {
  plantLock(this, 0);
});

// Root can unlink from a directory it cannot write, so the step is PENDING there.
Given("the git directory cannot be written to", async function (this: OlaiWorld) {
  if (isRoot()) return "pending";
  fs.chmodSync(gitDirIn(this), 0o500);
});

When("the git directory can be written to again", async function (this: OlaiWorld) {
  if (isRoot()) return "pending";
  fs.chmodSync(gitDirIn(this), 0o700);
});

Then("the commit panel says a lock file is in the way", async function (this: OlaiWorld) {
  const line = this.page.locator(COMMIT_REFUSED);
  await line.waitFor({ state: "visible", timeout: POLL_TIMEOUT });
  const said = oneLine(await line.innerText());
  assert.ok(
    said.includes("lock file is in the way"),
    `the refusal line says "${said}", which is not the sentence about a lock file`,
  );
  const both = oneLine(await line.locator("xpath=..").innerText());
  assert.ok(
    both.includes("index.lock"),
    `the refusal line reads "${both}", which does not carry git's own words`,
  );
});

Then(
  "the commit panel says the lock was left {string}",
  async function (this: OlaiWorld, ago: string) {
    const words = `(left ${ago})`;
    try {
      await this.page
        .locator(`${COMMIT_REFUSED}:has-text(${JSON.stringify(words)})`)
        .waitFor({ state: "visible", timeout: POLL_TIMEOUT });
    } catch {
      const said = await this.page.locator(COMMIT_REFUSED).textContent({ timeout: POLL_TIMEOUT });
      assert.fail(
        `the refusal line to say the lock was left ${JSON.stringify(ago)}, ` +
          `and it says ${JSON.stringify(oneLine(said ?? ""))}`,
      );
    }
  },
);

Then("the commit panel offers to remove the lock file", async function (this: OlaiWorld) {
  await this.page.locator(COMMIT_UNLOCK)
    .waitFor({ state: "visible", timeout: POLL_TIMEOUT });
});

Then("the commit panel does not offer to remove a lock file", async function (this: OlaiWorld) {
  await this.page.locator(COMMIT_UNLOCK)
    .waitFor({ state: "hidden", timeout: POLL_TIMEOUT });
});

When("I remove the lock file and retry", async function (this: OlaiWorld) {
  await this.page.locator(COMMIT_UNLOCK).click({ timeout: POLL_TIMEOUT });
});

Then("the panel says a git process may still be writing", async function (this: OlaiWorld) {
  const line = this.page.locator(COMMIT_LOCK_HELD);
  await line.waitFor({ state: "visible", timeout: POLL_TIMEOUT });
  const said = oneLine(await line.innerText());
  assert.ok(
    said.includes("may still be writing"),
    `the held line says "${said}", which does not say why nothing was removed`,
  );
});

Then("the panel says the lock could not be removed", async function (this: OlaiWorld) {
  const line = this.page.locator(COMMIT_UNLOCK_REFUSED);
  await line.waitFor({ state: "visible", timeout: POLL_TIMEOUT });
  const said = oneLine(await line.innerText());
  assert.ok(
    said.includes("permission denied"),
    `the unlock refusal says "${said}", which does not name the errno`,
  );
});

Then(
  "the panel lists {string} as {string}",
  async function (this: OlaiWorld, file: string, how: string) {
    await this.expectChromeAttribute(
      `${COMMIT_OTHER}${attr("data-path", file)}`,
      "data-how",
      how,
      `the pending file "${file}"`,
    );
  },
);

Then(
  "the panel says it covers the whole repository",
  async function (this: OlaiWorld) {
    const said = await this.page
      .locator(COMMIT_SCOPE)
      .textContent({ timeout: POLL_TIMEOUT });
    assert.ok(
      (said ?? "").includes("Whole repository"),
      `expected the scope line to say what it covers, but it says "${said}"`,
    );
  },
);

When(
  "I untick {string}",
  async function (this: OlaiWorld, file: string) {
    await this.page
      .locator(`${COMMIT_TICK}${attr("data-path", file)}`)
      .uncheck({ timeout: POLL_TIMEOUT });
  },
);

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

Given("the served repository has a remote", function (this: OlaiWorld) {
  this.giveRemote();
});

Then(
  "the commit pill says {int} unpushed",
  async function (this: OlaiWorld, count: number) {
    await this.readStatus(() => this.expectChromeAttribute(
      COMMIT_PILL,
      "data-unpushed",
      String(count),
      "the unpushed count on the pill",
    ));
  },
);

Then(
  "the panel offers to push {int} commits",
  async function (this: OlaiWorld, count: number) {
    await this.expectChromeAttribute(
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
Then(
  "the remote has taken in {string} before this commit",
  function (this: OlaiWorld, subject: string) {
    const remoteTip = this.remoteGit("log", "--format=%s", "-1", "main").trim();
    const all = this.remoteGit("log", "--format=%s", "main").split("\n");
    assert.ok(
      all.length >= 2 && all[1] === subject,
      `expected the remote to hold "${subject}" as the tip's parent, but its log is: ${all.join(", ")}`,
    );
    assert.notStrictEqual(remoteTip, subject);
  },
);

Then(
  "the remote has {string}",
  function (this: OlaiWorld, subject: string) {
    assert.strictEqual(
      this.remoteGit("log", "--format=%s", "-1", "main").trim(),
      subject,
    );
  },
);


