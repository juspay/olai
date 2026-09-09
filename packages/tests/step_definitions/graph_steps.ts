/**
 * The reference graph — every claim about what the drawing draws and says.
 *
 * ONE rule distinguishes this file from the outline's share of the suite: a
 * dot is named by the key the FRAGMENT would spell (`#herbs`,
 * `notes/brief.md`), never by a title — because the key is the address's own
 * half, and a scenario that asked about a title could not catch the drawing
 * and the URL disagreeing about which vertex they mean.
 *
 * An "another writer" step is the directory itself, rewritten on disk the
 * way a second editor's save lands: the watcher's own hand is what turns
 * that into a drawing — the very thing the live scenarios exist over.
 */

import * as assert from "node:assert";
import * as fs from "node:fs";
import * as path from "node:path";
import { Given, Then, When } from "@cucumber/cucumber";

import {
  attr,
  GRAPH_CANVAS,
  GRAPH_CAPTION,
  GRAPH_CENTRE_HERE,
  GRAPH_CLOSER,
  GRAPH_EDGE,
  GRAPH_EMPTY,
  GRAPH_FILE,
  GRAPH_FIT,
  GRAPH_HORIZON,
  GRAPH_LEGEND,
  GRAPH_LINK,
  GRAPH_VERTEX,
  NODE_GRAPH_DOOR,
  POLL_TIMEOUT,
} from "../support/world.ts";
import type { OlaiWorld } from "../support/world.ts";

// ── opening its address ────────────────────────────────────────────────

Given("I open the reference graph", async function (this: OlaiWorld) {
  await this.openGraph();
});

Then("the dot {string} is {int} hops out", async function (this: OlaiWorld, key: string, hops: number) {
  await this.expectAttribute(dot(key), "data-hops", String(hops), `the dot ${key}`);
});

Given(
  "I open the reference graph around {string}",
  async function (this: OlaiWorld, address: string) {
    await this.openGraph(address);
  },
);

/** One dot, keyed on the address the fragment would spell. */
const dot = (key: string): string => `${GRAPH_VERTEX}${attr("data-key", key)}`;

// ── what the drawing holds ─────────────────────────────────────────────

Then("the graph shows the dot {string}", async function (this: OlaiWorld, key: string) {
  await this.waitUntil(
    async () => (await this.page.locator(dot(key)).count()) > 0,
    `the graph to show the dot ${key}`,
  );
});

Then("the graph shows no dot {string}", async function (this: OlaiWorld, key: string) {
  await this.waitUntil(
    async () => (await this.page.locator(dot(key)).count()) === 0,
    `the graph to hold no dot for ${key}`,
  );
});

Then("the graph draws exactly {int} dots", async function (this: OlaiWorld, expected: number) {
  await this.waitUntil(
    async () => (await this.page.locator(GRAPH_VERTEX).count()) === expected,
    `the graph to draw exactly ${expected} dots`,
  );
});

Then("the dot {string} is the graph's centre", async function (this: OlaiWorld, key: string) {
  await this.waitUntil(
    async () =>
      (await this.page.locator(`${dot(key)}${attr("data-centre", "true")}`).count()) > 0,
    `${key} to be the drawn centre`,
  );
});

Then(
  "the dot {string} has the grain {string}",
  async function (this: OlaiWorld, key: string, kind: string) {
    await this.expectAttribute(dot(key), "data-kind", kind, `the dot for ${key}`);
  },
);

Then(
  "the arrow runs from {string} to {string} the {string} way",
  async function (this: OlaiWorld, from: string, to: string, ways: string) {
    const arrow = `${GRAPH_EDGE}${attr("data-from", from)}${attr("data-to", to)}`;
    await this.expectAttribute(arrow, "data-ways", ways, `the arrow ${from} → ${to}`);
  },
);

