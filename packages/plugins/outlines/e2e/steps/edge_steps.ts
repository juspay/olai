import { TESTID } from "@olai/tests/harness/testids.ts"
import * as assert from "node:assert";
import { Then, When } from "@olai/tests/harness/runner.ts";


import {
  attr,
  EDGE_HELD,
  POLL_TIMEOUT,
  rowReads,
  SEE_REFS,
  TAG,
} from "@olai/tests/harness/world.ts";
import {
  AFTER_REFS,
  EDGE_DROP,
  EDGE_HIT,
  EDGE_PANEL,
  EDGE_SAID,
  EDGE_SEARCH,
  EDGE_VERB,
  REF_DROP,
} from "../selectors.ts";
import type { OlaiWorld } from "@olai/tests/harness/world.ts";
import { focusedOn } from "@olai/tests/harness/caret.ts";
import { saysThat } from "@olai/tests/harness/said.ts";
import { answering } from "@olai/tests/harness/shortlist.ts";
import { retypedAndTaken } from "@olai/tests/harness/atonce.ts";

const panelOf = async (world: OlaiWorld) => {
  const panel = world.page.locator(EDGE_PANEL).first();
  await panel.waitFor({ state: "visible", timeout: POLL_TIMEOUT });
  return panel;
};

const refsOf = (relation: string): string => {
  if (relation === "see") return SEE_REFS;
  if (relation === "after") return AFTER_REFS;
  throw new Error(`there is no drawn row for a \`${relation}\` relation`);
};

const edgeIn = (
  world: OlaiWorld,
  file: string,
  id: string,
  field: string,
): ReadonlyArray<string> => {
  const node = world.servedNodesSoFar(file).find((one) => one["id"] === id);
  return (node?.[field] ?? []) as ReadonlyArray<string>;
};

Then(
  "the {word} panel is open on {string}",
  async function (this: OlaiWorld, relation: string, id: string) {
    const panel = await panelOf(this);
    assert.strictEqual(
      await panel.getAttribute("data-relation"),
      relation,
      `the open edge panel is not the ${relation} one`,
    );
    await this.node(id)
      .locator(EDGE_PANEL)
      .first()
      .waitFor({ state: "visible", timeout: POLL_TIMEOUT });
  },
);

When(
  "I open the {word} panel from the page",
  async function (this: OlaiWorld, relation: string) {
    await this.press(
      this.page.locator(`${EDGE_VERB}${attr("data-relation", relation)}`),
    );
    await panelOf(this);
  },
);

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
  if (drawn) await world.waitForFrame();
};

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

Then(
  "the name the panel holds for {string} styles the tag {string}",
  async function (this: OlaiWorld, target: string, tag: string) {
    await (await panelOf(this))
      .locator(`${EDGE_HELD} ${attr("data-ref", target)} ${TAG}`)
      .filter({ hasText: tag })
      .first()
      .waitFor({ state: "visible", timeout: POLL_TIMEOUT });
  },
);

When(
  "I press the tag {string} the panel's name for {string} carries",
  async function (this: OlaiWorld, tag: string, target: string) {
    await this.press(
      (await panelOf(this))
        .locator(`${EDGE_HELD} ${attr("data-ref", target)} ${TAG}`)
        .filter({ hasText: tag })
        .first(),
    );
  },
);

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

Then(
  "the edge panel says {string}",
  async function (this: OlaiWorld, said: string) {
    await saysThat(this, EDGE_SAID, said, "edge panel's said line", "alarm");
  },
);

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

Then(
  "the node {string} comes after {string}",
  async function (this: OlaiWorld, id: string, titles: string) {
    await rowOfNode(this, id, "after", titles);
  },
);

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

Then("the edge panel search reads {string}", async function (this: OlaiWorld, query: string) {
  const box = (await panelOf(this)).locator(EDGE_SEARCH);
  await this.waitUntil(async () => (await box.inputValue()) === query,
    `the edge panel to retain the query ${JSON.stringify(query)}`);
});

Then("the edge panel's search box asks for a Go key and no corrections", async function (this: OlaiWorld) {
  const box = (await panelOf(this)).locator(EDGE_SEARCH);
  await box.waitFor({ state: "visible", timeout: POLL_TIMEOUT });
  assert.equal(await box.getAttribute("enterkeyhint"), "go", "the shortlist's enterkeyhint");
  assert.equal(await box.getAttribute("autocapitalize"), "none", "the shortlist's autocapitalize");
  assert.equal(await box.getAttribute("autocorrect"), "off", "the shortlist's autocorrect");
  assert.equal(await box.getAttribute("spellcheck"), "false", "the shortlist's spellcheck");
});

Then("no edge panel is open", async function (this: OlaiWorld) {
  await this.waitUntil(async () => (await this.page.locator(EDGE_PANEL).count()) === 0,
    "the edge panel to be closed");
});

Then("the edge search has requested {string} without relabelling its retained rows", async function(this: OlaiWorld, query: string) {
  await this.waitUntil(async () => this.socketAskedSince("searchResults", query) > 0, "the debounced search to reach the wire while its reply is held");
  assert.equal(await this.page.locator(`${EDGE_PANEL} [data-asked]`).count(), 0,
    "old search rows must not acquire the new query label before its answer arrives");
  assert.ok((await this.page.locator(EDGE_HIT).first().innerText()).includes("the compost heap"));
});
