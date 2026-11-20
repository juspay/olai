import { TESTID } from "@olai/tests/harness/testids.ts";
import * as assert from "node:assert";
import { Given, Then, When } from "@olai/tests/harness/runner.ts";

import {
  attr,
  DOCUMENT_LINK,
  FILE_DIR,
  FILE_DIR_TOGGLE,
  FILE_GLYPH,
  HYDRATION_TIMEOUT,
  HYPERTEXT_LINK,
  oneLine,
  OUTLINE_LINK,
  OUTLINE_LIST,
  OUTLINE_TREE,
  PANE,
  POLL_TIMEOUT,
  RAIL_DOCS,
  RAIL_OUTLINES,
} from "@olai/tests/harness/world.ts";
import type { OlaiWorld } from "@olai/tests/harness/world.ts";

const folderSelector = (path: string): string =>
  `${FILE_DIR}${attr("data-path", path)}`;

const folderToggle = (world: OlaiWorld, path: string) =>
  world.page.locator(`${FILE_DIR_TOGGLE}${attr("data-path", path)}`).first();

Then("the outline list is shown", async function (this: OlaiWorld) {
  await this.page
    .locator(OUTLINE_LIST)
    .waitFor({ state: "visible", timeout: HYDRATION_TIMEOUT });
});

Then("no outline list is shown", async function (this: OlaiWorld) {
  assert.strictEqual(
    await this.page.locator(OUTLINE_LIST).count(),
    0,
    "the sidebar is on screen; an invalid set shows the error view INSTEAD of it",
  );
});

Then(
  "the outline list has {int} entries",
  async function (this: OlaiWorld, expected: number) {
    await this.showSidebar();
    const links = this.page.locator(`${OUTLINE_LIST} ${OUTLINE_LINK}`);
    await this.page.getByTestId(TESTID.sidebarFiles).waitFor({ state: "visible", timeout: HYDRATION_TIMEOUT });
    await this.page.locator(OUTLINE_LIST).waitFor({ state: "attached", timeout: HYDRATION_TIMEOUT });
    const files = await links.evaluateAll((nodes) =>
      nodes.map((node) => node.getAttribute("data-file")),
    );
    assert.strictEqual(
      files.length,
      expected,
      `expected ${expected} outline(s) in the sidebar, found ${files.length}: ${files.join(", ")}`,
    );
  },
);

Then(
  "the outline list links to {string}",
  async function (this: OlaiWorld, file: string) {
    await this.showSidebar();
    await this.outlineLink(file).waitFor({
      state: "visible",
      timeout: HYDRATION_TIMEOUT,
    });
  },
);

Then(
  "the outline list does not link to {string}",
  async function (this: OlaiWorld, file: string) {
    await this.showSidebar();
    await this.waitUntil(
      async () => (await this.outlineLink(file).count()) === 0,
      `the sidebar to stop linking to "${file}", which is not an outline`,
    );
  },
);

Then(
  "the sidebar marks the outline {string} as the one open",
  async function (this: OlaiWorld, file: string) {
    await this.showSidebar();
    const entry = this.outlineLink(file);
    await entry.waitFor({ state: "visible", timeout: HYDRATION_TIMEOUT });
    await this.waitUntil(
      async () => (await entry.getAttribute("aria-current")) === "page",
      `the sidebar entry for ${file} to be the one marked as open`,
    );
  },
);

const treeOf = (world: OlaiWorld, file: string) =>
  world.frontLane()
    .locator(`${PANE}[data-pane-focused="true"]${attr("data-drawn-file", file)} ${attr("aria-busy", "false")} ${OUTLINE_TREE}`)
    .first();

When(
  "I click the outline {string}",
  async function (this: OlaiWorld, file: string) {
    await this.showSidebar();
    const link = this.outlineLink(file);
    await link.waitFor({ state: "visible", timeout: HYDRATION_TIMEOUT });
    await link.click();
    await treeOf(this, file).waitFor({
      state: "visible",
      timeout: POLL_TIMEOUT,
    });
  },
);

