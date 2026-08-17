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

import { SIDEBAR_WIDTH_KEY } from "@olai/web/src/client/layout/prefs.ts";
import {
  APP_HEADER,
  attr,
  CHAT_PANEL,
  CHAT_PILL,
  CHAT_SHEET,
  CHAT_SHEET_HANDLE,
  CHAT_SHEET_SCRIM,
  CHAT_STRIP,
  CHAT_TOGGLE,
  HYDRATION_TIMEOUT,
  OUTLINE_TREE,
  POLL_TIMEOUT,
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

When("I open the agent from the pill", async function (this: OlaiWorld) {
  await this.page.locator(CHAT_PILL).click();
  await this.page
    .locator(CHAT_PANEL)
    .waitFor({ state: "visible", timeout: POLL_TIMEOUT });
});

// ── the panel chords ───────────────────────────────────────────────────

When("I press the sidebar shortcut", async function (this: OlaiWorld) {
  await this.page.keyboard.press("ControlOrMeta+\\");
  await this.waitForFrame();
});

When("I press the chat shortcut", async function (this: OlaiWorld) {
  await this.page.keyboard.press("ControlOrMeta+j");
  await this.waitForFrame();
});

// ── the header's search box ────────────────────────────────────────────

When(
  "I search the header for {string}",
  async function (this: OlaiWorld, text: string) {
    const box = this.page.locator(HEADER_SEARCH);
    await box.waitFor({ state: "visible", timeout: HYDRATION_TIMEOUT });
    // Focus is what puts the results up, so this types rather than fills:
    // `fill` sets the value without the box ever holding the caret.
    await box.click();
    await box.type(text);
  },
);

Then(
  "the header search lists the node {string}",
  async function (this: OlaiWorld, title: string) {
    await this.page
      .locator(HEADER_SEARCH_ITEM)
      .filter({ hasText: title })
      .first()
      .waitFor({ state: "visible", timeout: POLL_TIMEOUT });
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

Then(
  "the header search result {string} shows no properties",
  async function (this: OlaiWorld, title: string) {
    const row = this.page
      .locator(HEADER_SEARCH_ITEM)
      .filter({ hasText: title })
      .first();
    await row.waitFor({ state: "visible", timeout: POLL_TIMEOUT });
    assert.equal(await row.locator(HEADER_SEARCH_ITEM_PROP).count(), 0);
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

When("I tap the header agent toggle", async function (this: OlaiWorld) {
  // Must work while the sheet is open — the scrim must not cover the header.
  await this.press(this.page.locator(CHAT_TOGGLE), "tap");
  await this.page
    .locator(CHAT_PANEL)
    .waitFor({ state: "hidden", timeout: POLL_TIMEOUT });
});

When("I tap the chat sheet handle", async function (this: OlaiWorld) {
  await this.press(this.page.locator(CHAT_SHEET_HANDLE), "tap");
  await this.waitForFrame();
});

When("I tap the chat sheet scrim", async function (this: OlaiWorld) {
  const viewport = this.viewport();
  // Scrim is under the header; tap its top band above the half sheet.
  await this.page.locator(CHAT_SHEET_SCRIM).click({
    position: { x: Math.round(viewport.width / 2), y: 12 },
  });
  await this.page
    .locator(CHAT_PANEL)
    .waitFor({ state: "hidden", timeout: POLL_TIMEOUT });
});
