/**
 * The sidebar's file tree: what the served directory turned out to contain.
 */

import * as assert from "node:assert";
import { Given, Then, When } from "@cucumber/cucumber";

import {
  attr,
  DOCUMENT_LINK,
  FILE_DIR,
  FILE_GLYPH,
  HYDRATION_TIMEOUT,
  HYPERTEXT_LINK,
  oneLine,
  OUTLINE_LINK,
  OUTLINE_LIST,
  OUTLINE_TREE,
  POLL_TIMEOUT,
  RAIL_DOCS,
  RAIL_OUTLINES,
} from "../support/world.ts";
import type { OlaiWorld } from "../support/world.ts";

/** One folder in the file tree, as a selector string `expectAttribute` takes. */
const folderSelector = (path: string): string =>
  `${FILE_DIR}${attr("data-path", path)}`;

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

/** WHICH outline the tree says is open — `aria-current`, which is what the
 *  entry's wash is drawn from, read where the press that moved it was ALLOWED
 *  to leave the address a frame behind: asked only after the route has
 *  settled, so `waitUntil` rather than one read. The `.html` sibling of this
 *  step lives in `html_steps.ts`, on the preview's own idiom. */
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

/** A row of THIS file — the swap, not any outline-tree still held from the
 *  page before. Shared by the click and the open so they cannot drift. */
const treeOf = (world: OlaiWorld, file: string) =>
  world.page.locator(`${OUTLINE_TREE} ${attr("data-file", file)}`).first();

/** The same click one kind over from "I click the document": the entry in the
 *  tree, pressed from wherever the reader already is. Its sibling below opens
 *  the app first, which is what makes it a `Given`; this one is a gesture on a
 *  page that is already up, and the difference is the whole subject of
 *  `features/the_chrome_holds_still.feature`. The wait after the click is the
 *  swap, same as the Given — not a rAF. */
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

Given(
  "I open the outline {string}",
  async function (this: OlaiWorld, file: string) {
    await this.open("/");
    // On a phone the list is behind the burger; on a laptop this does nothing.
    await this.showSidebar();
    const link = this.outlineLink(file);
    await link.waitFor({ state: "visible", timeout: HYDRATION_TIMEOUT });
    await link.click();
    // A ROW OF THIS FILE, not any outline-tree. `/` is the first outline
    // (`Daily/2026-08.olai` in the good corpus); createReading HOLDS that
    // tree while the named outline is in flight, so waiting for the
    // container matches the previous page. One rAF is vsync, not the swap
    // — darwin + parallel workers loses that window (#445's row-jump), and
    // the next step's Done flip is then the held page's prefs-choice.
    await treeOf(this, file).waitFor({
      state: "visible",
      timeout: POLL_TIMEOUT,
    });
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

/** The folder is NOT drawn at all — which is a different claim from
 *  collapsed, and the one the `_olai/` rule makes: a folder whose every file
 *  the tree left out is a folder the walk never mints
 *  (`web/src/client/fileTree.ts`). */
Then(
  "the file tree does not show the folder {string}",
  async function (this: OlaiWorld, path: string) {
    await this.showSidebar();
    // The LIST first: asking a locator for a count the frame before the tree
    // is painted answers zero for a folder that is about to be drawn.
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
      await this.page.locator(`${DOCUMENT_LINK}${attr("data-file", file)}`).count(),
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

// ── what KIND each row is ──────────────────────────────────────────────
//
// The basename is what the row SAYS; the glyph is what it says the row IS
// (`client/file/icons.tsx`). Asserted on `data-glyph` rather than on the
// drawing, because which shape is right for an outline is a design question
// and "there is one, and it is the outline's" is the promise. The extension is
// deliberately not the assertion either: `.olai` in the label is the thing
// that was carrying this on its own and the reason the mark was filed.
//
// EIGHT rows are asserted and not every row on screen, which a reviewer asked
// about and which is deliberate: every kind × the faces it is drawn on, which is
// the whole of the closed set (`DirectoryKind`). What a per-row sweep
// would add is a fourth reading of `fileTree.ts`'s walk — the tree's membership
// and its order are already promised by the scenarios above this one — and what
// it could not add is the case that actually threatens this: a kind with NO
// glyph. `Record<DirectoryKind, Drawn>` makes that a compile error rather than
// a row the suite would have to catch, so the type carries the exhaustiveness
// and these rows carry the wiring.

// Through `expectAttribute`, like every other `data-` fact in this file. The
// compound selector is what makes the wait RETRY across the frame that paints
// the tree, and the failure says what the glyph carries INSTEAD — which is the
// difference between "the wrong kind" and "no glyph at all".
//
// Scoped to the clickable thing — a link, or a folder's own `:scope > button`,
// the same scoping `folderToggle` gives — and never to a folder's `<li>`:
// nested folders nest their `li`s, so a glyph found under one of those could be
// a child's.

/** One row of the tree wears one kind's glyph. One body for the three file
 *  kinds, because the only thing that differs between them is which testid the
 *  row has and which word the glyph must carry — and a fourth kind's step
 *  should be a line here rather than a fourth copy of this. */
const drawnAs = async (
  world: OlaiWorld,
  testid: string,
  file: string,
  kind: string,
  what: string,
): Promise<void> => {
  await world.showSidebar();
  await world.expectAttribute(
    `${testid}${attr("data-file", file)} ${FILE_GLYPH}`,
    "data-glyph",
    kind,
    `the ${what} "${file}"`,
    HYDRATION_TIMEOUT,
  );
};
