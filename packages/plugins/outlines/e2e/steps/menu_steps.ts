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

const panelOf = async (world: OlaiWorld) => {
  const panel = world.page.locator(NODE_MENU_PANEL);
  await panel.waitFor({ state: "visible", timeout: POLL_TIMEOUT });
  return panel;
};

const SUB_MARK = /\s*›$/;
const labelOf = (text: string): string => oneLine(text).replace(SUB_MARK, "");
const pathOf = (label: string): ReadonlyArray<string> =>
  label.split("›").map((one) => one.trim()).filter((one) => one !== "");

const subOf = (world: OlaiWorld, label: string): Locator =>
  world.page.locator(`${NODE_MENU_SUB}${attr("aria-label", label)}`);

const findIn = async (level: Locator, label: string): Promise<Locator | undefined> => {
  const items = level.locator(NODE_MENU_ITEM);
  const at = (await items.allInnerTexts()).map(labelOf).indexOf(label);
  return at < 0 ? undefined : items.nth(at);
};

const itemIn = async (world: OlaiWorld, level: Locator, label: string, where: string): Promise<Locator> => {
  let found: Locator | undefined;
  await world.waitUntil(
    async () => (found = await findIn(level, label)) !== undefined,
    `${where} to offer ${JSON.stringify(label)}`,
  );
  return found!;
};

const openSub = async (
  world: OlaiWorld,
  trigger: Locator,
  label: string,
  gesture: "click" | "tap",
): Promise<Locator> => {
  const sub = subOf(world, label);
  const expanded = async (): Promise<boolean> =>
    (await trigger.getAttribute("data-expanded", { timeout: 2000 }).catch(() => null)) !== null;
  let refused: unknown;
  try {
    await world.waitUntil(async () => {
      if (await expanded()) return true;
      await sub.waitFor({ state: "detached", timeout: 2000 }).catch(() => undefined);
      await world.press(trigger, gesture).catch((cause: unknown) => { refused = cause });
      return await sub.waitFor({ state: "visible", timeout: 3000 }).then(() => true, async () => await expanded());
    }, `the node menu's ${JSON.stringify(label)} submenu to open`);
  } catch (error) {
    throw refused === undefined ? error : new Error(`${String(error)} — the last press said: ${String(refused)}`);
  }
  return sub;
};

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
  const triggers = panel.locator(`${NODE_MENU_ITEM}[data-opens]`);
  const subs = (await triggers.allInnerTexts()).map(labelOf);
  const holding: Array<number> = [];
  for (const [at, sub] of subs.entries()) {
    const level = await openSub(world, triggers.nth(at), sub, gesture);
    if ((await findIn(level, name)) !== undefined) holding.push(at);
  }
  if (holding.length === 0) return await itemIn(world, panel, name, "the node menu");
  assert.ok(
    holding.length === 1,
    `${JSON.stringify(name)} is in ${JSON.stringify(holding.map((at) => subs[at]))} — spell the path, e.g. "${subs[holding[0]!]} › ${name}"`,
  );
  const sub = subs[holding[0]!]!;
  return await itemIn(world, await openSub(world, triggers.nth(holding[0]!), sub, gesture), name, `the node menu's ${JSON.stringify(sub)}`);
};

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

When(
  "I press the node menu of {string}",
  async function (this: OlaiWorld, id: string) {
    await pressDots(this, id);
  },
);

When(
  "I open the node menu of {string} with the keyboard",
  async function (this: OlaiWorld, id: string) {
    this.menuNode = id;
    await this.focusWithin(id, NODE_MENU);
    await pressed(this, "Enter");
    await panelOf(this);
  },
);

When(
  "I hold a finger on the node {string}",
  async function (this: OlaiWorld, id: string) {
    this.menuNode = id;
    await this.hold(this.within(id, NODE_GUTTER));
  },
);

Then("the node menu is open", async function (this: OlaiWorld) {
  await panelOf(this);
});

When(
  "I tap {string} in the node menu",
  async function (this: OlaiWorld, label: string) {
    await this.press(await entry(this, label, "tap"), "tap");
  },
);

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

When("I click away from the node menu", async function (this: OlaiWorld) {
  await this.clickAway();
});
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

Then("the caret is nowhere", async function (this: OlaiWorld) {
  const caret = await caretOn(this);
  assert.strictEqual(
    caret,
    null,
    `the caret is on ${JSON.stringify(caret)}, and this step says a press outside leaves it where it fell`,
  );
});

Then("the node menu is closed", async function (this: OlaiWorld) {
  await this.waitUntil(
    async () => (await this.page.locator(NODE_MENU_PANEL).count()) === 0,
    "the node menu panel to be gone",
  );
});

Then(
  "the node menu takes the pointer where it crosses the section heading of {string}",
  async function (this: OlaiWorld, id: string) {
    const panel = await panelOf(this);
    const heading = this.within(id, NODE_GUTTER);
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
const linesOf = async (level: Locator): Promise<ReadonlyArray<string>> =>
  (await level.locator(`${NODE_MENU_ITEM}, hr, [role="separator"]`).evaluateAll((els) =>
    els.map((el) =>
      el.tagName === "HR" || el.getAttribute("role") === "separator" ? "—" : (el as HTMLElement).innerText
    )
  )).map((line) => oneLine(line).replace(SUB_MARK, " ›"));

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

const said = async (
  world: OlaiWorld,
): Promise<{ readonly text: string; readonly tone: string | null }> => {
  const line = world.page.locator(NODE_MENU_SAID);
  await line.waitFor({ state: "visible", timeout: POLL_TIMEOUT });
  return { text: oneLine(await line.innerText()), tone: await line.getAttribute("data-tone") };
};

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

Given("this browser's clipboard refuses", async function (this: OlaiWorld) {
  await this.page.evaluate(() => {
    Object.defineProperty(navigator, "clipboard", {
      configurable: true,
      value: undefined,
    });
  });
});

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

const copied = (world: OlaiWorld): Promise<string> =>
  world.page.evaluate(
    () =>
      (globalThis as unknown as { __olaiClipboard?: { text: string } }).__olaiClipboard
        ?.text ?? "",
  );

Then("the clipboard holds:", async function (this: OlaiWorld, expected: string) {
  await this.waitUntil(
    async () => (await copied(this)) !== "",
    "something to reach the clipboard",
  );
  assert.strictEqual(await copied(this), expected);
});

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
