import * as assert from "node:assert";

import { Then, When } from "@olai/tests/harness/runner.ts";

import { aboveTitle, carry, titleOf } from "@olai/tests/harness/dragging.ts";
import { childOf, notChildOf } from "@olai/tests/harness/nesting.ts";
import { saysThat } from "@olai/tests/harness/said.ts";
import {
  DROP_LINE,
  POLL_TIMEOUT,
} from "@olai/tests/harness/world.ts";
import {
  DROP_REFUSED,
} from "../selectors.ts";
import type { OlaiWorld } from "@olai/tests/harness/world.ts";

When(
  "I pick up the bullet of {string} in pane {int} and hold it above the title of {string} in pane {int}",
  async function (this: OlaiWorld, id: string, from: number, above: string, to: number) {
    const target = this.pane(to);
    await carry(this, this.pane(from), id, await aboveTitle(this, target, above));
  },
);

When(
  "I pick up the bullet of {string} in pane {int} and hold it over the title of {string} in pane {int}",
  async function (this: OlaiWorld, id: string, from: number, over: string, to: number) {
    const box = await this.box(
      titleOf(this.pane(to), over),
      `the title of "${over}" in pane ${to}`,
    );
    await carry(
      this,
      this.pane(from),
      id,
      { x: box.x + box.width / 2, y: box.y + box.height / 2 },
      DROP_REFUSED,
    );
  },
);

Then(
  "the drop line is drawn over pane {int}",
  async function (this: OlaiWorld, index: number) {
    const line = await this.box(this.page.locator(DROP_LINE).first(), "the drop line");
    const pane = await this.box(this.pane(index).first(), `pane ${index}`);
    const middle = line.x + line.width / 2;
    assert.ok(
      middle >= pane.x && middle <= pane.x + pane.width,
      `the drop line is drawn at x ${Math.round(line.x)}–${
        Math.round(line.x + line.width)
      }, which is not over pane ${index} (x ${Math.round(pane.x)}–${
        Math.round(pane.x + pane.width)
      })`,
    );
  },
);

Then(
  "the drop is refused by {string}",
  async function (this: OlaiWorld, file: string) {
    await this.expectChromeAttribute(DROP_REFUSED, "data-file", file, "the refusal");
  },
);

Then(
  "the refused pane says {string}",
  async function (this: OlaiWorld, said: string) {
    await saysThat(this, DROP_REFUSED, said, "refusal over the pane", undefined, this.page);
  },
);

Then(
  "the refused pane does not say {string}",
  async function (this: OlaiWorld, said: string) {
    const face = this.page.locator(DROP_REFUSED).first();
    await face.waitFor({ state: "visible", timeout: POLL_TIMEOUT });
    const text = (await face.innerText()).trim();
    assert.ok(
      !text.includes(said),
      `the refusal reads ${JSON.stringify(text)}, which mentions ${JSON.stringify(said)} and should not`,
    );
  },
);

Then("no drop line is drawn", async function (this: OlaiWorld) {
  await this.waitUntil(
    async () => (await this.page.locator(DROP_LINE).count()) === 0,
    "no drop line to be drawn",
  );
});

Then("no drop is refused", async function (this: OlaiWorld) {
  await this.waitUntil(
    async () => (await this.page.locator(DROP_REFUSED).count()) === 0,
    "no refusal to be drawn",
  );
});

Then(
  "the node {string} is a child of {string} in pane {int}",
  async function (this: OlaiWorld, child: string, parent: string, index: number) {
    await childOf(this, this.pane(index), child, parent, ` in pane ${index}`);
  },
);

Then(
  "the node {string} is not a child of {string} in pane {int}",
  async function (this: OlaiWorld, child: string, parent: string, index: number) {
    await notChildOf(this, this.pane(index), child, parent, ` in pane ${index}`);
  },
);
