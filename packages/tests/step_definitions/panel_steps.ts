/**
 * Panel rework: rail, resize-by-effect, pill content, drawer geometry, sheet
 * under header — and the two chords that toggle the panels.
 *
 * The PALETTE moved out (`./palette_steps.ts`) when it stopped being a shell:
 * it writes now, so it has a question before one of its verbs, two moods to
 * say things in and a capture line — the same split, for the same reason, that
 * `./menu_steps.ts` is next to `./outline_tree_steps.ts`.
 */

import * as assert from "node:assert";
import { Then, When } from "@cucumber/cucumber";

import { SIDEBAR_WIDTH_KEY } from "@olai/web/testlib";
import { retypedAndTaken } from "../support/atonce.ts";
import { countsNothing, foundCount } from "../support/counted.ts";
import { keysSettled, pressed } from "../support/settling.ts";
import { answered } from "../support/shortlist.ts";
import {
  APP_CHROME,
  APP_HEADER,
  attr,
  CHAT_PANEL,
  CHAT_PILL,
  CHAT_SHEET,
  CHAT_SHEET_HANDLE,
  CHAT_STRIP,
  CHAT_TOGGLE,
  HEADER_SEARCH_RESULTS,
  HYDRATION_TIMEOUT,
  OUTLINE_TREE,
  POLL_TIMEOUT,
  SEARCH_COUNT,
  SIDEBAR,
  SIDEBAR_BODY,
  SIDEBAR_COLLAPSE,
  SIDEBAR_EXPAND,
  SIDEBAR_RAIL,
  SIDEBAR_RESIZE,
  SIDEBAR_SCRIM,
  SIDEBAR_TOGGLE,
} from "../support/world.ts";
import type { OlaiWorld } from "../support/world.ts";

const HEADER_SEARCH = `[data-testid="header-search"]`;
const HEADER_SEARCH_ITEM = `[data-testid="header-search-item"]`;
const HEADER_SEARCH_ITEM_PROP = `[data-testid="header-search-item-prop"]`;
const CHAT_PILL_TEXT = `[data-testid="chat-pill-text"]`;

// ── desktop sidebar ────────────────────────────────────────────────────

Then("the sidebar is open on desktop", async function (this: OlaiWorld) {
  await this.page
    .locator(SIDEBAR_BODY)
    .waitFor({ state: "visible", timeout: HYDRATION_TIMEOUT });
  assert.strictEqual(
    await this.page.locator(SIDEBAR_RAIL).isVisible(),
    false,
    "the icon rail is showing while the full sidebar should be open",
  );
});

When("I collapse the sidebar", async function (this: OlaiWorld) {
  await this.page.locator(SIDEBAR_COLLAPSE).click();
  await this.page
    .locator(SIDEBAR_RAIL)
    .waitFor({ state: "visible", timeout: POLL_TIMEOUT });
});

Then("the sidebar rail is showing", async function (this: OlaiWorld) {
  await this.page
    .locator(SIDEBAR_RAIL)
    .waitFor({ state: "visible", timeout: HYDRATION_TIMEOUT });
  assert.strictEqual(
    await this.page.locator(SIDEBAR_BODY).isVisible(),
    false,
    "the full sidebar body is still visible beside the rail",
  );
});

Then(
  "the outline {string} is still on screen",
  async function (this: OlaiWorld, _file: string) {
    await this.page
      .locator(OUTLINE_TREE)
      .waitFor({ state: "visible", timeout: HYDRATION_TIMEOUT });
  },
);

When("I expand the sidebar from the rail", async function (this: OlaiWorld) {
  await this.page.locator(SIDEBAR_EXPAND).click();
  await this.page
    .locator(SIDEBAR_BODY)
    .waitFor({ state: "visible", timeout: POLL_TIMEOUT });
});

// ── resize by effect ───────────────────────────────────────────────────

When("I drag the sidebar wider by {int}px", async function (this: OlaiWorld, dx: number) {
  const handle = this.page.locator(SIDEBAR_RESIZE);
  await handle.waitFor({ state: "visible", timeout: HYDRATION_TIMEOUT });
  const before = await this.page.locator(SIDEBAR).boundingBox();
  assert.ok(before !== null, "sidebar has no box before the drag");
  this.attach(String(before.width), "text/plain");
  // Stash on the world via evaluate so the next step can read it.
  await this.page.evaluate((w) => {
    (window as unknown as { __olaiSideBefore?: number }).__olaiSideBefore = w;
  }, before.width);

  const box = await handle.boundingBox();
  assert.ok(box !== null, "resize handle has no box");
  const x = box.x + box.width / 2;
  const y = box.y + box.height / 2;
  await this.page.mouse.move(x, y);
  await this.page.mouse.down();
  await this.page.mouse.move(x + dx, y, { steps: 8 });
  await this.page.mouse.up();
  await this.waitForFrame();
});

