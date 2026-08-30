/**
 * Zoom, permalinks, breadcrumbs.
 *
 * Two things these steps are careful about. A zoomed page is asserted through
 * the heading's `data-node-id`, which is the CANONICAL node's — so "zoom a
 * mirror, land on the node" is one assertion rather than a guess from the
 * title text. And the address is read from the URL bar, because a permalink
 * that is right on screen and wrong in the location bar is not a permalink.
 */

import * as assert from "node:assert";
import { Given, Then, When } from "@cucumber/cucumber";
import type { Locator } from "playwright";

import {
  attr,
  BLOCKED,
  LANDING_SAID,
  NODE_REF,
  NOT_FOUND,
  oneLine,
  POLL_TIMEOUT,
  SEE_REFS,
  TIP,
  EMPTY_UNDER,
  placeOf,
  ZOOM,
  ZOOM_TITLE,
} from "../support/world.ts";
import { saysThat } from "../support/said.ts";
import type { OlaiWorld } from "../support/world.ts";

// ── zooming ────────────────────────────────────────────────────────────

When(
  "I zoom into the node {string}",
  async function (this: OlaiWorld, id: string) {
    await this.clickWithin(id, ZOOM);
    await this.page
      .locator(ZOOM_TITLE)
      .waitFor({ state: "visible", timeout: POLL_TIMEOUT });
  },
);

Given("I open the node {string}", async function (this: OlaiWorld, id: string) {
  await this.openNode(id);
});

Then(
  "the zoomed node is {string}",
  async function (this: OlaiWorld, id: string) {
    await this.expectAttribute(
      ZOOM_TITLE,
      "data-node-id",
      id,
      "the zoomed page",
    );
  },
);

Then(
  "the page says Prefs is hiding finished work",
  async function (this: OlaiWorld) {
    const said = this.page.locator(EMPTY_UNDER);
    await said.waitFor({ state: "visible", timeout: POLL_TIMEOUT });
    assert.ok(
      /prefs/i.test(await said.innerText()),
      "the empty page names the state and not Prefs, so a reader whose " +
        "finished work is hidden has no door back",
    );
  },
);

/** WHAT THE LANDING SAID — the outline's one alarm line over the tree when
 *  the row an address named is drawn nowhere on the page it opened. Read
 *  through the suite's one reader of every said-line (`support/said.ts`): the
 *  words, and the MOOD as a `data-` fact — an answer to a dead link in the
 *  aside tone would be a refusal a screen reader is not interrupted for. */
Then("the landing says {string}", async function (this: OlaiWorld, said: string) {
  await saysThat(this, LANDING_SAID, said, "the landing's answer", "alarm");
});

/** …and that the line left: it is a notice, not a state. The budget is the
 *  poll's, which is comfortably longer than the six seconds a said line
 *  stays (`client/saying.ts`) — spelling the six here would be the client's
 *  constant written down twice, and a boundary-step's claim is again 
 *  different (the line leaves WITH the page, not with the clock), which is
 *  the next one's. */
Then("the landing's sentence has gone", async function (this: OlaiWorld) {
  await this.waitUntil(
    async () => (await this.page.locator(LANDING_SAID).count()) === 0,
    "the landing's said line to take itself away",
  );
});

/** …gone WITH ITS PAGE, the boundary scenario's fence: the poll's own six
 *  second pass would ask nothing of the boundary at all — the line answers
 *  its own SAID_MS in that window, and the scenario would pass for the very
 *  reason it exists. The budget is comfortably under six: one second —
 *  "gone" within it can be had ONLY from the boundary's `saying.say(null)`
 *  answering (`client/OutlinePage.tsx`), which is the living half this is
 *  here to watch. */
Then("the landing's sentence has gone with its page", async function (this: OlaiWorld) {
  await this.waitUntil(
    async () => (await this.page.locator(LANDING_SAID).count()) === 0,
    "the landing's said line to leave with the page it was said for, well before its own clock would have",
    1_000,
  );
});

Then("the address is {string}", async function (this: OlaiWorld, path: string) {
  // Waited for, not read once: a click navigates and re-renders in the same
  // frame, and reading the URL immediately races the pushState that produced
  // the page being looked at.
  await this.page
    .waitForURL((url) => placeOf(url) === path, { timeout: POLL_TIMEOUT })
    .catch(() => undefined);
  assert.strictEqual(this.place(), path);
});

// ── breadcrumbs ────────────────────────────────────────────────────────

/** The trail, crumb by crumb, in order. Asserting the whole list rather than
 *  "contains X" is the point: crumbs are an ANCESTRY, and one in the wrong
 *  place — or an extra one picked up from the route that was clicked — is
 *  exactly the bug. */
