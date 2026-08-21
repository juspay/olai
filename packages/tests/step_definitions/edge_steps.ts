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
import { TESTID } from "@olai/web/src/client/testids.ts";

import {
  AFTER_REFS,
  attr,
  EDGE_DROP,
  EDGE_HELD,
  EDGE_HIT,
  EDGE_PANEL,
  EDGE_SAID,
  EDGE_SEARCH,
  EDGE_VERB,
  POLL_TIMEOUT,
  REF_DROP,
  rowReads,
  SEE_REFS,
} from "../support/world.ts";
import type { OlaiWorld } from "../support/world.ts";
import { focusedOn } from "../support/caret.ts";
import { saysThat } from "../support/said.ts";
import { answering } from "../support/shortlist.ts";
import { retypedAndTaken } from "../support/atonce.ts";

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
      this.page.locator(`${EDGE_VERB}${attr("data-relation", relation)}`),
    );
    await panelOf(this);
  },
);

// ── choosing a target ──────────────────────────────────────────────────

/** The rows of THIS query, under this panel — `../support/shortlist.ts`,
 *  which is where that wait lives for every panel in this suite that searches. */
const answered = (world: OlaiWorld, text: string): Promise<void> =>
  answering(world, EDGE_PANEL, EDGE_HIT, text);

When(
  "I search the edge panel for {string}",
  async function (this: OlaiWorld, text: string) {
    const box = (await panelOf(this)).locator(EDGE_SEARCH);
    await box.fill(text);
    await answered(this, text);
  },
);

/** ANOTHER QUERY AND THE KEY IN ONE TASK — `../support/atonce.ts`, which is
 *  where that window is opened for every door in this suite that takes a row
 *  on `Enter`. It was written out here first, for the one door #294 gated; it
 *  is five doors now. */
When(
  "I retype the edge panel's search as {string} and press Enter at once",
  async function (this: OlaiWorld, text: string) {
    await retypedAndTaken(this, (await panelOf(this)).locator(EDGE_SEARCH), text);
  },
);

Then(
  "the edge panel's rows answer {string}",
  async function (this: OlaiWorld, text: string) {
    await answered(this, text);
  },
);

/** The third line, in the door that is NOT the palette. Four surfaces draw
 *  `Result.tsx` over one `createSearch`, and the properties reached one of
 *  them first; this is the fence that keeps them reaching all of them. */
Then(
  "the edge panel hit {string} shows the property {string} holding {string}",
  async function (this: OlaiWorld, title: string, key: string, value: string) {
    const prop = (await panelOf(this))
      .locator(EDGE_HIT)
      .filter({ hasText: title })
      .first()
      .locator(`[data-testid="edge-hit-prop"]${attr("data-key", key)}`);
    await prop.waitFor({ state: "visible", timeout: POLL_TIMEOUT });
    assert.equal((await prop.innerText()).trim(), `${key} ${value}`);
  },
);

/**
 * THIS TAB'S OWN RECEIPT for a write the three steps below make with the
 * pointer — and why the disk is not one.
 *
 * A write goes: the server writes the file, publishes the new set, and only
 * then answers the tab that asked (`packages/store/src/store.ts` — *rename
 * them all → re-probe and publish → the caller's post-publish hook*). So a
 * step that polls the FILE has read a fact the server has and this tab has
 * not — and everything the client does next turns on having been answered: the
 * inverse ⌘Z spends is filed on the answer (`client/writes.ts` →
 * `client/edit/undoing.ts`'s `record`), and a second write is dropped where it
 * stands while the first is out (`client/edges/editing.tsx`'s `sending`, the
 * date picker's rule).
 *
 * What this surface CAN say is the refs it draws. Nothing is echoed here — a
 * reference appears and goes when the file says so, off the same snapshot
 * every other reader is drawn from (`client/edges/editing.tsx`'s header) — so
 * the list having changed is this tab having been told, one message ahead of
 * the answer on the same wire.
 *
 * OR THE PAGE SAID WHY IT DID NOT, which is the other way any of these ends: a
 * loop refused, an id nothing declares. Same shape as `support/caret.ts`'s
 * waits, and for its reason — a step that only knew the happy answer would
 * hang for fifteen seconds on a scenario whose whole point is the refusal.
 *
 * A sentence left over from the LAST write cannot end this wait: the surface
 * clears its line before it sends (`editing.tsx`'s `write` — "cleared BEFORE
 * the attempt … a write that takes a moment would otherwise sit under the last
 * one's sentence"), and `world.press` has waited out a frame by the time any
 * of these starts polling.
 */
