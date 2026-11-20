import { TEST_CLAIMS } from "@olai/format/testlib"
import { TESTID } from "@olai/tests/harness/testids.ts"
import * as assert from "node:assert";
import { Given, Then, When } from "@olai/tests/harness/runner.ts";
import type { Page, Locator } from "@olai/tests/harness/playwright.ts";


import { fileKind } from "@olai/format";

import { SIZE_STORAGE_KEY, selector } from "@olai/web/testlib"
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
    const said = await this.page.locator(PREFS_SCOPE).allInnerTexts();
    assert.ok(
      said.some((one) => /this browser only/i.test(one)),
      `the panel's scope lines say ${JSON.stringify(said)}, none of which says ` +
        "these are kept in this browser and nowhere else",
    );
  },
);

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

const asOnOff = (value: string): "on" | "off" => {
  if (value !== "on" && value !== "off") {
    throw new Error(`a switch is "on" or "off", not "${value}"`);
  }
  return value;
};

const switchOnRow = (world: OlaiWorld, pref: string): Locator =>
  row(world, pref).locator(selector(TESTID.prefsSwitch));

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
    .expectChromeAttribute(`${PREFS_ROW}${attr("data-pref", pref)} ${selector(TESTID.prefsSwitch)}`, "aria-checked", wanted, `the ${pref} switch`);
};

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

const pickDone = async (
  world: OlaiWorld,
  value: "hidden" | "visible",
): Promise<void> => {
  await setSwitch(world, "done", value === "visible" ? "on" : "off");
};

const DONE_FLIP = attr("data-testid", TESTID.doneFlip);
const FOCUSED_PANE = attr("data-pane-focused", "true");

const outlineNamedBy = (href: string | null): string | undefined => {
  if (href === null || href === "") return undefined;
  const path = decodeURIComponent(href.split("?")[0] ?? "").replace(
    /^\//,
    "",
  );
  return TEST_CLAIMS.byKind.get(fileKind(TEST_CLAIMS, path) ?? "")?.holds === "nodes" ? path : undefined;
};

const flipOfAddressed = async (page: Page) => {
  const href = await page
    .locator(`${PANE}${FOCUSED_PANE}:visible`)
    .getAttribute("data-href");
  const named = outlineNamedBy(href);
  return named === undefined
    ? page.locator(`${FOCUSED_PANE}:visible ${DONE_FLIP}`)
    : page.locator(`${FOCUSED_PANE}:visible ${DONE_FLIP}${attr("data-file", named)}`);
};

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
    const echo = flip.locator("xpath=following-sibling::span[1]");
    await this.waitUntil(async () => (await echo.textContent())?.trim() === said,
      `the finished box's sentence to say ${said}`);
  },
);

Then("the finished box offers no reset", async function (this: OlaiWorld) {
  const flip = await flipOfAddressed(this.page);
  await flip.waitFor({ state: "visible", timeout: POLL_TIMEOUT });
  await this.waitUntil(async () => (await flip.locator(attr("data-testid", TESTID.doneRelease)).count()) === 0,
    "no reset beside the finished box");
});

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

