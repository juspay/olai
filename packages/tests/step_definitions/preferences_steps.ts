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
 * `showPreferences` is exported because the theme steps need it too — the chips
 * are a row of this panel now, so every theming scenario opens this first.
 */

import * as assert from "node:assert";
import { Then, When } from "@cucumber/cucumber";
import type { Page } from "playwright";

import { fileKind } from "@olai/format";

import {
  ALERT_SOUND_KEY,
  ALERTS_KEY,
  DENSITY_KEY,
  type Density,
  DONE_HIDDEN_KEY,
  DONE_OVERRIDES_KEY,
  SIZE_STORAGE_KEY,
  TESTID,
} from "@olai/web/testlib";

import { focusedOn } from "../support/caret.ts";
import { pressed } from "../support/settling.ts";
import {
  APP_HEADER,
  attr,
  HYDRATION_TIMEOUT,
  PANE,
  CHAT_TOGGLE,
  PLUGINS_PANEL,
  PLUGINS_REFUSED,
  PLUGINS_STARTED,
  PLUGINS_TRIGGER,
  POLL_TIMEOUT,
  PREFS_CHOICE,
  PREFS_HINT,
  PREFS_PANEL,
  PREFS_ROW,
  PREFS_RESUME,
  PREFS_SCOPE,
  PREFS_SET_BY,
  PREFS_TRIGGER,
  SIDEBAR_BODY,
  SIDEBAR_SCRIM,
  SIDEBAR_TOGGLE,
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
  if (!(await trigger.isVisible().catch(() => false))) {
    // Phone: the trigger is a row in the directory drawer.
    const burger = page.locator(SIDEBAR_TOGGLE);
    await burger.waitFor({ state: "visible", timeout: HYDRATION_TIMEOUT });
    await burger.click();
    await page.locator(SIDEBAR_BODY).waitFor({ state: "visible", timeout: POLL_TIMEOUT });
  }
  await trigger.waitFor({ state: "visible", timeout: HYDRATION_TIMEOUT });
  await trigger.click();
  await panel.waitFor({ state: "visible", timeout: POLL_TIMEOUT });
};

/** One row of it, by the preference it sets rather than by its position: rows
 *  are a list somebody will reorder. */
const row = (world: OlaiWorld, pref: string) =>
  world.page.locator(`${PREFS_ROW}${attr("data-pref", pref)}`);

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
 * ONE spelling for every segmented row there is — Done, Notes, Size, Git —
 * because they are one control (`client/settings/Segmented.tsx`) and the wait
 * is the subtle half: pressing and carrying on races the render, and each row
 * having its own copy of that wait is how the third one gets it slightly wrong.
 */
