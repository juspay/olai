/**
 * Starting a FILE that does not exist yet — the sidebar's two path boxes.
 *
 * Two features are served from here, which is the same exception `menu_steps.ts`
 * makes and for the same reason: `document_editing.feature` and
 * `new_outline.feature` drive ONE control (`web/src/client/file/NewFile.tsx`),
 * and they were two copies of "open it, type a path, press Enter, read the
 * refusal" that differed in three constants. The client collapsed that copy
 * when the outline's door landed; a suite that kept it would be the same drift
 * one package over — and the drift that matters, since a step file is where a
 * promise is actually held.
 *
 * The KIND is a word in the step, and what it selects comes from the client's
 * own table (`file/making.ts`) rather than from a list restated here. That is
 * the arrangement this package already keeps for every `data-testid`: a
 * contract between two packages that never otherwise meet, imported so that a
 * rename is a type error rather than a thirty-second timeout.
 */
import { TESTID } from "@olai/tests/harness/testids.ts"
import * as assert from "node:assert";
import * as fs from "node:fs";
import * as path from "node:path";

import { Then, When } from "@olai/tests/harness/runner.ts";

import { selector } from "@olai/web/testlib"
// WHICH DOOR MINTS WHAT is the files row's, and so is the word for it. It was
// re-exported from `@olai/web/testlib`, which made a general package declare
// `olai-plugin-files` for three names about a plugin's own door — the equality
// `@olai/bundle`'s `fence.test.ts` holds per package. Asked of the door itself,
// a rename over there is a type error here rather than a bare timeout.
import { type Making, MAKING_DOCUMENT, MAKING_OUTLINE } from "../../src/file/making.ts"

import { saysThat } from "@olai/tests/harness/said.ts";
import { keysSettled } from "@olai/tests/harness/settling.ts";
import { HYDRATION_TIMEOUT, POLL_TIMEOUT, SIDEBAR } from "@olai/tests/harness/world.ts";
import type { OlaiWorld } from "@olai/tests/harness/world.ts";

/** Which door a scenario means. A throw rather than a default, because a
 *  scenario naming a third kind of file is a scenario about something that
 *  does not exist. */
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

/** By keyboard only: Tab lands on the `+` from the heading row before it, and
 *  Enter presses it — a real button, not a pointer-only glyph. */
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
  // Arrow to it rather than click: the menu is a keyboard surface too.
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

/** No kind can be started here, so there is no `+` at all — never a button
 *  that opens an empty menu. */
Then("the Outlines heading offers no +", async function (this: OlaiWorld) {
  await this.showSidebar();
  await this.page.getByTestId(TESTID.sidebarFiles).waitFor({ state: "visible", timeout: HYDRATION_TIMEOUT });
  await this.waitUntil(async () => (await this.page.locator(PLUS).count()) === 0, "the Outlines + to be withdrawn");
});

/** The box, opened and waited for. One spelling, because four steps start from
 *  it and a second "click, then wait" is where two of them would drift. It is
 *  idempotent: a box already open is one to type in, not one to reopen. */
const boxOf = async (world: OlaiWorld, kind: string) => {
  const door = making(kind);
  await world.showSidebar();
  const path = selector(door.testids.path);
  if ((await world.page.locator(path).count()) === 0) {
    // The way in is the Outlines heading's `+` and the kind's item in the
    // menu it opens (`../../src/NewMenu.tsx`).
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

/** Typed but NOT sent — for the scenario about backing out, whose whole claim
 *  is that a path in the box is not a write. */
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

/** The ops layer's own sentence about the path, in the ALARM mood — through
 *  the one ritual every said-line in this suite is read by (`support/said.ts`),
 *  which is also what holds the mood: a refusal drawn quietly is a write a
 *  reader believes landed. */
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

/** WHAT THE BOX STILL HOLDS after it has said something — the other half of a
 *  refusal that ends "type `notes` to make `notes.olai`". Advice about a name
 *  the box had thrown away would be advice nobody can take, and the retention
 *  is one uncleared signal in the client (`file/NewFile.tsx`), which is exactly
 *  the kind of thing that goes quietly. */
Then(
  "the new {word} box still holds {string}",
  async function (this: OlaiWorld, kind: string, file: string) {
    const box = this.page.locator(selector(making(kind).testids.path));
    await box.waitFor({ state: "visible", timeout: POLL_TIMEOUT });
    assert.strictEqual(await box.inputValue(), file, `the new ${kind} box`);
  },
);

/**
 * THE BOX A PAGE OPENED IS ONE A PERSON CAN SEE. An empty directory's `New
 * outline` is pressed on the page, and the box it opens is the files row's own,
 * drawn in the sidebar — so the sidebar has to come into view with it: the
 * column out of its rail on a desktop, the drawer on a phone. A box opened in a
 * shut drawer is a press that looked like it did nothing.
 */
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
