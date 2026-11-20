import * as assert from "node:assert";
import { Then, When } from "@olai/tests/harness/runner.ts";

import { SIDEBAR_WIDTH_KEY } from "../../src/layout/prefs.ts";
import { retypedAndTaken } from "@olai/tests/harness/atonce.ts";
import { countsNothing, expectExactCount } from "@olai/tests/harness/counted.ts";
import { keysSettled, pressed } from "@olai/tests/harness/settling.ts";
import { answered } from "@olai/tests/harness/shortlist.ts";
import {
  APP_CHROME,
  APP_HEADER,
  attr,
  HEADER_SEARCH_RESULTS,
  HYDRATION_TIMEOUT,
  OUTLINE_TREE,
  POLL_TIMEOUT,
  SEARCH_COUNT,
  SIDEBAR,
  SIDEBAR_BODY,
  SIDEBAR_COLLAPSE,
  SIDEBAR_EXPAND,
  SIDEBAR_RAIL,
  SIDEBAR_RESIZE,
  SIDEBAR_SCRIM,
  SHORTCUTS,
  SIDEBAR_TOGGLE,
} from "@olai/tests/harness/world.ts";
import type { OlaiWorld } from "@olai/tests/harness/world.ts";

const HEADER_SEARCH = `[data-testid="header-search"]`;
const HEADER_SEARCH_ITEM = `[data-testid="header-search-item"]`;
const HEADER_SEARCH_ITEM_PROP = `[data-testid="header-search-item-prop"]`;

Then("the sidebar is open on desktop", async function (this: OlaiWorld) {
  await this.page
    .locator(SIDEBAR_BODY)
    .waitFor({ state: "visible", timeout: HYDRATION_TIMEOUT });
  assert.strictEqual(
    await this.page.locator(SIDEBAR_RAIL).isVisible(),
    false,
    "the icon rail is showing while the full sidebar should be open",
  );
});

When("I collapse the sidebar", async function (this: OlaiWorld) {
  await this.page.locator(SIDEBAR_COLLAPSE).click();
  await this.page
    .locator(SIDEBAR_RAIL)
    .waitFor({ state: "visible", timeout: POLL_TIMEOUT });
});

Then("the sidebar rail is showing", async function (this: OlaiWorld) {
  await this.page
    .locator(SIDEBAR_RAIL)
    .waitFor({ state: "visible", timeout: HYDRATION_TIMEOUT });
  assert.strictEqual(
    await this.page.locator(SIDEBAR_BODY).isVisible(),
    false,
    "the full sidebar body is still visible beside the rail",
  );
});

Then(
  "the outline {string} is still on screen",
  async function (this: OlaiWorld, _file: string) {
    await this.frontLane()
      .locator(OUTLINE_TREE)
      .waitFor({ state: "visible", timeout: HYDRATION_TIMEOUT });
  },
);

When("I expand the sidebar from the rail", async function (this: OlaiWorld) {
  await this.page.locator(SIDEBAR_EXPAND).click();
  await this.page
    .locator(SIDEBAR_BODY)
    .waitFor({ state: "visible", timeout: POLL_TIMEOUT });
});

When("I drag the sidebar wider by {int}px", async function (this: OlaiWorld, dx: number) {
  const handle = this.page.locator(SIDEBAR_RESIZE);
  await handle.waitFor({ state: "visible", timeout: HYDRATION_TIMEOUT });
  const before = await this.page.locator(SIDEBAR).boundingBox();
  assert.ok(before !== null, "sidebar has no box before the drag");
  this.attach(String(before.width), "text/plain");
  await this.page.evaluate((w) => {
    (window as unknown as { __olaiSideBefore?: number }).__olaiSideBefore = w;
  }, before.width);

  const box = await handle.boundingBox();
  assert.ok(box !== null, "resize handle has no box");
  const x = box.x + box.width / 2;
  const y = box.y + box.height / 2;
  await this.page.mouse.move(x, y);
  await this.page.mouse.down();
  await this.page.mouse.move(x + dx, y, { steps: 8 });
  await this.page.mouse.up();
  await this.waitForFrame();
});

