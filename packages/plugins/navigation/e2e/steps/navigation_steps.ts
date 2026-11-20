import * as assert from "node:assert";
import { Given, Then, When } from "@olai/tests/harness/runner.ts";
import type { Locator } from "@olai/tests/harness/playwright.ts";

import {
  attr,
  BLOCKED,
  LANDING_SAID,
  NODE_REF,
  NOT_FOUND,
  oneLine,
  POLL_TIMEOUT,
  SEE_REFS,
  TIP,
  EMPTY_UNDER,
  placeOf,
  ZOOM,
  ZOOM_TITLE,
} from "@olai/tests/harness/world.ts";
import { saysThat } from "@olai/tests/harness/said.ts";
import type { OlaiWorld } from "@olai/tests/harness/world.ts";

When(
  "I zoom into the node {string}",
  async function (this: OlaiWorld, id: string) {
    await this.clickWithin(id, ZOOM);
    await this.page
      .locator(ZOOM_TITLE)
      .waitFor({ state: "visible", timeout: POLL_TIMEOUT });
  },
);

Given("I open the node {string}", async function (this: OlaiWorld, id: string) {
  await this.openNode(id);
});

Then(
  "the zoomed node is {string}",
  async function (this: OlaiWorld, id: string) {
    await this.expectAttribute(
      ZOOM_TITLE,
      "data-node-id",
      id,
      "the zoomed page",
    );
  },
);

Then(
  "the page names that finished work is hidden",
  async function (this: OlaiWorld) {
    const said = this.page.locator(EMPTY_UNDER);
    await said.waitFor({ state: "visible", timeout: POLL_TIMEOUT });
    assert.ok(
      /Done flip/i.test(await said.innerText()),
      "the empty page names the pick that swept it, not a panel that may " +
        "say otherwise (the page can own the word itself)",
    );
  },
);

Then("the landing says {string}", async function (this: OlaiWorld, said: string) {
  await saysThat(this, LANDING_SAID, said, "the landing's answer", "alarm");
});

Then("the landing's sentence has gone", async function (this: OlaiWorld) {
  await this.waitUntil(
    async () => (await this.page.locator(LANDING_SAID).count()) === 0,
    "the landing's said line to take itself away",
  );
});

Then("the landing's sentence has gone with its page", async function (this: OlaiWorld) {
  await this.waitUntil(
    async () => (await this.page.locator(LANDING_SAID).count()) === 0,
    "the landing's said line to leave with the page it was said for, well before its own clock would have",
    1_000,
  );
});

Then("the address is {string}", async function (this: OlaiWorld, path: string) {
  await this.page
    .waitForURL((url) => placeOf(url) === path, { timeout: POLL_TIMEOUT })
    .catch(() => undefined);
  assert.strictEqual(this.place(), path);
});

Then("the address's query is {string}", async function (this: OlaiWorld, query: string) {
  await this.page
    .waitForURL((url) => url.search === query, { timeout: POLL_TIMEOUT })
    .catch(() => undefined);
  assert.strictEqual(new URL(this.page.url()).search, query);
});

Then(
  "the breadcrumbs are {string}",
  async function (this: OlaiWorld, expected: string) {
    const trail = this.crumbs();
    await trail
      .first()
      .waitFor({ state: "visible", timeout: POLL_TIMEOUT })
      .catch(() => undefined);
    assert.deepStrictEqual(
      (await trail.allInnerTexts()).map(oneLine),
      expected.split(",").map((crumb) => crumb.trim()),
    );
  },
);

When(
  "I follow the breadcrumb {string}",
  async function (this: OlaiWorld, label: string) {
    const crumb = this.crumbs().filter({ hasText: label }).first();
    await crumb.waitFor({ state: "visible", timeout: POLL_TIMEOUT });
    await crumb.click();
    await this.waitForFrame();
  },
);

Then("a not-found is shown", async function (this: OlaiWorld) {
  await this.page
    .locator(NOT_FOUND)
    .waitFor({ state: "visible", timeout: POLL_TIMEOUT });
});

const seeLinkTo = (world: OlaiWorld, source: string, target: string) =>
  world
    .node(source)
    .locator(`${SEE_REFS} ${NODE_REF}:has(${attr("data-ref", target)})`)
    .first();

const followRef = async (world: OlaiWorld, link: Locator): Promise<void> => {
  await world.press(link)
};

