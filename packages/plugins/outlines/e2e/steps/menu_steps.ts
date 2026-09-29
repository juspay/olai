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
import { TESTID } from "@olai/tests/harness/testids.ts"
import * as assert from "node:assert";
import { Given, Then, When } from "@olai/tests/harness/runner.ts";

import { selector } from "@olai/web/testlib"

import { chunkOf } from "@olai/tests/harness/chunks.ts";
import { pressed } from "@olai/tests/harness/settling.ts";

import {
  attr,
  HYDRATION_TIMEOUT,
  NODE_GUTTER,
  NODE_MENU,
  NODE_MENU_ITEM,
  NODE_MENU_PANEL,
  oneLine,
  POLL_TIMEOUT,
  ZOOM,
} from "@olai/tests/harness/world.ts";
import {
  NODE_MENU_CONFIRM,
  NODE_MENU_SAID,
  NODE_MENU_SUB,
} from "../selectors.ts";
import type { Locator } from "@olai/tests/harness/playwright.ts";
import type { OlaiWorld } from "@olai/tests/harness/world.ts";
import { revealGutter } from "./outline_tree_steps.ts";

/** The open panel, waited for. Every step here starts from it — the panel is
 *  the subject of all of them, and one spelling of "wait for it" is what keeps
 *  them from waiting on it several slightly different ways. */
const panelOf = async (world: OlaiWorld) => {
  const panel = world.page.locator(NODE_MENU_PANEL);
  await panel.waitFor({ state: "visible", timeout: POLL_TIMEOUT });
  return panel;
};

/**
 * THE MENU IS GROUPED: a line may OPEN a submenu (`Mark ›`, `More ›`, a
 * plugin's `Start an agent ›`) rather than run a verb, and the submenu is
 * portalled beside the panel, not inside it (`menu/Panel.tsx`).
 *
 * So an entry is named by a PATH, the way a person reads it off the screen:
 * `"Mark › Done"` is the `Done` in the submenu `Mark` opens. A label with no
 * `›` is looked for on the top level first and then, if it is not there, in
 * each submenu in turn — which is where a scenario that is about the verb
 * rather than about where it is filed can leave the filing to the menu. Two
 * submenus holding the same word (`Claude Code` under both `Start an agent`
 * and `Fresh start`) is a failure that says to spell the path.
 *
 * A line's LABEL is its words without the `›` a submenu's entry wears — the
 * `›` is `aria-hidden`, drawn for the eye — so `"Mark"` names that entry, and
 * {@link linesOf} lists it as `Mark ›`, the way it reads.
 */
const SUB_MARK = /\s*›$/;
const labelOf = (text: string): string => oneLine(text).replace(SUB_MARK, "");
const pathOf = (label: string): ReadonlyArray<string> =>
  label.split("›").map((one) => one.trim()).filter((one) => one !== "");

/** One open submenu, by the label of the entry that opened it. */
const subOf = (world: OlaiWorld, label: string): Locator =>
  world.page.locator(`${NODE_MENU_SUB}${attr("aria-label", label)}`);

/** The entry of `level` whose label is exactly `label`, or `undefined`. Read
 *  as one list and indexed, so `Collapse all` is never taken for `Collapse`. */
const findIn = async (level: Locator, label: string): Promise<Locator | undefined> => {
  const items = level.locator(NODE_MENU_ITEM);
  const at = (await items.allInnerTexts()).map(labelOf).indexOf(label);
  return at < 0 ? undefined : items.nth(at);
};

/** ...the same, waited for: a roster may still be arriving under the panel. */
const itemIn = async (world: OlaiWorld, level: Locator, label: string, where: string): Promise<Locator> => {
  let found: Locator | undefined;
  await world.waitUntil(
    async () => (found = await findIn(level, label)) !== undefined,
    `${where} to offer ${JSON.stringify(label)}`,
  );
  return found!;
};

/** Open the submenu an entry opens, the way `gesture` opens it, and wait for
 *  it to be on screen. */
