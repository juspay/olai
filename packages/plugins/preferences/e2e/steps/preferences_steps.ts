/**
 * The preferences panel: the one door in the header, the rows behind it, and
 * the promise every one of them makes — that a pick is this browser's and
 * reaches no server. DONE is the one setting with two homes, and this file
 * is both doors: the row says the panel's default; the flip beside a page's
 * filter out-votes it for that page and remembers what it said.
 *
 * The KEYS a preference is stored under are imported from the client that owns
 * them, for the reason `theme_steps.ts` imports the theme's: renaming one is
 * then a type error at `bun run typecheck` rather than a scenario that times
 * out thirty seconds later saying nothing about why.
 *
 * OPENING it, reading one row's hint and pressing one segment are the
 * harness's (`support/preferences.ts`) rather than this file's, and the reason
 * is that three other plugins do all three: the theme chips are a row of this
 * panel, the reminder switches are two more, and the face picker is a fourth.
 * A step file that exported them was a plugin reaching past another plugin's
 * doors for a gesture it does not own. Every CLAIM about the panel is still
 * here; what left is the way in.
 */
import { TEST_CLAIMS } from "@olai/format/testlib"
import { TESTID } from "@olai/tests/harness/testids.ts"
import * as assert from "node:assert";
import { Given, Then, When } from "@olai/tests/harness/runner.ts";
import type { Page, Locator } from "@olai/tests/harness/playwright.ts";


import { fileKind } from "@olai/format";

import { SIZE_STORAGE_KEY, selector } from "@olai/web/testlib"
// A PREFERENCE IS KEPT BY WHOEVER DRAWS THE THING, and the key it is kept
// under is that row's name for it. These six came through `@olai/web/testlib`,
// which is how a general package came to declare `olai-plugin-chat` and
// `olai-plugin-outlines` for six strings about two plugins' own storage —
// exactly the pass-through `@olai/bundle`'s `fence.test.ts` holds an equality
// against. The SIZE key above stays on that door, because the door hands it on
// from `@olai/appearance`, which really does own it.
import { ALERT_SOUND_KEY, ALERTS_KEY, DENSITY_KEY, type Density, DONE_HIDDEN_KEY, DONE_OVERRIDES_KEY } from "@olai/tests/harness/storage_keys.ts"

import { focusedOn } from "@olai/tests/harness/caret.ts";
import { hintOf, pickChoice, prefRow as row, showPreferences } from "@olai/tests/harness/preferences.ts";
import { pressed } from "@olai/tests/harness/settling.ts";
import {
  APP_HEADER,
  attr,
  CONNECTION,
  HEALTH,
  HEALTH_PANEL,
  HYDRATION_TIMEOUT,
  PANE,
  CHAT_TOGGLE,
  PADI_PILL,
  PLUGIN_CONFIG,
  PLUGIN_CONFIRM,
  PLUGIN_CONFIRM_KEEP,
  PLUGIN_CONFIRM_OFF,
  PLUGIN_GROUP,
  PLUGIN_SWITCH,
  PLUGINS_PANEL,
  PLUGINS_REFUSED,
  PLUGINS_STARTED,
  PLUGINS_TRIGGER,
  POLL_TIMEOUT,
  PREFS_CHOICE,
  PREFS_HINT,
  PREFS_PANEL,
  PREFS_ROW,
  PREFS_SCOPE,
  PREFS_TRIGGER,
  SIDEBAR_BODY,
  SIDEBAR_SCRIM,
  SIDEBAR_TOGGLE,
  WORDMARK,
} from "@olai/tests/harness/world.ts";
import type { OlaiWorld } from "@olai/tests/harness/world.ts";

Given("this browser refuses local storage", async function (this: OlaiWorld) {
  await this.page.addInitScript(() => {
    for (const method of ["getItem", "setItem", "removeItem"] as const) {
      Object.defineProperty(Storage.prototype, method, {
        configurable: true,
        value() { throw new DOMException("Storage is unavailable", "SecurityError"); },
      });
    }
  });
});

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
When("I press Escape on the preferences", async function (this: OlaiWorld) {
  await pressed(this, "Escape");
});

// ── where the caret is ─────────────────────────────────────────────────

When("I focus the preferences trigger", async function (this: OlaiWorld) {
  await this.page.locator(PREFS_TRIGGER).focus();
});

When("I press Enter", async function (this: OlaiWorld) {
  await pressed(this, "Enter");
});

When("I press Tab", async function (this: OlaiWorld) {
  await pressed(this, "Tab");
});

When("I press Shift+Tab", async function (this: OlaiWorld) {
  await pressed(this, "Shift+Tab");
});

Then("the preferences panel has the focus", async function (this: OlaiWorld) {
  assert.equal(
    await focusedOn(this),
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
      await focusedOn(this),
      expected,
      `Tab was supposed to land on the ${which} control in the panel`,
    );
  },
);

Then("the preferences trigger has the focus", async function (this: OlaiWorld) {
  const held = await focusedOn(this);
  assert.equal(
    held,
    TESTID.prefsTrigger,
    `the focus is on ${held}, not on the control that opened the panel`,
  );
});