Then(
  "the node {string} sees {string} as {string}",
  async function (
    this: OlaiWorld,
    source: string,
    target: string,
    title: string,
  ) {
    const link = seeLinkTo(this, source, target);
    await link.waitFor({ state: "visible", timeout: POLL_TIMEOUT });
    await this.node(source)
      .locator(SEE_REFS)
      .first()
      .waitFor({ state: "visible", timeout: POLL_TIMEOUT });
    assert.strictEqual(
      oneLine(await link.innerText()),
      title,
      `the see link on "${source}" to "${target}" does not show the target's title`,
    );
  },
);

When(
  "I follow the see link to {string} on {string}",
  async function (this: OlaiWorld, target: string, source: string) {
    await followRef(this, seeLinkTo(this, source, target));
  },
);

When(
  "I follow the blocked link to {string} on {string}",
  async function (this: OlaiWorld, blocker: string, id: string) {
    await followRef(
      this,
      this.node(id).locator(`${BLOCKED} ${attr("data-ref", blocker)}`).first(),
    );
  },
);

When(
  "I follow the waiting mark on {string}",
  async function (this: OlaiWorld, id: string) {
    await this.press(this.within(id, BLOCKED));
    await this.page.locator(ZOOM_TITLE).waitFor({ state: "visible", timeout: POLL_TIMEOUT });
  },
);

Then("a tip says {string}", async function (this: OlaiWorld, said: string) {
  const tips = this.page.locator(TIP);
  assert.strictEqual(
    await tips.count(),
    1,
    "more than one tip is on screen; only one may ever be",
  );
  assert.strictEqual(oneLine(await tips.first().innerText()), said);
});

Given("the window is shorter than the page", async function (this: OlaiWorld) {
  const size = this.viewport();
  await this.page.setViewportSize({ width: size.width, height: 400 });
});

const scrollTop = (world: OlaiWorld): Promise<number> =>
  world.page.evaluate(() => window.scrollY);

const toTheBottom = async (world: OlaiWorld): Promise<void> => {
  await world.page.evaluate(() => document.fonts.ready);
  await world.waitUntil(
    async () =>
      world.page.evaluate(
        () => document.documentElement.scrollHeight > window.innerHeight,
      ),
    "the page to be taller than the window",
  );
  await world.waitUntil(async () => {
    await world.page.evaluate(() => {
      window.scrollTo(0, document.documentElement.scrollHeight);
    });
    await world.waitForFrame();
    return world.page.evaluate(() => {
      const bottom = document.documentElement.scrollHeight - innerHeight;
      return bottom > 0 && scrollY > 0 && Math.abs(scrollY - bottom) <= 2;
    });
  }, "the rendered page to settle at its bottom");
};

const leftItHere = async (world: OlaiWorld): Promise<void> => {
  world.scrolledTo = await scrollTop(world);
  assert.ok(
    world.scrolledTo > 0,
    "the page does not scroll in this window, so scrolling it proves nothing",
  );
};

When("I scroll to the bottom of the page", async function (this: OlaiWorld) {
  await toTheBottom(this);
  await leftItHere(this);
});

When(
  "I scroll to the bottom of the page, keeping the bullet of {string} pressable",
  async function (this: OlaiWorld, id: string) {
    await toTheBottom(this);
    await this.intoReach(this.within(id, ZOOM), `the bullet of "${id}"`);
    await leftItHere(this);
  },
);

const expectScroll = async (
  world: OlaiWorld,
  top: number,
  what: string,
): Promise<void> => {
  try {
    await world.waitUntil(async () => (await scrollTop(world)) === top, what);
  } catch {
    throw new Error(`${what}, and it is at ${await scrollTop(world)}px instead`);
  }
};

Then("the page is at the top", async function (this: OlaiWorld) {
  await expectScroll(this, 0, "the page is at the top");
});

When("I go back", async function (this: OlaiWorld) {
  await this.page.goBack();
  await this.waitForFrame();
});

When("I go forward", async function (this: OlaiWorld) {
  await this.page.goForward();
  await this.waitForFrame();
});

Then("the page is back where I left it", async function (this: OlaiWorld) {
  const left = this.scrolledTo;
  assert.ok(left !== undefined, "nothing scrolled the page first");
  const slop = 8;
  try {
    await this.waitUntil(
      async () => Math.abs((await scrollTop(this)) - left) <= slop,
      `the page is back at ${left}px`,
    );
  } catch {
    throw new Error(
      `the page is back at ${left}px, and it is at ${await scrollTop(this)}px instead`,
    );
  }
});
