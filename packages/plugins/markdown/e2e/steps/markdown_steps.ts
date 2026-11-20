import * as assert from "node:assert";
import { Given, Then, When } from "@olai/tests/harness/runner.ts";

import { chunkOf } from "@olai/tests/harness/chunks.ts";
import { paintsOn, stopsWaiting, WAITING, waitsIllegibly } from "@olai/tests/harness/paints.ts";
import {
  DESC,
  DOCUMENT_BODY,
  HYDRATION_TIMEOUT,
  POLL_TIMEOUT,
} from "@olai/tests/harness/world.ts";
import type { Box, OlaiWorld } from "@olai/tests/harness/world.ts";

const PIPELINE = chunkOf("the markdown pipeline", "pipeline");

Given("the markdown pipeline is held up", async function (this: OlaiWorld) {
  await PIPELINE.holdUp(this);
});

Given("the markdown pipeline never arrives", async function (this: OlaiWorld) {
  await PIPELINE.neverArrives(this);
});

When("the markdown pipeline arrives", async function (this: OlaiWorld) {
  await PIPELINE.arrive(this);
});

Then("the shell asked for the markdown pipeline", async function (this: OlaiWorld) {
  const preloaded = await this.page.evaluate(() =>
    [...document.querySelectorAll('link[rel="modulepreload"]')].map((link) =>
      link.getAttribute("href") ?? ""
    )
  );
  assert.ok(
    preloaded.some((href) => PIPELINE.url.test(href)),
    `the shell preloads no markdown pipeline:\n  ${preloaded.join("\n  ") || "(no modulepreload at all)"}`,
  );
  const requested = PIPELINE.asked(this);
  assert.ok(
    requested.length > 0,
    `the shell names the pipeline but nothing fetched it\n  ${PIPELINE.diagnosis(this)}`,
  );
});

Then("the markdown pipeline was fetched once", function (this: OlaiWorld) {
  const requested = PIPELINE.asked(this);
  assert.strictEqual(
    requested.length,
    1,
    `the page asked for the markdown pipeline ${requested.length} time(s)\n  ${
      requested.length === 0 ? PIPELINE.diagnosis(this) : requested.join("\n  ")
    }`,
  );
});

Then("the document shows its own markdown source", async function (this: OlaiWorld) {
  const body = this.documentBody();
  await body.waitFor({ state: "visible", timeout: HYDRATION_TIMEOUT });
  const text = await body.innerText();
  assert.ok(
    text.includes("**matte**"),
    `the document is not showing its own source:\n${text.slice(0, 200)}`,
  );
});

Then(
  "the document says its renderer never came",
  async function (this: OlaiWorld) {
    const failed = this.page.locator(`${DOCUMENT_BODY}[data-markdown="failed"]`);
    await failed.waitFor({ state: "visible", timeout: POLL_TIMEOUT });
    const text = await failed.innerText();
    assert.ok(
      text.includes("could not be loaded"),
      `the page did not say why the markdown is unrendered:\n${text.slice(0, 200)}`,
    );
  },
);

Then(
  "the title of {string} shows its markdown source",
  async function (this: OlaiWorld, id: string) {
    const title = this.nodeTitle(id);
    await title.waitFor({ state: "visible", timeout: HYDRATION_TIMEOUT });
    await this.waitUntil(
      async () => (await title.innerText()).includes("**"),
      `the title of "${id}" to show its own source`,
    );
  },
);

Then("the document is waiting illegibly", async function (this: OlaiWorld) {
  await waitsIllegibly(
    this,
    this.page.locator(`${DOCUMENT_BODY}${WAITING}`),
    "the document",
  );
});

Then("the document is not waiting", async function (this: OlaiWorld) {
  await this.documentBody().waitFor({ state: "visible", timeout: POLL_TIMEOUT });
  await stopsWaiting(
    this,
    this.page.locator(`${DOCUMENT_BODY}${WAITING}`),
    "the document",
  );
});

Then(
  "the title of {string} is waiting illegibly",
  async function (this: OlaiWorld, id: string) {
    await waitsIllegibly(
      this,
      this.nodeTitle(id).locator(WAITING),
      `the title of "${id}"`,
    );
  },
);

Then(
  "the description of {string} is waiting illegibly",
  async function (this: OlaiWorld, id: string) {
    await waitsIllegibly(
      this,
      this.node(id).locator(DESC).first().locator(WAITING),
      `the note of "${id}"`,
    );
  },
);

Then(
  "the title of {string} is not waiting",
  async function (this: OlaiWorld, id: string) {
    await stopsWaiting(
      this,
      this.nodeTitle(id).locator(WAITING),
      `the title of "${id}"`,
    );
  },
);

Then(
  "the description of {string} is not waiting",
  async function (this: OlaiWorld, id: string) {
    await stopsWaiting(
      this,
      this.node(id).locator(DESC).first().locator(WAITING),
      `the note of "${id}"`,
    );
  },
);

Then("no frame of legible raw markdown was painted", async function (this: OlaiWorld) {
  const paints = await paintsOn(this.page);
  assert.ok(
    paints !== undefined,
    "no watcher is installed in this tab — the scenario needs the " +
      "@markdown-paints tag (support/hooks.ts), which arms one in every " +
      "document of its context",
  );
  assert.ok(
    paints.length > 0,
    "this page never held markdown source at all, so it proves nothing about " +
      "the frames that do — was the pipeline held up before anything was " +
      "opened, and does anything on the page have markdown in it?",
  );
  const legible = paints.filter((paint) => paint.legible);
  assert.deepStrictEqual(
    legible.map((paint) => `${paint.what}: ${paint.filter} — ${paint.text}`),
    [],
    `${legible.length} of ${paints.length} waiting paints were readable markdown source`,
  );
});

When(
  "I note where the description of {string} sits",
  async function (this: OlaiWorld, id: string) {
    this.blockBefore = await this.box(
      this.node(id).locator(DESC).first().locator(WAITING),
      `the note of "${id}"`,
    );
  },
);

When(
  "I note how tall the row of {string} is",
  async function (this: OlaiWorld, id: string) {
    this.blockBefore = await this.box(this.node(id).first(), `the row of "${id}"`);
  },
);

Then(
  "the row of {string} is the same height",
  async function (this: OlaiWorld, id: string) {
    const before = this.blockBefore;
    assert.ok(before !== undefined, "nothing noted how tall the row was");
    const now = await this.box(this.node(id).first(), `the row of "${id}"`);
    assert.strictEqual(
      Math.round(now.height),
      Math.round(before.height),
      `the row of "${id}" changed height when its title's rendering landed`,
    );
  },
);

Then(
  "the description of {string} is where it was",
  async function (this: OlaiWorld, id: string) {
    const before = this.blockBefore;
    assert.ok(before !== undefined, "nothing noted where the note was sitting");
    const now = await this.box(
      this.node(id).locator(DESC).first().locator(".olai-md").first(),
      `the note of "${id}"`,
    );
    const corner = (box: Box) => ({
      x: Math.round(box.x),
      y: Math.round(box.y),
      width: Math.round(box.width),
    });
    assert.deepStrictEqual(
      corner(now),
      corner(before),
      `the note of "${id}" moved when its rendering replaced its source`,
    );
  },
);