Then(
  "the sidebar is at least {int}px wider than the default",
  async function (this: OlaiWorld, minGain: number) {
    const after = await this.page.locator(SIDEBAR).boundingBox();
    assert.ok(after !== null, "sidebar has no box after the drag");
    const before = await this.page.evaluate(
      () => (window as unknown as { __olaiSideBefore?: number }).__olaiSideBefore,
    );
    assert.ok(typeof before === "number", "no width recorded before the drag");
    assert.ok(
      after.width >= before + minGain - 1,
      `sidebar grew by ${Math.round(after.width - before)}px, wanted ≥${minGain}`,
    );
    await this.page.evaluate((w) => {
      (window as unknown as { __olaiSideAfter?: number }).__olaiSideAfter = w;
    }, after.width);
  },
);

Then("the sidebar width survived the reload", async function (this: OlaiWorld) {
  const expected = await this.page.evaluate(
    () => (window as unknown as { __olaiSideAfter?: number }).__olaiSideAfter,
  );
  // After reload the stash is gone — read localStorage instead.
  const stored = await this.stored(SIDEBAR_WIDTH_KEY);
  assert.ok(stored !== null, "sidebar width was not persisted");
  const px = Number(stored);
  assert.ok(Number.isFinite(px), `stored width is not a number: ${stored}`);
  // Prefer the measured post-drag width when we still have it in-process
  // (same browser context keeps the evaluate globals only until reload).
  void expected;
  const box = await this.page.locator(SIDEBAR).boundingBox();
  assert.ok(box !== null, "sidebar has no box after reload");
  assert.ok(
    Math.abs(box.width - px) <= 2,
    `sidebar is ${Math.round(box.width)}px after reload, stored ${px}`,
  );
});

// ── chat minimize / pill ───────────────────────────────────────────────

When("I minimize the agent panel", async function (this: OlaiWorld) {
  const toggle = this.page.locator(CHAT_TOGGLE);
  await toggle.waitFor({ state: "visible", timeout: HYDRATION_TIMEOUT });
  if (await this.page.locator(CHAT_PANEL).isVisible()) {
    await toggle.click();
  }
  await this.page
    .locator(CHAT_PANEL)
    .waitFor({ state: "hidden", timeout: POLL_TIMEOUT });
});

Then("the agent panel is minimized", async function (this: OlaiWorld) {
  assert.strictEqual(
    await this.page.locator(CHAT_PANEL).isVisible(),
    false,
    "the agent panel is still open — minimize should leave only the pill/strip",
  );
});

Then("the chat pill is showing", async function (this: OlaiWorld) {
  await this.page
    .locator(CHAT_PILL)
    .waitFor({ state: "visible", timeout: HYDRATION_TIMEOUT });
});

Then("the chat strip is showing", async function (this: OlaiWorld) {
  await this.page
    .locator(CHAT_STRIP)
    .waitFor({ state: "visible", timeout: HYDRATION_TIMEOUT });
});

Then("the chat pill is busy", async function (this: OlaiWorld) {
  await this.expectAttribute(
    CHAT_PILL,
    "data-busy",
    "true",
    "the chat pill",
    POLL_TIMEOUT,
  );
});

Then(
  "the chat pill shows the last agent message",
  async function (this: OlaiWorld) {
    const text = this.page.locator(CHAT_PILL_TEXT);
    await text.waitFor({ state: "visible", timeout: HYDRATION_TIMEOUT });
    await this.waitUntil(
      async () => {
        const t = (await text.innerText()).trim();
        return t.length > 0 && t !== "ask the agent" && t !== "working…";
      },
      "the pill to show the last agent message rather than the empty fallback",
      POLL_TIMEOUT,
    );
  },
);

When("I wait for the agent to go idle", async function (this: OlaiWorld) {
  // Open briefly if needed so the cell can settle; the pill also tracks busy.
  await this.waitUntil(
    async () => {
      const busy = await this.page.locator(CHAT_PILL).getAttribute("data-busy");
      return busy === "false" || busy === null;
    },
    "the agent to finish so the pill stops pulsing",
    HYDRATION_TIMEOUT,
  );
});

// ── the panel chords ───────────────────────────────────────────────────

When("I press the sidebar shortcut", async function (this: OlaiWorld) {
  await pressed(this, "ControlOrMeta+\\");
});

