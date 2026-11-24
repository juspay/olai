/**
 * The sidebar's file tree: what the served directory turned out to contain.
 */

import { TESTID } from "@olai/tests/harness/testids.ts";
import * as assert from "node:assert";
import { Given, Then, When } from "@olai/tests/harness/runner.ts";

import {
  attr,
  DOCUMENT_LINK,
  FILE_DIR,
  FILE_GLYPH,
  HYDRATION_TIMEOUT,
  HYPERTEXT_LINK,
  oneLine,
  FILE_LIST,
  OUTLINE_LINK,
  OUTLINE_TREE,
  PANE,
  POLL_TIMEOUT,
  SIDEBAR,
} from "@olai/tests/harness/world.ts";
import type { OlaiWorld } from "@olai/tests/harness/world.ts";

/** One folder in the file tree, as a selector string `expectAttribute` takes. */
const folderSelector = (path: string): string =>
  `${FILE_DIR}${attr("data-path", path)}`;

/** The fold button of ONE folder — its own, not a nested folder's. Nested
 *  folders nest their `li`s, so an unscoped `FILE_DIR_TOGGLE` under a parent
 *  would match every toggle inside it.
 *
 *  `:scope > *:is(button, :has(> button)) > …` rather than the plain
 *  `:scope > button` this used to be: the toggle wears a `<Tip>` now, whose
 *  wrapper is a `display: contents` span — no box, nothing a reader can see,
 *  and one more element between the `<li>` and its button. Matching the
 *  button through at most one such wrapper keeps the claim ("this folder's
 *  own toggle") while leaving a nested folder's two levels down out of it. */
const folderToggle = (world: OlaiWorld, path: string) =>
  world.fileDir(path).locator(":scope > button, :scope > span > button").first();

Then("the outline list is shown", async function (this: OlaiWorld) {
  await this.page
    .locator(FILE_LIST)
    .waitFor({ state: "visible", timeout: HYDRATION_TIMEOUT });
});

Then("no outline list is shown", async function (this: OlaiWorld) {
  assert.strictEqual(
    await this.page.locator(FILE_LIST).count(),
    0,
    "the sidebar is on screen; an invalid set shows the error view INSTEAD of it",
  );
});

