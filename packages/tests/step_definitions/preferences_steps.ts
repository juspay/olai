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

import {
  DENSITY_KEY,
  type Density,
} from "@olai/web/src/client/settings/density.ts";
import { DONE_HIDDEN_KEY } from "@olai/web/src/client/settings/done.ts";
import { TESTID } from "@olai/web/src/client/testids.ts";
import { SIZE_STORAGE_KEY } from "@olai/web/src/client/theme/sizes.ts";

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
  return await hint.innerText();
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

// ── where the caret is ─────────────────────────────────────────────────

When("I focus the preferences trigger", async function (this: OlaiWorld) {
  await this.page.locator(PREFS_TRIGGER).focus();
});

When("I press Enter", async function (this: OlaiWorld) {
  await this.page.keyboard.press("Enter");
});

When("I press Tab", async function (this: OlaiWorld) {
  await this.page.keyboard.press("Tab");
});

When("I press Shift+Tab", async function (this: OlaiWorld) {
  await this.page.keyboard.press("Shift+Tab");
});

/** What has the caret, named the way this suite names things: its test id, or
 *  — for a control inside a panel that has none of its own — enough of it to
 *  say which control it is. */
const focused = (world: OlaiWorld): Promise<string> =>
  world.page.evaluate(() => {
    const el = document.activeElement;
    if (el === null || el === document.body) return "nothing";
    const id = el.getAttribute("data-testid");
    const value = el.getAttribute("data-value");
    return `${id ?? el.tagName.toLowerCase()}${value === null ? "" : `=${value}`}`;
  });

Then("the preferences panel has the focus", async function (this: OlaiWorld) {
  assert.equal(
    await focused(this),
    TESTID.prefsPanel,
    "opening the panel left the caret outside it, so a keyboard reaches the " +
      "controls only after walking the whole page (the panel is portalled to " +
      "the end of the body)",
  );
});

/**
 * The first and last things a Tab may land on INSIDE the panel, asked of the
 * page rather than written down here.
 *
 * Written down, they would be "the leaf chip" and "the Hidden segment" — which
 * is a list of what the panel happens to contain today, and a scenario about
 * the tab CYCLE would then fail the day a row is added. What it is really
 * asking is that the cycle's ends join up to the trigger.
 */
const endControl = (world: OlaiWorld, which: "first" | "last"): Promise<string> =>
  world.page.evaluate((end) => {
    const panel = document.querySelector('[data-testid="prefs-panel"]');
    const controls = [
      ...(panel?.querySelectorAll<HTMLElement>(
        'a[href], button:not(:disabled), input:not(:disabled), textarea:not(:disabled)',
      ) ?? []),
    ];
    const el = end === "first" ? controls[0] : controls[controls.length - 1];
    if (el === undefined) return "nothing";
    const id = el.getAttribute("data-testid");
    const value = el.getAttribute("data-value");
    return `${id ?? el.tagName.toLowerCase()}${value === null ? "" : `=${value}`}`;
  }, which);

Then(
  "the {word} control in the preferences has the focus",
  async function (this: OlaiWorld, which: string) {
    if (which !== "first" && which !== "last") {
      throw new Error(`there is no "${which}" control; say first or last`);
    }
    const expected = await endControl(this, which);
    assert.notEqual(expected, "nothing", "the panel offers no controls at all");
    assert.equal(
      await focused(this),
      expected,
      `Tab was supposed to land on the ${which} control in the panel`,
    );
  },
);

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
    `the focus is on ${focused ?? "nothing"}, not on the control that opened ` +
      "the panel",
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
  const viewport = this.viewport();
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

// ── picking a segment, whichever row it is on ──────────────────────────

/**
 * Press one segment of one row, and wait for the panel to say it took.
 *
 * ONE spelling for every segmented row there is — Done, Notes, Size — because
 * they are one control (`client/settings/Segmented.tsx`) and the wait is the
 * subtle half: pressing and carrying on races the render, and each row having
 * its own copy of that wait is how the third one gets it slightly wrong.
 */
const pickChoice = async (
  page: Page,
  pref: string,
  value: string,
): Promise<void> => {
  await showPreferences(page);
  const choice = page.locator(
    `${PREFS_ROW}[data-pref="${pref}"] ${PREFS_CHOICE}[data-value="${value}"]`,
  );
  await choice.waitFor({ state: "visible", timeout: POLL_TIMEOUT });
  await choice.click();
  await choice
    .and(page.locator('[aria-pressed="true"]'))
    .waitFor({ state: "visible", timeout: POLL_TIMEOUT })
    .catch(() => {
      throw new Error(`the ${pref} row never took "${value}"`);
    });
};

// ── the Done preference ────────────────────────────────────────────────

/** Press one Done segment on a page. Hide/show, the Prefs step and the
 *  second-tab step are one circuit — the outline pill that used to be a second
 *  door is gone. */
const pickDone = async (
  page: Page,
  value: "hidden" | "visible",
): Promise<void> => {
  await pickChoice(page, "done", value);
};

const asDone = (value: string): "hidden" | "visible" => {
  if (value !== "hidden" && value !== "visible") {
    throw new Error(`Done is "hidden" or "visible", not "${value}"`);
  }
  return value;
};

When(
  "I set Done to {string}",
  async function (this: OlaiWorld, value: string) {
    await pickDone(this.page, asDone(value));
  },
);

