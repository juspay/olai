import * as assert from "node:assert";

import { Then, When } from "@olai/tests/harness/runner.ts";

import { attr } from "@olai/tests/harness/selectors.ts";

import { APP_HEADER, type OlaiWorld, POLL_TIMEOUT } from "@olai/tests/harness/world.ts";

const BLOCK = `[data-testid="terminal-block"]`;
const ROW = `[data-dock-row]`;
const SAYS = `[data-testid="terminal-says"]`;
const PANE = `[data-testid="terminal-pane"]`;
const SCREEN = `[data-testid="terminal-screen"]`;

const blockOn = (world: OlaiWorld, id: string) => world.node(id).locator(BLOCK).first();

const rowOn = (world: OlaiWorld, id: string) => blockOn(world, id).locator(ROW).first();

Then(
  "the terminal row on {string} is {word}",
  async function (this: OlaiWorld, id: string, bucket: string) {
    await blockOn(this, id)
      .locator(`${ROW}${attr("data-bucket", bucket)}`)
      .first()
      .waitFor({ state: "visible", timeout: POLL_TIMEOUT });
    assert.equal(await blockOn(this, id).locator(SAYS).count(), 0);
  },
);

Then(
  "the terminal row on {string} is asking for you",
  async function (this: OlaiWorld, id: string) {
    await blockOn(this, id)
      .locator(`${ROW}[data-asking]`)
      .first()
      .waitFor({ state: "visible", timeout: POLL_TIMEOUT });
  },
);

Then(
  "the terminal on {string} has no row",
  async function (this: OlaiWorld, id: string) {
    const says = blockOn(this, id).locator(SAYS);
    await says.waitFor({ state: "visible", timeout: POLL_TIMEOUT });
    assert.equal(
      await blockOn(this, id).locator(ROW).count(),
      0,
      `the ${id} block should have nothing live to draw`,
    );
  },
);

Then(
  "the terminal on {string} says {string}",
  async function (this: OlaiWorld, id: string, says: string) {
    const said = await blockOn(this, id).locator(SAYS).first().textContent();
    assert.ok(
      said?.includes(says),
      `the ${id} block should say "${says}" — it said "${said}"`,
    );
  },
);

Then(
  "{string} wears no terminal door at all",
  async function (this: OlaiWorld, id: string) {
    await this.node(id).waitFor({ state: "visible", timeout: POLL_TIMEOUT });
    assert.equal(
      await this.node(id).locator(BLOCK).count(),
      0,
      `${id} should wear no terminal door — nothing licensed one`,
    );
  },
);

Then(
  "the terminal on {string} shows no door but keeps its value",
  async function (this: OlaiWorld, id: string) {
    const chip = this.node(id).locator(`[data-testid="prop"][data-key="terminal"]`).first();
    await chip.waitFor({ state: "visible", timeout: POLL_TIMEOUT });
    const drawn = await chip.locator(`[data-testid="prop-value"]`).first().textContent();
    assert.ok(
      drawn !== null && drawn.trim() !== "",
      `${id} should still draw its terminal value as text — it drew ${JSON.stringify(drawn)}`,
    );
    assert.equal(await this.node(id).locator(BLOCK).count(), 0);
  },
);

Then(
  "the terminal on {string} shows the stored value",
  async function (this: OlaiWorld, id: string) {
    const value = await blockOn(this, id).getAttribute("data-terminal");
    assert.ok(value !== null && value !== "", `the ${id} block should name its terminal`);
    const drawn = await blockOn(this, id)
      .locator(`[data-testid="prop-value"]`)
      .first()
      .textContent();
    assert.equal(drawn?.trim(), value);
  },
);

When(
  "I watch the terminal on {string}",
  async function (this: OlaiWorld, id: string) {
    await rowOn(this, id).click();
  },
);

Then(
  "a snapshot pane opens on {string}",
  async function (this: OlaiWorld, id: string) {
    await this.node(id)
      .locator(PANE)
      .first()
      .waitFor({ state: "visible", timeout: POLL_TIMEOUT });
  },
);