Then(
  "the panel says these preferences are this browser's",
  async function (this: OlaiWorld) {
    // ONE quiet line at the foot, said once for every row above it: whose
    // these are (this browser's) and that they go no further ("only").
    const said = (await this.page.locator(PREFS_SCOPE).innerText()).trim();
    assert.ok(
      /this browser only/i.test(said),
      `the panel's scope line says "${said}", which does not say these are ` +
        "kept in this browser and nowhere else",
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

/**
 * THE PANEL FITS THE SCREEN IT IS ON — measured, because on a phone the
 * geometry is the feature: a swatch row that does not wrap, a select that
 * does not shrink or a label that will not truncate pushes a control past the
 * right edge, and a panel that is merely "visible" is still one a thumb
 * cannot reach the end of.
 *
 * Every row and every control is asked, including the ones scrolled below the
 * panel's fold: sideways is never the panel's to scroll, downward always is.
 */
Then("the preferences panel fits the screen", async function (this: OlaiWorld) {
  const panel = this.page.locator(PREFS_PANEL);
  await panel.waitFor({ state: "visible", timeout: POLL_TIMEOUT });
  const viewport = this.viewport();
  const box = await this.box(panel, "the preferences");
  assert.ok(
    box.x >= -1 && box.x + box.width <= viewport.width + 1,
    `the panel spans x=${Math.round(box.x)}..${Math.round(box.x + box.width)} on a ${viewport.width}px screen`,
  );
  assert.ok(
    box.y >= -1 && box.y + box.height <= viewport.height + 1,
    `the panel spans y=${Math.round(box.y)}..${Math.round(box.y + box.height)} on a ${viewport.height}px screen — it should scroll inside itself`,
  );
  const measured = await panel.evaluate((el) => {
    const edge = el.getBoundingClientRect();
    const outside = [
      ...el.querySelectorAll<HTMLElement>('[data-testid="prefs-row"], button, select, input'),
    ]
      .map((one) => ({ one, at: one.getBoundingClientRect() }))
      .filter(({ at }) => at.width > 0 && (at.left < edge.left - 1 || at.right > edge.right + 1))
      .map(({ one, at }) =>
        `${one.getAttribute("data-testid") ?? one.tagName.toLowerCase()}` +
        `${one.getAttribute("data-value") === null ? "" : `=${one.getAttribute("data-value")}`}` +
        ` at x=${Math.round(at.left)}..${Math.round(at.right)}`);
    return {
      overflows: el.scrollWidth > el.clientWidth + 1,
      page: document.documentElement.scrollWidth > window.innerWidth + 1,
      outside,
    };
  });
  assert.ok(!measured.overflows, "the panel scrolls sideways");
  assert.ok(!measured.page, "the page scrolls sideways with the panel open");
  assert.deepStrictEqual(measured.outside, [], "a row or a control sits past the panel's edge");
});

// ── the headings ───────────────────────────────────────────────────────
//
// The panel knows no row of its own: the headings are its `HEADINGS` table,
// each contributor names the key its rows sit under (`preferences.sections`'
// `heading`), and a heading whose contributors have all gone is not drawn. So the headings on screen are a
// reading of WHICH ROWS ARE RUNNING, and that is what these steps ask.

/** The headings drawn, in the order a reader meets them, in the words a
 *  reader reads (the group's accessible name; `data-group` is the key). A
 *  heading whose contribution drew no row is hidden by CSS rather than
 *  removed, so it is read as a person would: visible or not. */
const headings = async (world: OlaiWorld): Promise<ReadonlyArray<string>> => {
  await showPreferences(world.page);
  return await world.page
    .locator(`${PREFS_PANEL} ${selector(TESTID.prefsGroup)}`)
    .evaluateAll((all) =>
      all
        .filter((one) => one.getClientRects().length > 0)
        .map((one) => one.getAttribute("aria-label") ?? ""),
    );
};

Then(
  "the preferences are headed {string}",
  async function (this: OlaiWorld, expected: string) {
    const wanted = expected.split(",").map((one) => one.trim());
    let seen: ReadonlyArray<string> = [];
    await this.waitUntil(async () => {
      seen = await headings(this);
      return seen.join("|") === wanted.join("|");
    }, `the preferences to be headed ${expected}`).catch(() => {
      assert.fail(`the preferences are headed ${JSON.stringify(seen.join(", "))}, not ${JSON.stringify(expected)}`);
    });
  },
);

Then(
  "the preferences have no {string} heading",
  async function (this: OlaiWorld, group: string) {
    await showPreferences(this.page);
    await this.page
      .locator(`${PREFS_PANEL} ${selector(TESTID.prefsGroup)}${attr("aria-label", group)}`)
      .waitFor({ state: "hidden", timeout: POLL_TIMEOUT })
      .catch(async () => {
        assert.fail(`the preferences still carry ${JSON.stringify(group)}; they are headed ${JSON.stringify((await headings(this)).join(", "))}`);
      });
  },
);

// ── the switches, whichever row they are on ────────────────────────────
//
// Every yes-or-no row draws the one shared switch (`@olai/ui-primitives`'
// `Switch.tsx`): `role="switch"`, `aria-checked`, and — frozen — dimmed and
// `aria-disabled` rather than `disabled`, so a keyboard can still reach it and
// hear why it will not move.

const asOnOff = (value: string): "on" | "off" => {
  if (value !== "on" && value !== "off") {
    throw new Error(`a switch is "on" or "off", not "${value}"`);
  }
  return value;
};

/** The switch on one row, by the preference it sets. */
const switchOnRow = (world: OlaiWorld, pref: string): Locator =>
  row(world, pref).locator(selector(TESTID.prefsSwitch));

/** Put one row's switch where it is asked to be — a press only if it is not
 *  there already, so a step says where it is going rather than which way to
 *  move — and wait for the switch to say it took. */
const setSwitch = async (
  world: OlaiWorld,
  pref: string,
  value: "on" | "off",
): Promise<void> => {
  await showPreferences(world.page);
  const control = switchOnRow(world, pref);
  await control.waitFor({ state: "visible", timeout: POLL_TIMEOUT });
  const wanted = value === "on" ? "true" : "false";
  if ((await control.getAttribute("aria-checked")) !== wanted) await world.press(control);
  await world
    .expectAttribute(`${PREFS_ROW}${attr("data-pref", pref)} ${selector(TESTID.prefsSwitch)}`, "aria-checked", wanted, `the ${pref} switch`);
};

/** A row by the label a person reads beside its control. */
const rowLabelled = (world: OlaiWorld, label: string): Locator =>
  world.page.locator(PREFS_ROW).filter({
    has: world.page.locator(`[role="group"]${attr("aria-label", label)}`),
  });

Then(
  "the {string} switch reads {string}",
  async function (this: OlaiWorld, label: string, value: string) {
    await showPreferences(this.page);
    const control = rowLabelled(this, label).locator(selector(TESTID.prefsSwitch));
    await control.waitFor({ state: "visible", timeout: POLL_TIMEOUT });
    const wanted = asOnOff(value) === "on" ? "true" : "false";
    await this.waitUntil(async () => (await control.getAttribute("aria-checked")) === wanted,
      `the ${label} switch to read ${value}`);
  },
);

/**
 * FROZEN, AS A PERSON MEETS IT: dimmed, announced as not movable, and — the
 * half an attribute cannot promise — pressing it moves nothing. Frozen rather
 * than hidden, because the switch above it (Alerts) says why, and a row a
 * reader cannot see is one they cannot ask about.
 */
Then(
  "the {string} switch is dimmed and does not move",
  async function (this: OlaiWorld, label: string) {
    await showPreferences(this.page);
    const control = rowLabelled(this, label).locator(selector(TESTID.prefsSwitch));
    await control.waitFor({ state: "visible", timeout: POLL_TIMEOUT });
    await this.waitUntil(async () => (await control.getAttribute("aria-disabled")) === "true",
      `the ${label} switch to be frozen`);
    const opacity = Number(await control.evaluate((el) => getComputedStyle(el).opacity));
    assert.ok(opacity < 1, `the frozen ${label} switch is drawn at full strength (opacity ${opacity})`);
    const before = await control.getAttribute("aria-checked");
    // FORCED, because Playwright will not click an `aria-disabled` control at
    // all — it waits for it to be enabled — and the claim is about what a
    // press a person can still make does, not whether a tool would make it.
    await this.intoReach(control);
    await control.click({ force: true });
    await this.waitForFrame();
    assert.equal(await control.getAttribute("aria-checked"), before, `pressing the frozen ${label} switch moved it`);
  },
);

Then(
  "the {string} switch can be set",
  async function (this: OlaiWorld, label: string) {
    await showPreferences(this.page);
    const control = rowLabelled(this, label).locator(selector(TESTID.prefsSwitch));
    await control.waitFor({ state: "visible", timeout: POLL_TIMEOUT });
    await this.waitUntil(async () => (await control.getAttribute("aria-disabled")) === null,
      `the ${label} switch to be live again`);
    const opacity = Number(await control.evaluate((el) => getComputedStyle(el).opacity));
    assert.equal(opacity, 1, `the live ${label} switch is still dimmed (opacity ${opacity})`);
  },
);

// ── the Done preference ────────────────────────────────────────────────

/** Set THE PANEL's Show finished switch — the reader's default for every
 *  page that has not said otherwise. The scenario words are the stored
 *  ones (`visible` / `hidden`); the switch reads on for visible. */
const pickDone = async (
  world: OlaiWorld,
  value: "hidden" | "visible",
): Promise<void> => {
  await setSwitch(world, "done", value === "visible" ? "on" : "off");
};

const DONE_FLIP = attr("data-testid", TESTID.doneFlip);
const FOCUSED_PANE = attr("data-pane-focused", "true");

/** The outline a pane's `data-href` names, or nothing — `/` is the first
 *  outline and does not spell a file; a node permalink does not either.
 *  Asked of `fileKind`, not of a spelled suffix: kinds.test.ts is the
 *  fence, and the registry is the one place that list exists. */
const outlineNamedBy = (href: string | null): string | undefined => {
  if (href === null || href === "") return undefined;
  const path = decodeURIComponent(href.split("?")[0] ?? "").replace(
    /^\//,
    "",
  );
  return TEST_CLAIMS.byKind.get(fileKind(TEST_CLAIMS, path) ?? "")?.holds === "nodes" ? path : undefined;
};

/** The flip of the ADDRESSED page, not a held previous one.
 *
 *  `/` lands on the first outline; a later open keeps that tree on screen
 *  until the named file arrives (`createReading`'s swap). The flip is drawn
 *  from the held reading, so a wait on any done-flip prefs-choice matches
 *  the previous page and the press (or the Then) is lost when the swap
 *  remounts it. */
const flipOfAddressed = async (page: Page) => {
  const href = await page
    .locator(`${PANE}${FOCUSED_PANE}`)
    .getAttribute("data-href");
  const named = outlineNamedBy(href);
  return named === undefined
    ? page.locator(`${FOCUSED_PANE} ${DONE_FLIP}`)
    : page.locator(`${FOCUSED_PANE} ${DONE_FLIP}${attr("data-file", named)}`);
};

/** The `finished` box beside the FOCUSED pane's filter: this page's own say.
 *  Ticked is `shown`, the override map's word; the panel's segments answer in
 *  the row's own `visible` / `hidden` (client/settings/done.ts keeps the two
 *  vocabularies apart on purpose).
 *
 *  PRESS WHAT YOU MEAN: a box already standing the way it is asked is left
 *  alone, so "I show the done nodes" on a page that shows them is not a press
 *  that would hide them — the same idempotent ask the two segments were. */
const flipDone = async (
  page: Page,
  word: "shown" | "hidden",
): Promise<void> => {
  const flip = await flipOfAddressed(page);
  const box = flip.locator(attr("data-testid", TESTID.doneToggle));
  await box.waitFor({ state: "visible", timeout: POLL_TIMEOUT });
  if ((await box.isChecked()) !== (word === "shown")) await box.click();
  await flip
    .and(page.locator(`${DONE_FLIP}${attr("data-shown", word === "shown" ? "true" : "false")}`))
    .waitFor({ state: "visible", timeout: POLL_TIMEOUT });
};

Then(
  "this page's Done flip says {string}",
  async function (this: OlaiWorld, word: string) {
    if (word !== "shown" && word !== "hidden") {
      throw new Error(`Done is "shown" or "hidden", not "${word}"`);
    }
    const flip = await flipOfAddressed(this.page);
    await flip
      .and(this.page.locator(`${DONE_FLIP}${attr("data-shown", word === "shown" ? "true" : "false")}`))
      .waitFor({ state: "visible", timeout: POLL_TIMEOUT });
    const box = flip.locator(attr("data-testid", TESTID.doneToggle));
    assert.strictEqual(await box.isChecked(), word === "shown", `the finished box is not ${word === "shown" ? "ticked" : "clear"}`);
  },
);

/** The box's accessible name and its tooltip, as a person reads them. */
Then(
  "the finished box is named {string}",
  async function (this: OlaiWorld, name: string) {
    const flip = await flipOfAddressed(this.page);
    await flip.getByRole("checkbox", { name, exact: true }).waitFor({ state: "visible", timeout: POLL_TIMEOUT });
  },
);

Then(
  "the finished box's tooltip says {string}",
  async function (this: OlaiWorld, said: string) {
    const flip = await flipOfAddressed(this.page);
    await this.waitUntil(async () => (await flip.getAttribute("title")) === said,
      `the finished box's tooltip to say ${said}`);
  },
);

Then("the finished box offers no reset", async function (this: OlaiWorld) {
  const flip = await flipOfAddressed(this.page);
  await flip.waitFor({ state: "visible", timeout: POLL_TIMEOUT });
  await this.waitUntil(async () => (await flip.locator(attr("data-testid", TESTID.doneRelease)).count()) === 0,
    "no reset beside the finished box");
});

/** THE ONE LINE on a phone: the box and the finished toggle share a row, the
 *  toggle's word is not cut, and each is a finger's target. */
Then("the filter and the finished box share one line", async function (this: OlaiWorld) {
  const flip = await flipOfAddressed(this.page);
  const input = this.page.locator(`${FOCUSED_PANE} ${attr("data-testid", TESTID.filterInput)}`);
  const a = await input.boundingBox();
  const b = await flip.boundingBox();
  assert.ok(a !== null && b !== null, "the filter or the finished box is not on screen");
  const viewport = this.page.viewportSize()!;
  assert.ok(Math.abs((a.y + a.height / 2) - (b.y + b.height / 2)) < 4,
    `the filter (y=${a.y}, h=${a.height}) and the finished box (y=${b.y}, h=${b.height}) are not on one line`);
  assert.ok(b.x >= a.x + a.width, "the finished box overlaps the filter");
  assert.ok(b.x + b.width <= viewport.width, `the finished box ends at ${b.x + b.width}, past the ${viewport.width}px screen`);
  assert.ok(a.height >= 44, `the filter is ${a.height}px tall, under a finger's 44`);
  const label = flip.locator("label");
  const box = await label.boundingBox();
  assert.ok(box !== null && box.height >= 44, `the finished toggle is ${box?.height}px tall, under a finger's 44`);
  const clipped = await label.evaluate((el) => el.scrollWidth > el.clientWidth + 1);
  assert.ok(!clipped, "the finished toggle's word is cut");
});

Then("the Done flip is this page's own", async function (this: OlaiWorld) {
  const flip = await flipOfAddressed(this.page);
  await flip
    .and(this.page.locator(`${DONE_FLIP}${attr("data-own", "true")}`))
    .waitFor({ state: "visible", timeout: POLL_TIMEOUT });
});

Then("the Done flip is the panel's answer", async function (this: OlaiWorld) {
  const flip = await flipOfAddressed(this.page);
  await flip
    .and(this.page.locator(`${DONE_FLIP}:not(${attr("data-own", "true")})`))
    .waitFor({ state: "visible", timeout: POLL_TIMEOUT });
});

const asDone = (value: string): "hidden" | "visible" => {
  if (value !== "hidden" && value !== "visible") {
    throw new Error(`Done is "hidden" or "visible", not "${value}"`);
  }
  return value;
};

When(
  "I set Done to {string}",
  async function (this: OlaiWorld, value: string) {
    await pickDone(this, asDone(value));
  },
);

/** Intent sentences the tree features already speak. They go through Prefs
 *  and then put the panel away, because the next step is about the TREE and a
 *  portalled panel would sit on top of it. */
/** The panel AND whatever stood behind it back off the page. The trigger,
 *  not Escape: hide/show is about the TREE, and a global Escape would
 *  cancel an editor or a menu the next step is about. On a phone the
 *  trigger lives in the directory drawer, so that tap shut the panel with
 *  the drawer still standing over the page — the scrim is its own way out.
 */
const prefsAway = async (world: OlaiWorld): Promise<void> => {
  await world.press(world.page.locator(PREFS_TRIGGER));
  await world.page
    .locator(PREFS_PANEL)
    .waitFor({ state: "hidden", timeout: POLL_TIMEOUT });
  const scrim = world.page.locator(SIDEBAR_SCRIM);
  if (await scrim.isVisible().catch(() => false)) {
    // The burger rather than the scrim: the drawer is nearly the scrim's
    // whole width on a phone, and the scrim click would have to thread the
    // sliver beside it. The header is the one place the scrim deliberately
    // does NOT cover (`#101`'s ruling, right above the scrim), so the
    // toggle is the door that always works.
    await world.press(world.page.locator(SIDEBAR_TOGGLE));
    await world.page
      .locator(SIDEBAR_BODY)
      .waitFor({ state: "hidden", timeout: POLL_TIMEOUT });
  }
};

When("I hide the done nodes", async function (this: OlaiWorld) {
  await flipDone(this.page, "hidden");
});

When("I show the done nodes", async function (this: OlaiWorld) {
  await flipDone(this.page, "shown");
});

/** The release door is `reset` — not a second press. The box's gestures are
 *  idempotent asks (press what you mean); only `reset` hands the pick back to
 *  the panel, and it is drawn exactly while the page holds its own word
 *  (client/filter/DoneFlip.tsx). */
When("I hand the page's Done pick back to the panel", async function (this: OlaiWorld) {
  const flip = await flipOfAddressed(this.page);
  await flip.locator(attr("data-testid", TESTID.doneRelease)).click();
});

/**
 * A SECOND page in the same context, which is what makes it a second tab of the
 * same browser rather than a second browser: one origin, one `localStorage`,
 * and the `storage` event this app listens for is fired in every document of it
 * except the one that wrote.
 *
 * Opened on the SAME address as this page: the scenario is on the page the
 * other tab is about to speak for. Driven through the flip rather than
 * through `setItem`, so what crosses is a pick somebody actually made. Left
 * open on purpose, exactly as the theme's twin is (`theme_steps.ts`): a
 * preference that only crossed once the other tab was gone would pass a
 * scenario that closed it.
 */
When("a second tab shows the done on this page", async function (this: OlaiWorld) {
  const other = await this.context.newPage();
  await other.goto(this.page.url());
  await flipDone(other, "shown");
});

/**
 * The OVERRIDE map's say for ONE outline — the entry the flip left. Absence
 * is a stored fact too: a page that was never asked holds no entry, which
 * the `no Done word` twin is the fence for.
 */
Then(
  "this browser has stored that done nodes are {string} on {string}",
  async function (this: OlaiWorld, state: string, file: string) {
    if (state !== "shown" && state !== "hidden") {
      throw new Error(`done nodes are "shown" or "hidden", not "${state}"`);
    }
    const stored = await this.stored(DONE_OVERRIDES_KEY);
    const words: unknown = stored === null ? {} : JSON.parse(stored);
    assert.ok(
      typeof words === "object" && words !== null && !Array.isArray(words),
      `this browser keeps "${stored}" under ${DONE_OVERRIDES_KEY}, ` +
        "which is not a map of words",
    );
    assert.equal(
      (words as Record<string, string>)[file],
      state,
      `this browser keeps "${stored}" under ${DONE_OVERRIDES_KEY}, ` +
        `which does not say done nodes are ${state} on ${file}`,
    );
  },
);

Then(
  "this browser has stored no Done word on {string}",
  async function (this: OlaiWorld, file: string) {
    const stored = await this.stored(DONE_OVERRIDES_KEY);
    const words =
      stored === null
        ? {}
        : (JSON.parse(stored) as Record<string, string>);
    assert.ok(
      !(file in words),
      `this browser keeps "${stored}" under ${DONE_OVERRIDES_KEY}, ` +
        `which says something about ${file} nobody asked it to`,
    );
  },
);

/** The default's own fact under ITS own key — an absent entry means what
 *  `boolCodec(true)` means, so "stored" here includes the browser that has
 *  never written it. */
Then(
  "this browser has stored done nodes {string} by default",
  async function (this: OlaiWorld, state: string) {
    if (state !== "shown" && state !== "hidden") {
      throw new Error(`done nodes are "shown" or "hidden", not "${state}"`);
    }
    const stored = await this.stored(DONE_HIDDEN_KEY);
    const hidden: unknown = stored === null ? true : JSON.parse(stored);
    assert.equal(
      hidden,
      state === "hidden",
      `this browser keeps "${stored}" under ${DONE_HIDDEN_KEY}, ` +
        `which does not mean done nodes are ${state} by default`,
    );
  },
);

/** On a page the pick does not reach — a day, the agenda, the trash, a
 *  document — there is no flip to press: the question it answers was never
 *  there (client/filter/DoneFlip.tsx's reaching argument). */
Then("this page offers no Done flip", async function (this: OlaiWorld) {
  const flips = this.page.locator(`${FOCUSED_PANE} ${DONE_FLIP}`);
  await flips
    .first()
    .waitFor({ state: "detached", timeout: POLL_TIMEOUT })
    .catch(() => undefined);
  assert.equal(
    await flips.count(),
    0,
    "this page keeps a Done flip, and this step says it should offer none",
  );
});

// ── the two Alert preferences ──────────────────────────────────────────
//
// What they DO is `packages/plugins/chat/e2e/features/the_agent_waits_on_you.feature`; what is here is
// that they are preferences like the others — a pick that moves this browser,
// is stored under one key, and says what it means.

When(
  "I set Alerts to {string}",
  async function (this: OlaiWorld, value: string) {
    await setSwitch(this, "alerts", asOnOff(value));
  },
);

When(
  "I set the alert sound to {string}",
  async function (this: OlaiWorld, value: string) {
    await setSwitch(this, "alert-sound", asOnOff(value));
  },
);

Then(
  "this browser has stored that alerts are {string}",
  async function (this: OlaiWorld, value: string) {
    const stored = await this.stored(ALERTS_KEY);
    assert.equal(
      stored,
      asOnOff(value) === "on" ? "true" : "false",
      `this browser keeps "${stored}" under ${ALERTS_KEY}`,
    );
  },
);

Then(
  "this browser has stored that the alert sound is {string}",
  async function (this: OlaiWorld, value: string) {
    const stored = await this.stored(ALERT_SOUND_KEY);
    assert.equal(
      stored,
      asOnOff(value) === "on" ? "true" : "false",
      `this browser keeps "${stored}" under ${ALERT_SOUND_KEY}`,
    );
  },
);

/** The sound row is drawn FROZEN rather than hidden while alerts are off —
 *  the shared switch's own `aria-disabled`: a choice a reader cannot see is
 *  one they cannot ask anybody about. */
Then("the alert sound cannot be set", async function (this: OlaiWorld) {
  await showPreferences(this.page);
  const control = switchOnRow(this, "alert-sound");
  await control.waitFor({ state: "visible", timeout: POLL_TIMEOUT });
  await this.waitUntil(async () => (await control.getAttribute("aria-disabled")) === "true",
    "the alert sound switch to be frozen");
});

Then(
  "the Alerts row explains {string}",
  async function (this: OlaiWorld, expected: string) {
    const hint = await hintOf(this, "alerts");
    assert.ok(
      hint.includes(expected),
      `the Alerts row says "${hint}", which does not carry "${expected}"`,
    );
  },
);

// ── what the browser has said about notifications ──────────────────────
//
// The Alerts row reads the browser's answer and says only what applies: a
// browser not yet asked is offered the one gesture that can raise its prompt
// (`Allow notifications`), one that refused is told so, and one with no
// notifications at all is told that. `@alerts` / `@alerts-denied` are the
// harness's granted and refused contexts (`support/hooks.ts`); the two
// Givens below are the states no tag makes. Both are init scripts, because
// the channel reads the permission when it starts, before any step could.

Given(
  "this browser has not yet been asked about notifications",
  async function (this: OlaiWorld) {
    // Headless Chromium hard-wires `denied` (`support/alerts.ts` says why);
    // a person's fresh browser answers `default` until somebody asks.
    await this.page.addInitScript(() => {
      if (typeof Notification === "undefined") return;
      Object.defineProperty(Notification, "permission", { get: () => "default", configurable: true });
    });
  },
);

Given(
  "this browser cannot show notifications",
  async function (this: OlaiWorld) {
    // No `Notification` at all — an in-app browser, an old WebView.
    await this.page.addInitScript(() => {
      delete (globalThis as { Notification?: unknown }).Notification;
    });
  },
);

const ALLOW_NOTIFY = selector(TESTID.prefsAllowNotify);

Then(
  "the Alerts row offers to allow notifications",
  async function (this: OlaiWorld) {
    await showPreferences(this.page);
    const allow = row(this, "alerts").locator(ALLOW_NOTIFY);
    await allow.waitFor({ state: "visible", timeout: POLL_TIMEOUT });
    assert.equal((await allow.innerText()).trim(), "Allow notifications");
  },
);

Then(
  "the Alerts row offers no way to allow notifications",
  async function (this: OlaiWorld) {
    await showPreferences(this.page);
    await row(this, "alerts").waitFor({ state: "visible", timeout: POLL_TIMEOUT });
    await row(this, "alerts").locator(ALLOW_NOTIFY).waitFor({ state: "detached", timeout: POLL_TIMEOUT });
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
    await prefsAway(this);
  },
);

/** Which segment of a row is in force, by the label the row wears — the row
 *  says what it is set to by its pressed segment and nothing else (no row
 *  carries a sentence read off its choice any more). */
Then(
  "the {string} row is set to {string}",
  async function (this: OlaiWorld, label: string, value: string) {
    await showPreferences(this.page);
    const inForce = rowLabelled(this, label)
      .locator(`${PREFS_CHOICE}[aria-pressed="true"]`);
    await inForce.waitFor({ state: "visible", timeout: POLL_TIMEOUT });
    await this.waitUntil(async () => (await inForce.getAttribute("data-value")) === value,
      `the ${label} row to be set to ${value}`).catch(async () => {
      assert.fail(`the ${label} row is set to ${JSON.stringify(await inForce.getAttribute("data-value"))}, not ${JSON.stringify(value)}`);
    });
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

// ── git is not a preference ────────────────────────────────────────────
//
// Commit and push policy is the INSTANCE's (`olai-plugin-git`), set in the
// vault's settings and shown on the plugins panel — never a row here.

/**
 * NOTHING ABOUT GIT IS STORED IN THIS BROWSER, and that is the fence for the
 * whole move.
 *
 * The two git rows used to write `olai.git.autocommit` and `olai.git.autopush`
 * here, which is what made a quiet window a claim about a reader: two tabs of
 * two browsers could each believe something different about one directory, and
 * a directory nobody had a tab open on recorded nothing. The rows draw the
 * instance's policy now, so a key of either name in this browser is the old
 * shape coming back.
 */
Then(
  "this browser has stored nothing about git",
  async function (this: OlaiWorld) {
    for (const key of ["olai.git.autocommit", "olai.git.autopush"]) {
      assert.equal(
        await this.stored(key),
        null,
        `this browser keeps something under ${key}, so a git preference is stored here`,
      );
    }
  },
);

// ── the PLUGINS panel: what this build has, and what each row is doing ──
//
// A control of its own beside preferences, drawing the same four-part row
// (`web/src/client/plugins/Panel.tsx`), so the reads below are the preferences
// reads scoped to the other panel — which is exactly how the two are told
// apart, and why `prefsRow` is one name across both.

/** Open it unless it is open, on `showPreferences`'s terms and for its
 *  reason. */
When("I open the plugins panel", async function (this: OlaiWorld) {
  if ((await this.pluginsPanel().count()) > 0) return;
  const trigger = this.page.locator(PLUGINS_TRIGGER).locator("visible=true");
  // On a desktop the door is a row at the foot of the health popover, so the
  // popover is put up first; on a phone it is the drawer's row, as it was.
  await this.waitUntil(async () => {
    if ((await this.pluginsPanel().count()) > 0 || await trigger.isVisible()) return true;
    await this.openStatus().catch(() => undefined);
    return (await this.pluginsPanel().count()) > 0 || await trigger.isVisible();
  }, "the restored panel or its trigger");
  // A returning layout can restore an open inspector before its trigger.
  if ((await this.pluginsPanel().count()) > 0) return;
  await this.press(trigger);
  await this.pluginsPanel().waitFor({ state: "visible", timeout: POLL_TIMEOUT });
});

When("I close the plugins panel", async function (this: OlaiWorld) {
  // A flip publishes its row before the replacement socket finishes opening.
  // Wait for the reconnecting dialog to release pointer and keyboard input.
  await this.page.locator(selector(TESTID.offline)).waitFor({ state: "hidden", timeout: POLL_TIMEOUT });
  await this.waitUntil(async () => await this.pluginsPanel().locator(`${PLUGIN_SWITCH}[aria-disabled="true"]`).count() === 0, "the panel controls to finish reconciling");
  // Escape, on every width: on a desktop the row that opened it went with the
  // health popover (picking it shuts the popover), and on a phone the panel
  // covers the drawer's row.
  // A step before this one may already have put the panel away (a press
  // elsewhere on the page is a click-away), so shut it only while it is up —
  // and keep asking, because a rebuilt shell puts a held-open panel back.
  await this.waitUntil(async () => {
    if ((await this.pluginsPanel().count()) === 0) return (await this.page.locator(PLUGINS_PANEL).count()) === 0;
    await this.pluginsPanel().press("Escape").catch(() => undefined);
    return (await this.page.locator(PLUGINS_PANEL).count()) === 0;
  }, "the plugins panel to be shut");
  // Picking the Plugins row already shut the health popover; should a step
  // before this one have left it up anyway, shut it the way a person would —
  // its dot again. Nothing is left over the page for the next step.
  const health = this.page.locator(HEALTH_PANEL);
  if (await health.isVisible()) {
    await this.press(this.page.locator(HEALTH));
    await health.waitFor({ state: "hidden", timeout: POLL_TIMEOUT });
  }
});

/**
 * WHAT ONE PLUGIN'S ROW SAYS IT IS DOING — the hint, which is the half of the
 * row a person can act on.
 *
 * By the plugin's NAME, which is the settings namespace and the label the
 * row wears, so a scenario names the row the same way the operator who caused
 * this state did.
 */
Then(
  "the plugins panel says {string} is {string}",
  async function (this: OlaiWorld, plugin: string, said: string) {
    // WAITED FOR rather than read once, and that is the loader surface rather
    // than flake-proofing: a flip is a press, a settle over every row and a
    // republish, so the sentence a scenario is waiting for arrives some frames
    // after the click. The reads this step made before were of a serve that had
    // not moved since it booted; this one is asked across a change.
    //
    // The WAIT is a locator carrying the words, which is what auto-waits; the
    // catch is what turns "timed out on a selector" back into the sentence the
    // row actually says, which is the whole of what a reader of a failure needs.
    // The sentence sits in the row's DETAIL (at rest a row is its name, a
    // few words and its switch), so every try re-opens the row it is on.
    try {
      await untilOnRow(this, plugin, (row) =>
        row.locator(`${PREFS_HINT}:has-text(${JSON.stringify(said)})`).isVisible(),
      `the row for ${plugin} to say ${said}`);
    } catch {
      // ...AND THE SWITCH BESIDE IT, which is the half that turns "it says
      // nothing" into a sentence somebody can act on: a row with no hint is a
      // running row that carries nobody, and a reader of this failure needs to
      // know whether the serve disagrees about the STATE or only about the
      // words. There is a real failure behind that — a scenario waiting for a
      // `waiting` row was told only that the row said `""`.
      assert.fail(
        `the row for ${JSON.stringify(plugin)} to say ${JSON.stringify(said)}, ` +
          `and it says ${JSON.stringify(await hintOn(this, plugin))} ` +
          `with its switch reading ${JSON.stringify(await switchOn(this, plugin))}`,
      );
    }
  },
);

/**
 * ...AND A ROW WITH NOTHING TO SAY SAYS NOTHING — the panel's ordinary state,
 * asserted as an ABSENCE because that is the only way it can be.
 *
 * A running row that carries nobody draws no sentence at all: the switch
 * already says On, and a paragraph repeating it is how a panel becomes the
 * column of identical paragraphs this one was rewritten out of. That is a claim
 * about what is NOT on screen, so no reading of the hint's words could hold it.
 */
Then(
  "the plugins panel says nothing more about {string}",
  async function (this: OlaiWorld, plugin: string) {
    // Silence also describes an off or pending row now. Pin running first,
    // especially after approval, before treating the missing caption as ready.
    // Polled, re-opening the row each time: approval moves a row out of
    // Needs attention into its own group, which starts folded — and the
    // sentence that has to be gone may still be on screen for a frame.
    await untilOnRow(this, plugin, async (row) =>
      await row.locator(`${PLUGIN_SWITCH}[aria-checked="true"]`).isVisible()
        && await row.locator(PREFS_HINT).count() === 0,
    `the row for ${plugin} to be running and say nothing more`);
  },
);

/** Read the displayed effective value, including the default named beneath a
 * refused file spelling. Raw drafts are asserted by the input-specific steps. */
Then(
  "the plugins panel shows {string} configured {string} as {string}",
  async function (this: OlaiWorld, plugin: string, key: string, value: string) {
    // The knobs are in the row's detail; every try re-opens it.
    await untilOnRow(this, plugin, async (row) => {
      const pair = row.locator(`${PLUGIN_CONFIG}${attr("data-config", key)}`);
      return await pair.count() === 1 && await pair.isVisible() && (await configurationValue(pair)) === value;
    }, `the ${JSON.stringify(plugin)} row to show ${JSON.stringify(key)} as ${JSON.stringify(value)}`);
  },
);

Then(
  "the plugins panel was started {string}",
  async function (this: OlaiWorld, said: string) {
    const foot = this.page.locator(`${PLUGINS_PANEL} ${PLUGINS_STARTED}`);
    await foot.waitFor({ state: "visible", timeout: POLL_TIMEOUT });
    const line = (await foot.innerText()).replaceAll("\n", " ");
    assert.ok(
      line.includes(said),
      `the panel's own line to say ${JSON.stringify(said)}, and it says ${JSON.stringify(line)}`,
    );
  },
);

/** ONE PLUGIN'S ROW on the plugins panel, by the settings namespace — which
 *  is the label the row wears, so a scenario names it the way the operator who
 *  caused this state did. */
const rowFor = (world: OlaiWorld, plugin: string) =>
  world.pluginsPanel().locator(`${PREFS_ROW}${attr("data-pref", `plugin-${plugin}`)}`);

const shownRow = (world: OlaiWorld, plugin: string) => world.showPluginRow(plugin);

/** ...with its DETAIL open. At rest a row is its name, a few words of state
 *  and its switch; the full sentence sits in the detail its name opens (a row
 *  filed under Needs attention starts open). A row with nothing to reveal has
 *  no disclosure, and is handed back as it is. */
export const detailOf = async (world: OlaiWorld, plugin: string): Promise<Locator> => {
  const row = await shownRow(world, plugin);
  // A long wait here spends the caller's whole budget on a row that has
  // already moved into a group that starts folded. Throwing lets that caller
  // open the group the row is in now.
  if (!(await row.isVisible().catch(() => false))) throw new Error(`the ${plugin} row is not on screen`);
  // Read the chevron's state and press it only while it says shut — in one
  // short attempt, never a wait on a selector: a roster republish can move the
  // row into Needs attention (which opens it) between the read and the press,
  // and a press that waited for a shut chevron that no longer exists would
  // spend the caller's whole deadline on one try.
  const disclosure = row.locator(".plugins-line button.plugins-name").first();
  if ((await disclosure.getAttribute("aria-expanded", { timeout: 1000 }).catch(() => null)) === "false") {
    await disclosure.click({ timeout: 2000 }).catch(() => undefined);
    await world.waitForFrame();
  }
  return row;
};

/**
 * Wait for something on one plugin's row, RE-OPENING the row on every try.
 *
 * A switch, an approval or a roster report can move a row to another group —
 * out of Needs attention into a group that starts folded — or redraw it, so a
 * locator resolved against the first drawing can be asking about a row that
 * is no longer on screen. Each try goes back through {@link detailOf}, which
 * unfolds whatever group and row now holds it.
 */
const untilOnRow = async (
  world: OlaiWorld,
  plugin: string,
  holds: (row: Locator) => Promise<boolean>,
  what: string,
): Promise<void> => {
  const deadline = Date.now() + POLL_TIMEOUT;
  for (;;) {
    try {
      if (await holds(await detailOf(world, plugin))) return;
    } catch (error) {
      if (Date.now() >= deadline) throw error;
    }
    if (Date.now() >= deadline) throw new Error(`timed out waiting until ${what}`);
    await world.waitForFrame();
  }
};

/** ...and its sentence, or the empty string where it has none. ABSENT IS NOT AN
 *  ERROR here: a row with nothing to say draws no paragraph at all, so
 *  `innerText` on a locator matching nothing would throw where the honest answer
 *  is "it says nothing", and the caller's `includes` refuses it in words a
 *  reader can act on. */
const hintOn = async (world: OlaiWorld, plugin: string): Promise<string> => {
  const row = await shownRow(world, plugin);
  await row.waitFor({ state: "visible", timeout: POLL_TIMEOUT });
  const hint = row.locator(PREFS_HINT);
  if ((await hint.count()) === 0) return "";
  return (await hint.innerText()).replaceAll("\n", " ");
};

/**
 * IS EVERY MEMBER THIS PAGE SUBSCRIBED TO STILL ARRIVING — the app's own
 * liveness readout, which is the strongest assertion this feature has.
 *
 * ## Why this and not a face
 *
 * Every other check here asks whether one drawn thing is right, and a drawn
 * thing can be right while the wire under it is dead: a chip that mounted off a
 * roster frame draws whether or not the member it reads is still being served.
 * This asks the question directly, about EVERY member at once, and it names the
 * silent ones — so a plugin whose streams stopped is caught whether or not
 * anybody wrote a scenario about that plugin.
 *
 * It is the reading behind the sentence a person sees on the connection chip:
 * *connected, but nothing is arriving on … what is on screen is missing whatever
 * those carry, and may be missing it silently.* `data-stopped` is empty on a
 * healthy wire, which is what makes the assertion a plain one.
 */
Then(
  "no member of this page has gone silent",
  async function (this: OlaiWorld) {
    // A roster switch may draw its surviving faces during a socket refresh.
    // Await the connection's own readiness before asserting stream health;
    // a permanently reconnecting or degraded wire still fails this bound. The
    // health dot carries the connection's state; the connection's ROW (in the
    // popover the dot opens) carries `data-stopped` beside it.
    await this.expectAttribute(HEALTH, "data-connection", "live", "the connection", HYDRATION_TIMEOUT);
    const [stopped, state] = await this.readStatus(async () => {
      const chip = this.page.locator(CONNECTION).first();
      await chip.waitFor({ state: "visible", timeout: POLL_TIMEOUT });
      return [(await chip.getAttribute("data-stopped")) ?? "", await chip.getAttribute("data-connection")] as const;
    });
    assert.equal(
      stopped,
      "",
      `the page reports nothing arriving on ${JSON.stringify(stopped)} — what is ` +
        "drawn is missing whatever those carry, and is missing it silently",
    );
    // Check again beside the stopped members so a drop after readiness is
    // not mistaken for an empty, healthy stream set.
    assert.equal(state, "live");
  },
);

/**
 * WHETHER THE APPLIANCE BEHIND A PLUGIN IS REACHED — the pill kolu hangs in the
 * bar, by the word it draws.
 *
 * A row coming back is TWO facts and they fail separately: the fiber re-applies
 * (its kinds return, its sibling is on the wire, its chunk mounts) and the
 * standing connection its `apply` armed is dialled again. A scenario that only
 * asked about the drawn face could not tell a plugin that came back with no link
 * from one that came back whole — and the second is the one that reads as *the
 * feature works* right up until somebody looks at the data.
 *
 * BY THE PLUGIN'S OWN ATTRIBUTE, which is a closed set the appliance publishes
 * (`connected` / `absent` / `skew`), rather than by a sentence: this step is
 * about whether a socket is up, and the words around it are kolu's to change.
 */
Then(
  "the appliance link reads {word}",
  async function (this: OlaiWorld, word: string) {
    // A row of the health popover on a desktop, so it is read with the
    // popover up and put away again after.
    const reached = await this.readStatus(() => this.page
      .locator(`${PADI_PILL}${attr("data-padi", word)}`)
      .first()
      .waitFor({ state: "visible", timeout: POLL_TIMEOUT })
      .then(() => null, async () => {
        const pill = this.page.locator(PADI_PILL).first();
        return (await pill.count()) === 0 ? "no pill at all" : await pill.getAttribute("data-padi");
      }));
    if (reached !== null) {
      // ...AND WHAT IT ACTUALLY READS, because the two ways this fails want two
      // different next steps: a pill saying `absent` is a plugin that is drawing
      // and cannot reach its appliance, and NO PILL AT ALL is a plugin whose
      // face never came back. A timeout on the selector alone cannot tell them
      // apart, and the difference is which half of a remount to go and look at.
      const found = reached;
      assert.fail(
        `the appliance link to read ${JSON.stringify(word)}, and it is ` +
          `${JSON.stringify(found)}`,
      );
    }
  },
);

/** WHICH WAY ONE ROW'S SWITCH IS READING — `on`, `off`, or `neither` for a
 *  strip that is drawn but has no segment pressed, which is not a state the
 *  panel has and is worth saying rather than guessing at. */
const switchOn = async (world: OlaiWorld, plugin: string): Promise<string> => {
  const row = await shownRow(world, plugin);
  const strip = row.locator(PLUGIN_SWITCH);
  if ((await strip.count()) === 0) return "neither";
  const checked = await strip.first().getAttribute("aria-checked");
  if (checked === "true") return "on";
  if (checked === "false") return "off";
  return "neither";
};

/**
 * PRESS A CONTROL ON A ROW THAT IS ALLOWED TO BE REDRAWN UNDER THE FINGER.
 *
 * Roster and management reports can rebuild the panel's groups while a press
 * is being aimed. `scrollIntoViewIfNeeded` can reject a detached element before
 * the click is dispatched. Resolve the replacement row and reopen its group
 * before trying the ordinary reachability and click checks again.
 *
 * So the re-resolution happens HERE, one level up, where `shownRow` can reopen
 * the group and hand back the row the NEW tree drew. The post-flip wait below
 * already polls this way for the same reason; the press had been left with the
 * one row it resolved first (juspay/olai#547 CI, `98362ac`).
 */
const pressOnRow = async (
  world: OlaiWorld,
  plugin: string,
  control: string,
): Promise<void> => {
  const deadline = Date.now() + POLL_TIMEOUT;
  let last: unknown;
  for (;;) {
    try {
      await world.press((await shownRow(world, plugin)).locator(control));
      return;
    } catch (error) {
      last = error;
      if (Date.now() >= deadline) break;
    }
  }
  throw last;
};

const confirmIfAsked = async (
  world: OlaiWorld,
  plugin: string,
  pick: string,
): Promise<void> => {
  const row = rowFor(world, plugin);
  const confirm = row.locator(PLUGIN_CONFIRM);
  if ((await confirm.count()) === 0) return;
  if (!(await confirm.isVisible().catch(() => false))) return;
  await pressOnRow(world, plugin, pick === "off" ? PLUGIN_CONFIRM_OFF : PLUGIN_CONFIRM_KEEP);
};

/**
 * THE SWITCH — a person turning one plugin on or off on the running serve.
 *
 * `on`/`off` is WHERE THE SWITCH IS BEING PUT rather than which way to move it,
 * all the way down: the segment carries the value it picks, the procedure takes
 * `enabled`, and the loader is told a `disabled` — so a scenario, a browser and
 * a serve all say the same thing about where this is aiming, and none of them
 * has to have read the roster correctly first.
 *
 * IT RETURNS WHEN THE ROW SAYS SO, not when the click lands. The press freezes
 * that row's strip while the bundle settles, so a scenario that carried on
 * immediately would be asserting about a serve mid-flip — the exact frame the
 * server holds its roster back for. Waiting for the segment to read the value
 * asked for is waiting for the republish that ends the movement.
 */
/** HOW LONG A FLIP MAY TAKE before it is a hang — see the step below for the
 *  four stages it is buying. Its own name rather than a literal, because it is
 *  a claim about this product's slowest deliberate gesture and not a nudge
 *  somebody tuned to make a suite pass. */
const FLIP_STEP_TIMEOUT = 90_000;

// A requested plugin may remain waiting on a dependency. Its switch reports
// whether it is running, so these scenarios wait for the explanatory row next.
When(
  "I request that the plugin {string} be {word}",
  async function (this: OlaiWorld, plugin: string, pick: string) {
    await pressOnRow(this, plugin, PLUGIN_SWITCH);
  },
);

Then(
  "the plugins panel group {string} is collapsed",
  async function (this: OlaiWorld, section: string) {
    await this.pluginsPanel()
      .locator(`${PLUGIN_GROUP}${attr("data-section", section)}${attr("data-collapsed", "true")}`)
      .waitFor({ state: "visible", timeout: POLL_TIMEOUT });
  },
);

When(
  "I open the plugins panel group {string}",
  async function (this: OlaiWorld, section: string) {
    const summary = this.pluginsPanel().locator(
      `${PLUGIN_GROUP}${attr("data-section", section)} > details > summary`,
    );
    await this.press(summary);
    await this.pluginsPanel()
      .locator(`${PLUGIN_GROUP}${attr("data-section", section)}:not([data-collapsed])`)
      .waitFor({ state: "visible", timeout: POLL_TIMEOUT });
  },
);

Then(
  "the plugins panel groups {string} under {string}",
  async function (this: OlaiWorld, plugin: string, section: string) {
    const row = await shownRow(this, plugin);
    await row.waitFor({ state: "visible", timeout: POLL_TIMEOUT });
    const group = this.pluginsPanel()
      .locator(`${PLUGIN_GROUP}${attr("data-section", section)}`)
      .filter({ has: this.page.locator(`${PREFS_ROW}${attr("data-pref", `plugin-${plugin}`)}`) });
    try {
      await group.waitFor({ state: "visible", timeout: POLL_TIMEOUT });
    } catch {
      const said = await this.pluginsPanel().locator(PLUGIN_GROUP).evaluateAll(
        (nodes) => nodes.map((node) => node.getAttribute("data-section")).join(", "),
      );
      assert.fail(
        `the row for ${JSON.stringify(plugin)} to sit under ${JSON.stringify(section)}, ` +
          `and the panel's groups are ${JSON.stringify(said)}`,
      );
    }
  },
);

Then(
  "the plugins panel asks to confirm turning {string} off",
  async function (this: OlaiWorld, plugin: string) {
    const row = await shownRow(this, plugin);
    await row.locator(PLUGIN_CONFIRM).waitFor({ state: "visible", timeout: POLL_TIMEOUT });
  },
);

Then(
  "the confirm for {string} names {string}",
  async function (this: OlaiWorld, plugin: string, named: string) {
    const row = await shownRow(this, plugin);
    const box = row.locator(PLUGIN_CONFIRM);
    await box.waitFor({ state: "visible", timeout: POLL_TIMEOUT });
    const said = (await box.innerText()).replaceAll("\n", " ");
    assert.ok(
      said.includes(named),
      `the confirm for ${JSON.stringify(plugin)} to name ${JSON.stringify(named)}, and it says ${JSON.stringify(said)}`,
    );
  },
);

When(
  "I confirm turning the plugin {string} off",
  { timeout: FLIP_STEP_TIMEOUT },
  async function (this: OlaiWorld, plugin: string) {
    await pressOnRow(this, plugin, PLUGIN_CONFIRM_OFF);
    await (await shownRow(this, plugin))
      .locator(`${PLUGIN_SWITCH}${attr("aria-checked", "false")}`)
      .waitFor({ state: "visible", timeout: POLL_TIMEOUT });
  },
);

When(
  "I keep the plugin {string} on",
  async function (this: OlaiWorld, plugin: string) {
    const row = await shownRow(this, plugin);
    await this.press(row.locator(PLUGIN_CONFIRM_KEEP));
    await row.locator(PLUGIN_CONFIRM).waitFor({ state: "detached", timeout: POLL_TIMEOUT });
  },
);

When(
  "I switch the plugin {string} {word}",
  // A LONGER STEP THAN THE ORDINARY ONE, and the number is the flip's own
  // shape rather than slack: a press is a settle over every row in the bundle,
  // a re-validation of the vault against the vocabulary that just moved, a
  // roster republish, a redial, and the tab's whole tree built again. Under the
  // 40s default the two `waitFor`s here can add up past it, and what a reader
  // would then see is `function timed out` rather than which of the four
  // stages did not happen.
  { timeout: FLIP_STEP_TIMEOUT },
  async function (this: OlaiWorld, plugin: string, pick: string) {
    // A serve that just re-read its settings file may be redialling: the
    // reconnecting dialog takes every press until the wire is back, so wait
    // for it to go first, as closing the panel does.
    await this.page.locator(selector(TESTID.offline)).waitFor({ state: "hidden", timeout: HYDRATION_TIMEOUT });
    const row = await shownRow(this, plugin);
    await row.waitFor({ state: "visible", timeout: POLL_TIMEOUT });
    const current = await switchOn(this, plugin);
    if (current !== pick) {
      await pressOnRow(this, plugin, PLUGIN_SWITCH);
      await confirmIfAsked(this, plugin, pick);
    }
    // THE ROW THIS WAITS ON MAY BE A NEW ELEMENT, which is what makes this a
    // wait for the flip rather than a wait for a control that has gone. It used
    // to say a redial rebuilds the tab's whole tree; it does not, and has not
    // since the pinned kolu's #2228 — the connection is one object and the tree
    // is rendered once. What DOES re-draw is the panel itself, for its own
    // reasons (the roster it lists moved), so the loop stands. Re-open the
    // group on every try: the first shownRow can land on the outgoing draw.
    const wanted = `${PLUGIN_SWITCH}${attr("aria-checked", pick === "on" ? "true" : "false")}`;
    // The step itself is allowed 90s because a flip recomposes the bundle.
    // The row can leave the panel for that whole recomposition. A 15s poll
    // gives up while the row is still on its way back.
    const deadline = Date.now() + 60_000;
    let last: unknown;
    while (Date.now() < deadline) {
      try {
        // The shell is built on navigation. Switching that row off takes the
        // bar with it, so there is no switch left to read — the row is off.
        if (pick === "off" && (await this.pluginsPanel().count()) === 0
          && (await this.page.locator(PLUGINS_TRIGGER).locator("visible=true").count()) === 0) return;
        await (await shownRow(this, plugin)).locator(wanted).waitFor({
          state: "visible",
          timeout: 1000,
        });
        last = undefined;
        break;
      } catch (error) {
        last = error;
      }
    }
    if (last !== undefined) throw last;
  },
);

/** Chat's outline contributions leave and return with its browser activation. */
Then("chat controls are {word} the outline", async function(this: OlaiWorld, presence: string) {
  assert.ok(presence === "in" || presence === "gone-from");
  await this.page.locator(`${selector(TESTID.agentStart)}, ${selector(TESTID.agentStanding)}`).first().waitFor({
    state: presence === "in" ? "attached" : "detached", timeout: POLL_TIMEOUT,
  });
});

/** ...AND THE REFUSAL, when the serve would not take it. One place on the panel
 *  rather than per row, because it is about the press just made. */
Then(
  "the plugins panel refuses with {string}",
  async function (this: OlaiWorld, said: string) {
    const refused = this.page.locator(`${PLUGINS_PANEL} ${PLUGINS_REFUSED}`);
    await refused.waitFor({ state: "visible", timeout: POLL_TIMEOUT });
    const line = await refused.innerText();
    assert.ok(
      line.includes(said),
      `the panel to refuse with ${JSON.stringify(said)}, and it says ${JSON.stringify(line)}`,
    );
  },
);

Then("the plugin {string} has no browser warning", async function (this: OlaiWorld, plugin: string) {
  // What a browser-half fault says, at rest ("Failed in this tab", "Starting
  // in this tab") and in the detail ("In this tab: …"). The row is found
  // afresh on every try, its group and its detail opened: a recovery moves it
  // out of Needs attention into its own group, which starts shut, and a row
  // read through a shut group reads as nothing at all.
  await this.waitUntil(async () => {
    try {
      return !/in this tab/i.test(await (await shownRow(this, plugin)).innerText());
    } catch {
      return false;
    }
  }, `${plugin}'s browser components to recover`);
});

Then("the plugins panel shows no refusal", async function (this: OlaiWorld) {
  await this.page.locator(`${PLUGINS_PANEL} ${PLUGINS_REFUSED}`).waitFor({ state: "hidden", timeout: POLL_TIMEOUT });
});

Then("the plugin {string} has inline controls", async function (this: OlaiWorld, plugin: string) {
  const row = await detailOf(this, plugin);
  assert.equal(await row.locator('[data-testid="plugin-defaults"], [data-testid="plugin-summary"]').count(), 0);
  const knobs = row.locator('[data-testid="plugin-knob"]');
  assert.ok(await knobs.count() > 0);
  for (const knob of await knobs.all()) assert.equal(await knob.isVisible(), true);
});
Then("the plugin {string} marks {string} as authored by {string}", async function (this: OlaiWorld, plugin: string, key: string, author: string) {
  const row = await detailOf(this, plugin);
  await this.waitUntil(async () => await row.locator(`${PLUGIN_CONFIG}${attr("data-config", key)}`).getAttribute("data-set-by") === author, "the author mark");
  const knob = row.locator(`[data-testid="plugin-knob"]${attr("data-config", key)}`);
  if (await knob.count()) {
    assert.equal(await knob.locator('[data-testid="plugin-source"]').count(), author === "vault" ? 1 : 0);
    if (author === "vault") {
      assert.equal(await knob.locator('[data-testid="plugin-source"]').getAttribute("title"), "set in Settings.olai");
      assert.equal(await knob.locator('[data-testid="plugin-reset"]').isVisible(), true);
    }
  }
});
When("I follow the policy link for {string}", async function (this: OlaiWorld, plugin: string) {
  await (await detailOf(this, plugin)).locator('[data-testid="plugin-config-link"]').click();
});
Then("the policy link targets node {string}", async function (this: OlaiWorld, node: string) {
  await this.waitUntil(async () => this.page.url().includes(node), "the policy node in the address");
});
Then("the plugin {string} has no policy link", async function (this: OlaiWorld, plugin: string) {
  // No panel means no link. Navigation being off takes the bar with it.
  if ((await this.pluginsPanel().count()) === 0) return;
  await (await shownRow(this, plugin)).locator('[data-testid="plugin-config-link"]').waitFor({ state: "detached", timeout: POLL_TIMEOUT });
});
Then("the plugin {string} keeps its control visible when {string} becomes {string}", async function (this: OlaiWorld, plugin: string, key: string, value: string) {
  await this.waitUntil(async () => await configurationValue((await detailOf(this, plugin)).locator(`${PLUGIN_CONFIG}${attr("data-config", key)}`)) === value, "the new default reading");
  assert.equal(await (await detailOf(this, plugin)).locator(`${PLUGIN_CONFIG}${attr("data-config", key)}`).isVisible(), true);
});


Then("the plugin {string} is running", async function (this: OlaiWorld, plugin: string) {
  await (await shownRow(this, plugin)).locator(`${PLUGIN_SWITCH}[aria-checked="true"]`).waitFor({ state: "visible", timeout: POLL_TIMEOUT });
});
Then("the commit ledger includes the settings switch", async function (this: OlaiWorld) {
  const group = this.page.locator(`${selector(TESTID.commitGroup)}${attr("data-file", "_olai/Settings.olai")}`);
  await group.waitFor({ state: "visible", timeout: POLL_TIMEOUT });
  assert.ok((await group.innerText()).includes("journal"), "the journal namespace is recorded as an ordinary node change");
});


/** Read the selected control, never the text of its unselected alternatives. */
const configurationValue = async (line: Locator): Promise<string> => {
  // A refused file spelling stays in the input; the effective default is the
  // value actually drawn in its problem line, not that unaccepted spelling.
  const problem = line.locator(selector(TESTID.pluginProblem))
  if (await problem.count()) {
    const text = await problem.first().innerText()
    const marker = " · using "
    if (text.includes(marker)) return text.slice(text.lastIndexOf(marker) + marker.length)
  }
  const input = line.locator("input, select")
  if (await input.count()) return input.first().inputValue()
  const picked = line.locator('[aria-pressed="true"]')
  if (await picked.count()) return (await picked.first().getAttribute("data-value")) ?? ""
  const toggle = line.locator('[role="switch"]')
  if (await toggle.count()) return await toggle.first().getAttribute("aria-checked") === "true" ? "yes" : "no"
  return (await line.getAttribute("data-value")) ?? (await line.innerText()).replaceAll("\n", " ")
}
