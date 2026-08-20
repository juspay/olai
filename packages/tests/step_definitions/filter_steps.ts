/**
 * The filter over the page: the box, what it found, what it refused, and the
 * `#tag` that fills it.
 *
 * Its own file rather than more of `./outline_tree_steps.ts` for the reason the
 * palette left `./panel_steps.ts`: a filter is a reading of the page and not a
 * fact about a row — it has an address, a grammar and a sentence of its own
 * when it finds nothing.
 *
 * WAITED FOR, never read once. Every assertion here follows a keystroke that
 * re-renders the tree, and reading a count or an attribute in the same tick
 * races the frame that produced it — so each one goes through the suite's own
 * two waits: a locator where a selector can express the question, and
 * `world.waitUntil` where it cannot ("this count has changed").
 */

import * as assert from "node:assert";
import { Then, When } from "@cucumber/cucumber";

import { saysThat } from "../support/said.ts";
import {
  attr,
  DESC_HIT,
  FILTER_BAR,
  FILTER_CLEAR,
  FILTER_COUNT,
  FILTER_INPUT,
  FILTER_OFFLINE,
  FILTER_REFUSAL,
  HIT,
  NODE,
  NODE_TITLE,
  nodeSelector,
  OUTLINE_TREE,
  POLL_TIMEOUT,
  addressOf,
  SEARCH_REFUSAL,
  TAG,
} from "../support/world.ts";
import type { OlaiWorld } from "../support/world.ts";

/** Every row the tree draws — the ones a reader counts. Scoped to the tree, so
 *  a zoomed page's own heading (which is a node too, and says so) is not one. */
const rows = (world: OlaiWorld) => world.page.locator(`${OUTLINE_TREE} ${NODE}`);

// ── typing ─────────────────────────────────────────────────────────────

/**
 * Type it, and WAIT FOR THE PAGE TO ANSWER IT.
 *
 * The filter is a question to the server now (`search-server-side`): a
 * debounce, then a round trip. So "I filtered the page" is not done when the
 * keystrokes land — it is done when the rows in front of the reader are the
 * answer to what was typed, which the bar publishes as `data-asked`
 * (`client/filter/FilterBar.tsx`, the same fact its count line says in words,
 * and the same attribute every other search box in that client uses for it).
 *
 * Waited for HERE, once, rather than in every step that reads a row afterwards:
 * a page mid-question is a real state with its own rules — the rows hold still
 * and the bar says so — and the scenario that is ABOUT that state waits for it
 * deliberately. Every other scenario is about what the query found, and none of
 * them should have to know there is a wire under the box.
 */
When(
  "I filter the page by {string}",
  async function (this: OlaiWorld, text: string) {
    const box = this.page.locator(FILTER_INPUT);
    await box.waitFor({ state: "visible", timeout: POLL_TIMEOUT });
    await box.fill(text);
    // A LOCATOR, because a selector can express this question — the suite's own
    // rule, and the same one the move picker and the edge panel wait on their
    // shortlists with (`data-asked`).
    await this.page
      .locator(`${FILTER_BAR}${attr("data-asked", text.trim())}`)
      .first()
      .waitFor({ state: "visible", timeout: POLL_TIMEOUT });
    await this.waitForFrame();
  },
);

When("I clear the filter", async function (this: OlaiWorld) {
  await this.press(this.page.locator(FILTER_CLEAR));
});

// ── what it drew ───────────────────────────────────────────────────────

Then(
  "the outline has {int} rows",
  async function (this: OlaiWorld, expected: number) {
    await this.waitUntil(
      async () => (await rows(this).count()) === expected,
      `the outline has ${expected} rows`,
    );
  },
);

/**
 * THE WHOLE COUNT LINE, exactly — not a substring of it.
 *
 * The suite's one reader (`support/said.ts`) matches a substring, and it is
 * right to: most of the sentences it reads are a phrase inside a paragraph
 * somebody wrote. This element is not one of those. It holds the count line and
 * nothing else (`client/filter/count.ts` is the only thing that writes it), so
 * a substring here buys nothing and costs the two things this feature is made
 * of: `"1 of 10"` is inside `"1 of 100"`, and — the one that matters —
 * `"1 of 10"` is inside `"1 of 10 — 2 more matches hidden as done (Prefs)"`,
 * so the scenario that exists to prove NO clause is said could not see one
 * appear (found by both reviewers of #248).
 *
 * The count settles a frame after the query, so the equality is WAITED for
 * rather than read once; what a failure prints is what the bar actually says.
 */
Then(
  "the filter found {string}",
  async function (this: OlaiWorld, said: string) {
    const line = this.page.locator(FILTER_COUNT).first();
    await line.waitFor({ state: "visible", timeout: POLL_TIMEOUT });
    await this.waitUntil(
      async () => (await line.innerText().catch(() => "")).trim() === said,
      `the filter says exactly ${JSON.stringify(said)}`,
    ).catch(() => undefined);
    assert.strictEqual(
      (await line.innerText()).trim(),
      said,
      `the filter count reads ${JSON.stringify((await line.innerText()).trim())}`,
    );
  },
);