Then("no snapshot pane is open", async function (this: OlaiWorld) {
  await this.page
    .locator(PANE)
    .first()
    .waitFor({ state: "detached", timeout: POLL_TIMEOUT })
    .catch(async () => {
      assert.equal(await this.frontLane().locator(PANE).count(), 0);
    });
});

Then(
  "the pane refuses with {string}",
  async function (this: OlaiWorld, says: string) {
    const refused = this.page
      .locator(`${SCREEN}[data-state="refused"]`)
      .first();
    await refused.waitFor({ state: "visible", timeout: POLL_TIMEOUT });
    const said = await refused.textContent();
    assert.ok(
      said?.includes(says),
      `the pane should refuse with "${says}" — it said "${said}"`,
    );
  },
);


const PADI = `[data-testid="padi"]`;

Then(
  "the padi indicator says {string}",
  async function (this: OlaiWorld, status: string) {
    await this.readStatus(async () => {
      const pill = this.page.locator(PADI).first();
      await pill.waitFor({ state: "visible", timeout: POLL_TIMEOUT });
      await this.waitUntil(
        async () => (await pill.getAttribute("data-padi")) === status,
        `the padi indicator to say ${JSON.stringify(status)}`,
      );
    });
  },
);

Then(
  "the padi indicator is not drawn at all",
  async function (this: OlaiWorld) {
    await this.page.locator(APP_HEADER).first().waitFor({
      state: "visible",
      timeout: POLL_TIMEOUT,
    });
    const rows = await this.readStatus(() => this.page.locator(PADI).count());
    assert.equal(
      rows,
      0,
      "a serve that composed no kolu should hang no padi readout in the bar",
    );
  },
);

Then(
  "the padi indicator explains {string}",
  async function (this: OlaiWorld, says: string) {
    const said = await this.readStatus(() => this.page.locator(PADI).first().getAttribute("aria-label"));
    assert.ok(
      said?.includes(says),
      `the padi indicator should explain "${says}" — it said "${said}"`,
    );
  },
);
Then(
  "the pane is a live window rather than a snapshot",
  async function (this: OlaiWorld) {
    const pane = this.frontLane().locator(PANE).first();
    assert.ok(
      (await pane.getAttribute("class"))?.includes("olai-live"),
      "the pane should wear the solid live border",
    );
    assert.equal(await pane.locator(`[data-testid="terminal-live"]`).count(), 1);
  },
);

Then(
  "the live screen shows {string}",
  async function (this: OlaiWorld, text: string) {
    const screen = this.page.locator(`${SCREEN}[data-state="attached"]`).first();
    await screen.waitFor({ state: "visible", timeout: POLL_TIMEOUT });
    await this.waitUntil(
      async () => ((await screen.textContent()) ?? "").includes(text),
      `the live pane to show ${JSON.stringify(text)}`,
    );
  },
);

When(
  "I resize the window {int} times",
  async function (this: OlaiWorld, times: number) {
    const { height } = this.page.viewportSize() ?? { width: 1280, height: 900 };
    for (let i = 0; i < times; i += 1) {
      await this.page.setViewportSize({ width: 1280 - i * 60, height });
      await this.page.waitForTimeout(120);
    }
  },
);

Then(
  "the pane on {string} is still live",
  async function (this: OlaiWorld, id: string) {
    const screen = this.node(id).locator(SCREEN).first();
    await screen.waitFor({ state: "visible", timeout: POLL_TIMEOUT });
    const state = await screen.getAttribute("data-state");
    assert.equal(
      state,
      "attached",
      `the pane should still be attached after the resizes — it is "${state}"`,
    );
    const said = await this.node(id).locator(SCREEN).first().textContent();
    assert.ok(
      !said?.includes("probably closed"),
      `the pane declared a live terminal dead: "${said}"`,
    );
  },
);
