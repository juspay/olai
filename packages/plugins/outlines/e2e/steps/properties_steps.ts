import * as assert from "node:assert";
import { Then, When } from "@olai/tests/harness/runner.ts";

import { saysThat } from "@olai/tests/harness/said.ts";
import { keysSettled } from "@olai/tests/harness/settling.ts";
import {
  attr,
  nodeSelector,
  oneLine,
  POLL_TIMEOUT,
  PROP,
  PROP_EDIT,
  PROP_EDIT_KEY,
  PROP_VALUE,
  PROPS,
} from "@olai/tests/harness/world.ts";
import {
  PROP_ADD,
  PROP_FOLD,
  PROP_KEY,
  PROP_SAID,
} from "../selectors.ts";
import type { OlaiWorld } from "@olai/tests/harness/world.ts";

const line = (world: OlaiWorld, id: string, key: string) =>
  world.page.locator(`${nodeSelector(world.nodeId(id))} ${PROP}${attr("data-key", key)}`);

Then(
  "the property {string} on {string} stays within the screen",
  async function (this: OlaiWorld, key: string, id: string) {
    const chip = line(this, id, key);
    await chip.waitFor({ state: "visible", timeout: POLL_TIMEOUT });
    const bounds = await chip.locator("a").evaluateAll((links) => links.map((link) => {
      const rect = link.getBoundingClientRect();
      return { left: rect.left, right: rect.right, width: innerWidth };
    }));
    assert.ok(bounds.length > 0);
    for (const found of bounds) assert.ok(found.left >= 0 && found.right <= found.width, JSON.stringify(found));
  },
);

Then(
  "the node {string} shows the property {string} holding {string}",
  async function (this: OlaiWorld, id: string, key: string, value: string) {
    const found = line(this, id, key).locator(PROP_VALUE);
    await found.waitFor({ state: "visible", timeout: POLL_TIMEOUT });
    let drawn = "";
    await this.waitUntil(
      async () => {
        drawn = oneLine(await found.innerText());
        return drawn === value;
      },
      `\`${key}\` on ${JSON.stringify(id)} to hold ${JSON.stringify(value)}`,
    ).catch(() => {
      assert.fail(`\`${key}\` on ${JSON.stringify(id)} draws ${JSON.stringify(drawn)}, not ${JSON.stringify(value)}`)
    });
  },
);

Then(
  "the node {string} shows no property {string}",
  async function (this: OlaiWorld, id: string, key: string) {
    await this.waitUntil(
      async () => (await line(this, id, key).count()) === 0,
      `the drawer on ${JSON.stringify(id)} to stop showing ${JSON.stringify(key)}`,
    );
  },
);

Then(
  "the property {string} on {string} is read-only",
  async function (this: OlaiWorld, key: string, id: string) {
    const found = line(this, id, key);
    await found.waitFor({ state: "attached", timeout: POLL_TIMEOUT });
    assert.strictEqual(
      await found.getAttribute("data-system"),
      "true",
      `${JSON.stringify(key)} is drawn as a property somebody may edit`,
    );
  },
);

Then(
  "the node {string} shows no drawer",
  async function (this: OlaiWorld, id: string) {
    assert.strictEqual(
      await this.page.locator(`${nodeSelector(id)} ${PROPS}`).count(),
      0,
      "the row draws a properties drawer, and this step says it has nothing to draw",
    );
  },
);

const door = (world: OlaiWorld, id: string, key: string) =>
  line(world, id, key).locator(`${PROP_VALUE} [data-door] a`);

Then(
  "the property {string} on {string} is a {string} door to {string}",
  async function (this: OlaiWorld, key: string, id: string, kind: string, href: string) {
    const found = door(this, id, key);
    await found.waitFor({ state: "visible", timeout: POLL_TIMEOUT });
    assert.strictEqual(
      await line(this, id, key).locator(PROP_VALUE).locator("[data-door]").getAttribute(
        "data-door",
      ),
      kind,
      `\`${key}\` on ${JSON.stringify(id)} is not a ${kind} door`,
    );
    assert.strictEqual(await found.getAttribute("href"), href);
  },
);