/**
 * THE BOX WITH NOWHERE TO SEND A QUESTION — disabled, since the filter is a
 * round trip and the wire is gone (`client/filter/asking.ts`).
 *
 * Asked of the control rather than of a class: `isDisabled` is what a person's
 * keystroke actually meets, and it is the same fact the browser uses to refuse
 * one.
 */
Then("the filter box is inert", async function (this: OlaiWorld) {
  const box = this.page.locator(FILTER_INPUT);
  await box.waitFor({ state: "visible", timeout: POLL_TIMEOUT });
  await this.waitUntil(
    async () => await box.isDisabled(),
    "the filter box is disabled",
  );
});

/** ...and it says WHY, in the connection pill's own words — never silently, and
 *  never in the grammar's refusal slot, which is a different piece of news. */
Then("the filter says it cannot be asked", async function (this: OlaiWorld) {
  await this.page
    .locator(FILTER_OFFLINE)
    .waitFor({ state: "visible", timeout: POLL_TIMEOUT });
});

/** SELECTED by the query, rather than kept as the ancestry that leads to one.
 *  The distinction is the whole of "filter in place": a page of matches with
 *  no context is a result list, and context that cannot be told from a match
 *  is a page that lies about what it found. */
Then(
  "the node {string} is a match",
  async function (this: OlaiWorld, id: string) {
    await this.expectAttribute(
      nodeSelector(id),
      "data-match",
      "true",
      `node \`${id}\``,
    );
  },
);

Then(
  "the node {string} is context",
  async function (this: OlaiWorld, id: string) {
    await this.expectAttribute(
      nodeSelector(id),
      "data-match",
      "false",
      `node \`${id}\``,
    );
  },
);

// ── why a row is drawn ─────────────────────────────────────────────────
//
// The three things a narrowed row says about itself. Every one of them is
// waited for rather than read once: they follow a keystroke that re-renders
// the whole tree.

/**
 * A node's OWN title, never a descendant's — nodes nest, and a parent's scope
 * holds every title under it. `.first()` is its own because a title is
 * rendered before the children (`world.nodeTitle`'s rule, one level down).
 *
 * `piece` narrows to one rendered piece of the title's markdown — a `code`
 * span, a link — for the steps that ask WHERE in the markup the query landed.
 * Empty is the whole title, which is what most of them ask.
 */
const lit = (world: OlaiWorld, id: string, piece = "") =>
  world.nodeTitle(id).locator(piece === "" ? HIT : `${piece} ${HIT}`);

/**
 * WHERE the query landed in this row's title — the highlight, read as the text
 * it wraps. A page that draws the row and lights nothing in it is the page this
 * whole feature is against: every number correct, and no row saying why it is
 * in front of the reader.
 *
 * ONE reading for every step below, narrowed or not. The wait and the assert
 * read the same locator twice on purpose (the file's header says why), and two
 * copies of that contract is exactly the drift it warns about.
 */
const expectLit = async (
  world: OlaiWorld,
  id: string,
  said: string,
  piece = "",
): Promise<void> => {
  const where = piece === "" ? "" : ` inside its \`${piece}\``;
  const read = async () =>
    (await lit(world, id, piece).allInnerTexts()).join(" ");
  await world.waitUntil(
    async () => (await read()) === said,
    `node \`${id}\` lights ${JSON.stringify(said)}${where}`,
  ).catch(() => undefined);
  assert.strictEqual(
    await read(),
    said,
    `node \`${id}\` does not light ${JSON.stringify(said)}${where}`,
  );
};

Then(
  "the node {string} lights {string}",
  async function (this: OlaiWorld, id: string, said: string) {
    await expectLit(this, id, said);
  },
);

/**
 * ...and the same reading narrowed to the two rendered pieces the tag split
 * deliberately leaves alone (`markdown/tags.ts`).
 *
 * The highlight used to leave them alone with it, so the step above is not
 * enough here: a row that lit the same word somewhere else in its title would
 * go green on a claim it is not making. Two steps rather than one taking the
 * piece as a `{string}`, so the Gherkin reads as a sentence instead of
 * carrying quotes around a tag name.
 */
Then(
  "the node {string} lights {string} inside its code span",
  async function (this: OlaiWorld, id: string, said: string) {
    await expectLit(this, id, said, "code");
  },
);

Then(
  "the node {string} lights {string} inside its link",
  async function (this: OlaiWorld, id: string, said: string) {
    await expectLit(this, id, said, "a");
  },
);

/** ...and the other half, which is the one that would go unnoticed: a row
 *  whose title holds nothing of the query lights nothing, whether it is the
 *  ancestry leading to a match or a match found behind its ¶. */
Then(
  "the node {string} lights nothing",
  async function (this: OlaiWorld, id: string) {
    await this.waitUntil(
      async () => (await lit(this, id).count()) === 0,
      `node \`${id}\` lights nothing`,
    );
  },
);

