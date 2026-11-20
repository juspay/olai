import { TESTID } from "@olai/tests/harness/testids.ts"
import * as assert from "node:assert";
import * as fs from "node:fs";
import * as path from "node:path";

import { Then, When } from "@olai/tests/harness/runner.ts";

import { selector } from "@olai/web/testlib"
import { type Making, MAKING_DOCUMENT, MAKING_OUTLINE } from "../../src/file/making.ts"

import { saysThat } from "@olai/tests/harness/said.ts";
import { keysSettled } from "@olai/tests/harness/settling.ts";
import { HYDRATION_TIMEOUT, POLL_TIMEOUT, SIDEBAR } from "@olai/tests/harness/world.ts";
import type { OlaiWorld } from "@olai/tests/harness/world.ts";

const making = (kind: string): Making => {
  if (kind === "outline") return MAKING_OUTLINE("outline-olai");
  if (kind === "document") return MAKING_DOCUMENT("markdown");
  throw new Error(`there is no sidebar door for a new ${kind}`);
};

const PLUS = selector(TESTID.newFile);
const MENU = selector(TESTID.newFileMenu);

const openNewMenu = async (world: OlaiWorld): Promise<void> => {
  await world.showSidebar();
  const plus = world.page.locator(PLUS);
  await plus.waitFor({ state: "visible", timeout: HYDRATION_TIMEOUT });
  if ((await world.page.locator(MENU).count()) === 0) await plus.click();
  await world.page.locator(MENU).waitFor({ state: "visible", timeout: POLL_TIMEOUT });
};

const pickFromNewMenu = async (world: OlaiWorld, door: Making): Promise<void> => {
  await openNewMenu(world);
  await world.page.locator(`${MENU} ${selector(door.testids.open)}`).click();
};

When("I open the Outlines + menu", async function (this: OlaiWorld) {
  await openNewMenu(this);
});

When("I open the Outlines + menu from the keyboard", async function (this: OlaiWorld) {
  await this.showSidebar();
  const plus = this.page.locator(PLUS);
  await plus.waitFor({ state: "visible", timeout: HYDRATION_TIMEOUT });
  await plus.focus();
  await this.page.keyboard.press("Enter");
  await this.page.locator(MENU).waitFor({ state: "visible", timeout: POLL_TIMEOUT });
});

Then("the Outlines + menu offers {string}", async function (this: OlaiWorld, labels: string) {
  const items = this.page.locator(MENU).getByRole("menuitem");
  await this.waitUntil(
    async () => (await items.allInnerTexts()).map((one) => one.trim()).join("|") === labels,
    `the + menu to offer ${labels}`,
  );
});

When("I choose {string} from the Outlines + menu with the keyboard", async function (this: OlaiWorld, label: string) {
  const item = this.page.locator(MENU).getByRole("menuitem", { name: label, exact: true });
  await item.waitFor({ state: "visible", timeout: POLL_TIMEOUT });
  for (let step = 0; step < 4 && !(await item.evaluate((el) => el.hasAttribute("data-highlighted"))); step++) {
    await this.page.keyboard.press("ArrowDown");
  }
  await this.page.keyboard.press("Enter");
});

Then("the Outlines + menu is shut and the + has focus", async function (this: OlaiWorld) {
  await this.page.locator(MENU).waitFor({ state: "detached", timeout: POLL_TIMEOUT });
  await this.waitUntil(
    async () => await this.page.locator(PLUS).evaluate((el) => document.activeElement === el),
    "focus to return to the Outlines +",
  );
  assert.strictEqual(await this.page.locator(PLUS).getAttribute("aria-expanded"), "false");
});

Then("the new {word} box has the caret", async function (this: OlaiWorld, kind: string) {
  const path = selector(making(kind).testids.path);
  await this.page.locator(path).waitFor({ state: "visible", timeout: POLL_TIMEOUT });
  await this.waitUntil(
    async () => await this.page.locator(path).evaluate((el) => document.activeElement === el),
    `the caret to be in the new ${kind} box`,
  );
});

Then("the Outlines heading offers no +", async function (this: OlaiWorld) {
  await this.showSidebar();
  await this.page.getByTestId(TESTID.sidebarFiles).waitFor({ state: "visible", timeout: HYDRATION_TIMEOUT });
  await this.waitUntil(async () => (await this.page.locator(PLUS).count()) === 0, "the Outlines + to be withdrawn");
});

const boxOf = async (world: OlaiWorld, kind: string) => {
  const door = making(kind);
  await world.showSidebar();
  const path = selector(door.testids.path);
  if ((await world.page.locator(path).count()) === 0) {
    await pickFromNewMenu(world, door);
  }
  const box = world.page.locator(path);
  await box.waitFor({ state: "visible", timeout: POLL_TIMEOUT });
  return box;
};

