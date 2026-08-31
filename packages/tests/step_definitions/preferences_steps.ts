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
 *  outline and does not spell a file; a node permalink does not either. */
const outlineNamedBy = (href: string | null): string | undefined => {
  if (href === null || href === "") return undefined;
  const path = decodeURIComponent(href.split("?")[0] ?? "");
  if (!path.endsWith(".olai")) return undefined;
  return path.replace(/^\//, "");
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
