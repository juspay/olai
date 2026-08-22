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
  CHAT_PANEL,
  CHAT_PILL,
  CHAT_SHEET,
  CHAT_SHEET_HANDLE,
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
  await this.page.keyboard.press("ControlOrMeta+\\");
  await this.waitForFrame();
});

When("I press the chat shortcut", async function (this: OlaiWorld) {
  await this.page.keyboard.press("ControlOrMeta+j");
  await this.waitForFrame();
});

// ── the header's search box: deleted ───────────────────────────────────
//
// It used to be here — a second search door in the bar, at a second scope, with
// a second answer shape. There is one box now, the page's own, and its steps
// are `filter_steps.ts`'; the everywhere page it widens to is
// `search_steps.ts`' (docs/brainstorming/one-search-box.md). What is left of
// this bar's search is the PHONE's magnifier, which puts the caret in that box
// — `phone_steps.ts` presses it.

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
