/**
 * The reference graph: what it drew, which way the arrows point, and where a
 * dot takes you.
 *
 * Its own file rather than more of `backlinks_steps.ts`, and the reason is the
 * same division that file draws against `edge_steps.ts`: those steps are about
 * one node's page reading its references BACKWARDS, and these are about the
 * shape both directions make. Nothing here writes, except the one scenario that
 * proves the drawing is as live as every other face — and that write goes
 * through another hand's door (`live_steps.ts`), because a reference added by
 * the tab under test would prove the forward half over again.
 *
 * WHAT IS ASSERTED IS NEVER A PIXEL. Where a dot lands is `d3-force`'s answer
 * and a scenario pinning it would fail the first time the constants improved;
 * what the page PROMISES is which nodes are drawn, which arrows join them, how
 * each one refers, which node is the centre, and that a dot is a link. All five
 * are attributes (`world.ts`'s graph selectors), which is also what lets a
 * scenario tell a `see` from a mention without reading a colour.
 *
 * A LIST rather than a membership, wherever there is an order to promise: the
 * reading is in corpus order, and a step that only looked for its node would
 * pass over a graph that had grown a dot somewhere else.
 */

import * as assert from "node:assert";
import { Given, Then, When } from "@cucumber/cucumber";

import {
  attr,
  expectDrawn,
  GRAPH_CANVAS,
  GRAPH_CAPTION,
  GRAPH_CLOSER,
  GRAPH_FIT,
  GRAPH_FURTHER,
  GRAPH_EDGE,
  GRAPH_EMPTY,
  GRAPH_FILE,
  GRAPH_HORIZON,
  GRAPH_LINK,
  GRAPH_NODE,
  GRAPH_PAGE,
  NODE_GRAPH_LINK,
  NOT_FOUND,
  POLL_TIMEOUT,
  ZOOM_TITLE,
} from "../support/world.ts";
import type { OlaiWorld } from "../support/world.ts";

// ── getting there ──────────────────────────────────────────────────────

/**
 * The address, cold — waited for by what it may LAND on rather than by the
 * drawing alone: an id nothing declares draws `NotFound` and no graph at all,
 * which is the same answer `/n/` gives to the same address and is a scenario of
 * its own. Waiting on the drawing would time out on exactly the case being
 * tested.
 */
Given(
  "I open the reference graph for {string}",
  async function (this: OlaiWorld, id: string) {
    await this.openGraph(id);
    await this.page
      .locator(`${GRAPH_PAGE}, ${NOT_FOUND}`)
      .first()
      .waitFor({ state: "visible", timeout: POLL_TIMEOUT });
  },
);

Given(
  "I open the reference graph for the directory",
  async function (this: OlaiWorld) {
    await this.openWholeGraph();
    await this.page
      .locator(GRAPH_PAGE)
      .waitFor({ state: "visible", timeout: POLL_TIMEOUT });
  },
);

/** The door on a NODE's own page — the half of the feature that is about
 *  reaching it from where a reader already is, rather than about the address. */
When("I follow the reference graph link", async function (this: OlaiWorld) {
  await this.press(this.page.locator(NODE_GRAPH_LINK).first());
  await this.page
    .locator(GRAPH_PAGE)
    .waitFor({ state: "visible", timeout: POLL_TIMEOUT });
});

/** ...and the door in the directory column, which opens the reading with no
 *  centre at all. */
When("I follow the Graph link in the sidebar", async function (this: OlaiWorld) {
  await this.showSidebar();
  await this.press(this.page.locator(GRAPH_LINK).first());
  await this.page
    .locator(GRAPH_PAGE)
    .waitFor({ state: "visible", timeout: POLL_TIMEOUT });
});

// ── what it drew ───────────────────────────────────────────────────────

Then(
  "the graph draws the nodes {string}",
  async function (this: OlaiWorld, ids: string) {
    await this.waitUntil(
      async () => (await dots(this)).join(", ") === ids,
      `the graph to draw ${JSON.stringify(ids)}`,
    );
  },
);