/** Intent sentences the tree features already speak. They go through Prefs
 *  and then put the panel away, because the next step is about the TREE and a
 *  portalled panel would sit on top of it. */
const pickDoneAndLeave = async (
  world: OlaiWorld,
  value: "hidden" | "visible",
): Promise<void> => {
  await pickDone(world.page, value);
  // The trigger, not Escape: hide/show is about the TREE, and a global
  // Escape would cancel an editor or a menu the next step is about.
  await world.press(world.page.locator(PREFS_TRIGGER));
  await world.page
    .locator(PREFS_PANEL)
    .waitFor({ state: "hidden", timeout: POLL_TIMEOUT });
};

When("I hide the done nodes", async function (this: OlaiWorld) {
  await pickDoneAndLeave(this, "hidden");
});

When("I show the done nodes", async function (this: OlaiWorld) {
  await pickDoneAndLeave(this, "visible");
});

/**
 * A SECOND page in the same context, which is what makes it a second tab of the
 * same browser rather than a second browser: one origin, one `localStorage`,
 * and the `storage` event this app listens for is fired in every document of it
 * except the one that wrote.
 *
 * Driven through the panel rather than through `setItem`, so what crosses is a
 * preference somebody actually set. Left open on purpose, exactly as the
 * theme's twin is (`theme_steps.ts`): a preference that only crossed once the
 * other tab was gone would pass a scenario that closed it.
 */
When(
  "a second tab sets Done to {string}",
  async function (this: OlaiWorld, value: string) {
    const other = await this.context.newPage();
    await other.goto("/");
    await pickDone(other, asDone(value));
  },
);

Then(
  "the Done row explains that finished work is {string}",
  async function (this: OlaiWorld, expected: string) {
    const hint = await hintOf(this, "done");
    assert.ok(
      hint.includes(`Finished work is ${expected}`),
      `the Done row says "${hint}", which does not say finished work is ` +
        `${expected}`,
    );
  },
);

Then(
  "this browser has stored that done nodes are {string}",
  async function (this: OlaiWorld, state: string) {
    const stored = await this.stored(DONE_HIDDEN_KEY);
    assert.equal(
      stored,
      state === "hidden" ? "true" : "false",
      `this browser keeps "${stored}" under ${DONE_HIDDEN_KEY}`,
    );
  },
);

// ── the Notes preference: how much of a row is drawn by default ────────

/** The three words the Notes row offers, checked here rather than left to a
 *  typo in a scenario: a `data-value` that matches nothing waits thirty seconds
 *  and then says a segment was not visible. */
const asDensity = (value: string): Density => {
  const found = (["compact", "cozy", "open"] as const).find(
    (one) => one === value,
  );
  if (found === undefined) {
    throw new Error(`Notes is compact, cozy or open, not "${value}"`);
  }
  return found;
};

When(
  "I set Notes to {string}",
  async function (this: OlaiWorld, value: string) {
    await pickChoice(this.page, "density", asDensity(value));
  },
);

/** ...and then put the panel away, because the next step is about the TREE and
 *  a portalled panel would sit on top of it. The trigger rather than Escape,
 *  for the reason the Done twin gives. */
When(
  "I read the outline with Notes on {string}",
  async function (this: OlaiWorld, value: string) {
    await pickChoice(this.page, "density", asDensity(value));
    await this.press(this.page.locator(PREFS_TRIGGER));
    await this.page
      .locator(PREFS_PANEL)
      .waitFor({ state: "hidden", timeout: POLL_TIMEOUT });
  },
);

When(
  "a second tab sets Notes to {string}",
  async function (this: OlaiWorld, value: string) {
    const other = await this.context.newPage();
    await other.goto("/");
    await pickChoice(other, "density", asDensity(value));
  },
);

Then(
  "the Notes row explains that a row {string}",
  async function (this: OlaiWorld, expected: string) {
    const hint = await hintOf(this, "density");
    assert.ok(
      hint.includes(expected),
      `the Notes row says "${hint}", which does not say ${JSON.stringify(expected)}`,
    );
  },
);

Then(
  "this browser has stored that notes are {string}",
  async function (this: OlaiWorld, value: string) {
    const stored = await this.stored(DENSITY_KEY);
    assert.equal(
      stored,
      asDensity(value),
      `this browser keeps "${stored}" under ${DENSITY_KEY}`,
    );
  },
);

// ── the Size preference: how big the page is set ───────────────────────

When(
  "I set Size to {string}",
  async function (this: OlaiWorld, value: string) {
    await pickChoice(this.page, "size", value);
  },
);

/**
 * The page's ROOT font size, which is the whole of what a size pick does: every
 * length in this client is a `rem`, so this one number is the page.
 *
 * Read as pixels off the document rather than as the `rem` the table declares —
 * that is what a reader gets, and it is what would stay at 16 if the sheet's
 * blocks or the boot script's attribute stopped meeting.
 */
Then(
  "the page is set at {string}",
  async function (this: OlaiWorld, size: string) {
    await this.waitUntil(
      async () =>
        (await this.page.evaluate(
          () => getComputedStyle(document.documentElement).fontSize,
        )) === size,
      `the page to be set at ${size}`,
    );
  },
);

Then(
  "this browser has stored the size {string}",
  async function (this: OlaiWorld, value: string) {
    const stored = await this.stored(SIZE_STORAGE_KEY);
    assert.equal(
      stored,
      value,
      `this browser keeps "${stored}" under ${SIZE_STORAGE_KEY}`,
    );
  },
);