When("I press the chat shortcut", async function (this: OlaiWorld) {
  await pressed(this, "ControlOrMeta+j");
});

// ── the header's search box ────────────────────────────────────────────

/** The header's box, waited for — one spelling of "how long a scenario gives
 *  the bar to hydrate", shared by every step that reaches into it. */
const headerBox = async (world: OlaiWorld) => {
  const box = world.page.locator(HEADER_SEARCH);
  await box.waitFor({ state: "visible", timeout: HYDRATION_TIMEOUT });
  return box;
};

/**
 * ...AND THE SEAT EMPTY, which is what a serve that did not name the `search`
 * row draws.
 *
 * The box is a ROW's face now (`olai-plugin-search`), hung in the bar's `lead`
 * seat, so with the row absent the plugin's chunk was never fetched, its fiber
 * never mounted and the face never registered. Nothing in the bar is hiding a
 * box; there is no box.
 *
 * It waits for the chrome first, the way the identity chip's twin does
 * (`./identity_steps.ts`), so an empty seat is an answer rather than a page
 * that has not drawn its bar yet.
 */
Then("the header has no search box", async function (this: OlaiWorld) {
  await this.waitForFrame();
  const header = this.page.locator(APP_HEADER);
  await header
    .locator(APP_CHROME)
    .waitFor({ state: "visible", timeout: POLL_TIMEOUT });
  // The server acknowledges the switch before browser composition completes.
  await header.locator(HEADER_SEARCH).waitFor({ state: "detached", timeout: POLL_TIMEOUT });
  assert.equal(
    await header.locator(HEADER_SEARCH).count(),
    0,
    "the search box is still in the header of a serve that did not mount the row",
  );
});

When(
  "I search the header for {string}",
  async function (this: OlaiWorld, text: string) {
    const box = await headerBox(this);
    // Focus is what puts the results up, so this types rather than fills:
    // `fill` sets the value without the box ever holding the caret.
    await box.click();
    await box.type(text);
  },
);

/** The window `../support/atonce.ts` opens, at this door. */
When(
  "I retype the header search as {string} and press Enter at once",
  async function (this: OlaiWorld, text: string) {
    await retypedAndTaken(this, await headerBox(this), text);
  },
);

/** One letter back — the gesture of somebody who typed one too many. It WIDENS
 *  the answer, which is what makes it worth its own step: the rows that were
 *  already there are still there, so a scenario can say they were not drawn
 *  again (`redraw_steps.ts`). */
When("I take a letter off the header search", async function (this: OlaiWorld) {
  const box = await headerBox(this);
  await box.click();
  await box.press("Backspace");
  await keysSettled(this);
});

Then(
  "the header search lists the node {string}",
  async function (this: OlaiWorld, title: string) {
    await answered(
      this,
      HEADER_SEARCH_RESULTS,
      await (await headerBox(this)).inputValue(),
    );
    await this.page
      .locator(HEADER_SEARCH_ITEM)
      .filter({ hasText: title })
      .first()
      .waitFor({ state: "visible", timeout: POLL_TIMEOUT });
  },
);

/**
 * ...and the row that is NOT there — the half a span assertion is made of.
 *
 * A search that lists two nodes proves what it FOUND; what a range has to
 * prove is what it left out, since the failure a typed span exists to prevent
 * is an answer with too much in it (`1000` inside `190..200`, which is what a
 * string comparison says). So this is asserted AFTER the answer has arrived —
 * `answered` waits for the results to be about the query that was typed —
 * because a row absent from a panel that has not answered yet is absent for
 * the wrong reason.
 */
Then(
  "the header search does not list the node {string}",
  async function (this: OlaiWorld, title: string) {
    await answered(
      this,
      HEADER_SEARCH_RESULTS,
      await (await headerBox(this)).inputValue(),
    );
    assert.strictEqual(
      await this.page.locator(HEADER_SEARCH_ITEM).filter({ hasText: title }).count(),
      0,
      `the header search lists ${JSON.stringify(title)}, and this step says it does not`,
    );
  },
);

/** One DOCUMENT row of the header's results, by path.
 *
 *  By `data-id`, for `palette_steps.ts`'s reason: the label is the file's NAME
 *  and the id is its whole path. One reading, two doors — the step below and
 *  the palette's are the same assertion about the same block of rows. Named
 *  because two steps ask for it and a locator spelled twice is a locator that
 *  can come to name two different rows. */
const documentRow = (world: OlaiWorld, file: string) =>
  world.page.locator(`${HEADER_SEARCH_ITEM}${attr("data-id", `hit-${file}`)}`);

