/**
 * Writing a node's edges: the panel, its two doors, and what the file says
 * afterwards.
 *
 * Its own file for the reason `date_steps.ts` is one: the edge panel is a
 * surface with a state of its own — an open relation, a search, a list of what
 * the node says now — and the rest of the editor's steps are about a line of
 * text.
 *
 * WHAT THE DIRECTORY SAYS is here rather than in `editing_steps.ts`, unlike a
 * date or a placement, because an edge is a LIST on a record and "holds the
 * node X seeing Y" is a question about the shape of that list. The two
 * relations are one step with the field as a word, exactly as the marks are:
 * the format has two writable edge fields, the ops layer plans them with one
 * function, and a suite that asked about them two different ways would be the
 * fourth spelling of a thing that is deliberately one.
 *
 * The two moods are kept apart with the same care every other said-line here
 * is: a refused SEARCH and a refused WRITE are different sentences in
 * different slots, and a step that read either would pass on a client that
 * showed the wrong one.
 */

import * as assert from "node:assert";
import { Then, When } from "@cucumber/cucumber";

import {
  AFTER_REFS,
  EDGE_DROP,
  EDGE_HELD,
  EDGE_HIT,
  EDGE_PANEL,
  EDGE_SAID,
  EDGE_SEARCH,
  EDGE_VERB,
  NODE_REF,
  oneLine,
  POLL_TIMEOUT,
  REF_DROP,
  SEE_REFS,
} from "../support/world.ts";
import type { OlaiWorld } from "../support/world.ts";
import { saysThat } from "../support/said.ts";

/** The open panel, waited for. Every step here starts from it, so there is one
 *  spelling of "wait for it" — the `•••` menu's steps keep the same rule. */
const panelOf = async (world: OlaiWorld) => {
  const panel = world.page.locator(EDGE_PANEL).first();
  await panel.waitFor({ state: "visible", timeout: POLL_TIMEOUT });
  return panel;
};

/** Which row of refs a relation draws. Two locators rather than one derived
 *  from the word, because these are two contracts and a scenario naming a
 *  third relation should fail here rather than silently look at nothing. */
const refsOf = (relation: string): string => {
  if (relation === "see") return SEE_REFS;
  if (relation === "after") return AFTER_REFS;
  throw new Error(`there is no drawn row for a \`${relation}\` relation`);
};

/** What one node's record says for one edge field, off the disk this scenario
 *  is writing to — never off the page, because what these scenarios claim is
 *  that a pointer's gesture reached a FILE through the ops layer. */
const edgeIn = (
  world: OlaiWorld,
  file: string,
  id: string,
  field: string,
): ReadonlyArray<string> => {
  const node = world.servedNodesSoFar(file).find((one) => one["id"] === id);
  return (node?.[field] ?? []) as ReadonlyArray<string>;
};

// ── opening the panel ──────────────────────────────────────────────────

Then(
  "the {word} panel is open on {string}",
  async function (this: OlaiWorld, relation: string, id: string) {
    const panel = await panelOf(this);
    assert.strictEqual(
      await panel.getAttribute("data-relation"),
      relation,
      `the open edge panel is not the ${relation} one`,
    );
    // …and it is THIS row's, which is the whole of "in place under the row":
    // the panel a person is typing in has to be the one hanging off the node
    // they chose it from.
    await this.node(id)
      .locator(EDGE_PANEL)
      .first()
      .waitFor({ state: "visible", timeout: POLL_TIMEOUT });
  },
);

/** The zoomed page's own door, which exists because a heading has no `•••`. */
When(
  "I open the {word} panel from the page",
  async function (this: OlaiWorld, relation: string) {
    await this.press(
      this.page.locator(`${EDGE_VERB}[data-relation="${relation}"]`),
    );
    await panelOf(this);
  },
);

// ── choosing a target ──────────────────────────────────────────────────

When(
  "I search the edge panel for {string}",
  async function (this: OlaiWorld, text: string) {
    const box = (await panelOf(this)).locator(EDGE_SEARCH);
    await box.fill(text);
    // The search is the SERVER's, so the rows arrive a round trip and a
    // debounce later — a step that chose immediately would be choosing from
    // the list before it.
    await this.page
      .locator(EDGE_HIT)
      .first()
      .waitFor({ state: "visible", timeout: POLL_TIMEOUT });
  },
);