const drawnOrSaid = async (
  world: OlaiWorld,
  changed: () => Promise<boolean>,
  what: string,
): Promise<void> => {
  let drawn = false;
  await world.waitUntil(
    async () => {
      drawn = await changed();
      return drawn || (await world.page.locator(EDGE_SAID).count()) > 0;
    },
    `${what}, or the page to say why it did not`,
  );
  // ONE MORE FRAME on the happy path, which is what the paragraph above is
  // actually owed: the refs list changing is the snapshot, and the answer this
  // tab's undo stack is filed on is the NEXT message on the same wire. Without
  // it, a poll whose first tick already saw the chip go returns before the
  // reply lands, and the ⌘Z after it spends a stack that is still empty — the
  // very gap this helper was written to close, left open by one message.
  //
  // The keys already wait exactly this (`support/caret.ts`'s take: wait for the
  // row the snapshot painted, then one frame), so the ritual here is theirs
  // rather than a new idea — grok's one follow-up from the review of #199, and
  // the reason the pointer and the keys now agree about when this tab has the
  // way back.
  //
  // Not on the refusal: a page that has SAID why it did not has already been
  // answered — the sentence is what the answer was — so there is no later
  // message to wait out, and waiting one would be every refusal scenario
  // paying a frame for nothing.
  if (drawn) await world.waitForFrame();
};

/**
 * Choose a hit, and wait for the panel to carry the write.
 *
 * A COUNT rather than the chip's own `data-ref`, because what this step is
 * given is a TITLE and the chips are keyed by id. One more of them is the same
 * claim, and it is the claim this panel can make about a write it just sent.
 */
When(
  "I choose {string} from the edge panel",
  async function (this: OlaiWorld, title: string) {
    const held = (await panelOf(this)).locator(`${EDGE_HELD} ${EDGE_DROP}`);
    const before = await held.count();
    const hit = (await panelOf(this))
      .locator(EDGE_HIT)
      .filter({ hasText: title })
      .first();
    await this.press(hit);
    await drawnOrSaid(
      this,
      async () => (await held.count()) > before,
      `the panel to draw ${JSON.stringify(title)} among what this node names`,
    );
  },
);

Then(
  "the edge panel holds {string}",
  async function (this: OlaiWorld, target: string) {
    await (await panelOf(this))
      .locator(`${EDGE_HELD} ${attr("data-ref", target)}`)
      .first()
      .waitFor({ state: "visible", timeout: POLL_TIMEOUT });
  },
);

/**
 * THE CARET ON THE `×`, and whether it is still there afterwards.
 *
 * The panel is a writing surface somebody keyboards around, and its chips ride
 * on the page's reading: every frame the store publishes replaces the node they
 * are drawn from, so a list keyed by reference rebuilt them all, and the caret
 * of a reader who had tabbed onto an `×` went to the document body with the
 * element it was on. That is not visible in anything the panel SAYS — which is
 * why the question is asked of `document.activeElement`
 * (`docs/brainstorming/reactivity-after-the-flip.md` §3.2, finding 2.3).
 */
When("I put the caret on the edge panel's ×", async function (this: OlaiWorld) {
  await (await panelOf(this)).locator(EDGE_DROP).first().focus();
});