Then(
  "the graph draws {int} nodes",
  async function (this: OlaiWorld, many: number) {
    await this.waitUntil(
      async () => (await dots(this)).length === many,
      `the graph to draw ${many} nodes`,
    );
  },
);

/**
 * The arrows, each as `<from> <ways> <to>` — the direction it was written in
 * and how that record refers, which is the whole of what an edge claims.
 */
Then(
  "the graph draws the arrows {string}",
  async function (this: OlaiWorld, arrows: string) {
    await this.waitUntil(
      async () => (await edges(this)).join(", ") === arrows,
      `the graph to draw the arrows ${JSON.stringify(arrows)}`,
    );
  },
);

Then("the graph draws no arrows", async function (this: OlaiWorld) {
  await this.waitUntil(
    async () => (await this.page.locator(GRAPH_EDGE).count()) === 0,
    "the graph to draw no arrows",
  );
});

Then(
  "the graph is centred on {string}",
  async function (this: OlaiWorld, id: string) {
    await this.expectAttribute(GRAPH_PAGE, "data-focus", id, "the graph page");
    // ...and the dot itself says so, which is what the drawing is read by.
    await this.expectAttribute(
      `${GRAPH_NODE}${attr("data-focus", "true")}`,
      "data-node-id",
      id,
      "the centre of the graph",
    );
  },
);

Then("the graph is centred on nothing", async function (this: OlaiWorld) {
  await this.expectAttributeAbsent(GRAPH_PAGE, "data-focus", "the graph page");
});

/** How far from the centre a node was reached — the ring it is on, which is
 *  what a second hop adds. */
Then(
  "the graph draws {string} {int} hops out",
  async function (this: OlaiWorld, id: string, hops: number) {
    await this.expectAttribute(
      `${GRAPH_NODE}${attr("data-node-id", id)}`,
      "data-hops",
      String(hops),
      `the node \`${id}\` on the graph`,
    );
  },
);

Then(
  "the graph names the files {string}",
  async function (this: OlaiWorld, files: string) {
    await expectDrawn(this.page.locator(GRAPH_FILE), "data-file", files);
  },
);

// ── how far it reaches ─────────────────────────────────────────────────

Then(
  "the graph reaches {int} hops",
  async function (this: OlaiWorld, hops: number) {
    await this.expectAttribute(
      GRAPH_PAGE,
      "data-hops",
      String(hops),
      "the graph page",
    );
    await this.expectAttribute(
      `${GRAPH_HORIZON}${attr("data-value", String(hops))}`,
      "aria-pressed",
      "true",
      `the ${hops}-hop control`,
    );
  },
);

When(
  "I set the graph horizon to {int} hops",
  async function (this: OlaiWorld, hops: number) {
    await this.press(
      this.page.locator(`${GRAPH_HORIZON}${attr("data-value", String(hops))}`).first(),
    );
    await this.waitForFrame();
  },
);

// ── following one ──────────────────────────────────────────────────────

When(
  "I follow the graph to {string}",
  async function (this: OlaiWorld, id: string) {
    await this.press(
      this.page.locator(`${GRAPH_NODE}${attr("data-node-id", id)} a`).first(),
    );
    await this.page
      .locator(ZOOM_TITLE)
      .waitFor({ state: "visible", timeout: POLL_TIMEOUT });
  },
);

// ── what it says instead of drawing ────────────────────────────────────

Then(
  "the graph says {string}",
  async function (this: OlaiWorld, said: string) {
    const line = this.page.locator(GRAPH_EMPTY).first();
    await line.waitFor({ state: "visible", timeout: POLL_TIMEOUT });
    assert.ok(
      (await line.innerText()).includes(said),
      `the graph says ${JSON.stringify(await line.innerText())}, not ` +
        `${JSON.stringify(said)}`,
    );
  },
);

// ── the ancestry, which is what a bare title cannot say ────────────────

When(
  "I point at the graph node {string}",
  async function (this: OlaiWorld, id: string) {
    await this.page
      .locator(`${GRAPH_NODE}${attr("data-node-id", id)} a`)
      .first()
      .hover();
    await this.waitForFrame();
  },
);

