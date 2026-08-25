/**
 * The run of chips under a node's title: what it shows, where a chip GOES when
 * it is pressed, what typing in one writes, and what the file says afterwards.
 *
 * Its own file for `date_steps.ts`' reason — a chip is a surface with a state
 * of its own — and it keeps the DISK assertions beside the screen ones rather
 * than in `editing_steps.ts`, because a property is named by a key the scenario
 * chose and the pair only reads as one claim together.
 *
 * THE PANEL IS GONE and so are its steps. A property used to be written in a
 * two-box form under the row, opened from the `•••`; it is written in the chip
 * now, where it is read. The steps below are shaped like that gesture: press a
 * chip's key, type, press Enter — with no Save button to name and no panel to
 * ask whether it is open.
 */

import * as assert from "node:assert";
import { Then, When } from "@cucumber/cucumber";

import { saysThat } from "../support/said.ts";
import { keysSettled } from "../support/settling.ts";
import {
  attr,
  nodeSelector,
  oneLine,
  POLL_TIMEOUT,
  PROP,
  PROP_ADD,
  PROP_EDIT,
  PROP_EDIT_KEY,
  PROP_FOLD,
  PROP_KEY,
  PROP_SAID,
  PROP_VALUE,
  PROPS,
} from "../support/world.ts";
import type { OlaiWorld } from "../support/world.ts";

// ── the drawer ─────────────────────────────────────────────────────────

/** One line of the drawer on one node, by KEY — never by position, so a
 *  scenario says which fact it is reading. */
const line = (world: OlaiWorld, id: string, key: string) =>
  world.page.locator(`${nodeSelector(id)} ${PROP}${attr("data-key", key)}`);

/** WAITED FOR rather than read once, and that is not politeness: nothing here
 *  is echoed, so a chip says what the file says — which means a write made one
 *  step earlier lands on the frame the SERVER publishes, and a scenario that
 *  read the run the instant it typed would be reading the value it typed over. */