const openSub = async (
  world: OlaiWorld,
  trigger: Locator,
  label: string,
  gesture: "click" | "tap",
): Promise<Locator> => {
  const sub = subOf(world, label);
  const expanded = async (): Promise<boolean> =>
    (await trigger.getAttribute("data-expanded", { timeout: 2000 }).catch(() => null)) !== null;
  await world.waitUntil(async () => {
    // OPEN IS THE ENTRY'S WORD (`data-expanded`), not the submenu's
    // visibility: opening a sibling shuts this one, and a submenu on its way
    // out is still on screen for a moment — read as open, it was never pressed
    // and then left.
    if (await expanded()) return true;
    // ...AND A PRESS THAT LANDED NOWHERE IS PRESSED AGAIN, which is the menu's
    // LIVENESS rather than slack. The entries are contributions: a plugin
    // switched off in another tab withdraws them, and the menu is rebuilt under
    // whoever has it open — a press aimed at the frame that just went is a
    // press that never happened. The entry's own word decides, so a press that
    // DID take is never repeated.
    await sub.waitFor({ state: "detached", timeout: 2000 }).catch(() => undefined);
    await world.press(trigger, gesture).catch(() => undefined);
    return await sub.waitFor({ state: "visible", timeout: 3000 }).then(() => true, async () => await expanded());
  }, `the node menu's ${JSON.stringify(label)} submenu to open`);
  return sub;
};

/** ONE entry of the menu, by its path (see above), with every submenu on the
 *  way opened by `gesture`. */
const entry = async (
  world: OlaiWorld,
  label: string,
  gesture: "click" | "tap" = "click",
): Promise<Locator> => {
  const path = pathOf(label);
  const panel = await panelOf(world);
  if (path.length > 1) {
    let level = panel;
    let where = "the node menu";
    for (const [at, name] of path.entries()) {
      const item = await itemIn(world, level, name, where);
      if (at === path.length - 1) return item;
      level = await openSub(world, item, name, gesture);
      where = `the node menu's ${JSON.stringify(name)}`;
    }
  }
  const name = path[0] ?? label;
  const top = await findIn(panel, name);
  if (top !== undefined) return top;
  // Not on the top level: look in each submenu, and be sure it is in ONE.
  const triggers = panel.locator(`${NODE_MENU_ITEM}[data-opens]`);
  const subs = (await triggers.allInnerTexts()).map(labelOf);
  const holding: Array<number> = [];
  for (const [at, sub] of subs.entries()) {
    const level = await openSub(world, triggers.nth(at), sub, gesture);
    if ((await findIn(level, name)) !== undefined) holding.push(at);
  }
  // In none of them: it may be a line still ARRIVING on the top level — a
  // plugin's verb asks a roster the tab dials after the panel opens.
  if (holding.length === 0) return await itemIn(world, panel, name, "the node menu");
  assert.ok(
    holding.length === 1,
    `${JSON.stringify(name)} is in ${JSON.stringify(holding.map((at) => subs[at]))} — spell the path, e.g. "${subs[holding[0]!]} › ${name}"`,
  );
  // Opening the next submenu may have shut this one: open it again.
  const sub = subs[holding[0]!]!;
  return await itemIn(world, await openSub(world, triggers.nth(holding[0]!), sub, gesture), name, `the node menu's ${JSON.stringify(sub)}`);
};

/** The `•••` pressed: the row's gutter revealed first (it is `opacity-0` until
 *  the row is hovered), then the press itself. `force` because opacity is not
 *  something Playwright's actionability check can see through. */
const pressDots = async (world: OlaiWorld, id: string): Promise<void> => {
  world.menuNode = id;
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
    this.menuNode = id;
    await this.focusWithin(id, NODE_MENU);
    await pressed(this, "Enter");
    await panelOf(this);
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
    this.menuNode = id;
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
    await this.press(await entry(this, label, "tap"), "tap");
  },
);