const pickChoice = async (
  page: Page,
  pref: string,
  value: string,
): Promise<void> => {
  await showPreferences(page);
  const choice = page.locator(
    `${PREFS_ROW}${attr("data-pref", pref)} ${PREFS_CHOICE}${attr("data-value", value)}`,
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

/** Press one Done segment of THE PANEL — the reader's default for every page
 *  that has not said otherwise. */
const pickDone = async (
  page: Page,
  value: "hidden" | "visible",
): Promise<void> => {
  await pickChoice(page, "done", value);
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
  return fileKind(path) === "outline" ? path : undefined;
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

/** One segment of the flip beside the FOCUSED pane's filter: this page's own
 *  say. Its value-space is the override map's — `shown` / `hidden` — where
 *  the panel's segments answer in the row's own `visible` / `hidden`
 *  (client/settings/done.ts keeps the two vocabularies apart on purpose). */
const flipDone = async (
  page: Page,
  word: "shown" | "hidden",
): Promise<void> => {
  const flip = await flipOfAddressed(page);
  const pick = flip.locator(`${PREFS_CHOICE}${attr("data-value", word)}`);
  await pick.waitFor({ state: "visible", timeout: POLL_TIMEOUT });
  await pick.click();
  // Scored to THE SEGMENT PRESSED: either the press landed (the segment
  // that was not in force now is) or the ask was a deliberate no-op (the
  // in-force side already carries it — at pace the same selector, at no
  // cost — a no-op IS the read a press makes of this strip now.
  await flip
    .locator(`${PREFS_CHOICE}${attr("data-value", word)}[aria-pressed="true"]`)
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
      .locator(
        `${PREFS_CHOICE}${attr("data-value", word)}[aria-pressed="true"]`,
      )
      .waitFor({ state: "visible", timeout: POLL_TIMEOUT });
  },
);

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
    await pickDone(this.page, asDone(value));
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

/** The release door is the MARK — not a second press. The strip's gestures
 *  are idempotent asks (press what you mean); only the `·` hands the pick
 *  back to the panel, and that is deliberately a door one CLUTTER-free
 *  second near a strip cannot miss (client/filter/DoneFlip.tsx). */
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

Then(
  "the Done row explains that finished work is {string}",
  async function (this: OlaiWorld, expected: string) {
    if (expected !== "hidden" && expected !== "shown") {
      throw new Error(`the hint says "hidden" or "shown", not "${expected}"`);
    }
    const hint = await hintOf(this, "done");
    assert.ok(
      hint.includes(`Finished work is ${expected}`),
      `the Done row says "${hint}", which does not say finished work is ` +
        `${expected}`,
    );
  },
);

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
// What they DO is `features/the_agent_waits_on_you.feature`; what is here is
// that they are preferences like the others — a pick that moves this browser,
// is stored under one key, and says what it means.

const asSwitch = (value: string): "on" | "off" => {
  if (value !== "on" && value !== "off") {
    throw new Error(`an alert row is "on" or "off", not "${value}"`);
  }
  return value;
};

When(
  "I set Alerts to {string}",
  async function (this: OlaiWorld, value: string) {
    await pickChoice(this.page, "alerts", asSwitch(value));
  },
);

When(
  "I set the alert sound to {string}",
  async function (this: OlaiWorld, value: string) {
    await pickChoice(this.page, "alert-sound", asSwitch(value));
  },
);

Then(
  "this browser has stored that alerts are {string}",
  async function (this: OlaiWorld, value: string) {
    const stored = await this.stored(ALERTS_KEY);
    assert.equal(
      stored,
      asSwitch(value) === "on" ? "true" : "false",
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
      asSwitch(value) === "on" ? "true" : "false",
      `this browser keeps "${stored}" under ${ALERT_SOUND_KEY}`,
    );
  },
);

/** The sound row is drawn INERT rather than hidden while alerts are off — the
 *  Segmented control's own "frozen", which the git rows already wear: a choice
 *  a reader cannot see is one they cannot ask anybody about. */
Then("the alert sound cannot be set", async function (this: OlaiWorld) {
  await showPreferences(this.page);
  const segments = row(this, "alert-sound").locator(PREFS_CHOICE);
  await segments.first().waitFor({ state: "visible", timeout: POLL_TIMEOUT });
  const disabled = await segments.evaluateAll((all) =>
    all.map((one) => one.getAttribute("aria-disabled")),
  );
  assert.ok(
    disabled.length > 0 && disabled.every((said) => said === "true"),
    `the alert sound row's segments say aria-disabled=${JSON.stringify(disabled)}`,
  );
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

// ── the two Git preferences ────────────────────────────────────────────
//
// TWO ROWS, because they are two independent facts: what is waiting can record
// itself, and a recorded commit can be pushed. Either alone is a shipped case —
// Auto-push with the Commit button is what #283 built — so the rows are asked
// for separately here too. There is no toggle: both rows are always the
// instance's, always read-only.

const asGit = (value: string): "off" | "on" => {
  if (value !== "off" && value !== "on") {
    throw new Error(`a Git preference is "off" or "on", not "${value}"`);
  }
  return value;
};

Then(
  "the Git commit row explains that a write {string}",
  async function (this: OlaiWorld, expected: string) {
    const hint = await hintOf(this, "git-commit");
    assert.ok(
      hint.includes(expected),
      `the Git commit row says "${hint}", which does not say a write ` +
        JSON.stringify(expected),
    );
  },
);

Then(
  "the Git push row explains that a commit {string}",
  async function (this: OlaiWorld, expected: string) {
    const hint = await hintOf(this, "git-push");
    assert.ok(
      hint.includes(expected),
      `the Git push row says "${hint}", which does not say a commit ` +
        JSON.stringify(expected),
    );
  },
);

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

// ── a git policy the INSTANCE holds ────────────────────────────────────
//
// Both git rows are the instance's: they draw its policy for this directory,
// always read-only. A flag on the command line is named; omitting it is the
// built-in default. Never hidden: a policy a reader cannot see is one they
// cannot ask anybody about.

/** Which of the two rows a scenario names, in the words the panel uses. */
const asGitRow = (label: string): "git-commit" | "git-push" => {
  if (label === "Git commit") return "git-commit";
  if (label === "Git push") return "git-push";
  throw new Error(`the pinnable rows are "Git commit" and "Git push", not "${label}"`);
};

Then(
  "the {string} row is the server's, set by {string}",
  async function (this: OlaiWorld, label: string, flag: string) {
    const pref = asGitRow(label);
    await showPreferences(this.page);
    const it = row(this, pref);
    await it.waitFor({ state: "visible", timeout: POLL_TIMEOUT });
    assert.equal(
      await it.getAttribute("data-pinned"),
      "true",
      `the ${label} row is not drawn as the server's`,
    );
    const said = await it.locator(PREFS_SET_BY).innerText();
    assert.ok(
      said.includes(flag),
      `the ${label} row says "${said}", which does not name ${JSON.stringify(flag)}`,
    );
  },
);

/** Every segment still on screen — a pinned row shows what it is set to AND
 *  what it could have been — and none of them pressable. */
Then(
  "the {string} row cannot be changed from this browser",
  async function (this: OlaiWorld, label: string) {
    const pref = asGitRow(label);
    await showPreferences(this.page);
    const choices = row(this, pref).locator(PREFS_CHOICE);
    const count = await choices.count();
    assert.ok(count > 1, `the ${label} row draws ${count} choices, so it hides one`);
    for (let at = 0; at < count; at += 1) {
      assert.equal(
        await choices.nth(at).getAttribute("aria-disabled"),
        "true",
        `segment ${at} of the ${label} row is still pressable`,
      );
    }
  },
);

Then(
  "the {string} row is the instance's built-in default",
  async function (this: OlaiWorld, label: string) {
    const pref = asGitRow(label);
    await showPreferences(this.page);
    const it = row(this, pref);
    await it.waitFor({ state: "visible", timeout: POLL_TIMEOUT });
    assert.equal(
      await it.getAttribute("data-pinned"),
      "true",
      `the ${label} row is not drawn as the instance's`,
    );
    const said = await it.locator(PREFS_SET_BY).innerText();
    assert.ok(
      /built-in default/i.test(said),
      `the ${label} row says "${said}", which does not name the built-in default`,
    );
  },
);

Then(
  "the {string} row is set to {string}",
  async function (this: OlaiWorld, label: string, value: string) {
    const pref = asGitRow(label);
    await showPreferences(this.page);
    const inForce = row(this, pref)
      .locator(PREFS_CHOICE)
      .and(this.page.locator('[aria-pressed="true"]'));
    assert.equal(
      await inForce.getAttribute("data-value"),
      asGit(value),
      `the ${label} row is not set to "${value}"`,
    );
  },
);

// ── Resume, which is the one gesture that starts a stopped loop again ──

Then(
  "the preferences offer to resume auto-commit",
  async function (this: OlaiWorld) {
    await showPreferences(this.page);
    await this.page
      .locator(PREFS_RESUME)
      .waitFor({ state: "visible", timeout: POLL_TIMEOUT });
  },
);

Then(
  "the preferences do not offer to resume auto-commit",
  async function (this: OlaiWorld) {
    await showPreferences(this.page);
    assert.equal(
      await this.page.locator(PREFS_RESUME).count(),
      0,
      "the preferences offer to resume a loop that is not stopped",
    );
  },
);

When("I resume auto-commit", async function (this: OlaiWorld) {
  await showPreferences(this.page);
  const resume = this.page.locator(PREFS_RESUME);
  await resume.waitFor({ state: "visible", timeout: POLL_TIMEOUT });
  await this.press(resume);
});

Then(
  "the preferences panel says two rows are the instance's",
  async function (this: OlaiWorld) {
    await showPreferences(this.page);
    const said = await this.page.locator(PREFS_SCOPE).innerText();
    assert.ok(
      /instance's policy/i.test(said) && /cannot be changed/i.test(said),
      `the panel says "${said}", which does not name the git rows as the instance's, read-only`,
    );
  },
);

/** The negative half of the row's promise: a sentence that is true of a live
 *  row can be exactly wrong on a pinned one, and only asserting what a hint
 *  SAYS would let the old words survive beside the new. */
Then(
  "the Git commit row does not explain that a write {string}",
  async function (this: OlaiWorld, unwanted: string) {
    const hint = await hintOf(this, "git-commit");
    assert.ok(
      !hint.includes(unwanted),
      `the Git commit row still says "${hint}", which claims ${JSON.stringify(unwanted)}`,
    );
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
  if ((await this.page.locator(PLUGINS_PANEL).count()) > 0) return;
  await this.press(this.page.locator(PLUGINS_TRIGGER));
  await this.page
    .locator(PLUGINS_PANEL)
    .waitFor({ state: "visible", timeout: POLL_TIMEOUT });
});

/**
 * WHAT ONE PLUGIN'S ROW SAYS IT IS DOING — the hint, which is the half of the
 * row a person can act on.
 *
 * By the plugin's NAME, which is the word `--plugins` takes and the label the
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
    const row = rowFor(this, plugin);
    await row.waitFor({ state: "visible", timeout: POLL_TIMEOUT });
    try {
      await row
        .locator(`${PREFS_HINT}:has-text(${JSON.stringify(said)})`)
        .waitFor({ state: "visible", timeout: POLL_TIMEOUT });
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
    const row = rowFor(this, plugin);
    await row.waitFor({ state: "visible", timeout: POLL_TIMEOUT });
    // `detached` rather than a count read: this is asked after a flip, so the
    // sentence that has to be gone may still be on screen for a frame — and a
    // count read once would be asserting about whichever frame it landed in.
    await row.locator(PREFS_HINT).waitFor({ state: "detached", timeout: POLL_TIMEOUT });
  },
);

/**
 * WHERE THIS SERVE WAS STARTED, said ONCE for the panel — the line that used to
 * be repeated under every row.
 *
 * It is a separate step from the per-row one because it is a separate claim:
 * the rows say what each plugin is doing, and this says what the process came up
 * with and how long a press here lasts. A scenario that asserted it through a
 * row would be asserting the arrangement this panel was rewritten to end.
 */
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

/** ONE PLUGIN'S ROW on the plugins panel, by the word `--plugins` takes — which
 *  is the label the row wears, so a scenario names it the way the operator who
 *  caused this state did. */
const rowFor = (world: OlaiWorld, plugin: string) =>
  world.page.locator(`${PLUGINS_PANEL} ${PREFS_ROW}${attr("data-pref", `plugin-${plugin}`)}`);

/** ...and its sentence, or the empty string where it has none. ABSENT IS NOT AN
 *  ERROR here: a row with nothing to say draws no paragraph at all, so
 *  `innerText` on a locator matching nothing would throw where the honest answer
 *  is "it says nothing", and the caller's `includes` refuses it in words a
 *  reader can act on. */
const hintOn = async (world: OlaiWorld, plugin: string): Promise<string> => {
  const row = rowFor(world, plugin);
  await row.waitFor({ state: "visible", timeout: POLL_TIMEOUT });
  const hint = row.locator(PREFS_HINT);
  if ((await hint.count()) === 0) return "";
  return (await hint.innerText()).replaceAll("\n", " ");
};

/** WHICH WAY ONE ROW'S SWITCH IS READING — `on`, `off`, or `neither` for a
 *  strip that is drawn but has no segment pressed, which is not a state the
 *  panel has and is worth saying rather than guessing at. */
const switchOn = async (world: OlaiWorld, plugin: string): Promise<string> => {
  const pressed = rowFor(world, plugin).locator(
    `${PREFS_CHOICE}${attr("aria-pressed", "true")}`,
  );
  return (await pressed.count()) === 0
    ? "neither"
    : (await pressed.first().getAttribute("data-value")) ?? "neither";
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
    const row = rowFor(this, plugin);
    await row.waitFor({ state: "visible", timeout: POLL_TIMEOUT });
    await this.press(row.locator(`${PREFS_CHOICE}${attr("data-value", pick)}`));
    // THE PANEL SURVIVES THE REBUILD THE PRESS CAUSED, which is what makes this
    // wait a wait for the flip rather than a wait for a control that has gone:
    // a roster change is a redial and a redial rebuilds the tab's whole tree,
    // so the row this is waiting on is a NEW element drawn by a panel that
    // reopened itself (`@olai/web`'s `client/plugins/`).
    await rowFor(this, plugin)
      .locator(`${PREFS_CHOICE}${attr("data-value", pick)}${attr("aria-pressed", "true")}`)
      .waitFor({ state: "visible", timeout: POLL_TIMEOUT });
  },
);

/**
 * IS THE CONVERSATION HERE AT ALL — the chat row's own chrome, by presence.
 *
 * The header's agent toggle is chat's, drawn by chat's browser half off a
 * sibling surface chat's server half serves. So it is the one control on the
 * page whose presence answers *did `surface/chat/` leave the wire and come
 * back*, which is what a scenario about flipping that row wants and what no
 * reading of the plugins panel could say — the panel is core's, and it would go
 * on drawing a row for chat whether or not anything of chat was served.
 *
 * BY PRESENCE AND NOT BY A SENTENCE, because the claim is absence: a plugin
 * that is off is not a disabled version of itself, it is gone, and the only
 * assertion that can tell those apart is one about whether the element is
 * there.
 */
Then(
  "the conversation is {word} the header",
  async function (this: OlaiWorld, presence: string) {
    if (presence !== "in" && presence !== "gone-from") {
      throw new Error(`the step says "in" or "gone-from", not "${presence}"`);
    }
    await this.page
      .locator(CHAT_TOGGLE)
      .waitFor({
        state: presence === "in" ? "visible" : "detached",
        timeout: POLL_TIMEOUT,
      });
  },
);

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
