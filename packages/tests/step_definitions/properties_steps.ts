/**
 * The properties drawer and the editor under it: what a node shows, what the
 * two boxes write, and what the file says afterwards.
 *
 * Its own file for `date_steps.ts`' reason — the editor is a surface with a
 * state of its own (two boxes, a button whose LABEL is the verb, two ways out
 * that write nothing) — and it keeps the DISK assertions beside the screen ones
 * rather than in `editing_steps.ts`, because a property is named by a key the
 * scenario chose and the pair only reads as one claim together.
 */

import * as assert from "node:assert";
import { Then, When } from "@cucumber/cucumber";

import {
  attr,
  nodeSelector,
  oneLine,
  POLL_TIMEOUT,
  PROP,
  PROP_EDITOR,
  PROP_EDITOR_CANCEL,
  PROP_EDITOR_KEY,
  PROP_EDITOR_SET,
  PROP_EDITOR_VALUE,
  PROP_FOLD,
  PROP_VALUE,
  PROPS,
} from "../support/world.ts";
import type { OlaiWorld } from "../support/world.ts";

// ── the drawer ─────────────────────────────────────────────────────────

/** One line of the drawer on one node, by KEY — never by position, so a
 *  scenario says which fact it is reading. */
const line = (world: OlaiWorld, id: string, key: string) =>
  world.page.locator(`${nodeSelector(id)} ${PROP}${attr("data-key", key)}`);

Then(
  "the node {string} shows the property {string} holding {string}",
  async function (this: OlaiWorld, id: string, key: string, value: string) {
    const found = line(this, id, key).locator(PROP_VALUE);
    await found.waitFor({ state: "visible", timeout: POLL_TIMEOUT });
    assert.strictEqual(oneLine(await found.innerText()), value);
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

/** A line the drawer draws and the menu does not offer to change: the node's
 *  own facts, which have verbs of their own. */
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

/** No drawer AT ALL, which is not the same as an empty one: a row draws none
 *  until somebody has added a property, so a vault where nobody has looks
 *  exactly as it did before there were any. */
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

// ── the doors ──────────────────────────────────────────────────────────

/**
 * The `<a>` a value turned out to be, whatever kind of door it is — an app
 * `<Link>` and an external anchor are both anchors, which is what makes ONE
 * step able to say where any chip goes.
 *
 * Under the value rather than beside it, because `data-door` sits on the value
 * (`client/props/PropsDrawer.tsx`) and its ABSENCE is what a scenario asserts
 * when a value is meant to stay text.
 */
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

/** A value that names nothing: drawn, readable, and NOT a link. The negative
 *  half of the rule, and the one worth a step of its own — a wrong door is
 *  worse than no door, so "no door" has to be assertable. */
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

/** A door out of the app opens a tab of its own, and under the pair that keeps
 *  the far end from reaching back — the rule a link written into a note already
 *  follows (`client/markdown/rewrite.ts`). Asserted rather than clicked: a step
 *  that followed it would be a scenario waiting on somebody else's server. */
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

/** THE RUN'S ORDER, key by key — the file's own, and never re-sorted. The whole
 *  list rather than "contains X", for the reason the breadcrumbs step asserts
 *  the whole trail: an order is only wrong relative to the rest of it. */
Then(
  "the properties on {string} read {string}",
  async function (this: OlaiWorld, id: string, expected: string) {
    const chips = this.page.locator(`${nodeSelector(id)} ${PROPS}`).first().locator(PROP);
    await chips.first().waitFor({ state: "visible", timeout: POLL_TIMEOUT });
    assert.deepStrictEqual(
      await chips.evaluateAll((found) =>
        found.map((one) => one.getAttribute("data-key") ?? "")
      ),
      expected.split(",").map((key) => key.trim()),
    );
  },
);

/** A value too long to be a fact, drawn as its first words. The presence of the
 *  fold is the claim; what it holds is asserted by opening it. */
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

// ── the editor ─────────────────────────────────────────────────────────

const editor = (world: OlaiWorld) => world.page.locator(PROP_EDITOR);

Then("the property editor is open", async function (this: OlaiWorld) {
  await editor(this).waitFor({ state: "visible", timeout: POLL_TIMEOUT });
});

Then("the property editor is closed", async function (this: OlaiWorld) {
  await this.waitUntil(
    async () => (await editor(this).count()) === 0,
    "the property editor to be gone from the page",
  );
});

/** What the two boxes hold — one step for the pair, because "editing `pr`"
 *  means both of them at once and two steps could pass one at a time. */
Then(
  "the property editor holds {string} and {string}",
  async function (this: OlaiWorld, key: string, value: string) {
    await editor(this).waitFor({ state: "visible", timeout: POLL_TIMEOUT });
    assert.strictEqual(await this.page.locator(PROP_EDITOR_KEY).inputValue(), key);
    assert.strictEqual(await this.page.locator(PROP_EDITOR_VALUE).inputValue(), value);
  },
);

/** The KEY box cannot be typed in while an existing property is being changed:
 *  a rename is a removal and an addition, which is two ops, and this face does
 *  not get gestures an agent cannot make. */
Then("the property editor's key is fixed", async function (this: OlaiWorld) {
  assert.strictEqual(
    await this.page.locator(PROP_EDITOR_KEY).isEditable(),
    false,
    "the key box accepts typing, and this step says a rename is two ops",
  );
});

When(
  "I write the property {string} holding {string}",
  async function (this: OlaiWorld, key: string, value: string) {
    const box = this.page.locator(PROP_EDITOR_KEY);
    if (await box.isEditable()) await box.fill(key);
    await this.page.locator(PROP_EDITOR_VALUE).fill(value);
    await this.press(this.page.locator(PROP_EDITOR_SET));
    await editor(this).waitFor({ state: "hidden", timeout: POLL_TIMEOUT });
  },
);

When("I leave the property editor", async function (this: OlaiWorld) {
  await this.press(this.page.locator(PROP_EDITOR_CANCEL));
});

/**
 * Every control of the editor is on the screen and big enough for a thumb.
 *
 * The panel is a flex row of two boxes and two buttons, which is a comfortable
 * shape at 1200pt and a claim at 390 — the row wraps, and nothing says so until
 * something has fallen off the side. `min-h` is the other half: the app's rule
 * for anything a finger aims at is 44px, and these inputs carry `md:min-h-0`,
 * so the phone keeps the target and the laptop does not pay for it.
 *
 * Asked of the VIEWPORT rather than of a container, because what a person
 * cannot reach is what is off the screen (opencode's nit, review of #179).
 */
Then("the property editor fits the screen", async function (this: OlaiWorld) {
  const width = this.viewport().width;
  for (
    const [name, selector] of [
      ["the key box", PROP_EDITOR_KEY],
      ["the value box", PROP_EDITOR_VALUE],
      ["the button", PROP_EDITOR_SET],
      ["cancel", PROP_EDITOR_CANCEL],
    ] as ReadonlyArray<readonly [string, string]>
  ) {
    const box = await this.box(this.page.locator(selector), name);
    assert.ok(
      box.x >= -0.5 && box.x + box.width <= width + 0.5,
      `${name} runs from ${Math.round(box.x)} to ${
        Math.round(box.x + box.width)
      } on a ${width}pt screen`,
    );
    assert.ok(
      box.height >= 44,
      `${name} is ${Math.round(box.height)}px tall, under the 44px a thumb is given`,
    );
  }
});

// ── and what the directory says ────────────────────────────────────────

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