Then(
  "the node {string} shows the property {string} holding {string}",
  async function (this: OlaiWorld, id: string, key: string, value: string) {
    const found = line(this, id, key).locator(PROP_VALUE);
    await found.waitFor({ state: "visible", timeout: POLL_TIMEOUT });
    await this.waitUntil(
      async () => oneLine(await found.innerText()) === value,
      `\`${key}\` on ${JSON.stringify(id)} to hold ${JSON.stringify(value)}`,
    );
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
    const wanted = expected.split(",").map((key) => key.trim());
    const drawn = async () =>
      await chips.evaluateAll((found) => found.map((one) => one.getAttribute("data-key") ?? ""));
    // Waited for, for the reason the step above is: a write lands on the
    // server's next frame, not on the keystroke that sent it.
    await this.waitUntil(
      async () => JSON.stringify(await drawn()) === JSON.stringify(wanted),
      `the run on ${JSON.stringify(id)} to read ${JSON.stringify(expected)}`,
    );
    assert.deepStrictEqual(await drawn(), wanted);
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

// ── the editor, which is the chip itself ───────────────────────────────
//
// There is no panel and no Save button any more. A chip's KEY is its handle
// and a value that is not a link is a second way in; Enter commits, Escape
// cancels, leaving commits whatever changed, and clearing the box removes the
// property — which is the op's own reading of an empty value, not a gesture
// this face invented (`client/props/editor.ts`).

/** The box open on ONE node — never `page.locator(PROP_EDIT)` alone, because a
 *  page draws a run per row and a step has to say which node it means. */
const box = (world: OlaiWorld, id: string) =>
  world.page.locator(`${nodeSelector(id)} ${PROP_EDIT}`).first();

When(
  "I edit the property {string} on {string}",
  async function (this: OlaiWorld, key: string, id: string) {
    await this.press(line(this, id, key).locator(PROP_KEY));
    await box(this, id).waitFor({ state: "visible", timeout: POLL_TIMEOUT });
  },
);

/**
 * The same gesture aimed at ONE HALF of a run drawing both — for the record
 * that carries a custom key spelling a field's name.
 *
 * `custom` is open all the way, so a hand-written `"custom":{"date":…}` sits
 * beside the `date` FIELD on a node's own page and two chips answer to the same
 * `data-key`. The suite's ordinary `line()` would match both and Playwright
 * would refuse the ambiguity; these two steps say which half a scenario means,
 * which is the same distinction `keyOf` draws in the markup.
 */
const half = (world: OlaiWorld, id: string, key: string, system: boolean) =>
  world.page.locator(
    `${nodeSelector(id)} ${PROP}${attr("data-key", key)}${
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

/** A system chip offers no way in at all: no key button, and no box inside it —
 *  which is the half the bare-key comparison used to open by accident. */
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

/** HOW MANY boxes are open — one gesture opens one editor, and the count is the
 *  claim rather than the presence, because the bug this pins drew a second. */
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

/** The other way in, and the one a reader reaches for first: the VALUE, where
 *  it is not a link. A step of its own because which half answered the press is
 *  the whole of the gesture ruling. */
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

/** Type it and press Enter. `fill` then `Enter`, rather than the panel's old
 *  button, because the button is what went. */
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

/** ...and the OTHER way out, which is not a way out at all: leaving the box
 *  commits what changed. A separate step from the row editor's own click-away
 *  (`editing_steps.ts`), which waits for the caret to leave a LINE — a chip is
 *  not one, and the receipt here is the box going. */
When(
  "I click away from the property editor on {string}",
  async function (this: OlaiWorld, id: string) {
    await box(this, id).blur();
    await this.waitForFrame();
  },
);

/** Nothing was said about a write, in either mood — which is what makes
 *  "opened a chip and left it alone" SILENT rather than refused. A refusal
 *  would be an alarm line under the run; a nudge would be a quiet one. */
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

/** The `+` at the end of the run, and the two boxes it opens — the ONE place a
 *  key is ever typed, since a rename is two ops. */
When("I add a property on {string}", async function (this: OlaiWorld, id: string) {
  await this.press(this.page.locator(`${nodeSelector(id)} ${PROP_ADD}`).first());
  await this.page
    .locator(`${nodeSelector(id)} ${PROP_EDIT_KEY}`)
    .first()
    .waitFor({ state: "visible", timeout: POLL_TIMEOUT });
});

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

/** An existing chip's key is not typeable, and that is the format's rule rather
 *  than the box's: `set_prop` sets ONE key, so a rename is a removal and an
 *  addition. The KEY BOX is drawn only while a property is being NAMED. */
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

/**
 * Every box of the editor is on the screen and big enough for a thumb.
 *
 * The chip is a pill holding one or two boxes, which is comfortable at 1200pt
 * and a claim at 390. `min-h` is the other half: the app's rule for anything a
 * finger aims at is 44px, and these inputs carry `md:min-h-0`, so the phone
 * keeps the target and the laptop does not pay for it.
 *
 * Asked of the VIEWPORT rather than of a container, because what a person
 * cannot reach is what is off the screen (opencode's nit, review of #179).
 */
Then(
  "the property editor on {string} fits the screen",
  async function (this: OlaiWorld, id: string) {
    const width = this.viewport().width;
    // Waited for rather than counted once: the editor is opened by a gesture
    // one step earlier, and Solid draws it on the next frame.
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

/**
 * WHAT THE RUN SAID ABOUT A REFUSED WRITE — the typed-properties seam, read
 * where a person reads it.
 *
 * `says nothing about its properties` above is the silent half of the same
 * line; this is the loud one, and it is a separate step rather than a
 * parameter because the two are opposite claims and a scenario should not be
 * able to write the wrong one by leaving an argument off. The TONE is asserted
 * with the words: a refusal is an `alarm`, and a refusal drawn in the mood of a
 * remark is a sentence a reader is entitled to scroll past.
 *
 * The words are the OPS LAYER'S, verbatim, which is the whole claim — so the
 * step takes the fragment a scenario cares about and `saysThat` asks whether
 * the line contains it, rather than pinning a whole sentence that a better
 * wording would have to break a test to improve.
 */
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