Then(
  "the graph caption reads {string}",
  async function (this: OlaiWorld, said: string) {
    await this.waitUntil(
      async () => (await this.page.locator(GRAPH_CAPTION).first().innerText()) === said,
      `the graph caption to read ${JSON.stringify(said)}`,
    );
  },
);

/** The same sentence, on the dot itself — because a tip may never be the only
 *  home of one, which is this app's standing rule and the reason the caption is
 *  a copy rather than the original. */
Then(
  "the graph node {string} is labelled {string}",
  async function (this: OlaiWorld, id: string, label: string) {
    await this.expectAttribute(
      `${GRAPH_NODE}${attr("data-node-id", id)} a`,
      "aria-label",
      label,
      `the dot for \`${id}\``,
    );
  },
);

/**
 * Every node drawn, by id, in the order the page drew them — the reading's own
 * corpus order.
 *
 * POLLED rather than asserted once, which is why this is not `expectDrawn`: one
 * scenario watches a dot ARRIVE under a write another hand made, and a one-shot
 * assertion would race the frame. Named `dots` rather than `drawn` because
 * `world.ts` exports a `drawn` of its own that sibling step files import.
 */
const dots = async (world: OlaiWorld): Promise<ReadonlyArray<string>> =>
  await world.page.locator(GRAPH_NODE).evaluateAll((found) =>
    found.map((one) => one.getAttribute("data-node-id") ?? "")
  );

/** ...and every arrow, as the claim it makes, on the same terms. */
const edges = async (world: OlaiWorld): Promise<ReadonlyArray<string>> =>
  await world.page.locator(GRAPH_EDGE).evaluateAll((found) =>
    found.map((one) =>
      `${one.getAttribute("data-from") ?? ""} ${one.getAttribute("data-ways") ?? ""} ${
        one.getAttribute("data-to") ?? ""
      }`
    )
  );

// ── the camera ─────────────────────────────────────────────────────────

/**
 * WHAT THE READER IS LOOKING FROM, read off the drawing rather than off a
 * transform: `data-scale` is the one number the page publishes about the
 * camera, and `1.00` is fitted — the layout already puts the whole graph in the
 * frame, so the camera that shows everything is the one doing nothing.
 */
Then("the graph is fitted", async function (this: OlaiWorld) {
  await this.expectAttribute(GRAPH_CANVAS, "data-scale", "1.00", "the graph");
});

Then("the graph is closer than fitted", async function (this: OlaiWorld) {
  await this.waitUntil(async () => {
    const said = await this.page.locator(GRAPH_CANVAS).first().getAttribute("data-scale");
    return said !== null && Number(said) > 1;
  }, "the graph to be closer than fitted");
});

When("I move the graph camera closer", async function (this: OlaiWorld) {
  await this.press(this.page.locator(GRAPH_CLOSER).first());
  await this.waitForFrame();
});

When("I move the graph camera further away", async function (this: OlaiWorld) {
  await this.press(this.page.locator(GRAPH_FURTHER).first());
  await this.waitForFrame();
});

When("I fit the graph", async function (this: OlaiWorld) {
  await this.press(this.page.locator(GRAPH_FIT).first());
  await this.waitForFrame();
});

// ── and what it can hold ───────────────────────────────────────────────

/** A DOT IS ALWAYS DRAWN and its label is not: at a scale where every title
 *  would land on its neighbour's, only the ones that fit are written. */
Then(
  "the graph names fewer dots than it draws",
  async function (this: OlaiWorld) {
    await this.waitUntil(async () => {
      const drawn = await this.page.locator(GRAPH_NODE).count();
      const named = await this.page
        .locator(`${GRAPH_NODE}${attr("data-labelled", "true")}`)
        .count();
      return drawn > 0 && named > 0 && named < drawn;
    }, "the graph to name fewer dots than it draws");
  },
);

Then(
  "the graph names the dot {string}",
  async function (this: OlaiWorld, id: string) {
    await this.expectAttribute(
      `${GRAPH_NODE}${attr("data-node-id", id)}`,
      "data-labelled",
      "true",
      `the dot for \`${id}\``,
    );
  },
);