Then(
  "the breadcrumbs are {string}",
  async function (this: OlaiWorld, expected: string) {
    const trail = this.crumbs();
    await trail
      .first()
      .waitFor({ state: "visible", timeout: POLL_TIMEOUT })
      .catch(() => undefined);
    assert.deepStrictEqual(
      (await trail.allInnerTexts()).map(oneLine),
      expected.split(",").map((crumb) => crumb.trim()),
    );
  },
);

When(
  "I follow the breadcrumb {string}",
  async function (this: OlaiWorld, label: string) {
    const crumb = this.crumbs().filter({ hasText: label }).first();
    await crumb.waitFor({ state: "visible", timeout: POLL_TIMEOUT });
    await crumb.click();
    await this.waitForFrame();
  },
);

// ── a permalink that names nothing ─────────────────────────────────────

Then("a not-found is shown", async function (this: OlaiWorld) {
  await this.page
    .locator(NOT_FOUND)
    .waitFor({ state: "visible", timeout: POLL_TIMEOUT });
});

// ── free cross-references (`see`) ──────────────────────────────────────

/** The see-link on a node that points at a particular target. Selected by
 *  `data-ref` (the target id), never by link text — titles change under a live
 *  page, and a scenario that pinned one would flake the moment the target was
 *  retitled. Scoped to the see row, because a node's blockers are links to
 *  nodes in exactly the same shape and this step is about `see`. */
const seeLinkTo = (world: OlaiWorld, source: string, target: string) =>
  world
    .node(source)
    .locator(`${SEE_REFS} ${NODE_REF}:has(${attr("data-ref", target)})`)
    .first();

/** Click a link from a node to a node, and land. One helper for both relations
 *  — a `see` ref and a blocker are the same link — over `press`, which is
 *  already "wait until it is there, click it, wait out the frame". */
const followRef = async (world: OlaiWorld, link: Locator): Promise<void> => {
  await world.press(link);
  await world.page
    .locator(ZOOM_TITLE)
    .waitFor({ state: "visible", timeout: POLL_TIMEOUT });
};

Then(
  "the node {string} sees {string} as {string}",
  async function (
    this: OlaiWorld,
    source: string,
    target: string,
    title: string,
  ) {
    const link = seeLinkTo(this, source, target);
    await link.waitFor({ state: "visible", timeout: POLL_TIMEOUT });
    // The refs container is drawn only when the node carries a see — so its
    // presence is part of the assertion, not a free ride.
    await this.node(source)
      .locator(SEE_REFS)
      .first()
      .waitFor({ state: "visible", timeout: POLL_TIMEOUT });
    assert.strictEqual(
      oneLine(await link.innerText()),
      title,
      `the see link on "${source}" to "${target}" does not show the target's title`,
    );
  },
);

When(
  "I follow the see link to {string} on {string}",
  async function (this: OlaiWorld, target: string, source: string) {
    await followRef(this, seeLinkTo(this, source, target));
  },
);

// ── what a node is waiting on (`after`) ────────────────────────────────

When(
  "I follow the blocked link to {string} on {string}",
  async function (this: OlaiWorld, blocker: string, id: string) {
    // The node's own page, where every blocker is named — a row draws a glyph
    // instead, and that goes to this page rather than to any one blocker.
    await followRef(
      this,
      this.node(id).locator(`${BLOCKED} ${attr("data-ref", blocker)}`).first(),
    );
  },
);

/** The mark column's waiting glyph on a row, which is a link to the node's own
 *  page: a row has room for the fact, not for the names. */
When(
  "I follow the waiting mark on {string}",
  async function (this: OlaiWorld, id: string) {
    await followRef(this, this.within(id, BLOCKED));
  },
);

Then("a tip says {string}", async function (this: OlaiWorld, said: string) {
  const tips = this.page.locator(TIP);
  // EXACTLY one, in the whole document. The doubled tip the human caught said
  // the right thing twice — two copies of one sentence, a few pixels apart and
  // unreadable — so every assertion about its TEXT passed while the screen was
  // wrong. Counting is the only part of this step that would have failed.
  assert.strictEqual(
    await tips.count(),
    1,
    "more than one tip is on screen; only one may ever be",
  );
  assert.strictEqual(oneLine(await tips.first().innerText()), said);
});
// ── where a navigation leaves the page ─────────────────────────────────
//
// A route change redraws the main pane and moves nothing else, so without a
// decision the reader keeps whatever scroll position the last page was left at.
// The decision (`client/scroll.ts`) is that a page you go TO starts at the top
// and a page you go BACK to is where you left it, and it can only be exercised
// on a page that is taller than the window it is being read in — which is why
// the window is made short rather than the fixtures made long: how tall a page
// is belongs to the stylesheet, and a corpus grown until it happened to
// overflow would be a scenario that stopped testing anything the day a margin
// changed.