Then(
  "no arrow runs from {string} to {string}",
  async function (this: OlaiWorld, from: string, to: string) {
    await this.waitUntil(
      async () =>
        (await this.page
          .locator(`${GRAPH_EDGE}${attr("data-from", from)}${attr("data-to", to)}`)
          .count()) === 0,
      `no arrow to run from ${from} to ${to}`,
    );
  },
);

Then("the graph names the file {string}", async function (this: OlaiWorld, file: string) {
  await this.waitUntil(
    async () =>
      (await this.page.locator(`${GRAPH_FILE}${attr("data-file", file)}`).count()) > 0,
    `${file} to be named`,
  );
});

Then("the graph names no file {string}", async function (this: OlaiWorld, file: string) {
  await this.waitUntil(
    async () =>
      (await this.page.locator(`${GRAPH_FILE}${attr("data-file", file)}`).count()) === 0,
    `${file} to stay unlabelled`,
  );
});

Then("every way the reading knows is in the legend", async function (this: OlaiWorld) {
  await this.waitUntil(
    async () => (await this.page.locator(`${GRAPH_LEGEND} [data-way]`).count()) === 4,
    "the legend to hold all four ways",
  );
});

Then(
  "the graph draws every dot, naming only the ones that fit",
  async function (this: OlaiWorld) {
    await this.waitUntil(
      async () =>
        (await this.page.locator(`${GRAPH_VERTEX}${attr("data-labelled", "true")}`).count()) > 0 &&
          (await this.page.locator(`${GRAPH_VERTEX}${attr("data-labelled", "false")}`).count()) > 0,
      "the graph to name only the dots that fit, drawing all of them",
    );
  },
);

// ── pointing ───────────────────────────────────────────────────────────

When("I hover the graph dot {string}", async function (this: OlaiWorld, key: string) {
  const one = this.page.locator(dot(key));
  await one.waitFor({ state: "visible", timeout: POLL_TIMEOUT });
  await one.hover();
  await this.waitForFrame();
});

Then("the graph's caption reads {string}", async function (this: OlaiWorld, said: string) {
  // The SENTENCE, not the affordance beside it: the caption div also holds
  // "Centre here", which is its own step's subject rather than what the
  // caption SAYS.
  await this.waitUntil(
    async () =>
      (await this.page.locator(`${GRAPH_CAPTION} p`).first().innerText()).trim() === said,
    `the caption to read ${JSON.stringify(said)}`,
  );
});

When("I follow the graph dot {string}", async function (this: OlaiWorld, key: string) {
  const one = this.page.locator(dot(key));
  await one.waitFor({ state: "visible", timeout: POLL_TIMEOUT });
  await one.getByRole("link").click();
  await this.waitForFrame();
});

When("I press centre here", async function (this: OlaiWorld) {
  // A force click: the link's re-mount cadence is the layout's to control —
  // under Playwright's actionability gate one mount flash reads as a
  // moving target. The press still lands on the REAL element.
  const link = this.page.locator(GRAPH_CENTRE_HERE);
  await link.waitFor({ state: "visible", timeout: POLL_TIMEOUT });
  await link.click({ force: true });
  await this.waitForFrame();
});

// ── horizon and camera ────────────────────────────────────────────────

When("I set the horizon to {int} hops", async function (this: OlaiWorld, hops: number) {
  await this.press(this.page.locator(`${GRAPH_HORIZON} ${attr("data-value", String(hops))}`));
});

Then("the graph is at {int} hops", async function (this: OlaiWorld, hops: number) {
  await this.expectAttribute(GRAPH_HORIZON, "data-hops", String(hops), "the horizon");
});

When("I press the graph's closer control", async function (this: OlaiWorld) {
  await this.press(this.page.locator(GRAPH_CLOSER));
});

When("I press the graph's fit control", async function (this: OlaiWorld) {
  await this.press(this.page.locator(GRAPH_FIT));
});

/** The exact scale the camera is at, as the drawing itself prints it on the
 *  canvas: `"1.00"` is therefore a verdict — fitted at OPEN, when nothing has
 *  touched the lens, the claim the scenario holds. */
