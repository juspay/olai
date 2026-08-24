/**
 * The `•••` menu: opening it, what it offers, what it asks, and what it said.
 *
 * Its own file because the menu is no longer a list of read verbs — it writes
 * now, so it has a question before one of them, two moods to say things in,
 * and a clipboard to be denied by. What stays in `outline_tree_steps.ts` is
 * the GUTTER it lives in: whether the `•••` is revealed on hover, whether a
 * phone lays one out at all. That is a fact about the row; everything here is
 * about the panel.
 *
 * FOUR features are served from here, which is the exception to one-file-per-
 * feature and the reason worth writing down: `menu_verbs.feature` is what the
 * menu DOES to a node, `menu_panel.feature` is how the panel opens and shuts,
 * `menu_arrives.feature` is the chunk the primitive travels in, and
 * `dismiss_stack.feature` is which panel a gesture is FOR when the menu is not
 * the only one up — and all four drive the menu through the same three
 * gestures. A second copy of "open it, then wait for the panel" is exactly the
 * drift this suite spends its selectors avoiding.
 *
 * The one thing this file is careful about is TONE. What a verb said is drawn
 * in one place in two moods — a refusal, in the ops layer's own words, and a
 * remark from a write that landed — and a scenario that could not tell them
 * apart would pass on a client that alarmed about a nudge.
 */

import * as assert from "node:assert";
import { Given, Then, When } from "@cucumber/cucumber";

import { TESTID } from "@olai/web/testlib";

import { chunkOf } from "../support/chunks.ts";

import {
  NODE_GUTTER,
  NODE_MENU,
  NODE_MENU_CONFIRM,
  NODE_MENU_ITEM,
  NODE_MENU_PANEL,
  NODE_MENU_SAID,
  oneLine,
  POLL_TIMEOUT,
  ZOOM,
} from "../support/world.ts";
import type { OlaiWorld } from "../support/world.ts";
import { revealGutter } from "./outline_tree_steps.ts";

/** The open panel, waited for. Every step here starts from it — the panel is
 *  the subject of all of them, and one spelling of "wait for it" is what keeps
 *  them from waiting on it several slightly different ways. */
const panelOf = async (world: OlaiWorld) => {
  const panel = world.page.locator(NODE_MENU_PANEL);
  await panel.waitFor({ state: "visible", timeout: POLL_TIMEOUT });
  return panel;
};

/** ONE entry of it, by the label a person reads off it. `.first()` because one
 *  word can match two — the list's `Collapse`, and its `Collapse all`. */
const entry = async (world: OlaiWorld, label: string) =>
  (await panelOf(world)).locator(NODE_MENU_ITEM).filter({ hasText: label }).first();

/** The `•••` pressed: the row's gutter revealed first (it is `opacity-0` until
 *  the row is hovered), then the press itself. `force` because opacity is not
 *  something Playwright's actionability check can see through. */
const pressDots = async (world: OlaiWorld, id: string): Promise<void> => {
  await revealGutter(world, id);
  await world.within(id, NODE_MENU).click({ force: true });
  await world.waitForFrame();
};

When(
  "I open the node menu of {string}",
  async function (this: OlaiWorld, id: string) {
    await pressDots(this, id);
    await panelOf(this);
  },
);

/** The same press with nothing waited for afterwards — which is what a
 *  scenario asking what the SECOND press does needs: the step above waits for
 *  the panel and would time out on the press that shuts it. */
When(
  "I press the node menu of {string}",
  async function (this: OlaiWorld, id: string) {
    await pressDots(this, id);
  },
);

/** The `•••` opened the way a keyboard opens it: the caret on the trigger,
 *  then Enter. Distinct from the pointer step above because that is what the
 *  scenario about walking the entries is ABOUT — a menu opened by a click
 *  leaves the caret on the button the pointer pressed, exactly as the panel
 *  this replaced did, and one opened by a key puts it in the panel. */