Then(
  "the focused pane is drawing the outline {string}",
  async function (this: OlaiWorld, file: string) {
    await this.frontLane()
      .locator(`${PANE}[data-pane-focused="true"]${attr("data-drawn-file", file)}`)
      .first()
      .waitFor({ state: "visible", timeout: POLL_TIMEOUT });
  },
);

Then(
  "pane {int} is drawing the outline {string}",
  async function (this: OlaiWorld, index: number, file: string) {
    await this.frontLane()
      .locator(`${PANE}${attr("data-pane", String(index))}${attr("data-drawn-file", file)}`)
      .first()
      .waitFor({ state: "visible", timeout: POLL_TIMEOUT });
  },
);

Given(
  "I open the outline {string}",
  async function (this: OlaiWorld, file: string) {
    await this.open("/");
    await this.showSidebar();
    const link = this.outlineLink(file);
    await link.waitFor({ state: "visible", timeout: HYDRATION_TIMEOUT });
    await link.click();
    await treeOf(this, file).waitFor({
      state: "visible",
      timeout: POLL_TIMEOUT,
    });
  },
);

Then(
  "the file tree shows the folder {string}",
  async function (this: OlaiWorld, path: string) {
    await this.showSidebar();
    await this.fileDir(path).waitFor({
      state: "visible",
      timeout: HYDRATION_TIMEOUT,
    });
  },
);

Then(
  "the file tree does not show the folder {string}",
  async function (this: OlaiWorld, path: string) {
    await this.showSidebar();
    await this.page
      .locator(OUTLINE_LIST)
      .waitFor({ state: "visible", timeout: HYDRATION_TIMEOUT });
    assert.strictEqual(
      await this.fileDir(path).count(),
      0,
      `the file tree draws the folder "${path}"`,
    );
  },
);

Then(
  "the folder {string} is expanded",
  async function (this: OlaiWorld, path: string) {
    await this.expectChromeAttribute(
      folderSelector(path),
      "data-collapsed",
      "false",
      `the folder "${path}"`,
    );
  },
);

Then(
  "the folder {string} is collapsed",
  async function (this: OlaiWorld, path: string) {
    await this.expectChromeAttribute(
      folderSelector(path),
      "data-collapsed",
      "true",
      `the folder "${path}"`,
    );
  },
);

When(
  "I collapse the folder {string}",
  async function (this: OlaiWorld, path: string) {
    await this.showSidebar();
    const folder = this.fileDir(path);
    if (await folder.count() === 0) await this.expandReference();
    await folder.waitFor({ state: "visible", timeout: HYDRATION_TIMEOUT });
    if ((await folder.getAttribute("data-collapsed")) === "true") return;
    await folderToggle(this, path).click();
    await this.expectChromeAttribute(
      folderSelector(path),
      "data-collapsed",
      "true",
      `the folder "${path}"`,
    );
  },
);

When(
  "I expand the folder {string}",
  async function (this: OlaiWorld, path: string) {
    await this.showSidebar();
    const folder = this.fileDir(path);
    if (await folder.count() === 0) await this.expandReference();
    await folder.waitFor({ state: "visible", timeout: HYDRATION_TIMEOUT });
    if ((await folder.getAttribute("data-collapsed")) === "false") return;
    await folderToggle(this, path).click();
    await this.expectChromeAttribute(
      folderSelector(path),
      "data-collapsed",
      "false",
      `the folder "${path}"`,
    );
  },
);

Then(
  "the document link {string} is shown",
  async function (this: OlaiWorld, file: string) {
    await this.showSidebar();
    await this.documentLink(file).waitFor({
      state: "visible",
      timeout: HYDRATION_TIMEOUT,
    });
  },
);

