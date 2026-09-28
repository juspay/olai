/**
 * CHAT'S ENTRIES ON A ROW'S `•••` — `Start an agent`, `Fresh start` and
 * `Close the agent` — driven where they are a SUBMENU.
 *
 * Chat hangs one entry per gesture (`../../src/browser/verbs.tsx`): the verb
 * itself when one agent can start, and a choice of agents, drawn by outlines as
 * a submenu, when several can. Opening the menu and choosing a top-level entry
 * are the outlines row's steps (`menu_steps.ts`); what is chat's is the
 * agent submenu and the conversation a start leaves behind.
 */
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

/** Chat's top-level entry on the open menu, by the words on it. */
const entry = async (world: OlaiWorld, label: string) => {
  const panel = world.page.locator(NODE_MENU_PANEL);
  await panel.waitFor({ state: "visible", timeout: POLL_TIMEOUT });
  return panel.locator(`${NODE_MENU_ITEM}[data-action^="chat:"]`).filter({ hasText: label }).first();
};

/** The agent submenu chat's `label` entry opened, waited for. */
const submenu = (world: OlaiWorld, label: string) =>
  world.page.locator(`${NODE_MENU_SUB}${attr("data-sub", label === "Start an agent" ? "chat:start-agent" : "chat:fresh-start")}`);

/** After a start: the conversation the row now folds open, or the menu's said
 *  line when the start was refused. The same wait the plain `Start an agent`
 *  entry has in `menu_steps.ts`, for the submenu's choices. */
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
    await this.press(await entry(this, label));
    await submenu(this, label).waitFor({ state: "visible", timeout: POLL_TIMEOUT });
  },
);

When(
  "I open the node menu's {string} agents with the keyboard",
  async function (this: OlaiWorld, label: string) {
    const trigger = await entry(this, label);
    await trigger.focus();
    await this.page.keyboard.press("ArrowRight");
    await submenu(this, label).waitFor({ state: "visible", timeout: POLL_TIMEOUT });
  },
);

/** The whole gesture: the entry, then one agent in its submenu. A choice that
 *  asks first (Fresh start) leaves the question up; `I confirm "…" in the node
 *  menu` answers it. */
When(
  "I choose {string} › {string} from the node menu",
  async function (this: OlaiWorld, label: string, agent: string) {
    const sub = submenu(this, label);
    if (!(await sub.isVisible())) {
      await this.press(await entry(this, label));
      await sub.waitFor({ state: "visible", timeout: POLL_TIMEOUT });
    }
    await this.press(sub.getByRole("menuitem", { name: agent, exact: true }));
    if (label === "Start an agent") await started(this);
  },
);

Then(
  "the node menu's {string} offers the agents {string}",
  async function (this: OlaiWorld, label: string, agents: string) {
    const sub = submenu(this, label);
    await sub.waitFor({ state: "visible", timeout: POLL_TIMEOUT });
    const want = agents.split("|");
    await this.waitUntil(async () => {
      const got = (await sub.locator(NODE_MENU_ITEM).allInnerTexts()).map(oneLine);
      return JSON.stringify(got) === JSON.stringify(want);
    }, `the ${label} submenu to offer ${agents}`);
  },
);

Then(
  "the node menu's {string} is a submenu",
  async function (this: OlaiWorld, label: string) {
    const trigger = await entry(this, label);
    await trigger.waitFor({ state: "visible", timeout: POLL_TIMEOUT });
    assert.equal(await trigger.getAttribute("data-opens"), "", `${label} should open a submenu`);
  },
);

Then(
  "the node menu's {string} is a plain entry",
  async function (this: OlaiWorld, label: string) {
    const trigger = await entry(this, label);
    await trigger.waitFor({ state: "visible", timeout: POLL_TIMEOUT });
    assert.equal(await trigger.getAttribute("data-opens"), null, `${label} should run at once`);
  },
);

/** The fold's standing or start pill after the submenu choice — the
 *  keyboard's Enter on a submenu row, which is what a person reaching it with
 *  the arrows presses. */
When(
  "I press Enter on {string} in the node menu's agents",
  async function (this: OlaiWorld, agent: string) {
    const item = this.page.locator(NODE_MENU_SUB).getByRole("menuitem", { name: agent, exact: true });
    await this.waitUntil(async () => await item.evaluate(el => el === document.activeElement || el.hasAttribute("data-highlighted")), `${agent} to have the caret`);
    await this.page.keyboard.press("Enter");
    await started(this);
  },
);