When(
  "I open the node menu of {string} with the keyboard",
  async function (this: OlaiWorld, id: string) {
    await this.focusWithin(id, NODE_MENU);
    await this.page.keyboard.press("Enter");
    await panelOf(this);
    await this.waitForFrame();
  },
);

/**
 * The menu opened the way a PHONE opens it: there is no `•••` drawn below
 * 48rem, so a finger is HELD on the row itself (`client/longPress.ts`).
 *
 * A fourth gesture beside the three above, and the reason it is not simply a
 * `tap` with a longer timeout is in `world.hold`: it goes in through the
 * DevTools protocol so Chromium's own long press happens too, which is half of
 * what this affordance has to coexist with.
 *
 * It does not wait for the panel. The scenario that says a SCROLL is not a
 * press needs the same gesture without one, and an opener that waited would be
 * two steps that could drift about what "held" means.
 */
When(
  "I hold a finger on the node {string}",
  async function (this: OlaiWorld, id: string) {
    await this.hold(this.within(id, NODE_GUTTER));
  },
);

// There is no "hold a finger on the BULLET" step here any more, and its absence
// is the ruling: the bullet is the handle a finger picks a row up by
// (`client/drag/dragging.ts`), so holding it opens no menu. What that gesture
// does now is `phone_steps.ts`'s — "…and keep it there", because a drag is what
// the finger does after the deadline.

/** UP, and the panel is really on screen: `visible`, not merely mounted. */
Then("the node menu is open", async function (this: OlaiWorld) {
  await panelOf(this);
});

/** The same entry, pressed the way a phone presses it. `world.press` takes the
 *  gesture as a parameter for exactly this reason, and a tap is not a click:
 *  the whole point of a phone scenario is that no mouse was involved anywhere
 *  in it. */
When(
  "I tap {string} in the node menu",
  async function (this: OlaiWorld, label: string) {
    await this.press(await entry(this, label), "tap");
  },
);

/** Somewhere that is not the menu — `clickAway` is the suite's one spelling of
 *  that gesture, and a row's note is dismissed by the same one. */
When("I click away from the node menu", async function (this: OlaiWorld) {
  await this.clickAway();
});
/**
 * WHERE the caret is, as this suite talks about elements: the test id it
 * carries, the row it is in, and the words on it. `null` for `<body>`, which is
 * NOWHERE and is the failure every step below exists to catch — a keyboard left
 * there is a walk down the whole document to get back.
 */
const caretOn = async (
  world: OlaiWorld,
): Promise<{ testid: string | null; node: string | null; text: string } | null> => {
  const caret = await world.page.evaluate(() => {
    const el = document.activeElement as HTMLElement | null;
    return el === null || el === document.body ? null : {
      testid: el.getAttribute("data-testid"),
      node: el.closest("[data-node-id]")?.getAttribute("data-node-id") ?? null,
      text: el.innerText,
    };
  });
  return caret === null ? null : { ...caret, text: oneLine(caret.text) };
};

/**
 * WHICH entry has the caret, by the label a person reads.
 *
 * The panel swaps its content for the question one verb asks, and a swap that
 * left the caret on the entry it just removed leaves the keyboard nowhere.
 * Nothing else in this suite would notice: the question is on screen either
 * way.
 */
Then(
  "the node menu's {string} has the caret",
  async function (this: OlaiWorld, label: string) {
    const caret = await caretOn(this);
    assert.deepStrictEqual(
      caret === null ? null : { testid: caret.testid, text: caret.text },
      { testid: TESTID.nodeMenuItem, text: label },
      `the caret is on ${JSON.stringify(caret)}, expected the node menu's ${JSON.stringify(label)}`,
    );
  },
);

/**
 * The caret back on the `•••` a menu was opened from.
 *
 * A panel that took the caret has to give it back when it goes, and the
 * primitive's own way of doing that never fires here (`menu/Dropdown.tsx`'s
 * `handBack` says why), so this is the step that would notice it stopping.
 * The ROW is asserted as well as the control: handing the caret to some other
 * row's `•••` would be its own kind of lost.
 */