When(
  "I choose {string} from the edge panel",
  async function (this: OlaiWorld, title: string) {
    const hit = (await panelOf(this))
      .locator(EDGE_HIT)
      .filter({ hasText: title })
      .first();
    await this.press(hit);
  },
);

Then(
  "the edge panel holds {string}",
  async function (this: OlaiWorld, target: string) {
    await (await panelOf(this))
      .locator(`${EDGE_HELD} [data-ref="${target}"]`)
      .first()
      .waitFor({ state: "visible", timeout: POLL_TIMEOUT });
  },
);

When(
  "I drop {string} in the edge panel",
  async function (this: OlaiWorld, target: string) {
    await this.press(
      (await panelOf(this)).locator(`${EDGE_DROP}[data-ref="${target}"]`).first(),
    );
  },
);

/** The `×` on a reference the PAGE draws, which is the other door onto the
 *  same op — and the one a person reading a node reaches for. */
When(
  "I drop {string} from the drawn {string} of {string}",
  async function (
    this: OlaiWorld,
    target: string,
    relation: string,
    id: string,
  ) {
    await this.press(
      this.node(id)
        .locator(`${refsOf(relation)} ${REF_DROP}[data-ref="${target}"]`)
        .first(),
    );
  },
);

// ── what it said ───────────────────────────────────────────────────────

/** The ops layer's own words about a WRITE — the loop an `after` would close,
 *  an id nothing declares. Verbatim, and in the alarm mood: a refusal a reader
 *  does not notice is a write they believe landed. */
Then(
  "the edge panel says {string}",
  async function (this: OlaiWorld, said: string) {
    await saysThat(this, EDGE_SAID, said, "edge panel's said line", "alarm");
  },
);

// ── what the page draws ────────────────────────────────────────────────

/** The `after` a node DECLARES, in order — deliberately not `blocked by`,
 *  which is derived and names only what is still in the way. */
Then(
  "the node {string} comes after {string}",
  async function (this: OlaiWorld, id: string, titles: string) {
    const row = this.node(id).locator(AFTER_REFS).first();
    await row.waitFor({ state: "visible", timeout: POLL_TIMEOUT });
    await this.waitUntil(
      async () =>
        (await row.locator(NODE_REF).allInnerTexts()).map(oneLine).join(", ") ===
          titles,
      `the \`after\` row of "${id}" to read ${JSON.stringify(titles)}`,
    );
  },
);

Then(
  "the node {string} draws no {string}",
  async function (this: OlaiWorld, id: string, relation: string) {
    await this.waitUntil(
      async () => (await this.node(id).locator(refsOf(relation)).count()) === 0,
      `the \`${relation}\` row of "${id}" to be gone`,
    );
  },
);

// ── what the directory says ────────────────────────────────────────────

Then(
  "{string} holds the node {string} seeing {string}",
  async function (this: OlaiWorld, file: string, id: string, target: string) {
    await this.waitUntil(
      async () => edgeIn(this, file, id, "see").includes(target),
      `${file} to hold ${JSON.stringify(id)} seeing ${JSON.stringify(target)}`,
    );
  },
);

Then(
  "{string} holds the node {string} seeing nothing",
  async function (this: OlaiWorld, file: string, id: string) {
    await this.waitUntil(
      async () => edgeIn(this, file, id, "see").length === 0,
      `${file} to hold ${JSON.stringify(id)} with no \`see\` at all`,
    );
  },
);

/** The whole list, in order, because an edge write is INCREMENTAL: "after
 *  demo" would be satisfied by a write that added three more, and the thing
 *  under test is that exactly one target moved. */
Then(
  "{string} holds the node {string} after {string}",
  async function (this: OlaiWorld, file: string, id: string, targets: string) {
    const wanted = targets.split(",").map((one) => one.trim());
    await this.waitUntil(
      async () => edgeIn(this, file, id, "after").join(",") === wanted.join(","),
      `${file} to hold ${JSON.stringify(id)} after ${JSON.stringify(targets)}`,
    );
  },
);