Then(
  "the property {string} on {string} is not a link",
  async function (this: OlaiWorld, key: string, id: string) {
    const value = line(this, id, key).locator(PROP_VALUE);
    await value.waitFor({ state: "visible", timeout: POLL_TIMEOUT });
    assert.strictEqual(
      await value.locator("[data-door]").count(),
      0,
      `\`${key}\` on ${JSON.stringify(id)} was drawn as a door, and this step says it names nothing`,
    );
    assert.strictEqual(
      await value.locator("a").count(),
      0,
      `\`${key}\` on ${JSON.stringify(id)} is a link with no door behind it`,
    );
  },
);

Then(
  "the property {string} on {string} opens in a tab of its own",
  async function (this: OlaiWorld, key: string, id: string) {
    const found = door(this, id, key);
    await found.waitFor({ state: "visible", timeout: POLL_TIMEOUT });
    assert.strictEqual(await found.getAttribute("target"), "_blank");
    const rel = (await found.getAttribute("rel")) ?? "";
    for (const word of ["noopener", "noreferrer"]) {
      assert.ok(
        rel.split(/\s+/).includes(word),
        `the door on \`${key}\` carries rel=${JSON.stringify(rel)}, without ${word}`,
      );
    }
  },
);

When(
  "I follow the property {string} on {string}",
  async function (this: OlaiWorld, key: string, id: string) {
    await this.press(door(this, id, key));
  },
);

Then(
  "the properties on {string} read {string}",
  async function (this: OlaiWorld, id: string, expected: string) {
    const chips = this.page.locator(`${nodeSelector(id)} ${PROPS}`).first().locator(PROP);
    await chips.first().waitFor({ state: "visible", timeout: POLL_TIMEOUT });
    const wanted = expected.split(",").map((key) => key.trim());
    const drawn = async () =>
      await chips.evaluateAll((found) => found.map((one) => one.getAttribute("data-key") ?? ""));
    await this.waitUntil(
      async () => JSON.stringify(await drawn()) === JSON.stringify(wanted),
      `the run on ${JSON.stringify(id)} to read ${JSON.stringify(expected)}`,
    );
    assert.deepStrictEqual(await drawn(), wanted);
  },
);

Then(
  "the property {string} on {string} is folded",
  async function (this: OlaiWorld, key: string, id: string) {
    const fold = line(this, id, key).locator(PROP_FOLD);
    await fold.waitFor({ state: "attached", timeout: POLL_TIMEOUT });
    assert.strictEqual(
      await fold.getAttribute("open"),
      null,
      `the fold on \`${key}\` starts open, and a fold that starts open is the wall`,
    );
  },
);

Then(
  "the property {string} on {string} is not folded",
  async function (this: OlaiWorld, key: string, id: string) {
    const value = line(this, id, key).locator(PROP_VALUE);
    await value.waitFor({ state: "visible", timeout: POLL_TIMEOUT });
    assert.strictEqual(
      await line(this, id, key).locator(PROP_FOLD).count(),
      0,
      `\`${key}\` on ${JSON.stringify(id)} is folded, and this step says it is short enough to read`,
    );
  },
);

When(
  "I open the property {string} on {string}",
  async function (this: OlaiWorld, key: string, id: string) {
    await this.press(line(this, id, key).locator(`${PROP_FOLD} summary`));
  },
);

Then(
  "the property {string} on {string} reads {string}",
  async function (this: OlaiWorld, key: string, id: string, said: string) {
    const found = line(this, id, key);
    await this.waitUntil(
      async () => oneLine(await found.innerText()).includes(said),
      `\`${key}\` on ${JSON.stringify(id)} to read ${JSON.stringify(said)}`,
    );
  },
);

const box = (world: OlaiWorld, id: string) =>
  world.page.locator(`${nodeSelector(id)} ${PROP_EDIT}`).first();

When(
  "I edit the property {string} on {string}",
  async function (this: OlaiWorld, key: string, id: string) {
    await this.press(line(this, id, key).locator(PROP_KEY));
    await box(this, id).waitFor({ state: "visible", timeout: POLL_TIMEOUT });
  },
);

const half = (world: OlaiWorld, id: string, key: string, system: boolean) =>
  world.page.locator(
    `${nodeSelector(world.nodeId(id))} ${PROP}${attr("data-key", key)}${
      system ? attr("data-system", "true") : ":not([data-system])"
    }`,
  );

When(
  "I edit the custom property {string} on {string}",
  async function (this: OlaiWorld, key: string, id: string) {
    await this.press(half(this, id, key, false).locator(PROP_KEY));
    await box(this, id).waitFor({ state: "visible", timeout: POLL_TIMEOUT });
  },
);