/** A row's OWN excerpt lines — never a descendant's.
 *
 *  `.first()` is the rule the sibling helpers use and it will not do here: it
 *  answers for the POSITIVE case (a row is drawn before its children) and gets
 *  the negative one exactly backwards, since a descendant's line would make
 *  "this row draws no excerpt" quietly false. So the filter is asked of the
 *  element — which node does this line belong to — the same question
 *  `shownRecord` answers in the client. */
const excerpts = async (
  world: OlaiWorld,
  id: string,
): Promise<ReadonlyArray<string>> =>
  await world.node(id).locator(DESC_HIT).evaluateAll(
    (lines, owner) =>
      lines
        .filter((line) =>
          line.closest("[data-node-id]")?.getAttribute("data-node-id") === owner
        )
        .map((line) => (line.textContent ?? "").replace(/\s+/g, " ").trim()),
    id,
  );

/** The note a row was found BY, one clamped line under its title with the word
 *  lit inside it — drawn only where the hit is behind the ¶ and the title says
 *  nothing the reader typed. */
Then(
  "the node {string} excerpts {string}",
  async function (this: OlaiWorld, id: string, said: string) {
    await this.waitUntil(
      async () => (await excerpts(this, id)).some((line) => line.includes(said)),
      `node \`${id}\` excerpts ${JSON.stringify(said)}`,
    ).catch(async () => {
      const drawn = await excerpts(this, id);
      assert.fail(
        `node \`${id}\` excerpts ${JSON.stringify(drawn.join(" · "))}, ` +
          `which does not hold ${JSON.stringify(said)}`,
      );
    });
  },
);

Then(
  "the node {string} draws no excerpt",
  async function (this: OlaiWorld, id: string) {
    await this.waitUntil(
      async () => (await excerpts(this, id)).length === 0,
      `node \`${id}\` draws no excerpt`,
    );
  },
);
/** The SAME refusal, on a door that had to ask the server for it. One step for
 *  both of those doors, because it is one sentence about one grammar. */
Then(
  "the search refuses {string} and says {string}",
  async function (this: OlaiWorld, token: string, teaching: string) {
    await saysThat(this, SEARCH_REFUSAL, token, "search refusal");
    await saysThat(this, SEARCH_REFUSAL, teaching, "search refusal");
  },
);

// ── the box itself ─────────────────────────────────────────────────────

Then(
  "the filter box holds {string}",
  async function (this: OlaiWorld, text: string) {
    const box = this.page.locator(FILTER_INPUT);
    await box.waitFor({ state: "visible", timeout: POLL_TIMEOUT });
    assert.strictEqual(await box.inputValue(), text);
  },
);

Then("there is no filter bar", async function (this: OlaiWorld) {
  assert.strictEqual(
    await this.page.locator(FILTER_BAR).count(),
    0,
    "a filter box is drawn on a page whose address has nowhere to keep one",
  );
});

// ── the address, query and all ─────────────────────────────────────────

/** Not `the address is` — that step reads the PLACE, and every scenario using
 *  it would go on passing over a page that is also filtered. This is the whole
 *  bar, which is what a filtered page's link actually is. */
Then(
  "the address is exactly {string}",
  async function (this: OlaiWorld, address: string) {
    await this.page
      .waitForURL((url) => addressOf(url) === address, {
        timeout: POLL_TIMEOUT,
      })
      .catch(() => undefined);
    assert.strictEqual(this.address(), address);
  },
);

// ── the tag, pressed ───────────────────────────────────────────────────

When("I press the tag {string}", async function (this: OlaiWorld, tag: string) {
  await this.press(this.page.locator(TAG).filter({ hasText: tag }).first());
});

/** The same press, aimed at ONE ROW'S OWN TITLE — which is a different thing
 *  from the step above on the pages that draw ancestry: a day and the agenda
 *  put the same tag in a crumb, the crumb is a link, and a press there goes
 *  where the link goes. Both are promises, and they need two aims. */
When(
  "I press the tag {string} in the row {string}",
  async function (this: OlaiWorld, tag: string, id: string) {
    await this.press(
      this.page
        .locator(`${nodeSelector(id)} ${NODE_TITLE} ${TAG}`)
        .filter({ hasText: tag })
        .first(),
    );
  },
);

/** Whether a `#tag` in this pane is live — the fact the cursor is drawn from
 *  (`client/styles.css`) and the fact the listener declines on
 *  (`client/App.tsx`). Asserted as the `data-` fact rather than as the cursor,
 *  because which pages can be narrowed is a claim and the pointer is a
 *  styling decision a refactor may change. The scenario presses one afterwards,
 *  so the claim and the behaviour are held to each other.
 *
 *  There is no longer a step for the other side of it: every page that draws a
 *  title can be narrowed now, and a document — the one that cannot — draws its
 *  tags as prose, where they were never pills (`markdown/tags.ts` styles
 *  titles). "There is no filter bar" is what says it for that page. */
Then("tags on this page are pressable", async function (this: OlaiWorld) {
  await this.expectAttribute("main", "data-narrowable", "true", "the page");
  assert.ok(
    (await this.page.locator(TAG).count()) > 0,
    "no tag is drawn, so this proves nothing",
  );
});