Then(
  "the sidebar is at least {int}px wider than the default",
  async function (this: OlaiWorld, minGain: number) {
    const after = await this.page.locator(SIDEBAR).boundingBox();
    assert.ok(after !== null, "sidebar has no box after the drag");
    const before = await this.page.evaluate(
      () => (window as unknown as { __olaiSideBefore?: number }).__olaiSideBefore,
    );
    assert.ok(typeof before === "number", "no width recorded before the drag");
    assert.ok(
      after.width >= before + minGain - 1,
      `sidebar grew by ${Math.round(after.width - before)}px, wanted ≥${minGain}`,
    );
  },
);

Then("the sidebar width survived the reload", async function (this: OlaiWorld) {
  const stored = await this.stored(SIDEBAR_WIDTH_KEY);
  assert.ok(stored !== null, "sidebar width was not persisted");
  const px = Number(stored);
  assert.ok(Number.isFinite(px), `stored width is not a number: ${stored}`);
  const box = await this.page.locator(SIDEBAR).boundingBox();
  assert.ok(box !== null, "sidebar has no box after reload");
  assert.ok(
    Math.abs(box.width - px) <= 2,
    `sidebar is ${Math.round(box.width)}px after reload, stored ${px}`,
  );
});

When("I press the sidebar shortcut", async function (this: OlaiWorld) {
  await pressed(this, "ControlOrMeta+\\");
});

const headerBox = async (world: OlaiWorld) => {
  const box = world.page.locator(HEADER_SEARCH);
  await box.waitFor({ state: "visible", timeout: HYDRATION_TIMEOUT });
  return box;
};

Then("the header has no search box", async function (this: OlaiWorld) {
  await this.waitForFrame();
  const header = this.page.locator(APP_HEADER);
  await header
    .locator(APP_CHROME)
    .waitFor({ state: "visible", timeout: POLL_TIMEOUT });
  await header.locator(HEADER_SEARCH).waitFor({ state: "detached", timeout: POLL_TIMEOUT });
  assert.equal(
    await header.locator(HEADER_SEARCH).count(),
    0,
    "the search box is still in the header of a serve that did not mount the row",
  );
});

When(
  "I search the header for {string}",
  async function (this: OlaiWorld, text: string) {
    const box = await headerBox(this);
    await box.click();
    await box.type(text);
  },
);

When(
  "I retype the header search as {string} and press Enter at once",
  async function (this: OlaiWorld, text: string) {
    await retypedAndTaken(this, await headerBox(this), text);
  },
);

When("I take a letter off the header search", async function (this: OlaiWorld) {
  const box = await headerBox(this);
  await box.click();
  await box.press("Backspace");
  await keysSettled(this);
});

Then(
  "the header search lists the node {string}",
  async function (this: OlaiWorld, title: string) {
    await answered(
      this,
      HEADER_SEARCH_RESULTS,
      await (await headerBox(this)).inputValue(),
    );
    await this.page
      .locator(HEADER_SEARCH_ITEM)
      .filter({ hasText: title })
      .first()
      .waitFor({ state: "visible", timeout: POLL_TIMEOUT });
  },
);

Then(
  "the header search does not list the node {string}",
  async function (this: OlaiWorld, title: string) {
    await answered(
      this,
      HEADER_SEARCH_RESULTS,
      await (await headerBox(this)).inputValue(),
    );
    assert.strictEqual(
      await this.page.locator(HEADER_SEARCH_ITEM).filter({ hasText: title }).count(),
      0,
      `the header search lists ${JSON.stringify(title)}, and this step says it does not`,
    );
  },
);

const documentRow = (world: OlaiWorld, file: string) =>
  world.page.locator(`${HEADER_SEARCH_ITEM}${attr("data-id", `hit-${file}`)}`);

Then(
  "the header search lists the document {string}",
  async function (this: OlaiWorld, file: string) {
    await answered(
      this,
      HEADER_SEARCH_RESULTS,
      await (await headerBox(this)).inputValue(),
    );
    await documentRow(this, file)
      .waitFor({ state: "visible", timeout: POLL_TIMEOUT });
  },
);

Then(
  "the header search found {string}",
  async function (this: OlaiWorld, said: string) {
    await expectExactCount(
      this,
      `${HEADER_SEARCH_RESULTS} ${SEARCH_COUNT}`,
      said,
      "header search count",
    );
  },
);

