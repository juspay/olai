/**
 * The sidebar's file tree: what the served directory turned out to contain.
 */

import * as assert from "node:assert";
import { Given, Then, When } from "@cucumber/cucumber";

import {
  DOCUMENT_LINK,
  FILE_DIR,
  HYDRATION_TIMEOUT,
  NEW_OUTLINE,
  NEW_OUTLINE_PATH,
  NEW_OUTLINE_SAID,
  oneLine,
  OUTLINE_LINK,
  OUTLINE_LIST,
  OUTLINE_TREE,
  POLL_TIMEOUT,
} from "../support/world.ts";
import type { OlaiWorld } from "../support/world.ts";

/** One folder in the file tree, as a selector string `expectAttribute` takes. */
const folderSelector = (path: string): string =>
  `${FILE_DIR}[data-path="${path}"]`;

/** The fold button of ONE folder — a direct child of its `<li>`, not a
 *  descendant's. Nested folders nest their `li`s, so an unscoped
 *  `FILE_DIR_TOGGLE` under a parent would match every toggle inside it. */
const folderToggle = (world: OlaiWorld, path: string) =>
  world.fileDir(path).locator(":scope > button");

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
    const links = this.page.locator(`${OUTLINE_LIST} ${OUTLINE_LINK}`);
    // Wait for the expected count rather than reading it once: the list is
    // painted from the first snapshot, and reading during the frame that adds
    // the second entry would see one.
    await links
      .nth(expected - 1)
      .waitFor({ state: "attached", timeout: HYDRATION_TIMEOUT });
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
    assert.strictEqual(
      await this.outlineLink(file).count(),
      0,
      `the sidebar links to "${file}", which is not an outline`,
    );
  },
);

Given(
  "I open the outline {string}",
  async function (this: OlaiWorld, file: string) {
    await this.open("/");
    // On a phone the list is behind the burger; on a laptop this does nothing.
    await this.showSidebar();
    const link = this.outlineLink(file);
    await link.waitFor({ state: "visible", timeout: HYDRATION_TIMEOUT });
    await link.click();
    // The tree is the app's answer to the click; waiting for it here means
    // every later step starts from a rendered outline rather than racing it.
    await this.page
      .locator(OUTLINE_TREE)
      .waitFor({ state: "visible", timeout: POLL_TIMEOUT });
    await this.waitForFrame();
  },
);

// ── folders in the file tree ───────────────────────────────────────────

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
  "the folder {string} is expanded",
  async function (this: OlaiWorld, path: string) {
    await this.expectAttribute(
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
    await this.expectAttribute(
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
    await folder.waitFor({ state: "visible", timeout: HYDRATION_TIMEOUT });
    if ((await folder.getAttribute("data-collapsed")) === "true") return;
    await folderToggle(this, path).click();
    await this.expectAttribute(
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
    await folder.waitFor({ state: "visible", timeout: HYDRATION_TIMEOUT });
    if ((await folder.getAttribute("data-collapsed")) === "false") return;
    await folderToggle(this, path).click();
    await this.expectAttribute(
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
    // Collapsed children are not drawn, so the link is gone rather than
    // merely display:none — the same contract a collapsed outline node has
    // for its children.
    assert.strictEqual(
      await this.page.locator(`${DOCUMENT_LINK}[data-file="${file}"]`).count(),
      0,
      `the document "${file}" is still in the tree after its folder collapsed`,
    );
  },
);

// ── leaf labels — the visible point of the file tree ───────────────────
//
// `data-file` carries the full path by design (routes, broken marks, tests
// that open a file). The label the reader SEES is the basename. Asserting
// only on `data-file` would pass if every nested entry drew the wrapped
// path string this tree exists to remove.

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

// ── starting an outline that does not exist yet ────────────────────────
//
// The tree is what it adds to, so the steps for it are here rather than in a
// file of their own: `+ New outline` is an entry arriving in this list, and
// what the scenarios claim is that the entry came from a FILE the ops layer
// minted rather than from anything a browser drew for itself.

/** The box, opened and waited for. One spelling, because three steps start
 *  from it and a second "click, then wait" is where two of them would drift. */
const outlineBox = async (world: OlaiWorld) => {
  await world.showSidebar();
  const open = world.page.locator(NEW_OUTLINE);
  if ((await world.page.locator(NEW_OUTLINE_PATH).count()) === 0) {
    await open.waitFor({ state: "visible", timeout: HYDRATION_TIMEOUT });
    await open.click();
  }
  const box = world.page.locator(NEW_OUTLINE_PATH);
  await box.waitFor({ state: "visible", timeout: POLL_TIMEOUT });
  return box;
};

When("I open the new outline box", async function (this: OlaiWorld) {
  await outlineBox(this);
});

/** Typed but NOT sent — for the scenario about backing out, whose whole claim
 *  is that a path in the box is not a write. */
When(
  "I fill the new outline box with {string}",
  async function (this: OlaiWorld, file: string) {
    await (await outlineBox(this)).fill(file);
  },
);

When(
  "I create the outline {string} from the sidebar",
  async function (this: OlaiWorld, file: string) {
    const box = await outlineBox(this);
    await box.fill(file);
    await box.press("Enter");
  },
);

Then(
  "the outline creation is refused saying {string}",
  async function (this: OlaiWorld, said: string) {
    const refusal = this.page.locator(NEW_OUTLINE_SAID);
    await refusal.waitFor({ state: "visible", timeout: POLL_TIMEOUT });
    const text = oneLine(await refusal.innerText());
    assert.ok(
      text.includes(said),
      `the refusal reads ${JSON.stringify(text)}, which does not say ` +
        `${JSON.stringify(said)}`,
    );
  },
);

Then("the new outline box is gone", async function (this: OlaiWorld) {
  await this.waitUntil(
    async () => (await this.page.locator(NEW_OUTLINE_PATH).count()) === 0,
    "the new outline box to be put away",
  );
});