Then("the caret is still on the edge panel's ×", async function (this: OlaiWorld) {
  assert.strictEqual(
    await focusedOn(this),
    TESTID.edgeDrop,
    "the caret left the × while somebody else wrote to the file. The chips " +
      "were torn down and drawn again for a frame that said nothing about " +
      "them, and a control that is replaced takes the focus with it.",
  );
});

/** The panel's own `×`. Waits for the chip to GO, for the reason the choose
 *  above waits for one to arrive. */
When(
  "I drop {string} in the edge panel",
  async function (this: OlaiWorld, target: string) {
    const chip = (await panelOf(this))
      .locator(`${EDGE_DROP}${attr("data-ref", target)}`)
      .first();
    await this.press(chip);
    await drawnOrSaid(
      this,
      async () => (await chip.count()) === 0,
      `the panel to stop drawing ${JSON.stringify(target)}`,
    );
  },
);

/**
 * The `×` on a reference the PAGE draws, which is the other door onto the same
 * op — and the one a person reading a node reaches for.
 *
 * This is the step that needed the receipt above. On a loaded box the suite
 * dropped `⌘Z after a × puts the target back` three times in thirty runs
 * (`../underload.sh`), because the scenario's next gate was the FILE and the
 * chord after it reached a tab whose stack was still empty. ⌘Z then drew
 * `nothing to undo` — and the write's own late answer wiped even that
 * (`undoing.ts`'s `record` clears the said as it files the inverse), so the
 * fifteen-second failure was over a page with nothing on it to say why.
 */
When(
  "I drop {string} from the drawn {string} of {string}",
  async function (
    this: OlaiWorld,
    target: string,
    relation: string,
    id: string,
  ) {
    const chip = this.node(id)
      .locator(`${refsOf(relation)} ${REF_DROP}${attr("data-ref", target)}`)
      .first();
    await this.press(chip);
    await drawnOrSaid(
      this,
      async () => (await chip.count()) === 0,
      `the row to stop drawing ${JSON.stringify(target)} among its \`${relation}\``,
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

/** One relation's row on one node, read WHOLE — `rowReads` is `world.ts`'s
 *  now, shared with the referenced-by rows, and what is left here is which row
 *  this suite means. */
const rowOfNode = async (
  world: OlaiWorld,
  id: string,
  relation: string,
  titles: string,
): Promise<void> => {
  const row = world.node(id).locator(refsOf(relation)).first();
  await row.waitFor({ state: "visible", timeout: POLL_TIMEOUT });
  await rowReads(world, row, titles, `the \`${relation}\` row of "${id}"`);
};

/** The `after` a node DECLARES, in order — deliberately not `blocked by`,
 *  which is derived and names only what is still in the way. */
Then(
  "the node {string} comes after {string}",
  async function (this: OlaiWorld, id: string, titles: string) {
    await rowOfNode(this, id, "after", titles);
  },
);

/** The `see` row, whole — the sibling of the step above over the same helper,
 *  and its own words for the same reason the directory-side steps are two: a
 *  relation is read in the reader's language, not as a field name in a slot.
 *  Distinct from `sees {string} as {string}` beside it (`navigation_steps.ts`),
 *  which asks about ONE target's link and its title; this one asks what the
 *  row draws ALTOGETHER, which is the question a repeated target raises. */
Then(
  "the node {string} sees exactly {string}",
  async function (this: OlaiWorld, id: string, titles: string) {
    await rowOfNode(this, id, "see", titles);
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

/** The whole list, IN ORDER, because an edge write is incremental twice over:
 *  "after demo" would be satisfied by a write that added three more, and where
 *  a re-added target LANDS is the documented residual of undoing a removal —
 *  an add appends, so a scenario that only asked about membership could not
 *  tell the residual from its absence. */
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

Then(
  "{string} holds the node {string} after nothing",
  async function (this: OlaiWorld, file: string, id: string) {
    await this.waitUntil(
      async () => edgeIn(this, file, id, "after").length === 0,
      `${file} to hold ${JSON.stringify(id)} with no \`after\` at all`,
    );
  },
);