Then(
  "the system property {string} on {string} offers no editor",
  async function (this: OlaiWorld, key: string, id: string) {
    const chip = half(this, id, key, true);
    await chip.waitFor({ state: "attached", timeout: POLL_TIMEOUT });
    assert.strictEqual(
      await chip.locator(PROP_EDIT).count(),
      0,
      `the system \`${key}\` chip holds an edit box, and this step says it is read-only`,
    );
    assert.strictEqual(
      await chip.locator(PROP_KEY).count(),
      0,
      `the system \`${key}\` chip's key is a button, and this step says it is a label`,
    );
  },
);

Then(
  "exactly {int} property editor is open on {string}",
  async function (this: OlaiWorld, count: number, id: string) {
    await this.waitUntil(
      async () =>
        (await this.page.locator(`${nodeSelector(id)} ${PROP_EDIT}`).count()) === count,
      `${count} property editor(s) open on ${JSON.stringify(id)}`,
    );
  },
);

When(
  "I press the value of {string} on {string}",
  async function (this: OlaiWorld, key: string, id: string) {
    await this.press(line(this, id, key).locator(`${PROP_VALUE} button`));
  },
);

Then(
  "the property editor on {string} holds {string}",
  async function (this: OlaiWorld, id: string, value: string) {
    const open = box(this, id);
    await open.waitFor({ state: "visible", timeout: POLL_TIMEOUT });
    assert.strictEqual(await open.inputValue(), value);
  },
);

Then(
  "the property editor on {string} is closed",
  async function (this: OlaiWorld, id: string) {
    await this.waitUntil(
      async () => (await this.page.locator(`${nodeSelector(id)} ${PROP_EDIT}`).count()) === 0,
      `the property editor on ${JSON.stringify(id)} to be gone from the page`,
    );
  },
);

When(
  "I type {string} into the property editor on {string} without pressing Enter",
  async function (this: OlaiWorld, value: string, id: string) {
    const open = box(this, id);
    await open.waitFor({ state: "visible", timeout: POLL_TIMEOUT });
    await open.fill(value);
  },
);

When(
  "I type {string} into the property editor on {string}",
  async function (this: OlaiWorld, value: string, id: string) {
    const open = box(this, id);
    await open.waitFor({ state: "visible", timeout: POLL_TIMEOUT });
    await open.fill(value);
    await open.press("Enter");
    await keysSettled(this);
  },
);

When(
  "I leave the property editor on {string} without pressing Enter",
  async function (this: OlaiWorld, id: string) {
    await box(this, id).press("Escape");
    await keysSettled(this);
  },
);

When(
  "I click away from the property editor on {string}",
  async function (this: OlaiWorld, id: string) {
    await box(this, id).blur();
    await this.waitForFrame();
  },
);

Then(
  "the node {string} says nothing about its properties",
  async function (this: OlaiWorld, id: string) {
    assert.strictEqual(
      await this.page.locator(`${nodeSelector(id)} ${PROP_SAID}`).count(),
      0,
      "the run said something about a write, and this step says nothing was written",
    );
  },
);

When("I add a property on {string}", async function (this: OlaiWorld, id: string) {
  await this.press(this.page.locator(`${nodeSelector(id)} ${PROP_ADD}`).first());
  await this.page
    .locator(`${nodeSelector(id)} ${PROP_EDIT_KEY}`)
    .first()
    .waitFor({ state: "visible", timeout: POLL_TIMEOUT });
});

When(
  "I draft the property {string} holding {string} on {string}",
  async function (this: OlaiWorld, key: string, value: string, id: string) {
    const keyBox = this.page.locator(`${nodeSelector(id)} ${PROP_EDIT_KEY}`).first();
    await keyBox.fill(key);
    await box(this, id).fill(value);
  },
);

When(
  "I write the property {string} holding {string} on {string}",
  async function (this: OlaiWorld, key: string, value: string, id: string) {
    const keyBox = this.page.locator(`${nodeSelector(id)} ${PROP_EDIT_KEY}`).first();
    await keyBox.waitFor({ state: "visible", timeout: POLL_TIMEOUT });
    await keyBox.fill(key);
    const valueBox = box(this, id);
    await valueBox.fill(value);
    await valueBox.press("Enter");
    await keysSettled(this);
  },
);

Then(
  "the property editor on {string} offers no key box",
  async function (this: OlaiWorld, id: string) {
    assert.strictEqual(
      await this.page.locator(`${nodeSelector(id)} ${PROP_EDIT_KEY}`).count(),
      0,
      "a key box is open, and this step says a rename is two ops",
    );
  },
);