Then(
  "the node menu of {string} has the caret",
  async function (this: OlaiWorld, id: string) {
    const caret = await caretOn(this);
    assert.deepStrictEqual(
      caret === null ? null : { testid: caret.testid, node: caret.node },
      { testid: TESTID.nodeMenu, node: id },
      `the caret is on ${JSON.stringify(caret)}, expected the "${id}" row's •••`,
    );
  },
);

/** NOWHERE, and on purpose: a press that landed outside the menu is where the
 *  reader now is, and the menu does not get to take the caret back off it. */
Then("the caret is nowhere", async function (this: OlaiWorld) {
  const caret = await caretOn(this);
  assert.strictEqual(
    caret,
    null,
    `the caret is on ${JSON.stringify(caret)}, and this step says a press outside leaves it where it fell`,
  );
});

/** GONE, not merely invisible: the panel is unmounted when the menu shuts, so
 *  a scenario that accepted `hidden` would also accept one left in the DOM
 *  under a row nobody is pointing at. */
Then("the node menu is closed", async function (this: OlaiWorld) {
  await this.waitUntil(
    async () => (await this.page.locator(NODE_MENU_PANEL).count()) === 0,
    "the node menu panel to be gone",
  );
});

/**
 * WHAT PAINTS AT THE OVERLAP — the only honest assertion a stacking bug
 * has. A bounding box cannot see a layer: the heading is still laid out
 * exactly where it should be, still `visible` to Playwright, and still
 * what a pointer would reach if the panel were left in the row.
 *
 * `topmostTestidAt` walks to the nearest `data-testid`, so a hit on an
 * entry reports `node-menu-item` rather than the panel — both are the
 * menu. The heading is `node-gutter`.
 */
Then(
  "the node menu takes the pointer where it crosses the section heading of {string}",
  async function (this: OlaiWorld, id: string) {
    const panel = await panelOf(this);
    const heading = this.within(id, NODE_GUTTER);
    const over = await this.box(panel, "the node menu");
    const under = await this.box(heading, `the section heading "${id}"`);
    const left = Math.max(over.x, under.x);
    const right = Math.min(over.x + over.width, under.x + under.width);
    const top = Math.max(over.y, under.y);
    const bottom = Math.min(over.y + over.height, under.y + under.height);
    assert.ok(
      right > left && bottom > top,
      `the menu (${Math.round(over.x)},${Math.round(over.y)} ` +
        `${Math.round(over.width)}×${Math.round(over.height)}) does not ` +
        `cross the section heading of "${id}" ` +
        `(${Math.round(under.x)},${Math.round(under.y)} ` +
        `${Math.round(under.width)}×${Math.round(under.height)}) — ` +
        "without an overlap this step cannot see a layer",
    );
    const found = await this.topmostTestidAt(
      (left + right) / 2,
      (top + bottom) / 2,
    );
    assert.ok(
      found === TESTID.nodeMenuPanel || found === TESTID.nodeMenuItem ||
        found === TESTID.nodeMenuConfirm,
      `the element at the overlap is ${found} — a sticky heading ` +
        "painting through the panel is the bug this scenario holds",
    );
  },
);

/** The same question, asked of the line a verb leaves behind. The panel
 *  is gone by then; the line is what a later heading used to swallow. */