Then(
  "the header search lists the document {string}",
  async function (this: OlaiWorld, file: string) {
    await answered(
      this,
      HEADER_SEARCH_RESULTS,
      await (await headerBox(this)).inputValue(),
    );
    await documentRow(this, file)
      .waitFor({ state: "visible", timeout: POLL_TIMEOUT });
  },
);

// ── how much of the answer it drew ─────────────────────────────────────
//
// The palette's steps are the same two, over the same helper
// (`support/counted.ts`) and the same line in the client: one reading, two
// doors, one sentence. What is this door's own is the panel it is read inside.

Then(
  "the header search found {string}",
  async function (this: OlaiWorld, said: string) {
    await foundCount(
      this,
      `${HEADER_SEARCH_RESULTS} ${SEARCH_COUNT}`,
      said,
      "header search count",
    );
  },
);

Then(
  "the header search says nothing about a total",
  async function (this: OlaiWorld) {
    await countsNothing(
      this,
      `${HEADER_SEARCH_RESULTS} ${SEARCH_COUNT}`,
      "header search",
    );
  },
);

/** One `key value` pair on a result row — the third line PR #192 left off and
 *  this one draws. Scoped to the row, so "the hit for THIS node says it". */
const searchRowProp = (
  world: OlaiWorld,
  title: string,
  key: string,
) =>
  world.page
    .locator(HEADER_SEARCH_ITEM)
    .filter({ hasText: title })
    .first()
    .locator(`${HEADER_SEARCH_ITEM_PROP}${attr("data-key", key)}`);

/**
 * WHAT A DOCUMENT ROW CALLS IT — the face's title, drawn as the row's first
 * line, asked by PATH so the assertion cannot be satisfied by the thing it is
 * about.
 *
 * By `data-id` for the reason the listing step above gives, and then the row's
 * own first line: a document whose title came off the wrong line would be
 * found by this step and named wrong by it, which is exactly the failure a
 * `---` block at the top used to produce.
 */
Then(
  "the header search result for the document {string} is called {string}",
  async function (this: OlaiWorld, file: string, title: string) {
    const row = documentRow(this, file);
    await row.waitFor({ state: "visible", timeout: POLL_TIMEOUT });
    assert.equal((await row.innerText()).split("\n")[0]?.trim(), title);
  },
);

Then(
  "the header search result {string} shows the property {string} holding {string}",
  async function (this: OlaiWorld, title: string, key: string, value: string) {
    const prop = searchRowProp(this, title, key);
    await prop.waitFor({ state: "visible", timeout: POLL_TIMEOUT });
    assert.equal((await prop.innerText()).trim(), `${key} ${value}`);
  },
);

Then(
  "the header search result {string} marks {string} as why it matched",
  async function (this: OlaiWorld, title: string, key: string) {
    const prop = searchRowProp(this, title, key);
    await prop.waitFor({ state: "visible", timeout: POLL_TIMEOUT });
    assert.equal(
      await prop.getAttribute("data-matched"),
      "true",
      `"${key}" is drawn on the row for "${title}" but not as the reason it is there`,
    );
    // …and it LEADS, because a line that has to be ellipsized shows its front.
    const first = this.page
      .locator(HEADER_SEARCH_ITEM)
      .filter({ hasText: title })
      .first()
      .locator(HEADER_SEARCH_ITEM_PROP)
      .first();
    assert.equal(await first.getAttribute("data-key"), key);
  },
);

When(
  "I press the header search result {string}",
  async function (this: OlaiWorld, title: string) {
    await this.page
      .locator(HEADER_SEARCH_ITEM)
      .filter({ hasText: title })
      .first()
      .click();
    await this.waitForFrame();
  },
);

// ── mobile drawer + sheet geometry ─────────────────────────────────────

Then(
  "the directory drawer is open with a scrim",
  async function (this: OlaiWorld) {
    await this.page
      .locator(SIDEBAR_BODY)
      .waitFor({ state: "visible", timeout: HYDRATION_TIMEOUT });
    await this.page
      .locator(SIDEBAR_SCRIM)
      .waitFor({ state: "visible", timeout: HYDRATION_TIMEOUT });

    const header = await this.box(this.page.locator(APP_HEADER), "header");
    const nav = await this.box(this.page.locator(SIDEBAR), "sidebar");
    const scrim = await this.box(this.page.locator(SIDEBAR_SCRIM), "scrim");
    const viewport = this.viewport();

    // Fixed under the header: top at the header bottom, bottom at the viewport.
    assert.ok(
      Math.abs(nav.y - (header.y + header.height)) <= 2,
      `drawer top is y=${Math.round(nav.y)}, header bottom is ${Math.round(header.y + header.height)} — relative demotion used to land ~48px lower`,
    );
    assert.ok(
      nav.y + nav.height >= viewport.height - 2,
      `drawer bottom is ${Math.round(nav.y + nav.height)} on a ${viewport.height}px screen — last entries were clipped`,
    );
    // Scrim also under the header.
    assert.ok(
      scrim.y >= header.y + header.height - 1,
      `scrim starts at y=${Math.round(scrim.y)}, covering the header`,
    );
  },
);