const prefsAway = async (world: OlaiWorld): Promise<void> => {
  await world.press(world.page.locator(PREFS_TRIGGER));
  await world.page
    .locator(PREFS_PANEL)
    .waitFor({ state: "hidden", timeout: POLL_TIMEOUT });
  const scrim = world.page.locator(SIDEBAR_SCRIM);
  if (await scrim.isVisible().catch(() => false)) {
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

When("I hand the page's Done pick back to the panel", async function (this: OlaiWorld) {
  const flip = await flipOfAddressed(this.page);
  await flip.locator(attr("data-testid", TESTID.doneRelease)).click();
});

When("a second tab shows the done on this page", async function (this: OlaiWorld) {
  const other = await this.context.newPage();
  await other.goto(this.page.url());
  await flipDone(other, "shown");
});

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

Then("this page offers no Done flip", async function (this: OlaiWorld) {
  const flips = this.page.locator(`${FOCUSED_PANE}:visible ${DONE_FLIP}`);
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

Given(
  "this browser has not yet been asked about notifications",
  async function (this: OlaiWorld) {
    await this.page.addInitScript(() => {
      if (typeof Notification === "undefined") return;
      Object.defineProperty(Notification, "permission", { get: () => "default", configurable: true });
    });
  },
);

Given(
  "this browser cannot show notifications",
  async function (this: OlaiWorld) {
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

When(
  "I read the outline with Notes on {string}",
  async function (this: OlaiWorld, value: string) {
    await pickChoice(this.page, "density", asDensity(value));
    await prefsAway(this);
  },
);

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

When(
  "I set Size to {string}",
  async function (this: OlaiWorld, value: string) {
    await pickChoice(this.page, "size", value);
  },
);

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

When("I open the plugins panel", async function (this: OlaiWorld) {
  if ((await this.pluginsPanel().count()) > 0) return;
  const trigger = this.page.locator(PLUGINS_TRIGGER).locator("visible=true");
  await this.waitUntil(async () => {
    if ((await this.pluginsPanel().count()) > 0 || await trigger.isVisible()) return true;
    await this.openStatus().catch(() => undefined);
    return (await this.pluginsPanel().count()) > 0 || await trigger.isVisible();
  }, "the restored panel or its trigger");
  if ((await this.pluginsPanel().count()) > 0) return;
  await this.press(trigger);
  await this.pluginsPanel().waitFor({ state: "visible", timeout: POLL_TIMEOUT });
});

When("I close the plugins panel", async function (this: OlaiWorld) {
  await this.page.locator(selector(TESTID.offline)).waitFor({ state: "hidden", timeout: POLL_TIMEOUT });
  await this.waitUntil(async () => await this.pluginsPanel().locator(`${PLUGIN_SWITCH}[aria-disabled="true"]`).count() === 0, "the panel controls to finish reconciling");
  await this.waitUntil(async () => {
    if ((await this.pluginsPanel().count()) === 0) return (await this.page.locator(PLUGINS_PANEL).count()) === 0;
    await this.pluginsPanel().press("Escape").catch(() => undefined);
    return (await this.page.locator(PLUGINS_PANEL).count()) === 0;
  }, "the plugins panel to be shut");
  const health = this.page.locator(HEALTH_PANEL);
  if (await health.isVisible()) {
    await this.press(this.page.locator(HEALTH));
    await health.waitFor({ state: "hidden", timeout: POLL_TIMEOUT });
  }
});

Then(
  "the plugins panel says {string} is {string}",
  async function (this: OlaiWorld, plugin: string, said: string) {
    try {
      await untilOnRow(this, plugin, (row) =>
        row.locator(`${PREFS_HINT}:has-text(${JSON.stringify(said)})`).isVisible(),
      `the row for ${plugin} to say ${said}`);
    } catch {
      assert.fail(
        `the row for ${JSON.stringify(plugin)} to say ${JSON.stringify(said)}, ` +
          `and it says ${JSON.stringify(await hintOn(this, plugin))} ` +
          `with its switch reading ${JSON.stringify(await switchOn(this, plugin))}`,
      );
    }
  },
);

Then(
  "the plugins panel says nothing more about {string}",
  async function (this: OlaiWorld, plugin: string) {
    await untilOnRow(this, plugin, async (row) =>
      await row.locator(`${PLUGIN_SWITCH}[aria-checked="true"]`).isVisible()
        && await row.locator(PREFS_HINT).count() === 0,
    `the row for ${plugin} to be running and say nothing more`);
  },
);

Then(
  "the plugins panel shows {string} configured {string} as {string}",
  async function (this: OlaiWorld, plugin: string, key: string, value: string) {
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

const rowFor = (world: OlaiWorld, plugin: string) =>
  world.pluginsPanel().locator(`${PREFS_ROW}${attr("data-pref", `plugin-${plugin}`)}`);

const shownRow = (world: OlaiWorld, plugin: string) => world.showPluginRow(plugin);

export const detailOf = async (world: OlaiWorld, plugin: string): Promise<Locator> => {
  const row = await shownRow(world, plugin);
  if (!(await row.isVisible().catch(() => false))) throw new Error(`the ${plugin} row is not on screen`);
  const disclosure = row.locator(".plugins-line button.plugins-name").first();
  if ((await disclosure.getAttribute("aria-expanded", { timeout: 1000 }).catch(() => null)) === "false") {
    await disclosure.click({ timeout: 2000 }).catch(() => undefined);
    await world.waitForFrame();
  }
  return row;
};

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

const hintOn = async (world: OlaiWorld, plugin: string): Promise<string> => {
  const row = await shownRow(world, plugin);
  await row.waitFor({ state: "visible", timeout: POLL_TIMEOUT });
  const hint = row.locator(PREFS_HINT);
  if ((await hint.count()) === 0) return "";
  return (await hint.innerText()).replaceAll("\n", " ");
};

Then(
  "no member of this page has gone silent",
  async function (this: OlaiWorld) {
    await this.expectChromeAttribute(HEALTH, "data-connection", "live", "the connection", HYDRATION_TIMEOUT);
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
    assert.equal(state, "live");
  },
);

Then(
  "the appliance link reads {word}",
  async function (this: OlaiWorld, word: string) {
    const reached = await this.readStatus(() => this.page
      .locator(`${PADI_PILL}${attr("data-padi", word)}`)
      .first()
      .waitFor({ state: "visible", timeout: POLL_TIMEOUT })
      .then(() => null, async () => {
        const pill = this.page.locator(PADI_PILL).first();
        return (await pill.count()) === 0 ? "no pill at all" : await pill.getAttribute("data-padi");
      }));
    if (reached !== null) {
      const found = reached;
      assert.fail(
        `the appliance link to read ${JSON.stringify(word)}, and it is ` +
          `${JSON.stringify(found)}`,
      );
    }
  },
);

const switchOn = async (world: OlaiWorld, plugin: string): Promise<string> => {
  const row = await shownRow(world, plugin);
  const strip = row.locator(PLUGIN_SWITCH);
  if ((await strip.count()) === 0) return "neither";
  const checked = await strip.first().getAttribute("aria-checked");
  if (checked === "true") return "on";
  if (checked === "false") return "off";
  return "neither";
};

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

const FLIP_STEP_TIMEOUT = 90_000;

When(
  "I request that the plugin {string} be {word}",
  async function (this: OlaiWorld, plugin: string, pick: string) {
    assert.ok(this.served, "switching a plugin writes Settings.olai; tag this scenario @scratch:good");
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
  { timeout: FLIP_STEP_TIMEOUT },
  async function (this: OlaiWorld, plugin: string, pick: string) {
    assert.ok(this.served, "switching a plugin writes Settings.olai; tag this scenario @scratch:good");
    await this.page.locator(selector(TESTID.offline)).waitFor({ state: "hidden", timeout: HYDRATION_TIMEOUT });
    const row = await shownRow(this, plugin);
    await row.waitFor({ state: "visible", timeout: POLL_TIMEOUT });
    const current = await switchOn(this, plugin);
    if (current !== pick) {
      await pressOnRow(this, plugin, PLUGIN_SWITCH);
      await confirmIfAsked(this, plugin, pick);
    }
    const wanted = `${PLUGIN_SWITCH}${attr("aria-checked", pick === "on" ? "true" : "false")}`;
    const deadline = Date.now() + 60_000;
    let last: unknown;
    while (Date.now() < deadline) {
      try {
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

Then("chat controls are {word} the outline", async function(this: OlaiWorld, presence: string) {
  assert.ok(presence === "in" || presence === "gone-from");
  await this.page.locator(`${selector(TESTID.agentStart)}, ${selector(TESTID.agentStanding)}`).first().waitFor({
    state: presence === "in" ? "attached" : "detached", timeout: POLL_TIMEOUT,
  });
});

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
      assert.equal(
        (await knob.locator('[data-testid="plugin-source"] + span').textContent())?.trim(),
        "set in Settings.olai",
      );
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


const configurationValue = async (line: Locator): Promise<string> => {
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