Then(
  "the node menu's said line takes the pointer where it crosses the section heading of {string}",
  async function (this: OlaiWorld, id: string) {
    const said = this.page.locator(NODE_MENU_SAID);
    await said.waitFor({ state: "visible", timeout: POLL_TIMEOUT });
    const heading = this.within(id, NODE_GUTTER);
    const over = await this.box(said, "the node menu's said line");
    const under = await this.box(heading, `the section heading "${id}"`);
    const left = Math.max(over.x, under.x);
    const right = Math.min(over.x + over.width, under.x + under.width);
    const top = Math.max(over.y, under.y);
    const bottom = Math.min(over.y + over.height, under.y + under.height);
    assert.ok(
      right > left && bottom > top,
      `the said line (${Math.round(over.x)},${Math.round(over.y)} ` +
        `${Math.round(over.width)}×${Math.round(over.height)}) does not ` +
        `cross the section heading of "${id}" ` +
        `(${Math.round(under.x)},${Math.round(under.y)} ` +
        `${Math.round(under.width)}×${Math.round(under.height)}) — ` +
        "without an overlap this step cannot see a layer",
    );
    const found = await this.topmostTestidAt(
      (left + right) / 2,
      (top + bottom) / 2,
    );
    assert.strictEqual(
      found,
      TESTID.nodeMenuSaid,
      `the element at the overlap is ${found} — a sticky heading ` +
        "painting through the said line is the bug this scenario holds",
    );
  },
);
/** What it is offering, in order. Through `oneLine` like every other text this
 *  suite reads out of the DOM, so a label that wraps is still one label. */
const menuLabels = async (world: OlaiWorld): Promise<ReadonlyArray<string>> =>
  (await (await panelOf(world)).locator(NODE_MENU_ITEM).allInnerTexts()).map(oneLine);

Then(
  "the node menu offers {string}",
  async function (this: OlaiWorld, label: string) {
    const labels = await menuLabels(this);
    assert.ok(
      labels.includes(label),
      `node menu offers ${JSON.stringify(labels)}, expected ${JSON.stringify(label)}`,
    );
  },
);

Then(
  "the node menu does not offer {string}",
  async function (this: OlaiWorld, label: string) {
    const labels = await menuLabels(this);
    assert.ok(
      !labels.includes(label),
      `node menu offers ${JSON.stringify(labels)}, and this step says ${
        JSON.stringify(label)
      } is not one of them`,
    );
  },
);

When(
  "I choose {string} from the node menu",
  async function (this: OlaiWorld, label: string) {
    await this.press(await entry(this, label));
  },
);

/** The question the panel puts where its list was. VERBATIM, because the whole
 *  point of it is the two things it names — which row, and how much goes with
 *  it — and a substring match would pass on a confirm that had lost the
 *  count. */
Then(
  "the node menu asks {string}",
  async function (this: OlaiWorld, question: string) {
    const asked = this.page.locator(NODE_MENU_CONFIRM);
    await asked.waitFor({ state: "visible", timeout: POLL_TIMEOUT });
    assert.strictEqual(oneLine(await asked.innerText()), question);
  },
);

Then("the node menu is not asking anything", async function (this: OlaiWorld) {
  await this.waitUntil(
    async () => (await this.page.locator(NODE_MENU_CONFIRM).count()) === 0,
    "the confirm to be gone from the panel",
  );
});

/** What the line beside the `•••` reads, and which MOOD it is in. Both at
 *  once, because the two steps below differ in nothing else — and the tone is
 *  a `data-` fact rather than a colour, the same contract the row editor's
 *  line keeps.
 *
 *  The line is PORTALLED onto `overlay.ts` (`menu/MenuSaid.tsx`), so it is
 *  not a descendant of the row. The page holds at most one at a time: a new
 *  sentence replaces the one before it. */
const said = async (
  world: OlaiWorld,
): Promise<{ readonly text: string; readonly tone: string | null }> => {
  const line = world.page.locator(NODE_MENU_SAID);
  await line.waitFor({ state: "visible", timeout: POLL_TIMEOUT });
  return { text: oneLine(await line.innerText()), tone: await line.getAttribute("data-tone") };
};

/** A REFUSAL: verbatim, and in the alarm tone. Quoting the ops layer's own
 *  sentence in a feature file is how "surfaced verbatim" is a test rather than
 *  a claim. */
Then(
  "the node menu of {string} says {string}",
  async function (this: OlaiWorld, id: string, text: string) {
    const line = await said(this);
    assert.strictEqual(line.text, text);
    assert.strictEqual(
      line.tone,
      "alarm",
      `"${id}" said ${JSON.stringify(line.text)} in the wrong tone — a refusal is an alarm`,
    );
  },
);