Then(
  "the header chrome stays tappable over the drawer",
  async function (this: OlaiWorld) {
    // The burger must remain the topmost control at its own centre — not the
    // scrim. A stack that puts scrim first is finding 2.
    const top = await this.topmostTestidOver(
      this.page.locator(SIDEBAR_TOGGLE),
      "the burger",
    );
    assert.strictEqual(
      top,
      "sidebar-toggle",
      `element at the burger is ${top}, not the burger — scrim is on top of the header`,
    );
  },
);

When("I tap the directory scrim", async function (this: OlaiWorld) {
  const viewport = this.viewport();
  // Scrim is under the header now; aim at the uncovered right edge.
  await this.page.locator(SIDEBAR_SCRIM).click({
    position: { x: viewport.width - 8, y: Math.round(viewport.height / 3) },
  });
  await this.page
    .locator(SIDEBAR_BODY)
    .waitFor({ state: "hidden", timeout: POLL_TIMEOUT });
});

Then("the chat sheet sits under the header", async function (this: OlaiWorld) {
  await this.page
    .locator(CHAT_SHEET)
    .waitFor({ state: "visible", timeout: HYDRATION_TIMEOUT });
  const header = await this.box(this.page.locator(APP_HEADER), "header");
  const sheet = await this.box(this.page.locator(CHAT_SHEET), "chat sheet host");
  assert.ok(
    sheet.y >= header.y + header.height - 1,
    `chat sheet host starts at y=${Math.round(sheet.y)}, covering the header (bottom ${Math.round(header.y + header.height)})`,
  );
});

Then(
  "the chat sheet is at snap {string}",
  async function (this: OlaiWorld, snap: string) {
    await this.expectAttribute(
      CHAT_PANEL,
      "data-snap",
      snap,
      "the chat sheet snap",
      POLL_TIMEOUT,
    );
  },
);

When("I drag the chat sheet handle up", async function (this: OlaiWorld) {
  const handle = this.page.locator(CHAT_SHEET_HANDLE);
  await handle.waitFor({ state: "visible", timeout: HYDRATION_TIMEOUT });
  const box = await handle.boundingBox();
  assert.ok(box !== null);
  const x = box.x + box.width / 2;
  const y = box.y + box.height / 2;
  await this.page.mouse.move(x, y);
  await this.page.mouse.down();
  // Drag well past the half→full threshold.
  await this.page.mouse.move(x, y - 200, { steps: 12 });
  await this.page.mouse.up();
  await this.waitForFrame();
});

When("I drag the chat sheet handle down", async function (this: OlaiWorld) {
  const handle = this.page.locator(CHAT_SHEET_HANDLE);
  await handle.waitFor({ state: "visible", timeout: HYDRATION_TIMEOUT });
  const box = await handle.boundingBox();
  assert.ok(box !== null);
  const x = box.x + box.width / 2;
  const y = box.y + box.height / 2;
  await this.page.mouse.move(x, y);
  await this.page.mouse.down();
  // Drag well past the full→half threshold. At full the sheet covers the
  // scrim, so half is where a thumb can tap the dim to put it away.
  await this.page.mouse.move(x, y + 200, { steps: 12 });
  await this.page.mouse.up();
  await this.waitForFrame();
});

When("I tap the chat sheet scrim", async function (this: OlaiWorld) {
  // The scrim is `inset-0` behind the sheet, so a tap on its own box lands
  // on the transcript. Aim at the dim above the sheet, the way a thumb
  // actually puts a half-open sheet away.
  const host = await this.box(this.page.locator(CHAT_SHEET), "the chat sheet host");
  const sheet = await this.box(this.page.locator(CHAT_PANEL), "the chat sheet");
  const gap = sheet.y - host.y;
  assert.ok(
    gap > 8,
    `the sheet starts ${Math.round(gap)}px below the host — at full snap the ` +
      "scrim is covered, so drag it to half first",
  );
  await this.page.mouse.click(host.x + host.width / 2, host.y + gap / 2);
  await this.page
    .locator(CHAT_PANEL)
    .waitFor({ state: "hidden", timeout: POLL_TIMEOUT });
});
