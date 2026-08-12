/**
 * Editing the files underneath a running server, and asking what the page did
 * about it.
 *
 * The WRITES go through `world.writeServed`, which refuses unless the scenario
 * asked for a scratch copy — the shared corpora are tracked fixtures and every
 * other scenario is reading them.
 *
 * There are no assertions here about what an error SAYS: those are the same two
 * questions the error-view feature asks, and they live in `support/errors.ts`
 * so that both features ask them the same way. What is left is the handful of
 * steps that are about liveness itself — an outline marked unreadable, a banner
 * that has to go away, and the MEMBERSHIP of what is drawn.
 *
 * That last one is the lesson of the live-dead diagnosis: asserting that some
 * title eventually reads a certain way passes over a tree that has lost a node
 * and drawn another one twice. So the id multiset is asserted whole — which is
 * what a mis-merged snapshot actually breaks.
 */

import * as assert from "node:assert";
import * as fs from "node:fs";
import { Then, When } from "@cucumber/cucumber";

import { expectCodeIn, expectSiteIn } from "../support/errors.ts";
import {
  BACKSTOP_TIMEOUT,
  NODE,
  OUTLINE_FAILURE,
  OUTLINE_LINK,
  POLL_TIMEOUT,
  STALE_BANNER,
} from "../support/world.ts";
import type { OlaiWorld } from "../support/world.ts";

// ── writing ────────────────────────────────────────────────────────────

When(
  "I rewrite {string} as:",
  function (this: OlaiWorld, file: string, contents: string) {
    this.writeServed(file, contents);
  },
);

When("I delete {string}", function (this: OlaiWorld, file: string) {
  this.removeServed(file);
});

/**
 * The served directory itself goes away under the running server.
 *
 * The store's OTHER failure — not a file it cannot parse, but a tree it cannot
 * read at all. A vanished directory is the one shape of it a test can make
 * happen on any machine: EACCES needs a non-root user and ENOSPC needs a full
 * disk, and all three arrive at the probe as the same `PlatformFailure`.
 *
 * Putting it BACK is `I rewrite`, which makes the directories it needs — so
 * the recovery half is the same steps every other liveness scenario uses, and
 * what only an e2e can say is that both halves reach a reader.
 */
When("the served directory is taken away", function (this: OlaiWorld) {
  fs.rmSync(this.scratch(), { recursive: true, force: true });
});

// ── what is actually drawn ─────────────────────────────────────────────

/** Every node of one file currently in the tree, as `id` and `id@line` lists.
 *
 *  Read together and in DOM order: the ids are what the assertion compares, and
 *  the lines are what makes a failure legible — "`palette` twice, `mid` missing,
 *  lines 1,3,4,…,19,19" says which merge went wrong, where a bare set difference
 *  would not. Scoped by `data-file` because a mirror renders another file's
 *  subtree inside this one, and those nodes are that file's, not this one's. */
const drawn = async (
  world: OlaiWorld,
  file: string,
): Promise<{ ids: string[]; sites: string[] }> => {
  const rendered = await world.page
    .locator(`${NODE}[data-file="${file}"]`)
    .evaluateAll((nodes) =>
      nodes.map((node) => ({
        id: node.getAttribute("data-node-id") ?? "?",
        line: node.getAttribute("data-line") ?? "?",
      })),
    );
  return {
    ids: rendered.map((node) => node.id),
    sites: rendered.map((node) => `${node.id}@${node.line}`),
  };
};

/** Same members, same number of times. Sorted, so the comparison is about
 *  MEMBERSHIP and not about draw order — the order is the outline's own (`ord`),
 *  and the scenarios that care about it say so with their own assertions. */
const sameMultiset = (
  shown: ReadonlyArray<string>,
  expected: ReadonlyArray<string>,
): boolean => {
  if (shown.length !== expected.length) return false;
  const a = [...shown].sort();
  const b = [...expected].sort();
  return a.every((id, index) => id === b[index]);
};

/** What is wrong with it, in the words a reader of the failure needs: the ones
 *  drawn too often, and the ones not drawn at all. */
const countOf = (ids: ReadonlyArray<string>): Map<string, number> => {
  const counts = new Map<string, number>();
  for (const id of ids) counts.set(id, (counts.get(id) ?? 0) + 1);
  return counts;
};