/**
 * NOTHING at all — the absence of the line, which is its own claim and not the
 * weaker "it did not say X".
 *
 * The entry that opens the date picker is why this exists: `run` answers with
 * what an action has to SAY, and an expression body calling a Solid setter
 * answers with the setter's new value — which the panel then drew as a
 * bordered box with no words in it. `data-tone` cannot catch that (there is
 * none), and no text assertion can either. The absence is the assertion.
 *
 * READ ONCE, and that is the whole of why this is not `support/said.ts`'s
 * `saysNothing`: that one WAITS for the locators to be gone, which this line
 * always is eventually — it clears itself after `SAID_MS`. A poll would have
 * sat there for six seconds and then passed over a box that had been on screen
 * the whole time, which is exactly what it did the first time this step was
 * written. The gesture has already been through `waitForFrame`, and the panel
 * draws its line in the same tick it is told to, so NOW is when there is
 * something to see.
 */
Then(
  "the node menu of {string} says nothing",
  async function (this: OlaiWorld, id: string) {
    const line = this.page.locator(NODE_MENU_SAID);
    const said = await line.count();
    assert.strictEqual(
      said,
      0,
      said === 0 ? "" : `the node menu of "${id}" drew a line saying ${
        JSON.stringify(oneLine(await line.first().innerText()))
      } — an action that has nothing to say must answer with nothing`,
    );
  },
);

/** The other mood: news about something that HAPPENED — a write that landed and
 *  had something to add, or a copy confirming it reached the clipboard, which
 *  is the one verb whose success the page cannot otherwise show. A substring,
 *  because a nudge is a paragraph the rollup wrote and what matters is that it
 *  arrived at all — and that it did not arrive as an alarm. */
Then(
  "the node menu of {string} remarks {string}",
  async function (this: OlaiWorld, id: string, text: string) {
    const line = await said(this);
    assert.ok(
      line.text.includes(text),
      `"${id}" remarked ${JSON.stringify(line.text)}, which does not mention ${
        JSON.stringify(text)
      }`,
    );
    assert.strictEqual(
      line.tone,
      "aside",
      `"${id}" remarked ${JSON.stringify(line.text)} in the wrong tone — a nudge is not an alarm`,
    );
  },
);

// ── the clipboard ──────────────────────────────────────────────────────

/**
 * A browser whose clipboard says no.
 *
 * Which is the ORDINARY browser for most olai readers: `navigator.clipboard`
 * is gated on a secure context, and a server on the LAN read over plain http
 * is not one. The e2e suite is served from `localhost`, which IS a secure
 * context, so the refusal has to be put back — and put back as the same shape
 * a real one has, a rejected promise from `writeText`.
 */
Given("this browser's clipboard refuses", async function (this: OlaiWorld) {
  // `evaluate` on the page that is already open, rather than `addInitScript`:
  // the feature's Background has navigated before this step runs, and an init
  // script only reaches the NEXT navigation. Nothing here reloads — the app is
  // a single page — so patching the live window is what a scenario sees.
  await this.page.evaluate(() => {
    Object.defineProperty(navigator, "clipboard", {
      configurable: true,
      value: {
        writeText: () =>
          Promise.reject(new Error("olai e2e: the clipboard is not available")),
      },
    });
  });
});

/**
 * A clipboard that keeps what it was given, so a scenario can read it back.
 *
 * Patched rather than granted: reading the real clipboard needs a permission
 * that is Chromium's alone, and the assertion this exists for is about the
 * TEXT olai composed — every tab, every note line — which is the same string
 * either way. The same live-window patch as the refusing one above, and the
 * same reason it is not an init script.
 */
Given(
  "this browser's clipboard records what is copied",
  async function (this: OlaiWorld) {
    await this.page.evaluate(() => {
      const held = { text: "" };
      (globalThis as unknown as { __olaiClipboard: typeof held }).__olaiClipboard = held;
      Object.defineProperty(navigator, "clipboard", {
        configurable: true,
        value: {
          writeText: (text: string) => {
            held.text = text;
            return Promise.resolve();
          },
        },
      });
    });
  },
);