/** A submenu opened on its own — the pointer's press on `Mark ›` — so a
 *  scenario can say what is IN it before choosing anything. */
When(
  "I open {string} in the node menu",
  async function (this: OlaiWorld, label: string) {
    const panel = await panelOf(this);
    await openSub(this, await itemIn(this, panel, label, "the node menu"), label, "click");
  },
);

When(
  "I tap {string} open in the node menu",
  async function (this: OlaiWorld, label: string) {
    const panel = await panelOf(this);
    await openSub(this, await itemIn(this, panel, label, "the node menu"), label, "tap");
  },
);

/** What a submenu offers, in order, a rule as `—`. The whole list: a submenu
 *  is short, and what it holds and in which order is the grouping this menu is
 *  about. */
Then(
  "the node menu's {string} offers:",
  async function (this: OlaiWorld, label: string, table: { raw(): string[][] }) {
    const sub = subOf(this, label);
    await sub.waitFor({ state: "visible", timeout: POLL_TIMEOUT });
    const expected = table.raw().map((row) => row[0]!);
    await this.waitUntil(
      async () => JSON.stringify(await linesOf(sub)) === JSON.stringify(expected),
      `the node menu's ${JSON.stringify(label)} to offer ${JSON.stringify(expected)}`,
    );
  },
);

Then(
  "the node menu's {string} is open",
  async function (this: OlaiWorld, label: string) {
    await subOf(this, label).waitFor({ state: "visible", timeout: POLL_TIMEOUT });
  },
);

Then(
  "the node menu's {string} is closed",
  async function (this: OlaiWorld, label: string) {
    await this.waitUntil(
      async () => (await subOf(this, label).count()) === 0,
      `the node menu's ${JSON.stringify(label)} to be gone`,
    );
  },
);

/** The top level of the panel, in order, a rule as `—` and a submenu's entry
 *  as `Mark ›` — the menu as a person reads it down the screen. */
Then("the node menu reads, in order:", async function (this: OlaiWorld, table: { raw(): string[][] }) {
  const panel = await panelOf(this);
  const expected = table.raw().map((row) => row[0]!);
  let seen: ReadonlyArray<string> = [];
  await this.waitUntil(
    async () => JSON.stringify(seen = await linesOf(panel)) === JSON.stringify(expected),
    `the node menu to read ${JSON.stringify(expected)}`,
  ).catch((cause: unknown) => {
    throw new Error(`the node menu reads ${JSON.stringify(seen)}: ${String(cause)}`);
  });
});

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
      caret === null ? null : { testid: caret.testid, text: labelOf(caret.text) },
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
    // Floating placement can flip after the menu first becomes visible. The
    // layer assertion needs the settled overlap, not its initial coordinates.
    await this.waitUntil(async () => {
      const over = await panel.boundingBox();
      const under = await heading.boundingBox();
      return over !== null && under !== null &&
        Math.min(over.x + over.width, under.x + under.width) > Math.max(over.x, under.x) &&
        Math.min(over.y + over.height, under.y + under.height) > Math.max(over.y, under.y);
    }, `the node menu to settle across the section heading "${id}"`);
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
/** One level of the menu as it reads: each line's label (`Mark ›` for one
 *  that opens a submenu) and `—` for a rule between groups. */
const linesOf = async (level: Locator): Promise<ReadonlyArray<string>> =>
  // The rule is Kobalte's `Separator`, an `<hr>` (whose role is implicit, so
  // no attribute says it).
  (await level.locator(`${NODE_MENU_ITEM}, hr, [role="separator"]`).evaluateAll((els) =>
    els.map((el) =>
      el.tagName === "HR" || el.getAttribute("role") === "separator" ? "—" : (el as HTMLElement).innerText
    )
  )).map((line) => oneLine(line).replace(SUB_MARK, " ›"));

/**
 * Whether the menu offers a verb, by the same PATH {@link entry} takes: a
 * bare label is looked for on the top level and in every submenu (opening
 * each), `"More › Copy link"` only where it says.
 */