Then(
  "the outline {string} shows exactly the nodes {string}",
  async function (this: OlaiWorld, file: string, wanted: string) {
    const expected = wanted
      .split(",")
      .map((id) => id.trim())
      .filter((id) => id.length > 0);
    // The edit is still in flight when this step starts (a probe, a revalidate,
    // a frame), so this polls rather than reads once. `seen` is kept outside the
    // predicate so the failure can quote the LAST state rather than re-reading a
    // tree that may have moved on.
    let seen: { ids: string[]; sites: string[] } = { ids: [], sites: [] };
    try {
      await this.waitUntil(async () => {
        seen = await drawn(this, file);
        return sameMultiset(seen.ids, expected);
      }, `${file} shows exactly ${expected.length} nodes: ${expected.join(", ")}`);
    } catch {
      const shownCounts = countOf(seen.ids);
      const expectedCounts = countOf(expected);
      const twice = [...shownCounts]
        .filter(([id, n]) => n > (expectedCounts.get(id) ?? 0))
        .map(([id, n]) => `${id} ×${n}`);
      const missing = [...expectedCounts]
        .filter(([id, n]) => n > (shownCounts.get(id) ?? 0))
        .map(([id]) => id);
      throw new Error(
        `${file} does not show the nodes it should.\n` +
          `  drawn (id@line): ${seen.sites.join(", ") || "(nothing)"}\n` +
          `  expected: ${expected.join(", ")}\n` +
          (missing.length > 0 ? `  MISSING: ${missing.join(", ")}\n` : "") +
          (twice.length > 0 ? `  DRAWN TOO OFTEN: ${twice.join(", ")}\n` : ""),
      );
    }
  },
);

// ── one outline that could not be read ─────────────────────────────────

Then(
  "the outline {string} is marked unreadable",
  async function (this: OlaiWorld, file: string) {
    await this.page
      .locator(`${OUTLINE_LINK}[data-file="${file}"][data-broken="true"]`)
      .waitFor({ state: "visible", timeout: POLL_TIMEOUT });
  },
);

When(
  "I open the unreadable outline {string}",
  async function (this: OlaiWorld, file: string) {
    // Not "I open the outline": that step waits for a tree, and the whole point
    // of this one is that there will never be a tree to wait for.
    await this.showSidebar();
    await this.outlineLink(file).click();
    await this.page
      .locator(`${OUTLINE_FAILURE}[data-file="${file}"]`)
      .waitFor({ state: "visible", timeout: POLL_TIMEOUT });
  },
);

Then(
  "the outline failure shows an error at {string}",
  async function (this: OlaiWorld, site: string) {
    await expectSiteIn(this.page.locator(OUTLINE_FAILURE), site, "this outline's place");
  },
);

Then(
  "the outline failure shows an error with code {string}",
  async function (this: OlaiWorld, code: string) {
    await expectCodeIn(this.page.locator(OUTLINE_FAILURE), code, "this outline's place");
  },
);

// ── the whole set, held ────────────────────────────────────────────────

Then("the stale banner is shown", async function (this: OlaiWorld) {
  await this.page
    .locator(STALE_BANNER)
    .waitFor({ state: "visible", timeout: POLL_TIMEOUT });
});

/**
 * The same claim, on the budget a change to the ROOT ITSELF needs.
 *
 * Its own step rather than a longer default, so exactly one scenario pays: an
 * edit INSIDE the directory is seen by the watcher and lands in milliseconds,
 * and every scenario asserting one keeps the interaction budget. A directory
 * that was removed is the case no watcher reports on both platforms, so the
 * probe that notices is the unconditional sweep — prompt on Linux, a backstop
 * away on macOS, and the same product on each.
 */
Then("the stale banner eventually appears", async function (this: OlaiWorld) {
  await this.page
    .locator(STALE_BANNER)
    .waitFor({ state: "visible", timeout: BACKSTOP_TIMEOUT });
});

Then(
  "the stale banner says {string}",
  async function (this: OlaiWorld, text: string) {
    const banner = this.page.locator(STALE_BANNER);
    await banner.waitFor({ state: "visible", timeout: POLL_TIMEOUT });
    assert.ok(
      (await banner.innerText()).includes(text),
      `the banner to say "${text}"`,
    );
  },
);

Then("the stale banner is gone", async function (this: OlaiWorld) {
  await this.waitUntil(
    async () => (await this.page.locator(STALE_BANNER).count()) === 0,
    "the banner is gone, so the set on disk validates again",
  );
});

Then("no stale banner is shown", async function (this: OlaiWorld) {
  // No wait: this asserts that a degrade did NOT escalate to holding the whole
  // set, and waiting for a banner that must not appear would only make the
  // suite slower at saying so. The step before it has already waited for the
  // change to land.
  assert.strictEqual(
    await this.page.locator(STALE_BANNER).count(),
    0,
    "the last-good banner is on screen; this change should have cost one outline, not the set",
  );
});

Then(
  "the stale banner shows an error with code {string}",
  async function (this: OlaiWorld, code: string) {
    await expectCodeIn(this.page.locator(STALE_BANNER), code, "the banner");
  },
);
