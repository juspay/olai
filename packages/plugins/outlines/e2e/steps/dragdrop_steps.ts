import * as assert from "node:assert";

import { Given, Then, When } from "@olai/tests/harness/runner.ts";

import {
  aboveTitle,
  carry,
  farInside,
  handleOf,
  insideTitle,
  ONE_STEP,
  pressBullet,
} from "@olai/tests/harness/dragging.ts";
import { saysNothing, saysThat } from "@olai/tests/harness/said.ts";
import {
  DROP_LINE,
  NODE,
  nodeSelector,
  OUTLINE_TREE,
  POLL_TIMEOUT,
  SELECTION_SAID,
} from "@olai/tests/harness/world.ts";
import {
  SELECTION_BAR,
  SELECTION_CONFIRM,
  SELECTION_NOTE,
  SELECTION_TRASH,
  SWEEP_BAND,
} from "../selectors.ts";
import type { OlaiWorld } from "@olai/tests/harness/world.ts";

When(
  "I pick up the bullet of {string} and hold it above the title of {string}",
  async function (this: OlaiWorld, id: string, above: string) {
    const here = this.everywhere();
    await carry(this, here, id, await aboveTitle(this, here, above));
  },
);

When(
  "I pick up the bullet of {string} and hold it one step in under the title of {string}",
  async function (this: OlaiWorld, id: string, under: string) {
    const here = this.everywhere();
    await carry(this, here, id, await insideTitle(this, here, under));
  },
);

When(
  "I pick up the bullet of {string} and hold it far inside the title of {string}",
  async function (this: OlaiWorld, id: string, under: string) {
    const here = this.everywhere();
    await carry(this, here, id, await farInside(this, here, under));
  },
);

When("I let go", async function (this: OlaiWorld) {
  await this.page.mouse.up();
  await this.waitForFrame();
});

Then("no drop line is shown", async function (this: OlaiWorld) {
  await this.page.locator(DROP_LINE).waitFor({ state: "hidden", timeout: POLL_TIMEOUT });
});

When(
  "I drag the bullet of {string} above the title of {string}",
  async function (this: OlaiWorld, id: string, above: string) {
    const here = this.everywhere();
    await carry(this, here, id, await aboveTitle(this, here, above));
    await this.page.mouse.up();
    await this.waitForFrame();
  },
);

When(
  "I drag the bullet of {string} one step in under the title of {string}",
  async function (this: OlaiWorld, id: string, under: string) {
    const here = this.everywhere();
    await carry(this, here, id, await insideTitle(this, here, under));
    await this.page.mouse.up();
    await this.waitForFrame();
  },
);

When("I click the bullet of {string}", async function (this: OlaiWorld, id: string) {
  await this.press(handleOf(this.everywhere(), id));
});

Then(
  "the drop line would put it under {string}",
  async function (this: OlaiWorld, parent: string) {
    await this.expectChromeAttribute(DROP_LINE, "data-parent", parent, "the drop line");
  },
);

Then(
  "the drop line would put it after {string}",
  async function (this: OlaiWorld, sibling: string) {
    await this.expectChromeAttribute(DROP_LINE, "data-after", sibling, "the drop line");
  },
);

Then("the drop line would put it first", async function (this: OlaiWorld) {
  await this.expectChromeAttribute(DROP_LINE, "data-after", "", "the drop line");
});

Then(
  "the drop line names nothing under {string}",
  async function (this: OlaiWorld, branch: string) {
    const line = this.page.locator(DROP_LINE);
    await line.waitFor({ state: "attached", timeout: POLL_TIMEOUT });
    const inside = await this.page
      .locator(`${nodeSelector(branch)} ${NODE}`)
      .evaluateAll((rows) => rows.map((row) => row.getAttribute("data-node-id")));
    const named = [
      await line.getAttribute("data-parent"),
      await line.getAttribute("data-after"),
    ];
    for (const id of [branch, ...inside]) {
      assert.ok(
        !named.includes(id),
        `the drop line offers to put the row beside "${id}", which is inside the branch being dragged`,
      );
    }
  },
);

When("I pick the title of {string}", async function (this: OlaiWorld, id: string) {
  await this.nodeTitle(id).click({ modifiers: ["ControlOrMeta"] });
  await this.waitForFrame();
});

When("I shift-click the title of {string}", async function (this: OlaiWorld, id: string) {
  await this.nodeTitle(id).click({ modifiers: ["Shift"] });
  await this.waitForFrame();
});

Then("{int} rows are picked", async function (this: OlaiWorld, many: number) {
  await this.expectAttribute(
    SELECTION_BAR,
    "data-rows",
    String(many),
    "the pick",
  );
});

Then("no rows are picked", async function (this: OlaiWorld) {
  await this.waitUntil(
    async () => (await this.page.locator(SELECTION_BAR).count()) === 0,
    "the pick to be put away",
  );
});

Then("the row {string} is picked", async function (this: OlaiWorld, id: string) {
  await this.expectNodeAttribute(id, "data-picked", "true");
});

Then("the row {string} is not picked", async function (this: OlaiWorld, id: string) {
  await this.expectAttributeAbsent(
    nodeSelector(id),
    "data-picked",
    `node "${id}"`,
  );
});

Then("the pick says {string}", async function (this: OlaiWorld, said: string) {
  await saysThat(this, SELECTION_SAID, said, "pick", "alarm");
});

Then("the pick notes {string}", async function (this: OlaiWorld, said: string) {
  await saysThat(this, SELECTION_NOTE, said, "pick");
});