Given("the window is shorter than the page", async function (this: OlaiWorld) {
  // The window this suite reads in, made short: only the HEIGHT is this step's
  // decision, and the width stays the one the scenario was laid out at
  // (`support/hooks.ts`) so the two-column breakpoint is not re-decided here.
  // Read back rather than spelled, because a `@phone` scenario says this too
  // (`the_header_sticks.feature`) and pinning the laptop's width would have
  // turned its handset into a 1440px one mid-scenario.
  const size = this.viewport();
  await this.page.setViewportSize({ width: size.width, height: 400 });
});

const scrollTop = (world: OlaiWorld): Promise<number> =>
  world.page.evaluate(() => window.scrollY);

/** The page, as far down as it goes. */
const toTheBottom = async (world: OlaiWorld): Promise<void> => {
  // The hosted faces are a late layout: fallback metrics are taller than
  // Literata's, and a bottom recorded before they swap is a position the
  // page cannot hold once they have. Wait for them — and for the page to
  // actually overflow, which is the event, not fonts.ready. A zoomed node
  // whose attached document has not arrived yet is shorter than the
  // window; scrolling it then is a no-op that reads as "the page does not
  // scroll in this window".
  await world.page.evaluate(() => document.fonts.ready);
  await world.waitUntil(
    async () =>
      world.page.evaluate(
        () => document.documentElement.scrollHeight > window.innerHeight,
      ),
    "the page to be taller than the window",
  );
  await world.page.evaluate(() => {
    window.scrollTo(0, document.documentElement.scrollHeight);
  });
  await world.waitForFrame();
};

/** WHERE THE READER IS, recorded for the assertion that says they were put
 *  back there. Read LAST, after everything this step does to the page, because
 *  it is the position the next navigation will be leaving — not the position
 *  the scroll asked for. */
const leftItHere = async (world: OlaiWorld): Promise<void> => {
  world.scrolledTo = await scrollTop(world);
  assert.ok(
    world.scrolledTo > 0,
    "the page does not scroll in this window, so scrolling it proves nothing",
  );
};

When("I scroll to the bottom of the page", async function (this: OlaiWorld) {
  await toTheBottom(this);
  await leftItHere(this);
});

/**
 * …and the same, stopping short of the bottom if going all the way there would
 * tuck the bullet the scenario is about to press under the pinned section
 * heading.
 *
 * THE BOTTOM IS THE HOSTILE PLACE, and that is worth saying rather than
 * working around quietly. A section holds its place at the top of the reading
 * while its own branch scrolls past (`client/Tree.tsx`), so at the very bottom
 * of `house.olai` the pinned `kitchen` heading lies exactly over
 * `install`'s bullet — an `elementFromPoint` survey of that page finds it is
 * the one row in the window whose bullet cannot be pressed. A reader who
 * wanted it would nudge the page; Playwright instead retries the click and
 * rescues it by scrolling, and where that scroll lands under load is the top.
 * The reader then really did leave the page at 0, the client really did
 * remember 0, and the assertion below was comparing against a number sampled
 * before any of it — which is the whole of the flake this step exists to end.
 *
 * So the reach is taken FIRST and the position recorded AFTER it: what this
 * step promises is a reader as far down the page as they can be while the
 * thing they are about to press is still theirs to press.
 */
When(
  "I scroll to the bottom of the page, keeping the bullet of {string} pressable",
  async function (this: OlaiWorld, id: string) {
    await toTheBottom(this);
    await this.intoReach(this.within(id, ZOOM), `the bullet of "${id}"`);
    await leftItHere(this);
  },
);

/** Wait for the page to be at a position, and say where it actually is when it
 *  never gets there — a timeout that only says "it did not scroll" leaves the
 *  two failures this can have (nothing moved, something moved it somewhere
 *  else) looking identical. */
const expectScroll = async (
  world: OlaiWorld,
  top: number,
  what: string,
): Promise<void> => {
  try {
    await world.waitUntil(async () => (await scrollTop(world)) === top, what);
  } catch {
    throw new Error(`${what}, and it is at ${await scrollTop(world)}px instead`);
  }
};

Then("the page is at the top", async function (this: OlaiWorld) {
  await expectScroll(this, 0, "the page is at the top");
});

When("I go back", async function (this: OlaiWorld) {
  await this.page.goBack();
  await this.waitForFrame();
});

Then("the page is back where I left it", async function (this: OlaiWorld) {
  const left = this.scrolledTo;
  assert.ok(left !== undefined, "nothing scrolled the page first");
  // Restore runs against the page being LEFT. A zoomed node is a shorter
  // page than the outline it came from, so the first attempt clamps, and
  // the retry can land a few pixels short of a bottom recorded on the
  // taller page. The claim is "where you were, not the top" — a 6px miss
  // at the bottom of house.olai is that clamp, not a lost position.
  const slop = 8;
  try {
    await this.waitUntil(
      async () => Math.abs((await scrollTop(this)) - left) <= slop,
      `the page is back at ${left}px`,
    );
  } catch {
    throw new Error(
      `the page is back at ${left}px, and it is at ${await scrollTop(this)}px instead`,
    );
  }
});
