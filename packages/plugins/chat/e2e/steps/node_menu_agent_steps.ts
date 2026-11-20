import assert from "node:assert/strict";
import { Then, When } from "@olai/tests/harness/runner.ts";
import { TESTID } from "@olai/tests/harness/testids.ts";
import { selector } from "@olai/web/testlib";
import {
  attr,
  HYDRATION_TIMEOUT,
  NODE_MENU_ITEM,
  NODE_MENU_PANEL,
  oneLine,
  POLL_TIMEOUT,
} from "@olai/tests/harness/world.ts";
import type { OlaiWorld } from "@olai/tests/harness/world.ts";

const NODE_MENU_SUB = selector(TESTID.nodeMenuSub);

const entry = async (world: OlaiWorld, label: string) => {
  const panel = world.page.locator(NODE_MENU_PANEL);
  await panel.waitFor({ state: "visible", timeout: POLL_TIMEOUT });
  return panel.locator(NODE_MENU_ITEM).filter({ hasText: label }).first();
};

const submenuOf = async (world: OlaiWorld, label: string) => {
  const trigger = await entry(world, label);
  await trigger.waitFor({ state: "visible", timeout: POLL_TIMEOUT });
  const action = await trigger.getAttribute("data-action");
  assert.ok(action, `the node menu's ${JSON.stringify(label)} names no action`);
  return { trigger, sub: world.page.locator(`${NODE_MENU_SUB}${attr("data-sub", action)}`) };
};

const started = async (world: OlaiWorld): Promise<void> => {
  const node = world.menuNode;
  if (node === null) return;
  const owned = world.page.locator(`${selector(TESTID.agentFold)}${attr("data-agent", world.nodeId(node))}`);
  const said = world.page.locator(selector(TESTID.nodeMenuSaid));
  await world.waitUntil(async () => await owned.isVisible() || await said.isVisible(), "the start to finish", HYDRATION_TIMEOUT);
  if (await owned.isVisible()) world.activeAgent = node;
};

When(
  "I open the node menu's {string} agents",
  async function (this: OlaiWorld, label: string) {
    const { trigger, sub } = await submenuOf(this, label);
    await this.press(trigger);
    await sub.waitFor({ state: "visible", timeout: POLL_TIMEOUT });
  },
);

When(
  "I open the node menu's {string} agents with the keyboard",
  async function (this: OlaiWorld, label: string) {
    const { trigger, sub } = await submenuOf(this, label);
    const entries = await this.page.locator(NODE_MENU_PANEL).locator(NODE_MENU_ITEM).count();
    for (let step = 0; step <= entries; step++) {
      if (await trigger.evaluate(el => el === document.activeElement)) break;
      await this.page.keyboard.press("ArrowDown");
    }
    assert.ok(await trigger.evaluate(el => el === document.activeElement), `the arrows never reached ${JSON.stringify(label)}`);
    await this.page.keyboard.press("ArrowRight");
    await sub.waitFor({ state: "visible", timeout: POLL_TIMEOUT });
    const first = sub.getByRole("menuitem").first();
    const caret = async () => await first.evaluate((el) =>
      el === document.activeElement && el.hasAttribute("data-highlighted"));
    await this.page.evaluate(() => new Promise<void>((resolve) => { setTimeout(resolve, 0); }));
    if (!(await caret())) {
      await first.evaluate((el) => { if (el instanceof HTMLElement) el.focus({ preventScroll: true }); });
      await this.page.evaluate(() => new Promise<void>((resolve) => { setTimeout(resolve, 0); }));
    }
    await this.waitUntil(caret, "the first agent in the submenu to have the caret");
  },
);

When(
  "I pick {string} in the {string} submenu of the node menu",
  async function (this: OlaiWorld, choice: string, label: string) {
    const { trigger, sub } = await submenuOf(this, label);
    const expanded = async () => (await trigger.getAttribute("data-expanded")) !== null;
    await this.waitUntil(async () => await expanded() || (await sub.count()) === 0,
      `the ${JSON.stringify(label)} submenu to be settled open or shut`);
    if (!(await expanded())) {
      await this.press(trigger);
      await sub.waitFor({ state: "visible", timeout: POLL_TIMEOUT });
    }
    const starting = await trigger.getAttribute("data-action") === "chat:start-agent";
    const item = sub.getByRole("menuitem", { name: choice, exact: true });
    // A Playwright click samples the box, then the portalled row moves, and the
    // click lands on the page — which shuts the menu.
    await this.waitUntil(async () => item.evaluate((el) => {
      const box = el.getBoundingClientRect();
      const x = box.left + box.width / 2;
      const y = box.top + box.height / 2;
      const hit = document.elementFromPoint(x, y);
      if (!(hit === el || (hit !== null && el.contains(hit)))) return false;
      el.dispatchEvent(new PointerEvent("pointerup", { bubbles: true, button: 0, clientX: x, clientY: y }));
      return true;
    }).catch(() => false), `${choice} to be where the pointer lands`);
    if (starting) await started(this);
  },
);

Then(
  "the node menu's {string} offers the agents {string}",
  async function (this: OlaiWorld, label: string, agents: string) {
    const { sub } = await submenuOf(this, label);
    await sub.waitFor({ state: "visible", timeout: POLL_TIMEOUT });
    const want = agents.split("|");
    await this.waitUntil(async () => {
      const got = (await sub.locator(NODE_MENU_ITEM).allInnerTexts()).map(oneLine);
      return JSON.stringify(got) === JSON.stringify(want);
    }, `the ${label} submenu to offer ${agents}`);
  },
);

const shaped = async (world: OlaiWorld, label: string, opens: boolean, said: string): Promise<void> => {
  const { trigger } = await submenuOf(world, label);
  await world.waitUntil(async () => ((await trigger.getAttribute("data-opens")) !== null) === opens, said);
  assert.ok((await trigger.getAttribute("data-action"))?.startsWith("chat:"), `${label} should be chat's`);
};

Then(
  "chat's {string} in the node menu opens a submenu",
  async function (this: OlaiWorld, label: string) {
    await shaped(this, label, true, `${label} to open a submenu`);
  },
);

Then(
  "chat's {string} in the node menu runs at once",
  async function (this: OlaiWorld, label: string) {
    await shaped(this, label, false, `${label} to run at once`);
  },
);

When(
  "I press Enter on {string} in the node menu's agents",
  async function (this: OlaiWorld, agent: string) {
    const item = this.page.locator(NODE_MENU_SUB).getByRole("menuitem", { name: agent, exact: true });
    await this.waitUntil(async () => await item.evaluate(el => el === document.activeElement || el.hasAttribute("data-highlighted")), `${agent} to have the caret`);
    await this.page.keyboard.press("Enter");
    await started(this);
  },
);