Then(
  "the header search says nothing about a total",
  async function (this: OlaiWorld) {
    await countsNothing(
      this,
      `${HEADER_SEARCH_RESULTS} ${SEARCH_COUNT}`,
      "header search",
    );
  },
);

const searchRowProp = (
  world: OlaiWorld,
  title: string,
  key: string,
) =>
  world.page
    .locator(HEADER_SEARCH_ITEM)
    .filter({ hasText: title })
    .first()
    .locator(`${HEADER_SEARCH_ITEM_PROP}${attr("data-key", key)}`);

Then(
  "the header search result for the document {string} is called {string}",
  async function (this: OlaiWorld, file: string, title: string) {
    const row = documentRow(this, file);
    await row.waitFor({ state: "visible", timeout: POLL_TIMEOUT });
    assert.equal((await row.innerText()).split("\n")[0]?.trim(), title);
  },
);

Then(
  "the header search result {string} shows the property {string} holding {string}",
  async function (this: OlaiWorld, title: string, key: string, value: string) {
    const prop = searchRowProp(this, title, key);
    await prop.waitFor({ state: "visible", timeout: POLL_TIMEOUT });
    assert.equal((await prop.innerText()).trim(), `${key} ${value}`);
  },
);

Then(
  "the header search result {string} marks {string} as why it matched",
  async function (this: OlaiWorld, title: string, key: string) {
    const prop = searchRowProp(this, title, key);
    await prop.waitFor({ state: "visible", timeout: POLL_TIMEOUT });
    assert.equal(
      await prop.getAttribute("data-matched"),
      "true",
      `"${key}" is drawn on the row for "${title}" but not as the reason it is there`,
    );
    const first = this.page
      .locator(HEADER_SEARCH_ITEM)
      .filter({ hasText: title })
      .first()
      .locator(HEADER_SEARCH_ITEM_PROP)
      .first();
    assert.equal(await first.getAttribute("data-key"), key);
  },
);

When(
  "I press the header search result {string}",
  async function (this: OlaiWorld, title: string) {
    await this.page
      .locator(HEADER_SEARCH_ITEM)
      .filter({ hasText: title })
      .first()
      .click();
    await this.waitForFrame();
  },
);

Then(
  "the directory drawer is open with a scrim",
  async function (this: OlaiWorld) {
    await this.page
      .locator(SIDEBAR_BODY)
      .waitFor({ state: "visible", timeout: HYDRATION_TIMEOUT });
    await this.page
      .locator(SIDEBAR_SCRIM)
      .waitFor({ state: "visible", timeout: HYDRATION_TIMEOUT });

    const header = await this.box(this.page.locator(APP_HEADER), "header");
    const nav = await this.box(this.page.locator(SIDEBAR), "sidebar");
    const scrim = await this.box(this.page.locator(SIDEBAR_SCRIM), "scrim");
    const viewport = this.viewport();

    assert.ok(
      Math.abs(nav.y - (header.y + header.height)) <= 2,
      `drawer top is y=${Math.round(nav.y)}, header bottom is ${Math.round(header.y + header.height)} — relative demotion used to land ~48px lower`,
    );
    assert.ok(
      nav.y + nav.height >= viewport.height - 2,
      `drawer bottom is ${Math.round(nav.y + nav.height)} on a ${viewport.height}px screen — last entries were clipped`,
    );
    assert.ok(
      scrim.y >= header.y + header.height - 1,
      `scrim starts at y=${Math.round(scrim.y)}, covering the header`,
    );
  },
);

Then(
  "the header chrome stays tappable over the drawer",
  async function (this: OlaiWorld) {
    const top = await this.topmostTestidOver(
      this.page.locator(SIDEBAR_TOGGLE),
      "the burger",
    );
    assert.strictEqual(
      top,
      "sidebar-toggle",
      `element at the burger is ${top}, not the burger — scrim is on top of the header`,
    );
  },
);

When("I tap the directory scrim", async function (this: OlaiWorld) {
  const viewport = this.viewport();
  await this.page.locator(SIDEBAR_SCRIM).click({
    position: { x: viewport.width - 8, y: Math.round(viewport.height / 3) },
  });
  await this.page
    .locator(SIDEBAR_BODY)
    .waitFor({ state: "hidden", timeout: POLL_TIMEOUT });
});