Then(
  "the property boxes on {string} ask for a Next key then a Done key",
  async function (this: OlaiWorld, id: string) {
    const keyBox = this.page.locator(`${nodeSelector(id)} ${PROP_EDIT_KEY}`).first();
    await keyBox.waitFor({ state: "visible", timeout: POLL_TIMEOUT });
    assert.strictEqual(await keyBox.getAttribute("enterkeyhint"), "next", "the key box's enterkeyhint");
    const valueBox = box(this, id);
    assert.strictEqual(await valueBox.getAttribute("enterkeyhint"), "done", "the value box's enterkeyhint");
    for (const [name, which] of [["key", keyBox], ["value", valueBox]] as const) {
      assert.strictEqual(await which.getAttribute("autocapitalize"), "none", `the ${name} box's autocapitalize`);
      assert.strictEqual(await which.getAttribute("autocorrect"), "off", `the ${name} box's autocorrect`);
      assert.strictEqual(await which.getAttribute("spellcheck"), "false", `the ${name} box's spellcheck`);
    }
  },
);

Then(
  "the property editor on {string} fits the screen",
  async function (this: OlaiWorld, id: string) {
    const width = this.viewport().width;
    await box(this, id).waitFor({ state: "visible", timeout: POLL_TIMEOUT });
    const boxes = this.page.locator(
      `${nodeSelector(id)} ${PROP_EDIT_KEY}, ${nodeSelector(id)} ${PROP_EDIT}`,
    );
    const count = await boxes.count();
    assert.ok(count > 0, "no editor box is open to measure");
    for (let at = 0; at < count; at += 1) {
      const found = await this.box(boxes.nth(at), `editor box ${at}`);
      assert.ok(
        found.x >= -0.5 && found.x + found.width <= width + 0.5,
        `editor box ${at} runs from ${Math.round(found.x)} to ${
          Math.round(found.x + found.width)
        } on a ${width}pt screen`,
      );
      assert.ok(
        found.height >= 44,
        `editor box ${at} is ${Math.round(found.height)}px tall, under the 44px a thumb is given`,
      );
    }
  },
);

const customOf = (node: Record<string, unknown>): Record<string, unknown> =>
  (node["custom"] ?? {}) as Record<string, unknown>;

Then(
  "{string} holds the node {string} with {string} set to {string}",
  async function (this: OlaiWorld, file: string, id: string, key: string, value: string) {
    await this.waitUntil(
      async () =>
        this.servedNodesSoFar(file).some(
          (node) => node["id"] === id && customOf(node)[key] === value,
        ),
      `${file} to hold ${JSON.stringify(id)} with \`${key}\` exactly ${JSON.stringify(value)}`,
    );
  },
);

Then(
  "{string} holds the node {string} with no {string}",
  async function (this: OlaiWorld, file: string, id: string, key: string) {
    await this.waitUntil(
      async () =>
        this.servedNodesSoFar(file).some(
          (node) => node["id"] === id && customOf(node)[key] === undefined,
        ),
      `${file} to hold ${JSON.stringify(id)} with no \`${key}\` at all`,
    );
  },
);

Then(
  "the node {string} refuses the property write with {string}",
  async function (this: OlaiWorld, id: string, said: string) {
    await saysThat(
      this,
      `${nodeSelector(id)} ${PROP_SAID}`,
      said,
      `refusal under the run on \`${id}\``,
      "alarm",
    );
  },
);

Then("the vault node {string} has property {string} holding {string}", async function(this: OlaiWorld, name: string, key: string, value: string) {
  const file = await this.node(name).getAttribute("data-file");
  assert.ok(file);
  await this.waitUntil(async () => {
    const node = this.servedNodes(file).find(row => row.id === this.nodeId(name));
    return (node?.custom as Record<string, unknown> | undefined)?.[key] === value;
  }, `the stored property ${key} on ${name} to equal ${value}`);
});

Then("the vault node {string} has no property {string}", async function(this: OlaiWorld, name: string, key: string) {
  const file = await this.node(name).getAttribute("data-file");
  assert.ok(file);
  const node = this.servedNodes(file).find(row => row.id === this.nodeId(name));
  assert.ok(
    (node?.custom as Record<string, unknown> | undefined)?.[key] === undefined,
    `the node ${name} already holds the property ${key}`,
  );
});
