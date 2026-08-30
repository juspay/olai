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
import * as path from "node:path";
import { Then, When } from "@cucumber/cucumber";

import { retargetRelative } from "@olai/format";

import { expectCodeIn, expectSiteIn, rowsIn } from "../support/errors.ts";
import { askResync } from "../support/scratch.ts";
import {
  attr,
  BACKSTOP_STEP_TIMEOUT,
  BACKSTOP_TIMEOUT,
  BROKEN_FILE_LINE,
  BROKEN_FILE_LINK,
  ERROR_ROW,
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

/**
 * Make a served file unreadable under a running server — chmod 000, the one
 * shape of "there and will not open" a test can produce on any machine that
 * is not root.
 *
 * Root can read a 0000 file, so the step is pending there rather than
 * inverted (`@olai/server`'s `media.test.ts` makes the same call).
 */
When(
  "the served file {string} cannot be read",
  async function (this: OlaiWorld, file: string) {
    if (typeof process.getuid === "function" && process.getuid() === 0) {
      return "pending";
    }
    const target = path.join(this.scratch(), file);
    fs.chmodSync(target, 0o000);
    // chmod does not change size; a same-second stamp miss would skip the
    // read. The POST asks for the store's verified class, which is the same
    // door a restore asks the still-running server to look through.
    await askResync(this.baseUrl, POLL_TIMEOUT);
  },
);

/**
 * Somebody else, writing, mid-scenario.
 *
 * The same door as `I rewrite` — a file changing under a running server — but
 * ADDING rather than replacing, which is what makes it usable in the middle of
 * a scenario that is testing keys: a rewrite would also revert whatever they
 * just did. The ids are fixed and named in the feature, so a scenario can
 * point at the row afterwards and say it is still there. What it is FOR is the
 * claim undo exists to make: an inverse is judged against the set as it is, so
 * taking your own edit back leaves everybody else's alone.
 */
When(
  "another writer adds {string} to {string}",
  function (this: OlaiWorld, title: string, file: string) {
    this.appendServed(file, { id: "outsider", ord: "z0", title });
  },
);

/**
 * Somebody else, writing a BODY — the same door as the step above, one file-
 * kind over, and the same step for both of the kinds that have one: what
 * `appendServedLine` does to a `.md` it does to a `.html`, and the noun is the
 * only thing a scenario about a preview needs to say differently.
 *
 * A LINE ADDED rather than the file replaced, and that is what makes it usable
 * in a scenario whose subject is the page NOT MOVING: the claim is about the
 * same document with one more line in it, and a second copy of the doc string
 * in the feature would be sixty lines a later editor has to keep byte-identical
 * by hand — or the scenario quietly stops testing a rewrite and starts testing
 * a different file.
 */
When(
  "another writer appends {string} to the document/page {string}",
  function (this: OlaiWorld, line: string, file: string) {
    this.appendServedLine(file, line);
  },
);

/** A row RETITLED under everybody's feet. What it is for is the one thing a
 *  text undo must never do: put back what this tab replaced, on top of words
 *  somebody else has since written. */
When(
  "another writer retitles {string} to {string} in {string}",
  function (this: OlaiWorld, id: string, title: string, file: string) {
    const records = this.servedNodes(file).map((node) =>
      node["id"] === id ? { ...node, title } : node
    );
    assert.ok(
      records.some((node) => node["id"] === id),
      `${file} holds no node \`${id}\` to retitle`,
    );
    this.writeServed(file, records.map((node) => JSON.stringify(node)).join("\n"));
  },
);

/** A row REPARENTED under everybody's feet — the anchor an undo recorded,
 *  moved somewhere that anchor no longer means. Lifting it to the top level is
 *  the smallest edit that does it and leaves a valid set behind (a parent is
 *  same-file by the format, and this drops the field rather than pointing it
 *  anywhere new). */
When(
  "another writer lifts {string} to the top level of {string}",
  function (this: OlaiWorld, id: string, file: string) {
    const records = this.servedNodes(file).map((node) =>
      node["id"] === id ? { ...node, parent: undefined } : node
    );
    assert.ok(
      records.some((node) => node["id"] === id),
      `${file} holds no node \`${id}\` to lift`,
    );
    // `undefined` is what JSON drops, which is how the field GOES rather than
    // arriving as a null the format would refuse.
    this.writeServed(file, records.map((node) => JSON.stringify(node)).join("\n"));
  },
);

/** A subtree put away under everybody's feet: the records leave this outline
 *  for `_olai/Trash.olai`, keeping their ids, which is exactly what the
 *  ops layer's `trash` does. `doc` is rewritten so it still names the same
 *  file from the trash's directory. Everything under the named node goes with
 *  it — a child left behind pointing at a parent in another file is a set that
 *  does not validate, which would be a scenario about the wrong thing. */
When(
  "another writer archives {string} out of {string}",
  function (this: OlaiWorld, id: string, file: string) {
    const records = this.servedNodes(file);
    const moving = new Set<string>([id]);
    // Repeat until it stops growing: the file is in no particular order, so a
    // single pass can meet a child before its parent.
    for (let pass = 0; pass < records.length; pass++) {
      for (const node of records) {
        const parent = node["parent"];
        if (typeof parent === "string" && moving.has(parent)) {
          moving.add(String(node["id"]));
        }
      }
    }
    assert.ok(records.some((node) => node["id"] === id), `${file} holds no \`${id}\``);
    // Archive first, then the outline. A probe that listed between the two
    // writes used to see `install` gone and no `_olai/Trash.olai` — undo then
    // answered "not a node in the loaded set" instead of naming the archive.
    // Written this way, "the node is not shown" cannot become true until the
    // archive is already on disk, so the next probe that drops the row also
    // holds it.
    this.writeServed(
      "_olai/Trash.olai",
      records
        .filter((node) => moving.has(String(node["id"])))
        // The root of what moved keeps no parent — whatever it hung under is
        // still in the outline it left.
        .map((node) => {
          const moved =
            node["id"] === id ? { ...node, parent: undefined } : { ...node }
          if (typeof moved["doc"] === "string") {
            moved["doc"] = retargetRelative(file, "_olai/Trash.olai", moved["doc"])
          }
          return JSON.stringify(moved)
        })
        .join("\n"),
    );
    this.writeServed(
      file,
      records
        .filter((node) => !moving.has(String(node["id"])))
        .map((node) => JSON.stringify(node))
        .join("\n"),
    );
  },
);

When(
  "another writer files a row under {string} in {string}",
  function (this: OlaiWorld, under: string, file: string) {
    // By TITLE, because the row it goes under is one the scenario has just
    // typed and its id was minted by the write — which is the same id the undo
    // of that write names, and the point of the scenario.
    const parent = this.servedNodes(file).find((node) => node["title"] === under);
    assert.ok(
      parent !== undefined,
      `${file} holds no node titled ${JSON.stringify(under)} to file anything under`,
    );
    this.appendServed(file, {
      id: "interloper",
      parent: parent["id"],
      ord: "a0",
      title: "and something filed under it",
    });
  },
);

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
    .locator(`${NODE}${attr("data-file", file)}`)
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
      .locator(`${OUTLINE_LINK}${attr("data-file", file)}[data-broken="true"]`)
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
      .locator(`${OUTLINE_FAILURE}${attr("data-file", file)}`)
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

/**
 * …AND NOT SOMEBODY ELSE'S ROW.
 *
 * The other half of "a finding breaks the files it is ABOUT": a row naming one
 * file alone belongs to that file's page and to no other, where a row naming
 * two belongs to both. Without this the pair of assertions above would pass
 * over a page that simply drew the whole directory's report.
 */
Then(
  "the outline failure does not show an error at {string}",
  async function (this: OlaiWorld, site: string) {
    const failure = this.page.locator(OUTLINE_FAILURE);
    await failure.waitFor({ state: "visible", timeout: POLL_TIMEOUT });
    const rows = await rowsIn(failure);
    assert.ok(
      !rows.some((row) => row.includes(site)),
      `this outline's place draws "${site}", which is another file's row:\n  ` +
        rows.join("\n  "),
    );
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
Then(
  "the stale banner eventually appears",
  // Cucumber's own kill-timeout, widened for this step ALONE: the default
  // envelope is 40s, so without this the wait below is killed at 40 by
  // something that knows nothing about what it was waiting for.
  { timeout: BACKSTOP_STEP_TIMEOUT },
  async function (this: OlaiWorld) {
    await this.page
      .locator(STALE_BANNER)
      .waitFor({ state: "visible", timeout: BACKSTOP_TIMEOUT });
  },
);

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

/**
 * HOW MANY files the summary names — the per-file ruling counted.
 *
 * It replaced "no stale banner is shown", which asserted that a degrade had not
 * ESCALATED to holding the whole set. There is no escalation left to assert:
 * every finding is per file, so the summary is drawn whenever anything is
 * broken and what says the degrade stayed put is the SIZE of it. One bad line
 * in one file names one file.
 *
 * No wait: the step before this has already waited for the change to land, and
 * waiting for a count that must not grow would only make the suite slower at
 * saying so.
 */
Then(
  "the stale banner names {int} file",
  async function (this: OlaiWorld, many: number) {
    const banner = this.page.locator(STALE_BANNER);
    await banner.waitFor({ state: "visible", timeout: POLL_TIMEOUT });
    assert.strictEqual(
      await banner.locator(BROKEN_FILE_LINE).count(),
      many,
      `the summary to name ${many} file(s); it says:\n  ` + (await banner.innerText()),
    );
  },
);

/**
 * The banner NAMES a broken file and says how many findings implicate it — a
 * count, never the rows.
 *
 * It used to be "shows an error with code X", drawn from the full enumeration
 * the banner inlined on every page in the app. That enumeration is the bug
 * (`last-good-banner-flood`): the banner draws the verdict's bounded face now
 * (`@olai/format`'s `summary`), so what a scenario can ask it is which file
 * and what state — and the rows are asked of the surfaces whose job is to show
 * them, which the two steps above this one already do.
 */
Then(
  "the stale banner names {string} as {string}",
  async function (this: OlaiWorld, file: string, state: string) {
    const banner = this.page.locator(STALE_BANNER);
    await banner.waitFor({ state: "visible", timeout: POLL_TIMEOUT });
    const line = banner.locator(
      `${BROKEN_FILE_LINE}${attr("data-file", file)}${attr("data-state", state)}`,
    );
    await line
      .first()
      .waitFor({ state: "visible", timeout: POLL_TIMEOUT })
      .catch(() => undefined);
    assert.ok(
      (await line.count()) > 0,
      `the banner to name "${file}" as "${state}"; it says:\n  ` +
        (await banner.innerText()),
    );
  },
);

/**
 * …AND THE LINE IS A DOOR.
 *
 * Every broken file has a page of its own since the per-file ruling
 * (2026-08-29), so the banner sends a reader to it. The sentence it replaces
 * refused to, and said why: a file that PARSED and said something the set could
 * not hold had no pane, so the obvious link went somewhere with nothing to
 * show. Asserted as an `href` rather than by clicking, because what is under
 * test is that the destination is named — the navigation itself is the router's
 * and has its own scenarios.
 */
Then(
  "the stale banner links to {string}",
  async function (this: OlaiWorld, file: string) {
    const banner = this.page.locator(STALE_BANNER);
    await banner.waitFor({ state: "visible", timeout: POLL_TIMEOUT });
    const link = banner.locator(`${BROKEN_FILE_LINK}${attr("data-file", file)}`);
    await link
      .first()
      .waitFor({ state: "visible", timeout: POLL_TIMEOUT })
      .catch(() => undefined);
    assert.ok(
      (await link.count()) > 0,
      `the banner to link to "${file}"; it says:\n  ` + (await banner.innerText()),
    );
  },
);

/**
 * …AND IT DRAWS NO ROWS, which is the bug itself asserted rather than argued.
 *
 * One outline failing typed-property validation was about 135 rows, and every
 * page in the app opened on a wall of them. The banner's payload is bounded by
 * construction now — `summary` cannot hand a surface a row — and this is what
 * holds that construction in place from the outside.
 */
Then("the stale banner enumerates nothing", async function (this: OlaiWorld) {
  const banner = this.page.locator(STALE_BANNER);
  await banner.waitFor({ state: "visible", timeout: POLL_TIMEOUT });
  assert.strictEqual(
    await banner.locator(ERROR_ROW).count(),
    0,
    "the banner is enumerating error rows over somebody else's page",
  );
});