Then(
  "the outline list has {int} entries",
  async function (this: OlaiWorld, expected: number) {
    await this.showSidebar();
    const links = this.page.locator(`${FILE_LIST} ${OUTLINE_LINK}`);
    await this.page.getByTestId(TESTID.sidebarFiles).waitFor({ state: "visible", timeout: HYDRATION_TIMEOUT });
    // An empty ul has no visible box, but must be mounted before counting.
    await this.page.locator(FILE_LIST).waitFor({ state: "attached", timeout: HYDRATION_TIMEOUT });
    const files = () => links.evaluateAll((nodes) => nodes.map((node) => node.getAttribute("data-file")))
    // The list follows the directory on the watcher's clock: a step that
    // removed files a moment ago may find the list still redrawing. Wait for
    // the count, then say what is there if it never comes.
    await this.waitUntil(
      async () => (await files()).length === expected,
      `the sidebar to list ${expected} outline(s)`,
      HYDRATION_TIMEOUT,
    ).catch(() => {});
    const listed = await files();
    // `assert.ok`, not `strictEqual` with a message: the run's output prints
    // only the diff for the latter and drops the names this message carries.
    assert.ok(
      listed.length === expected,
      `expected ${expected} outline(s) in the sidebar, found ${listed.length}: ${listed.join(", ")}`,
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

/**
 * ...AND THE SAME LINK GONE.
 *
 * IT WAITS, and the reason is what every caller of this step is actually
 * saying. A deletion is a write: the press goes to the gate, the gate answers,
 * the store publishes and the sidebar redraws — three hops after the frame the
 * confirm step waits for. Read once, this asserted that the sidebar had ALREADY
 * caught up, which is not a claim any scenario here means to make and is not
 * one a loaded machine keeps: it passed for as long as the round trip fitted
 * inside one animation frame and failed the day a shard put four workers on one
 * box.
 *
 * Waiting costs nothing where the link was never there — the first read
 * answers zero and the loop ends — so the absence a scenario asserts from a
 * standing start is the same absence it was.
 */
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

/**
 * THE DESTINATION PAGE, ARRIVED — a pane that is DRAWING this file, and the
 * tree inside it. Shared by the click and the open so they cannot drift.
 *
 * ## It was a row's `data-file`, and that established nothing
 *
 * `Tree.tsx` puts `data-file` on each ROW, as the file of the RECORD that row
 * draws — and a mirror pulls another outline's records into this one. The
 * `good` corpus has exactly that: `house.olai`'s `kitchen-herbs` mirrors
 * `herbs` out of `garden.olai`, so with `/house.olai` on screen the old
 * selector already matched a visible row (`mint`, and `basil` once done rows
 * are shown). Its post-condition was true at step ENTRY, so the wait
 * synchronised nothing at all for that pair — a review found it, and a probe
 * confirmed it in the DOM.
 *
 * ## Nor the href, nor the URL
 *
 * Both move the frame a link is clicked. A pane keeps the page it has while
 * the next reading is in flight (`olai-plugin-outlines`' `PageView.tsx`), so a
 * wait on either returns with the previous page still on screen. What this
 * asks is the pane's own `data-drawn-file`: the file of the page it is
 * DRAWING, which is the arrival itself.
 *
 * ## THE INTENDED PANE, which is the FOCUSED one
 *
 * "Any pane drawing it" was the same false positive one step out: a split with
 * the destination already open beside the reader satisfies it before the pane
 * they are IN has moved. The destination pane is not a guess — `router.go` is
 * `goIn(workspace().focus, next)`, so a plain link navigates the pane you are
 * in, and both callers of this are plain links. A step that means a particular
 * pane asks `paneAt` instead.
 */
const treeOf = (world: OlaiWorld, file: string) =>
  world.frontLane()
    // `/` can already draw this file. Its retained tree is not proof that
    // the explicit file request has arrived or that its controls are ready.
    .locator(`${PANE}[data-pane-focused="true"]${attr("data-drawn-file", file)} ${attr("aria-busy", "false")} ${OUTLINE_TREE}`)
    .first();

/** The same click one kind over from "I click the document": the entry in the
 *  tree, pressed from wherever the reader already is. Its sibling below opens
 *  the app first, which is what makes it a `Given`; this one is a gesture on a
 *  page that is already up, and the difference is the whole subject of
 *  `packages/plugins/navigation/e2e/features/the_chrome_holds_still.feature`. The wait after the click is the
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

/**
 * WHICH PAGE THE INTENDED PANE IS DRAWING — the arrival itself, asserted rather
 * than waited on incidentally.
 *
 * THE FOCUSED PANE, because that is where a sidebar click opens: a step that
 * accepted any pane would pass on a split where the file was already open
 * beside the one the reader is in. {@link treeOf}'s wait is deliberately wider
 * — it means "the destination is on screen" and the click decides where — and
 * this is the narrower claim a scenario makes when the pane matters.
 */
Then(
  "the focused pane is drawing the outline {string}",
  async function (this: OlaiWorld, file: string) {
    await this.frontLane()
      .locator(`${PANE}[data-pane-focused="true"]${attr("data-drawn-file", file)}`)
      .first()
      .waitFor({ state: "visible", timeout: POLL_TIMEOUT });
  },
);

/** ...and the same claim about one pane by its index, for a split whose panes
 *  are drawn by different hosts. */
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
      .locator(FILE_LIST)
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
  await world.expectChromeAttribute(
    `${testid}${attr("data-file", file)} ${FILE_GLYPH}`,
    "data-glyph",
    kind,
    `the ${what} "${file}"`,
    HYDRATION_TIMEOUT,
  );
};

// ── one tree of every file ─────────────────────────────────────────────
//
// Outlines and every other file stand in one list under one heading, by name at
// each level, folders and files together. What a row is, is its glyph.

/** The tree's top level as drawn, in order: a folder by its path and a
 *  trailing slash, a file by its path. */
const topLevel = (world: OlaiWorld): Promise<ReadonlyArray<string>> =>
  world.page.locator(FILE_LIST).evaluate((list) => [...list.children].map((item) => {
    const path = item.getAttribute("data-path");
    if (path !== null) return `${path}/`;
    return item.querySelector("[data-file]")?.getAttribute("data-file") ?? "?";
  }));

Then("the file list is headed {string}", async function(this: OlaiWorld, heading: string) {
  await this.showSidebar();
  const head = this.page.getByTestId(TESTID.sidebarFiles).locator("h2").first();
  await head.waitFor({ state: "visible", timeout: HYDRATION_TIMEOUT });
  // textContent, not innerText: the heading is drawn in capitals by CSS, and
  // what it SAYS is the sentence-case word.
  assert.equal((await head.textContent())?.trim(), heading);
});

Then("the sidebar has no Reference section", async function(this: OlaiWorld) {
  await this.showSidebar();
  await this.page.locator(FILE_LIST).waitFor({ state: "attached", timeout: HYDRATION_TIMEOUT });
  assert.equal(await this.page.locator(SIDEBAR).getByText("Reference", { exact: true }).count(), 0, "the sidebar still draws a Reference section");
});

Then("the file list's top level reads {string}", async function(this: OlaiWorld, expected: string) {
  await this.showSidebar();
  await this.page.locator(FILE_LIST).waitFor({ state: "attached", timeout: HYDRATION_TIMEOUT });
  const wanted = expected.split(",").map((one) => one.trim());
  await this.waitUntil(async () => JSON.stringify(await topLevel(this)) === JSON.stringify(wanted),
    `the file list's top level to read ${wanted.join(", ")}`).catch(async () => {
    assert.fail(`the file list's top level reads ${(await topLevel(this)).join(", ")}, not ${wanted.join(", ")}`);
  });
});

Then("the folder {string} appears once in the file list", async function(this: OlaiWorld, path: string) {
  await this.showSidebar();
  const folders = this.page.locator(`${FILE_LIST} ${FILE_DIR}${attr("data-path", path)}`);
  await folders.first().waitFor({ state: "visible", timeout: HYDRATION_TIMEOUT });
  assert.equal(await folders.count(), 1, `the folder "${path}" is drawn more than once`);
});

/** The rows directly under one folder, by path, in the order drawn. */
Then("the folder {string} in the file list holds {string}", async function(this: OlaiWorld, path: string, expected: string) {
  const wanted = expected.split(",").map((one) => one.trim());
  const held = () => this.fileDir(path).evaluate((folder) =>
    [...(folder.querySelector(":scope > ul")?.children ?? [])].map((item) =>
      item.getAttribute("data-path") ?? item.querySelector("[data-file]")?.getAttribute("data-file") ?? "?"));
  await this.waitUntil(async () => JSON.stringify(await held()) === JSON.stringify(wanted),
    `the folder "${path}" to hold ${wanted.join(", ")}`).catch(async () => {
    assert.fail(`the folder "${path}" holds ${(await held()).join(", ")}, not ${wanted.join(", ")}`);
  });
});

Then("the file list marks {string} as the open file", async function(this: OlaiWorld, file: string) {
  await this.showSidebar();
  await this.expectChromeAttribute(`${FILE_LIST} a${attr("data-file", file)}`, "aria-current", "page", `the row of "${file}"`);
});

/** Which folders are drawn open, every one of them: a folder opened that the
 *  scenario did not name is the failure, as much as one left shut. */
Then("the open folders in the file list are {string}", async function(this: OlaiWorld, expected: string) {
  await this.showSidebar();
  const wanted = expected === "none" ? [] : expected.split(",").map((one) => one.trim());
  const open = () => this.page.locator(`${FILE_LIST} ${FILE_DIR}[data-collapsed="false"]`)
    .evaluateAll((folders) => folders.map((folder) => folder.getAttribute("data-path") ?? "?").sort());
  await this.waitUntil(async () => JSON.stringify(await open()) === JSON.stringify([...wanted].sort()),
    `the open folders to be ${expected}`).catch(async () => {
    assert.fail(`the open folders are ${(await open()).join(", ") || "none"}, not ${expected}`);
  });
});

/** A folder this browser kept open before the page loads — the memory a
 *  reader carries across a change to the column. */
Given("this browser kept the folder {string} open", async function(this: OlaiWorld, path: string) {
  await this.page.addInitScript(([key, value]) => {
    if (localStorage.getItem(key) === null) localStorage.setItem(key, value);
  }, ["olai.sidebar.folders", JSON.stringify([path])] as const);
});