const offered = async (world: OlaiWorld, label: string): Promise<{ readonly found: boolean; readonly seen: ReadonlyArray<string> }> => {
  const path = pathOf(label);
  const name = path.at(-1) ?? label;
  const wordsOf = async (level: Locator) => (await level.locator(NODE_MENU_ITEM).allInnerTexts()).map(labelOf);
  let level = await panelOf(world);
  for (const [at, sub] of path.slice(0, -1).entries()) {
    const trigger = await findIn(level, sub);
    if (trigger === undefined) {
      return { found: false, seen: (await wordsOf(level)).map((one) => [...path.slice(0, at), one].join(" › ")) };
    }
    level = await openSub(world, trigger, sub, "click");
  }
  const where = path.slice(0, -1);
  const here = await wordsOf(level);
  const seen = here.map((one) => [...where, one].join(" › "));
  if (here.includes(name) || path.length > 1) return { found: here.includes(name), seen };
  // A bare label: every submenu too, each read while it is the one open.
  const triggers = level.locator(`${NODE_MENU_ITEM}[data-opens]`);
  for (const [at, sub] of (await triggers.allInnerTexts()).map(labelOf).entries()) {
    const words = await wordsOf(await openSub(world, triggers.nth(at), sub, "click"));
    seen.push(...words.map((one) => `${sub} › ${one}`));
    if (words.includes(name)) return { found: true, seen };
  }
  return { found: false, seen };
};
Then(
  "the node menu offers {string}",
  async function (this: OlaiWorld, label: string) {
    const { found, seen } = await offered(this, label);
    assert.ok(found, `node menu offers ${JSON.stringify(seen)}, expected ${JSON.stringify(label)}`);
  },
);

Then(
  "the node menu does not offer {string}",
  async function (this: OlaiWorld, label: string) {
    const { found, seen } = await offered(this, label);
    assert.ok(
      !found,
      `node menu offers ${JSON.stringify(seen)}, and this step says ${
        JSON.stringify(label)
      } is not one of them`,
    );
  },
);

When(
  "I choose {string} from the node menu",
  async function (this: OlaiWorld, label: string) {
    const item = await entry(this, label);
    const startingNode = label.startsWith("Start an agent") ? this.menuNode : null;
    // A tall menu scrolls independently of the outline. Reveal the item in
    // that scrollport before the page's sticky-cover check hit-tests it.
    // Roster updates may replace an entry while Playwright waits for scroll
    // stability. Scroll the currently resolved entry, then let press resolve
    // and hit-test the live locator again before it actually clicks.
    await item.evaluate(element => element.scrollIntoView({ block: "nearest", inline: "nearest" }));
    await this.waitForFrame();
    await this.press(item);
    if (startingNode !== null) {
      const owned = this.page.locator(`${selector(TESTID.agentFold)}${attr("data-agent", this.nodeId(startingNode))}`);
      await this.waitUntil(async () => await owned.isVisible() || await this.page.locator(NODE_MENU_SAID).isVisible(), "the start action to finish", HYDRATION_TIMEOUT);
      if (await owned.isVisible()) this.activeAgent = startingNode;
    }
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
      line.text.startsWith("The menu didn’t load. Reload the page to try again. (") &&
        line.text.endsWith(")"),
      `"${id}" did not say why its menu is not opening: ${JSON.stringify(line.text)}`,
    );
    assert.strictEqual(
      line.tone,
      "alarm",
      `"${id}" said its menu never came in the wrong tone — a fault is an alarm`,
    );
  },
);

Then("the node menu stays below the app header", async function (this: OlaiWorld) {
  const panel = await panelOf(this);
  await this.waitUntil(async () => {
    const [menu, header] = await Promise.all([panel.boundingBox(), this.page.locator(selector(TESTID.appHeader)).boundingBox()]);
    return menu !== null && header !== null && menu.y >= header.y + header.height;
  }, "the menu to leave its first entry below the app header");
});