Then(
  "the document link {string} is hidden",
  async function (this: OlaiWorld, file: string) {
    await this.showSidebar();
    assert.strictEqual(
      await this.page.locator(`${DOCUMENT_LINK}${attr("data-file", file)}`).count(),
      0,
      `the document "${file}" is still in the tree after its folder collapsed`,
    );
  },
);

Then(
  "the document link {string} reads {string}",
  async function (this: OlaiWorld, file: string, label: string) {
    await this.showSidebar();
    const link = this.documentLink(file);
    await link.waitFor({ state: "visible", timeout: HYDRATION_TIMEOUT });
    assert.strictEqual(
      oneLine(await link.innerText()),
      label,
      `the document "${file}" draws ${JSON.stringify(oneLine(await link.innerText()))}, not the basename ${JSON.stringify(label)}`,
    );
  },
);

Then(
  "the outline link {string} reads {string}",
  async function (this: OlaiWorld, file: string, label: string) {
    await this.showSidebar();
    const link = this.outlineLink(file);
    await link.waitFor({ state: "visible", timeout: HYDRATION_TIMEOUT });
    assert.strictEqual(
      oneLine(await link.innerText()),
      label,
      `the outline "${file}" draws ${JSON.stringify(oneLine(await link.innerText()))}, not the basename ${JSON.stringify(label)}`,
    );
  },
);

const drawnAs = async (
  world: OlaiWorld,
  testid: string,
  file: string,
  kind: string,
  what: string,
): Promise<void> => {
  await world.showSidebar();
  await world.expectChromeAttribute(
    `${testid}${attr("data-file", file)} ${FILE_GLYPH}`,
    "data-glyph",
    kind,
    `the ${what} "${file}"`,
    HYDRATION_TIMEOUT,
  );
};

When("I expand the reference section", async function(this: OlaiWorld) {
  await this.expandReference();
});
When("I collapse the reference section", async function(this: OlaiWorld) {
  const toggle = this.page.getByTestId(TESTID.referenceToggle);
  if (await toggle.getAttribute("aria-expanded") === "true") await toggle.click();
});
Then("the reference section is {word}", async function(this: OlaiWorld, state: string) {
  assert.ok(state === "expanded" || state === "collapsed");
  await this.expectChromeAttribute(attr("data-testid", TESTID.referenceToggle), "aria-expanded", String(state === "expanded"), "Reference");
});
Then("the reference section lists {int} files", async function(this: OlaiWorld, count: number) {
  await this.expectChromeAttribute(attr("data-testid", TESTID.reference), "data-count", String(count), "Reference file count");
});
Then("there is no reference section", async function(this: OlaiWorld) {
  await this.page.getByTestId(TESTID.reference).waitFor({ state: "detached", timeout: HYDRATION_TIMEOUT });
});
Then("the outline tree omits the folder {string}", async function(this: OlaiWorld, folder: string) {
  assert.equal(await this.page.locator(`${OUTLINE_LIST} ${FILE_DIR}${attr("data-path", folder)}`).count(), 0);
});
Then("the folder {string} appears in both sidebar trees", async function(this: OlaiWorld, path: string) {
  for (const list of [OUTLINE_LIST, attr("data-testid", TESTID.referenceList)]) {
    await this.page.locator(`${list} ${FILE_DIR}${attr("data-path", path)}`).waitFor({ state: "visible", timeout: HYDRATION_TIMEOUT });
  }
});
Then("Reference marks {string} as the open file", async function(this: OlaiWorld, file: string) {
  await this.expectChromeAttribute(`${attr("data-testid", TESTID.referenceList)} ${DOCUMENT_LINK}${attr("data-file", file)}`, "aria-current", "page", "the selected Reference row");
});

Then("Reference has no stored fold preference", async function(this: OlaiWorld) {
  assert.equal(await this.stored("olai.sidebar.reference"), null);
});
Then("Reference has its own open preference", async function(this: OlaiWorld) {
  assert.equal(await this.stored("olai.sidebar.reference"), "true");
  assert.notEqual(await this.stored("olai.sidebar.folders"), "true");
});
