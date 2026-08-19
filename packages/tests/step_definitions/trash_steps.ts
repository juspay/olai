/**
 * The trash: opening it, what it lists, putting a row back, and what a
 * put-back that could not land said.
 *
 * Its own file for the menu's reason: the trash is not the outline tree — its
 * rows are archived nodes with one verb on them, not editable rows — so none
 * of the tree's steps apply and none of its selectors match. What every
 * writing step here asserts AFTERWARDS is the outline's state on disk
 * (`editing_steps.ts`'s holds/no-longer-holds), because "put back" is a claim
 * about the file, not about a row disappearing from a panel.
 */

import * as assert from "node:assert";
import { Then, When } from "@cucumber/cucumber";

import {
  attr,
  expectAbsent,
  expectGone,
  oneLine,
  POLL_TIMEOUT,
  TRASH_EMPTY,
  TRASH_EMPTY_CANCEL,
  TRASH_EMPTY_CONFIRM,
  TRASH_EMPTY_VERB,
  TRASH_LINK,
  TRASH_PAGE,
  TRASH_PAGE_SAID,
  TRASH_PUT_BACK,
  TRASH_ROW,
  TRASH_SAID,
} from "../support/world.ts";
import type { OlaiWorld } from "../support/world.ts";

/** One trash row, by the archived node it draws. A selector string for the
 *  same reason `nodeSelector` is one. */
const trashRow = (id: string): string => `${TRASH_ROW}${attr("data-node-id", id)}`;

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

/** Gone from the page — what a filter takes rows away with. Polled for the row
 *  to GO, because narrowing re-renders and reading the count once races the
 *  frame that dropped it (the outline's own `is not shown` does the same). */
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

/** SELECTED by the query, rather than kept as the scaffold that leads to one —
 *  the outline tree's distinction (`filter_steps.ts`), asked of a pile. A trash
 *  row is not a `node` testid, which is why these two steps exist beside the
 *  tree's rather than being the same ones. */
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
  // The empty line is the assertion, not a zero row count: a trash that
  // failed to draw at all has no rows either.
  await this.page
    .locator(TRASH_EMPTY)
    .waitFor({ state: "visible", timeout: POLL_TIMEOUT });
});

/** The other side of it, for a page a FILTER emptied: "the Trash is empty" is a
 *  claim about the archive, and a query that found nothing in it is a claim
 *  about the query — which the bar makes. Saying both would be the page
 *  telling the reader their archive had been emptied by a search. */
Then("the Trash does not say it is empty", async function (this: OlaiWorld) {
  await expectAbsent(
    this,
    TRASH_PAGE,
    TRASH_EMPTY,
    "the Trash says it is empty over a page a filter narrowed to nothing",
  );
});

When(
  "I put back {string} from the Trash",
  async function (this: OlaiWorld, id: string) {
    const row = this.page.locator(trashRow(id)).first();
    // The verb is hover-revealed on a pointer device, the gutter's own
    // manner; the hover is what a person does to reach it.
    await row.hover();
    await row
      .locator(TRASH_PUT_BACK)
      .first()
      .click();
    await this.waitForFrame();
  },
);

/** The signpost rows the archive minted carry no id a scenario chose — they
 *  are the ancestor TITLES — so they are reached the way a reader reaches
 *  them: by the words on the row. */
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

/** The signpost refusal, in the ops layer's own words. A substring rather than
 *  the whole sentence: what this pins is that the REASON reached the row it
 *  was pressed on, in the alarm tone — the sentence itself is the planner's
 *  and is pinned verbatim where it is written (`plan.test.ts`). */
Then(
  "the Trash says under the row titled {string} that it is a signpost",
  async function (this: OlaiWorld, title: string) {
    const line = titledRow(this, title).locator(TRASH_SAID).first();
    await line.waitFor({ state: "visible", timeout: POLL_TIMEOUT });
    const text = oneLine(await line.innerText());
    assert.match(
      text,
      /is the title `archive` wrote above what was put away/,
      `the line under ${JSON.stringify(title)} reads ${JSON.stringify(text)}`,
    );
    assert.strictEqual(await line.getAttribute("data-tone"), "alarm");
  },
);

/** Exactly one, which is the whole of MUST-FIX 1: restoring a signpost used to
 *  mint a SECOND live node carrying a title the set already had. */
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

/** A put-back that could not land, in the ops layer's own words — VERBATIM
 *  and in the alarm tone, the same contract every other refusal line keeps.
 *  The row it is about is named, because a trash holds many rows and a
 *  refusal under the wrong one would pass a substring check. */
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

/** WHERE a node sits, which "holds the node" cannot say: a put-back that
 *  landed the subtree at top level instead of under its old parent still
 *  holds every id. Read off the disk like its siblings in
 *  `editing_steps.ts`, and waited for, because the write is a round trip. */
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

// ── emptying it ────────────────────────────────────────────────────────

/** The page's own verb, pressed. ONE control in three states — offered,
 *  asking, working — so every step here reaches it by the same selector rather
 *  than by the words on it, which is the same fact its testid records. */
const pressEmptyTrash = async (world: OlaiWorld): Promise<void> => {
  await world.page
    .locator(TRASH_EMPTY_VERB)
    .waitFor({ state: "visible", timeout: POLL_TIMEOUT });
  await world.page.locator(TRASH_EMPTY_VERB).click();
};

/** The FIRST press: it raises the question and writes nothing. */
When("I press Empty trash", async function (this: OlaiWorld) {
  await pressEmptyTrash(this);
  await this.page
    .locator(TRASH_EMPTY_CONFIRM)
    .waitFor({ state: "visible", timeout: POLL_TIMEOUT });
});

/** …and the SECOND, which is the one that deletes. Its own sentence rather
 *  than the same one twice: the two presses reach the same control and mean
 *  entirely different things, and a scenario that says so cannot be misread by
 *  whoever copies the pattern next. It waits for the confirm to be UP first,
 *  so a step that lands before the question is drawn fails as a missing
 *  question rather than by quietly arming one. */
When("I confirm emptying the Trash", async function (this: OlaiWorld) {
  await this.page
    .locator(TRASH_EMPTY_CONFIRM)
    .waitFor({ state: "visible", timeout: POLL_TIMEOUT });
  await pressEmptyTrash(this);
  await this.waitForFrame();
});

When("I cancel emptying the Trash", async function (this: OlaiWorld) {
  await this.page.locator(TRASH_EMPTY_CANCEL).click();
  await expectGone(
    this,
    TRASH_EMPTY_CONFIRM,
    "the question is still up after Cancel",
  );
});

/** VERBATIM, because the count in it is the whole claim: what a person agrees
 *  to has to be what the write moves, and the sentence itself is unit-tested
 *  where it is written (`trash/question.test.ts`). */
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

/** What the emptying said, on the PAGE's line rather than under a row — the
 *  write is about every archive at once, so there is no row to put it under.
 *  Verbatim and in the alarm tone, the contract every refusal here keeps. */
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

/** The file, read off the disk the suite is serving: an emptied archive holds
 *  no records at all. The page having drawn nothing and the archive being
 *  empty are two claims, and this is the second one. */
Then(
  "{string} holds nothing",
  async function (this: OlaiWorld, file: string) {
    await this.waitUntil(
      async () => this.servedNodes(file).length === 0,
      `${file} to hold no records`,
    );
  },
);