Then("the graph's camera reads {string}", async function (this: OlaiWorld, scale: string) {
  await this.expectAttribute(GRAPH_CANVAS, "data-scale", scale, "the camera");
});

Then("the graph is closer than fitted", async function (this: OlaiWorld) {
  await this.waitUntil(
    async () =>
      parseFloat((await this.page.locator(GRAPH_CANVAS).getAttribute("data-scale")) ?? "0") > 1,
    "the camera to have moved closer than fitted",
  );
});

Then(
  "the graph's canvas fills the pane and the page does not scroll",
  async function (this: OlaiWorld) {
    const box = await this.page.locator(GRAPH_CANVAS).boundingBox();
    assert.ok(box !== null, "the canvas to have a box");
    const viewport = this.page.viewportSize();
    assert.ok(viewport !== null, "the page to have a viewport");
    assert.ok(
      box.height > viewport.height / 2,
      `the canvas (${box.height}) to fill more than half the viewport (${viewport.height})`,
    );
    const overshoot = await this.page.evaluate(
      () => document.documentElement.scrollHeight - window.innerHeight,
    );
    assert.ok(overshoot <= 1, `the page not to scroll (overshoot ${overshoot})`);
  },
);

// ── what it says instead of a drawing ──────────────────────────────────

Then("the graph says {string}", async function (this: OlaiWorld, said: string) {
  await this.waitUntil(
    async () =>
      (await this.page.locator(GRAPH_EMPTY).innerText()).replace(/\s+/g, " ").trim() === said,
    `the graph to say ${JSON.stringify(said)}`,
  );
});

When("I follow the link in the graph's sentence", async function (this: OlaiWorld) {
  await this.press(this.page.locator(`${GRAPH_EMPTY} a`));
});

// ── the ways in ────────────────────────────────────────────────────────

Then("the graph door is drawn below the files", async function (this: OlaiWorld) {
  await this.waitUntil(
    async () => (await this.page.locator(GRAPH_LINK).count()) === 1,
    "the graph door to be drawn once, below the files",
  );
});

When("I open the graph from the sidebar", async function (this: OlaiWorld) {
  await this.press(this.page.locator(GRAPH_LINK));
});

When("I open the graph door under the node", async function (this: OlaiWorld) {
  await this.press(this.page.locator(NODE_GRAPH_DOOR));
});

// ── the fixture's own additions ────────────────────────────────────────

/** The background three: the row that makes both grains of neighbourhood
 *  answerable, and what it is like for a page to draw where something is
 *  talked about rather than what it says. */
Given(
  "the outline {string} holds a row whose see points at the herb bed",
  function (this: OlaiWorld, file: string) {
    // The one row with both grains in the same stroke: "like @herbs" IN the
    // title is the mention way, the property the see way — so a page around
    // `herbs` is where the ways-learned reader sees the drawer fold them.
    const at = path.join(this.scratch(), file);
    fs.appendFileSync(
      at,
      JSON.stringify({
        id: "worktop",
        parent: "kitchen",
        ord: "a02",
        title: "seal the worktop like @herbs",
        see: ["herbs"],
      }) + "\n",
    );
  },
);

Given(
  "the note {string} links the herb bed and the house",
  function (this: OlaiWorld, file: string) {
    fs.writeFileSync(
      path.join(this.scratch(), file),
      [
        "# The tan brief",
        "",
        "Seal [the bed](#herbs) in mineral oil before the cold weather,",
        "and phone [the house](../house.olai) about the worktop. Loosely of",
        "@order's own note: the one that holds the rest in place.",
        "",
      ].join("\n"),
    );
  },
);

Given("the record {string} is put away", function (this: OlaiWorld, id: string) {
  const at = path.join(this.scratch(), "_olai");
  fs.mkdirSync(at, { recursive: true });
  fs.writeFileSync(
    path.join(at, "Trash.olai"),
    JSON.stringify({ id, ord: "a0", title: "the printed labels" }) + "\n",
  );
});

