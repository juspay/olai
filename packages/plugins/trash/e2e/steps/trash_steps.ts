import * as assert from "node:assert";
import { Then, When } from "@olai/tests/harness/runner.ts";

import {
  attr,
  expectAbsent,
  expectGone,
  oneLine,
  POLL_TIMEOUT,
  SIDEBAR_BODY,
  TRASH_LINK,
} from "@olai/tests/harness/world.ts";
import { selector } from "@olai/web/testlib";
import { TESTID } from "@olai/tests/harness/testids.ts";
import {
  RAIL_TRASH,
  TRASH_EMPTY,
  TRASH_EMPTY_CANCEL,
  TRASH_EMPTY_CONFIRM,
  TRASH_EMPTY_VERB,
  TRASH_PAGE,
  TRASH_PAGE_SAID,
  TRASH_PUT_BACK,
  TRASH_ROW,
  TRASH_SAID,
} from "../selectors.ts";
import type { OlaiWorld } from "@olai/tests/harness/world.ts";

const SIDEBAR_FOOT = selector(TESTID.sidebarFoot);

const trashRow = (id: string): string => `${TRASH_ROW}${attr("data-node-id", id)}`;

Then("the Trash door is pinned at the sidebar's foot", async function (this: OlaiWorld) {
  await this.showSidebar();
  const door = this.page.locator(`${SIDEBAR_FOOT} ${TRASH_LINK}`);
  await door.waitFor({ state: "visible", timeout: POLL_TIMEOUT });
  assert.strictEqual(await this.page.locator(`${SIDEBAR_BODY} ${TRASH_LINK}`).count(), 0, "the Trash scrolls with the list");
  const box = await door.boundingBox();
  const viewport = this.page.viewportSize();
  assert.ok(box !== null && viewport !== null && box.y + box.height <= viewport.height, "the Trash door is below the fold");
});

Then("the Trash door is at least a finger's size", async function (this: OlaiWorld) {
  const box = await this.page.locator(`${SIDEBAR_FOOT} ${TRASH_LINK}`).boundingBox();
  assert.ok(box !== null && box.height >= 44, `the Trash door is ${box?.height}px tall, under the 44px target`);
});

Then("the Trash door is the current page", async function (this: OlaiWorld) {
  await this.showSidebar();
  await this.expectChromeAttribute(TRASH_LINK, "aria-current", "page", "the Trash door");
});

When("I tap the Trash door", async function (this: OlaiWorld) {
  await this.press(this.page.locator(`${SIDEBAR_FOOT} ${TRASH_LINK}`), "tap");
  await this.page.locator(TRASH_PAGE).waitFor({ state: "visible", timeout: POLL_TIMEOUT });
});

When("I open the Trash from the rail", async function (this: OlaiWorld) {
  await this.page.locator(RAIL_TRASH).click();
  await this.page.locator(TRASH_PAGE).waitFor({ state: "visible", timeout: POLL_TIMEOUT });
});

When("I open the Trash", async function (this: OlaiWorld) {
  await this.showSidebar();
  await this.page.locator(TRASH_LINK).click();
  await this.page
    .locator(TRASH_PAGE)
    .waitFor({ state: "visible", timeout: POLL_TIMEOUT });
});

Then(
  "the Trash lists the node {string}",
  async function (this: OlaiWorld, id: string) {
    await this.page
      .locator(trashRow(id))
      .waitFor({ state: "visible", timeout: POLL_TIMEOUT });
  },
);

Then(
  "the Trash does not list the node {string}",
  async function (this: OlaiWorld, id: string) {
    await expectGone(
      this,
      trashRow(id),
      `"${id}" is in the Trash, and this step says it should not be drawn`,
    );
  },
);

Then(
  "the Trash row {string} is a match",
  async function (this: OlaiWorld, id: string) {
    await this.expectAttribute(trashRow(id), "data-match", "true", `row \`${id}\``);
  },
);

Then(
  "the Trash row {string} is context",
  async function (this: OlaiWorld, id: string) {
    await this.expectAttribute(trashRow(id), "data-match", "false", `row \`${id}\``);
  },
);

Then("the Trash is empty", async function (this: OlaiWorld) {
  await this.page
    .locator(TRASH_EMPTY)
    .waitFor({ state: "visible", timeout: POLL_TIMEOUT });
});
When(
  "I put back {string} from the Trash",
  async function (this: OlaiWorld, id: string) {
    const row = this.page.locator(trashRow(id)).first();
    await row.hover();
    await row
      .locator(TRASH_PUT_BACK)
      .first()
      .click();
    await this.waitForFrame();
  },
);

const titledRow = (world: OlaiWorld, title: string) =>
  world.page
    .locator(TRASH_ROW)
    .filter({ has: world.page.getByText(title, { exact: true }) })
    .last();

When(
  "I put back the row titled {string} from the Trash",
  async function (this: OlaiWorld, title: string) {
    const row = titledRow(this, title);
    await row.hover();
    await row.locator(TRASH_PUT_BACK).first().click();
    await this.waitForFrame();
  },
);