When(
  "I open the new {word} box",
  async function (this: OlaiWorld, kind: string) {
    await boxOf(this, kind);
  },
);

When(
  "I fill the new {word} box with {string}",
  async function (this: OlaiWorld, kind: string, file: string) {
    await (await boxOf(this, kind)).fill(file);
  },
);

When(
  "I submit the new {word} box while updates are delayed",
  async function (this: OlaiWorld, kind: string) {
    await this.page.locator(selector(making(kind).testids.path)).press("Enter");
  },
);

Then("the file {string} has not been created", function (this: OlaiWorld, file: string) {
  assert.strictEqual(fs.existsSync(path.join(this.scratch(), file)), false);
});

Then("the file {string} has been created", async function (this: OlaiWorld, file: string) {
  await this.waitUntil(async () => fs.existsSync(path.join(this.scratch(), file)), `${file} to exist`);
});

When("I follow the outline {string} while updates are delayed", async function (this: OlaiWorld, file: string) {
  await this.outlineLink(file).click();
});

Then("the new {word} box is ready", async function (this: OlaiWorld, kind: string) {
  await this.expectChromeAttribute(selector(making(kind).testids.path), "aria-busy", "false", `new ${kind} box`);
});

Then("the arriving document editor leaves the new document box focused", async function (this: OlaiWorld) {
  await this.page.locator(selector(TESTID.documentEditor)).waitFor({ state: "visible", timeout: POLL_TIMEOUT });
  assert.strictEqual(await this.page.locator(selector(MAKING_DOCUMENT("markdown").testids.path)).evaluate(
    (box) => document.activeElement === box,
  ), true, "a delayed document body must not take focus from the next filename");
});

Then("the new {word} box has no refusal", async function (this: OlaiWorld, kind: string) {
  assert.strictEqual(await this.page.locator(selector(making(kind).testids.said)).count(), 0);
});

When(
  "I create the {word} {string} from the sidebar",
  async function (this: OlaiWorld, kind: string, file: string) {
    const box = await boxOf(this, kind);
    await box.fill(file);
    await box.press("Enter");
    await keysSettled(this);
  },
);

Then(
  "the {word} creation is refused saying {string}",
  async function (this: OlaiWorld, kind: string, said: string) {
    await saysThat(
      this,
      selector(making(kind).testids.said),
      said,
      `refusal under the new ${kind} box`,
      "alarm",
      this.page,
    );
  },
);

Then(
  "the new {word} box still holds {string}",
  async function (this: OlaiWorld, kind: string, file: string) {
    const box = this.page.locator(selector(making(kind).testids.path));
    await box.waitFor({ state: "visible", timeout: POLL_TIMEOUT });
    assert.strictEqual(await box.inputValue(), file, `the new ${kind} box`);
  },
);

Then(
  "the sidebar is open with the new {word} box in it",
  async function (this: OlaiWorld, kind: string) {
    const sidebar = this.page.locator(SIDEBAR);
    await sidebar.waitFor({ state: "visible", timeout: POLL_TIMEOUT });
    assert.strictEqual(await sidebar.getAttribute("data-open"), "true", "the sidebar is drawn shut");
    await sidebar
      .locator(selector(making(kind).testids.path))
      .waitFor({ state: "visible", timeout: POLL_TIMEOUT });
  },
);

Then(
  "the new {word} box is gone",
  async function (this: OlaiWorld, kind: string) {
    const path = selector(making(kind).testids.path);
    await this.waitUntil(
      async () => (await this.page.locator(path).count()) === 0,
      `the new ${kind} box to be put away`,
    );
  },
);

Then(
  "the new {word} box asks for a Done key and no corrections",
  async function (this: OlaiWorld, kind: string) {
    const box = this.page.locator(selector(making(kind).testids.path));
    await box.waitFor({ state: "visible", timeout: POLL_TIMEOUT });
    assert.strictEqual(await box.getAttribute("enterkeyhint"), "done", `the new ${kind} box's enterkeyhint`);
    assert.strictEqual(await box.getAttribute("inputmode"), null, `the new ${kind} box asks for no special keyboard`);
    assert.strictEqual(await box.getAttribute("autocapitalize"), "none", `the new ${kind} box's autocapitalize`);
    assert.strictEqual(await box.getAttribute("autocorrect"), "off", `the new ${kind} box's autocorrect`);
    assert.strictEqual(await box.getAttribute("spellcheck"), "false", `the new ${kind} box's spellcheck`);
  },
);