// ── another writer ─────────────────────────────────────────────────────

/** Rewrite one outline's JSONL, applying the fold asked for to the row whose
 *  id matches — the way a second editor's save lands on disk. */
const editOutline = (
  world: OlaiWorld,
  id: string,
  fold: (row: Record<string, unknown>) => void,
): void => {
  const at = path.join(world.scratch(), fileOf(id));
  const records = fs
    .readFileSync(at, "utf8")
    .split("\n")
    .filter((line) => line.trim() !== "")
    .map((line) => JSON.parse(line) as Record<string, unknown>);
  for (const row of records) fold(row);
  fs.writeFileSync(at, records.map((row) => JSON.stringify(row)).join("\n") + "\n");
};

/** Which fixture outline holds the row — the same constant the scratch
 *  copy restores from, rather than a scan that could succeed by finding
 *  the record somewhere it was never written. */
const fileOf = (id: string): string =>
  ["slugs", "garden", "herbs", "basil", "mint", "frames", "glazing", "sowing", "compost", "turned", "straw"].includes(id)
    ? "garden.olai"
    : "house.olai";

When(
  "another writer makes {string} see {string}",
  function (this: OlaiWorld, from: string, at: string) {
    editOutline(this, from, (row) => {
      if (row["id"] === from) {
        row["see"] = [...((row["see"] as ReadonlyArray<string> | undefined) ?? []), at];
      }
    });
  },
);

When(
  "another writer retitles {string} to {string}",
  function (this: OlaiWorld, id: string, title: string) {
    editOutline(this, id, (row) => {
      if (row["id"] === id) row["title"] = title;
    });
  },
);

// ── placements are not references, and time does not move a dot ───────

const HELD = new Map<string, readonly [number, number]>();

When(
  "I record the position of the graph dot {string}",
  async function (this: OlaiWorld, key: string) {
    const box = await this.page.locator(dot(key)).boundingBox();
    assert.ok(box !== null, `the dot ${key} to have a box`);
    HELD.set(key, [box.x, box.y]);
  },
);

Then("the graph dot {string} has not moved", async function (this: OlaiWorld, key: string) {
  const [x, y] = HELD.get(key) ?? [NaN, NaN];
  assert.ok(!Number.isNaN(x), `no recorded position for ${key}`);
  const box = await this.page.locator(dot(key)).boundingBox();
  assert.ok(box !== null, `the dot ${key} to still have a box`);
  assert.ok(
    Math.abs(box.x - x) <= 1 && Math.abs(box.y - y) <= 1,
    `the dot ${key} to have stood still (${x},${y} → ${box.x},${box.y})`,
  );
});

Then(
  "the dot {string} labels its new title {string}",
  async function (this: OlaiWorld, key: string, title: string) {
    await this.waitUntil(
      async () =>
        ((await this.page.locator(`${dot(key)} a`).first().getAttribute("aria-label")) ?? "")
          .includes(title),
      `the dot ${key} to carry the title ${JSON.stringify(title)}`,
    );
  },
);


/** A crowd on one mast: the number it takes for the declutter to be the
 *  ONLY honest answer — one outline's rows, all pointing at the same bed,
 *  all on the fitted page at once. */
Given(
  "the outline {string} holds {int} more rows whose see point at the herb bed",
  function (this: OlaiWorld, file: string, count: number) {
    const at = path.join(this.scratch(), file);
    for (let i = 0; i < count; i++) {
      fs.appendFileSync(
        at,
        JSON.stringify({
          id: `ref-crowd-${i}`,
          parent: "kitchen",
          ord: `b${String(i).padStart(3, "0")}`,
          title: `watch the bed ${i}`,
          see: ["herbs"],
        }) + "\n",
      );
    }
  },
);