Then(
  "the Trash says under the row titled {string} that it is a signpost",
  async function (this: OlaiWorld, title: string) {
    const line = titledRow(this, title).locator(TRASH_SAID).first();
    await line.waitFor({ state: "visible", timeout: POLL_TIMEOUT });
    const text = oneLine(await line.innerText());
    assert.match(
      text,
      /is the title `trash` wrote above what was put away/,
      `the line under ${JSON.stringify(title)} reads ${JSON.stringify(text)}`,
    );
    assert.strictEqual(await line.getAttribute("data-tone"), "alarm");
  },
);

Then(
  "{string} holds one node titled {string}",
  async function (this: OlaiWorld, file: string, title: string) {
    await this.waitUntil(
      async () =>
        this.servedNodes(file).filter((node) => node["title"] === title).length === 1,
      `${file} to hold exactly one node titled ${JSON.stringify(title)}`,
    );
  },
);

Then(
  "the Trash under {string} says {string}",
  async function (this: OlaiWorld, id: string, text: string) {
    const line = this.page.locator(`${trashRow(id)} ${TRASH_SAID}`).first();
    await line.waitFor({ state: "visible", timeout: POLL_TIMEOUT });
    assert.strictEqual(oneLine(await line.innerText()), text);
    assert.strictEqual(
      await line.getAttribute("data-tone"),
      "alarm",
      "a refusal is an alarm",
    );
  },
);

Then(
  "the node {string} in {string} sits under {string}",
  async function (this: OlaiWorld, id: string, file: string, parent: string) {
    await this.waitUntil(
      async () =>
        this.servedNodes(file).some(
          (node) => node["id"] === id && node["parent"] === parent,
        ),
      `${file} to hold ${JSON.stringify(id)} under ${JSON.stringify(parent)}`,
    );
  },
);

const pressEmptyTrash = async (world: OlaiWorld): Promise<void> => {
  await world.page
    .locator(TRASH_EMPTY_VERB)
    .waitFor({ state: "visible", timeout: POLL_TIMEOUT });
  await world.page.locator(TRASH_EMPTY_VERB).click();
};

When("I press Empty trash", async function (this: OlaiWorld) {
  await pressEmptyTrash(this);
  await this.page
    .locator(TRASH_EMPTY_CONFIRM)
    .waitFor({ state: "visible", timeout: POLL_TIMEOUT });
});

When("I confirm emptying the Trash", async function (this: OlaiWorld) {
  await this.page
    .locator(TRASH_EMPTY_CONFIRM)
    .waitFor({ state: "visible", timeout: POLL_TIMEOUT });
  await pressEmptyTrash(this);
  await this.waitForFrame();
});

When("I confirm emptying the Trash while updates are delayed", async function (this: OlaiWorld) {
  await this.page.locator(TRASH_EMPTY_CONFIRM).waitFor({ state: "visible", timeout: POLL_TIMEOUT });
  await pressEmptyTrash(this);
});

Then("the Trash is not asking for confirmation", async function (this: OlaiWorld) {
  await expectGone(this, TRASH_EMPTY_CONFIRM, "the old Trash question is still shown");
});

When("I cancel emptying the Trash", async function (this: OlaiWorld) {
  await this.page.locator(TRASH_EMPTY_CANCEL).click();
  await expectGone(
    this,
    TRASH_EMPTY_CONFIRM,
    "the question is still up after Cancel",
  );
});

Then(
  "the Trash asks {string}",
  async function (this: OlaiWorld, text: string) {
    const line = this.page.locator(TRASH_EMPTY_CONFIRM).first();
    await line.waitFor({ state: "visible", timeout: POLL_TIMEOUT });
    assert.strictEqual(oneLine(await line.innerText()), text);
  },
);

Then("the Trash does not offer Empty trash", async function (this: OlaiWorld) {
  await expectAbsent(
    this,
    TRASH_PAGE,
    TRASH_EMPTY_VERB,
    "the Trash offers to empty itself over an archive that holds nothing",
  );
});

Then("the Trash offers Empty trash", async function (this: OlaiWorld) {
  await this.page
    .locator(TRASH_EMPTY_VERB)
    .waitFor({ state: "visible", timeout: POLL_TIMEOUT });
});

Then(
  "the Trash says {string}",
  async function (this: OlaiWorld, text: string) {
    const line = this.page.locator(TRASH_PAGE_SAID).first();
    await line.waitFor({ state: "visible", timeout: POLL_TIMEOUT });
    assert.strictEqual(oneLine(await line.innerText()), text);
    assert.strictEqual(
      await line.getAttribute("data-tone"),
      "alarm",
      "a refusal is an alarm",
    );
  },
);

Then(
  "{string} holds nothing",
  async function (this: OlaiWorld, file: string) {
    await this.waitUntil(
      async () => this.servedNodesSoFar(file).length === 0,
      `${file} to hold no records`,
    );
  },
);