/** What is on the recording clipboard right now, or `""` before anything has
 *  been copied. One spelling, so the poll below and the assertion after it
 *  cannot read it two different ways — and cannot disagree about which write
 *  they are talking about. */
const copied = (world: OlaiWorld): Promise<string> =>
  world.page.evaluate(
    () =>
      (globalThis as unknown as { __olaiClipboard?: { text: string } }).__olaiClipboard
        ?.text ?? "",
  );

/** What landed on it, to the tab. A doc string rather than a table: the shape
 *  IS the assertion — one line per node, one tab per level, the note beneath
 *  its own node — and a table would hide exactly the whitespace under test. */
Then("the clipboard holds:", async function (this: OlaiWorld, expected: string) {
  await this.waitUntil(
    async () => (await copied(this)) !== "",
    "something to reach the clipboard",
  );
  assert.strictEqual(await copied(this), expected);
});

/**
 * THE PRIMITIVE AS A CHUNK, which is the other half of "a row pays for its
 * menu once it reaches for one".
 *
 * Kobalte's `DropdownMenu` is fetched by the `import()` in
 * `client/menu/chunk.ts` — ~80 kB the first paint of an outline does not wait
 * for — so what a row draws before anybody presses it is a plain `<button>`,
 * and these steps are about the network rather than about the panel. The
 * machinery is `support/chunks.ts`, shared with the markdown pipeline, and the
 * chunk's URL is derived there from the module it is split at: `menu/
 * Dropdown.tsx` → `Dropdown-<hash>.js`.
 */
const PRIMITIVE = chunkOf("the menu's primitive", "Dropdown");

Given("the menu's primitive is held up", async function (this: OlaiWorld) {
  await PRIMITIVE.holdUp(this);
});

Given("the menu's primitive never arrives", async function (this: OlaiWorld) {
  await PRIMITIVE.neverArrives(this);
});

When("the menu's primitive arrives", async function (this: OlaiWorld) {
  await PRIMITIVE.arrive(this);
});

Then("nothing has asked for the menu's primitive", function (this: OlaiWorld) {
  const requested = PRIMITIVE.asked(this);
  assert.deepStrictEqual(
    [...requested],
    [],
    `this page fetched the menu's primitive before any row was asked for a menu:\n  ${
      requested.join("\n  ")
    }`,
  );
});

/** ONCE, however many rows have been opened: the chunk is one fact about the
 *  app, not one per row (`client/arriving.ts`). */
Then("the menu's primitive was fetched once", function (this: OlaiWorld) {
  const requested = PRIMITIVE.asked(this);
  assert.strictEqual(
    requested.length,
    1,
    `the page asked for the menu's primitive ${requested.length} time(s)\n  ${
      requested.length === 0 ? PRIMITIVE.diagnosis(this) : requested.join("\n  ")
    }`,
  );
});

/**
 * WHAT A ROW SAYS when the primitive is never coming.
 *
 * Not the verbatim-sentence step above, and the difference is the CAUSE: the
 * middle of this sentence is the browser's own words for a fetch that failed,
 * with the hashed chunk URL in them, so a feature file cannot spell it. What
 * the app owns is the two ends — what could not be loaded, and what to do
 * about it — and those are what this holds, in the alarm tone every refusal
 * wears. `markdown_steps.ts` says the same thing about the renderer the same
 * way.
 */
Then(
  "the node menu of {string} says its menu never came",
  async function (this: OlaiWorld, id: string) {
    const line = await said(this);
    assert.ok(
      line.text.startsWith("the ••• menu could not be loaded:") &&
        line.text.endsWith("reloading is the way to try again."),
      `"${id}" did not say why its menu is not opening: ${JSON.stringify(line.text)}`,
    );
    assert.strictEqual(
      line.tone,
      "alarm",
      `"${id}" said its menu never came in the wrong tone — a fault is an alarm`,
    );
  },
);