Then("nothing is said about the pick", async function (this: OlaiWorld) {
  await saysNothing(
    this,
    [SELECTION_SAID],
    "the pick to have nothing said about it",
  );
});

Then("the pick is not asking anything", async function (this: OlaiWorld) {
  await this.waitUntil(
    async () => (await this.page.locator(SELECTION_CONFIRM).count()) === 0,
    "the Trash question to have been put away with its rows",
  );
});

const railBeside = async (
  world: OlaiWorld,
  id: string,
): Promise<{ x: number; y: number }> => {
  const at = await world.node(id).first().evaluate((row) => {
    const list = row.parentElement?.closest("ul")
    const line = row.querySelector("[data-row-key]")
    if (list === null || list === undefined || line === null) return null
    const box = list.getBoundingClientRect()
    const on = line.getBoundingClientRect()
    return { x: box.x + 4, y: on.y + on.height / 2 }
  });
  assert.ok(at !== null, `the row "${id}" is not inside a list with a rail beside it`);
  return at;
};

const belowTheOutline = async (world: OlaiWorld): Promise<{ x: number; y: number }> => {
  const tree = await world.box(world.page.locator(OUTLINE_TREE).first(), "the outline");
  return { x: tree.x + ONE_STEP, y: tree.y + tree.height + 24 };
};

const sweepFrom = async (
  world: OlaiWorld,
  from: { x: number; y: number },
  to: { x: number; y: number },
): Promise<void> => {
  await world.page.mouse.move(from.x, from.y);
  await world.page.mouse.down();
  await world.page.mouse.move(to.x, to.y, { steps: 12 });
  await world.waitForFrame();
};

When(
  "I sweep from beside {string} down to {string}",
  async function (this: OlaiWorld, from: string, to: string) {
    const start = await railBeside(this, from);
    const end = await railBeside(this, to);
    await sweepFrom(this, start, { x: start.x, y: end.y });
  },
);

When(
  "I sweep from below the outline up to {string}",
  async function (this: OlaiWorld, to: string) {
    const start = await belowTheOutline(this);
    const end = await railBeside(this, to);
    await sweepFrom(this, start, { x: start.x, y: end.y });
  },
);

When(
  "I sweep from beside {string} to the bottom of the window",
  async function (this: OlaiWorld, from: string) {
    const start = await railBeside(this, from);
    await this.page.mouse.move(start.x, start.y);
    await this.page.mouse.down();
    await holdAtTheEdge(this, start.x);
  },
);

When("I press below the outline", async function (this: OlaiWorld) {
  const at = await belowTheOutline(this);
  await this.page.mouse.click(at.x, at.y);
  await this.waitForFrame();
});

When(
  "I select text across the title of {string}",
  async function (this: OlaiWorld, id: string) {
    const box = await this.box(this.nodeTitle(id), `the title of "${id}"`);
    await this.page.mouse.move(box.x + 4, box.y + box.height / 2);
    await this.page.mouse.down();
    await this.page.mouse.move(box.x + box.width - 4, box.y + box.height * 3, { steps: 12 });
    await this.waitForFrame();
  },
);

Then("the band is crossing {int} rows", async function (this: OlaiWorld, many: number) {
  await this.expectChromeAttribute(SWEEP_BAND, "data-rows", String(many), "the sweep's band");
});

Then("no band is drawn", async function (this: OlaiWorld) {
  await this.waitUntil(
    async () => (await this.page.locator(SWEEP_BAND).count()) === 0,
    "the sweep's band not to be drawn",
  );
});

Then("the words are selected", async function (this: OlaiWorld) {
  const said = await this.page.evaluate(() => window.getSelection()?.toString() ?? "");
  assert.ok(
    said.trim().length > 0,
    "the pull selected no text at all — the marquee has taken the browser's own gesture",
  );
});

const AT_THE_EDGE = 8;

Given("the window is shorter than the outline", async function (this: OlaiWorld) {
  await this.shrinkToScroll(SHORT_WINDOW.width, SHORT_WINDOW.height);
});

const SHORT_WINDOW = { width: 1_100, height: 400 };

const holdAtTheEdge = async (world: OlaiWorld, x: number): Promise<void> => {
  const view = world.viewport();
  await world.page.mouse.move(x, view.height - AT_THE_EDGE, { steps: 10 });
  await world.waitUntil(
    async () => (await world.page.evaluate(() => window.scrollY)) > 0,
    "the page to start moving under the gesture",
  );
  await world.waitForFrame();
};

When(
  "I pick up the bullet of {string} and hold it at the bottom of the window",
  async function (this: OlaiWorld, id: string) {
    const box = await pressBullet(this, this.everywhere(), id);
    await holdAtTheEdge(this, box.x + ONE_STEP);
  },
);

Then("the pick offers the Trash", async function (this: OlaiWorld) {
  await this.page
    .locator(SELECTION_TRASH)
    .waitFor({ state: "visible", timeout: POLL_TIMEOUT });
});

Then("the pick does not offer the Trash", async function (this: OlaiWorld) {
  await this.waitUntil(
    async () => (await this.page.locator(SELECTION_TRASH).count()) === 0,
    "the Trash verb not to be offered",
  );
});

When("I press the Trash", async function (this: OlaiWorld) {
  await this.press(this.page.locator(SELECTION_TRASH).first());
});

Then("the question names {string}", async function (this: OlaiWorld, said: string) {
  await saysThat(this, SELECTION_CONFIRM, said, "question");
});
