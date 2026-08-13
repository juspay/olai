/**
 * The preferences panel: the one door in the header, the rows behind it, and
 * the promise every one of them makes — that a pick is this browser's and
 * reaches no server.
 *
 * The KEYS a preference is stored under are imported from the client that owns
 * them, for the reason `theme_steps.ts` imports the theme's: renaming one is
 * then a type error at `bun run typecheck` rather than a scenario that times
 * out thirty seconds later saying nothing about why.
 *
 * `showPreferences` is exported because the theme steps need it too — the chips
 * are a row of this panel now, so every theming scenario opens this first.
 */

import * as assert from "node:assert";
import { Then, When } from "@cucumber/cucumber";
import type { Page } from "playwright";

import { DONE_HIDDEN_KEY } from "@olai/web/src/client/settings/done.ts";
import { TESTID } from "@olai/web/src/client/testids.ts";

import {
  APP_HEADER,
  HYDRATION_TIMEOUT,
  POLL_TIMEOUT,
  PREFS_CHOICE,
  PREFS_HINT,
  PREFS_PANEL,
  PREFS_ROW,
  PREFS_SCOPE,
  PREFS_TRIGGER,
  WORDMARK,
} from "../support/world.ts";
import type { OlaiWorld } from "../support/world.ts";

/** Open the panel unless it is already open. Idempotent, because a scenario
 *  that opened it to pick a theme should not have to know whether the step
 *  after it needs opening again. */
export const showPreferences = async (page: Page): Promise<void> => {
  const panel = page.locator(PREFS_PANEL);
  if (await panel.isVisible().catch(() => false)) return;
  const trigger = page.locator(PREFS_TRIGGER);
  await trigger.waitFor({ state: "visible", timeout: HYDRATION_TIMEOUT });
  await trigger.click();
  await panel.waitFor({ state: "visible", timeout: POLL_TIMEOUT });
};

/** One row of it, by the preference it sets rather than by its position: rows
 *  are a list somebody will reorder. */
const row = (world: OlaiWorld, pref: string) =>
  world.page.locator(`${PREFS_ROW}[data-pref="${pref}"]`);

/** What that row says the choice in force MEANS. Exported for the theme steps,
 *  which read it for the promise the retired header pill used to keep. */
export const hintOf = async (
  world: OlaiWorld,
  pref: string,
): Promise<string> => {
  await showPreferences(world.page);
  const hint = row(world, pref).locator(PREFS_HINT);
  await hint.waitFor({ state: "visible", timeout: POLL_TIMEOUT });
  return (await hint.innerText()) ?? "";
};

// ── opening it ─────────────────────────────────────────────────────────

When("I open the preferences", async function (this: OlaiWorld) {
  await showPreferences(this.page);
});

Then("the preferences are open", async function (this: OlaiWorld) {
  await this.page
    .locator(PREFS_PANEL)
    .waitFor({ state: "visible", timeout: POLL_TIMEOUT });
});

Then("the preferences are shut", async function (this: OlaiWorld) {
  await this.page
    .locator(PREFS_PANEL)
    .waitFor({ state: "hidden", timeout: POLL_TIMEOUT });
});

/** Unconditionally, unlike `showPreferences`: the scenario that presses it a
 *  SECOND time is asking what that press does. */
When("I press the preferences trigger", async function (this: OlaiWorld) {
  await this.press(this.page.locator(PREFS_TRIGGER));
});

When("I press Escape on the preferences", async function (this: OlaiWorld) {
  await this.page.keyboard.press("Escape");
});

When("I click the wordmark", async function (this: OlaiWorld) {
  // Somewhere that is neither the trigger nor the panel, and that does nothing
  // of its own — a node title would open an editor, and a scenario about a
  // popover shutting should not also be a scenario about a caret.
  await this.page.locator(WORDMARK).click();
});

Then("the preferences trigger has the focus", async function (this: OlaiWorld) {
  const focused = await this.page.evaluate(
    () =>
      document.activeElement?.getAttribute("data-testid") ??
        document.activeElement?.tagName.toLowerCase() ??
        null,
  );
  assert.equal(
    focused,
    TESTID.prefsTrigger,
    `the focus is on ${focused ?? "nothing"} after Escape, not back on the ` +
      "control that opened the panel",
  );
});

