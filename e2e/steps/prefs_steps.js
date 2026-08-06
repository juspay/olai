// Client prefs: the theme picker, what it writes on <html>, and what the page
// repaints to. The theme names are read off the CHIPS — web/theme owns the
// table, and a suite with its own copy of it would only ever be out of date.

import assert from "node:assert/strict";
import { Then, When } from "@cucumber/cucumber";

// The theme row of the picker. `data-pref` is the pref's name, which is also
// the tail of the attribute (data-theme) and of the storage key (olai.theme) —
// so one selector reaches all three (web/prefs).
const ROW = '.ol-prefs .ol-pref[data-pref="theme"]';
const CHIP = `${ROW} .ol-pref-opt`;

// What the parse probe leaves on the window. Named here because two steps and
// one init script have to agree on it.
const PROBE = "__olai_theme_landed";

// ---- picking ---------------------------------------------------------------

When("I pick the theme {string}", async function (theme) {
  await pick(this.page, theme);
});

When("I pick the default theme", async function () {
  await pick(this.page, await defaultTheme(this.page));
});

/** Click a chip and wait for the page to say it is in that theme. prefs.js
 *  writes the attribute in the click handler, so this settles in a tick — but
 *  waiting on the page rather than on the click is what keeps the assertions
 *  after it about the theme and not about timing. */
async function pick(page, theme) {
  const chip = page.locator(`${CHIP}[data-value="${theme}"]`);
  await chip.waitFor({ state: "visible" });
  await chip.click();
  await page.waitForFunction(
    (t) => document.documentElement.getAttribute("data-theme") === t,
    theme,
  );
}

// ---- what the page is in ---------------------------------------------------

// No attribute is not "no theme": it is the DEFAULT, which the sheet draws on
// the bare :root. The distinction is the point — this is the page nobody has
// picked on yet.
Then("the page names no theme", async function () {
  const named = await namedTheme(this.page);
  assert.equal(named, null, `the page already names a theme: ${named}`);
});

Then("the page is in the theme {string}", async function (theme) {
  assert.equal(await namedTheme(this.page), theme);
});

Then("the page is in the default theme", async function () {
  assert.equal(await namedTheme(this.page), await defaultTheme(this.page));
});

/** The theme <html> names, or null for the one nobody has picked. */
function namedTheme(page) {
  return page.locator("html").getAttribute("data-theme");
}

Then("the lit theme chip is {string}", async function (theme) {
  assert.equal(await litTheme(this.page), theme);
});

Then("the lit theme chip is the default", async function () {
  assert.equal(await litTheme(this.page), await defaultTheme(this.page));
});

// The invariant behind the chips, as its own step: a screen reader reads
// aria-pressed and not the class, and a scenario about PICKING a theme should
// not be the thing that fails when those two drift.
Then("every theme chip agrees with what it announces", async function () {
  for (const c of await chips(this.page)) {
    assert.equal(c.pressed, c.on ? "true" : "false", `${c.value}: aria-pressed`);
  }
});

/** The theme the row falls back to, asked of the row. */
async function defaultTheme(page) {
  const row = page.locator(ROW);
  await row.waitFor({ state: "visible" });
  return await row.getAttribute("data-default");
}

/** Every chip: which theme it offers, whether it is lit, what it announces. */
function chips(page) {
  return page.locator(CHIP).evaluateAll((els) =>
    els.map((el) => ({
      value: el.dataset.value,
      on: el.classList.contains("is-on"),
      pressed: el.getAttribute("aria-pressed"),
    })),
  );
}

/** Which theme the picker says is in force. */
async function litTheme(page) {
  // prefs.js is deferred and re-marks after every htmx swap, so the lit chip
  // is a thing that ARRIVES rather than a thing the server drew — and exactly
  // one of them is lit once it has.
  await page.waitForFunction(
    (sel) => document.querySelectorAll(`${sel}.is-on`).length === 1,
    CHIP,
  );
  return (await chips(page)).find((c) => c.on).value;
}

// ---- the paint -------------------------------------------------------------

When("I note the paper colour", async function () {
  this.paperBefore = await paper(this.page);
  assert.ok(this.paperBefore, "the sheet paints no --paper");
});

Then("the paper colour has changed", async function () {
  const now = await paper(this.page);
  assert.ok(this.paperBefore, "nothing noted the paper colour first");
  assert.notEqual(
    now,
    this.paperBefore,
    "the attribute flipped but the sheet painted the same paper",
  );
});

// The one colour a step may talk about is the one the server computed and the
// browser resolved: we compare --paper against itself, never against a hex
// written here.
async function paper(page) {
  return await page.evaluate(() =>
    getComputedStyle(document.documentElement)
      .getPropertyValue("--paper")
      .trim(),
  );
}

// The pair, spelled once for both the wait and the diagnosis. A page-side
// expression rather than a function, because waitForFunction and evaluate can
// both take a string and neither can call back into this module.
const META_AND_PAPER = `({
  meta: document.querySelector('meta[name="theme-color"]')?.getAttribute('content'),
  paper: getComputedStyle(document.documentElement).getPropertyValue('--paper').trim(),
})`;

Then("the theme-color meta matches the paper", async function () {
  try {
    // pwa.js repaints the meta two animation frames after a chip is clicked,
    // so this is a wait, not a read. Short: a mismatch is a fact within a
    // frame or two, and the rest of the budget would only buy a worse message.
    await this.page.waitForFunction(
      `(r => !!r.meta && r.meta === r.paper)(${META_AND_PAPER})`,
      null,
      { timeout: 5_000 },
    );
  } catch (e) {
    // the timeout says "it never matched"; say WHAT it said instead
    const { meta, paper } = await this.page.evaluate(META_AND_PAPER);
    assert.equal(meta, paper, "meta theme-color is not the paper");
    throw e;
  }
});

// ---- before the first paint ------------------------------------------------

// The stored theme has to be on <html> while the document is still parsing:
// the inline boot script in <head> is what puts it there, and everything else
// on the page is deferred — a theme that landed later is a flash of the wrong
// colours on every load. The observer is installed before any page script runs
// and reads document.readyState at the moment the attribute appears:
// "loading" is the parser still going, and no deferred script has run yet.
When("I watch for the theme landing", async function () {
  await this.page.addInitScript((key) => {
    window[key] = null;
    // `document` with subtree: at this point <html> does not exist yet, so
    // there is nothing narrower to observe.
    new MutationObserver((records) => {
      if (window[key]) return;
      if (!records.some((r) => r.attributeName === "data-theme")) return;
      window[key] = {
        theme: document.documentElement.getAttribute("data-theme"),
        parsing: document.readyState === "loading",
      };
    }).observe(document, {
      attributes: true,
      subtree: true,
      attributeFilter: ["data-theme"],
    });
  }, PROBE);
});

Then(
  "the theme {string} landed while the page was still parsing",
  async function (theme) {
    const landed = await this.page.evaluate((k) => window[k], PROBE);
    assert.ok(landed, "no theme was ever written on <html>");
    assert.equal(landed.theme, theme);
    assert.equal(
      landed.parsing,
      true,
      "the theme landed after the parse: the page flashed the wrong one",
    );
  },
);