Then(
  "the panel says these preferences are this browser's",
  async function (this: OlaiWorld) {
    const said = await this.page.locator(PREFS_SCOPE).innerText();
    assert.ok(
      /browser/i.test(said) && /never sent/i.test(said),
      `the panel's scope line says "${said}", which does not say whose these ` +
        "are or that they stay here",
    );
  },
);

/** The panel opens DOWNWARD from its trigger, escapes the bar, and lands
 *  inside the window.
 *
 *  The header is `sticky` with a z-index, which makes it a stacking context and
 *  a 3rem-tall box — so the panel is portalled out of it and placed against the
 *  viewport (`web/src/client/anchor.ts`). A panel laid out inside the bar is
 *  the failure this catches, and it is invisible to any assertion phrased as
 *  "the panel is visible": a clipped one still is. Its top is measured against
 *  the TRIGGER rather than the bar, because that is what it is anchored to —
 *  the pill has padding above and below it inside the bar, so the gap below the
 *  pill starts a pixel or two above the bar's own bottom edge. */
Then("the preferences panel opens downward, clear of the bar", async function (this: OlaiWorld) {
  const header = await this.box(this.page.locator(APP_HEADER), "the app header");
  const trigger = await this.box(this.page.locator(PREFS_TRIGGER), "the trigger");
  const panel = await this.box(this.page.locator(PREFS_PANEL), "the preferences");
  assert.ok(
    panel.y >= trigger.y + trigger.height - 1,
    `the panel starts at y=${Math.round(panel.y)} and its trigger ends at ` +
      `${Math.round(trigger.y + trigger.height)} — it is opening upward into ` +
      "a 3rem bar",
  );
  assert.ok(
    panel.y + panel.height > header.y + header.height,
    "the whole panel is inside the header's own 3rem, which is a panel that " +
      "has been clipped rather than one that was portalled out",
  );
  const viewport = this.page.viewportSize();
  assert.ok(viewport !== null, "this scenario has no viewport size");
  assert.ok(
    panel.x >= -1 && panel.x + panel.width <= viewport.width + 1,
    `the panel spans x=${Math.round(panel.x)}..` +
      `${Math.round(panel.x + panel.width)} on a ${viewport.width}px screen`,
  );
  assert.ok(
    panel.y + panel.height <= viewport.height + 1,
    `the panel ends at y=${Math.round(panel.y + panel.height)} on a ` +
      `${viewport.height}px screen — it should scroll inside itself instead`,
  );
});

// ── the Done preference ────────────────────────────────────────────────

/** Press one segment of a row's control, and wait for it to say it is the one
 *  in force — so everything after this step is about what the app DID rather
 *  than about the click landing. */
When(
  "I set Done to {string}",
  async function (this: OlaiWorld, value: string) {
    await showPreferences(this.page);
    await this.press(
      row(this, "done").locator(`${PREFS_CHOICE}[data-value="${value}"]`),
    );
    await this.expectAttribute(
      `${PREFS_ROW}[data-pref="done"] ${PREFS_CHOICE}[data-value="${value}"]`,
      "aria-pressed",
      "true",
      `the Done "${value}" choice`,
    );
  },
);

Then(
  "the Done row explains that finished work is {string}",
  async function (this: OlaiWorld, expected: string) {
    const hint = await hintOf(this, "done");
    assert.ok(
      hint.includes(`finished work ${expected}`),
      `the Done row says "${hint}", which does not say finished work is ` +
        `${expected}`,
    );
  },
);

Then(
  "this browser has stored that done nodes are {string}",
  async function (this: OlaiWorld, state: string) {
    const stored = await this.page.evaluate(
      (key) => localStorage.getItem(key),
      DONE_HIDDEN_KEY,
    );
    assert.equal(
      stored,
      state === "hidden" ? "true" : "false",
      `this browser keeps "${stored}" under ${DONE_HIDDEN_KEY}`,
    );
  },
);
