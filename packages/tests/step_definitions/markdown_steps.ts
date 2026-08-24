/**
 * The markdown pipeline as a thing that ARRIVES.
 *
 * It is a chunk of its own — split out by the `import()` in
 * `packages/web/src/client/markdown/chunk.ts` — fetched the first time a page
 * needs to interpret markdown and never on a page that does not, which is a
 * claim about the network, so these steps are about the network.
 * The one recording of what the page asked for is the world's (`support/`),
 * the same list the no-CDN step reads; what is added here is a way to hold the
 * answer back, so the moment before it lands is a moment a scenario can stand
 * in rather than a race it has to win.
 */

import * as assert from "node:assert";
import { Given, Then, When } from "@cucumber/cucumber";

import { chunkOf } from "../support/chunks.ts";
import { paintsOn, stopsWaiting, WAITING, waitsIllegibly } from "../support/paints.ts";
import {
  DESC,
  DOCUMENT_BODY,
  HYDRATION_TIMEOUT,
  POLL_TIMEOUT,
} from "../support/world.ts";
import type { OlaiWorld } from "../support/world.ts";

/**
 * The pipeline, as a chunk a scenario can hold up.
 *
 * The URL it is fetched from is derived from the module it is split at —
 * `markdown/pipeline.ts` → `pipeline-<hash>.js` — because that is the bundler's
 * naming rule, and the rule is spelled once for both chunks in
 * `support/chunks.ts` (the `•••` menu's primitive is the other; its steps are
 * in `menu_steps.ts`).
 */
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

/**
 * The SHELL asked, which is a claim about `index.html` rather than about
 * anything the app did — so it is asked of the document's own head, and of the
 * network beside it.
 *
 * Both halves matter. The tag alone would pass on a shell that named a chunk
 * no build ever wrote; the request alone would pass on the old arrangement,
 * where the first thing to draw markdown started the fetch a round trip late.
 */
Then("the shell asked for the markdown pipeline", async function (this: OlaiWorld) {
  const preloaded = await this.page.evaluate(() =>
    [...document.querySelectorAll('link[rel="modulepreload"]')].map((link) =>
      link.getAttribute("href") ?? ""
    )
  );
  assert.ok(
    preloaded.some((href) => /pipeline-[^/]+\.js$/.test(href)),
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
  // The marks themselves: a rendering would have turned these into elements,
  // so seeing them is seeing the file rather than a page of it.
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
    // WAITED for rather than read once: the title this is about arrives with a
    // frame from the live store, and reading during the frame before it lands
    // asserts on the title that was there already.
    await this.waitUntil(
      async () => (await title.innerText()).includes("**"),
      `the title of "${id}" to show its own source`,
    );
  },
);

// ── the waiting face ───────────────────────────────────────────────────
//
// One rule dresses every surface holding source it cannot render yet
// (`web/src/client/styles.css`), so these steps are one check asked of four
// different elements — and the element is always the one WEARING the face
// rather than the row or the pane around it.

Then("the document is waiting illegibly", async function (this: OlaiWorld) {
  await waitsIllegibly(
    this,
    this.page.locator(`${DOCUMENT_BODY}${WAITING}`),
    "the document",
  );
});

/** The other side of it, for the page whose renderer is never coming: there is
 *  no answer on its way, so the text somebody wrote IS the answer and has to
 *  be readable. Same check the de-blur makes below, since "no answer is
 *  coming" and "the answer came" leave the same page. */
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

/** The de-blur itself: the face is OFF the same element, which is what the
 *  swap is. */
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

/**
 * THE CLAIM ABOUT EVERY FRAME, including the ones that are gone: nothing this
 * document ever put in the waiting state was readable when it went in.
 *
 * Two assertions, and the first is the one that keeps this honest — a
 * scenario that raced past the waiting state and recorded nothing at all would
 * otherwise pass for having seen nothing. See `support/paints.ts`.
 */
Then("no frame of legible raw markdown was painted", async function (this: OlaiWorld) {
  const paints = await paintsOn(this.page);
  assert.ok(
    paints !== undefined,
    "no watcher is installed in this document — the scenario needs the " +
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

// ── and the swap ───────────────────────────────────────────────────────

When(
  "I note where the description of {string} sits",
  async function (this: OlaiWorld, id: string) {
    const desc = this.node(id).locator(DESC).first().locator(WAITING);
    const box = await desc.boundingBox();
    assert.ok(box !== null, `the note of "${id}" is not laid out`);
    this.blockBefore = { x: box.x, y: box.y, width: box.width };
  },
);

Then(
  "the description of {string} is where it was",
  async function (this: OlaiWorld, id: string) {
    const before = this.blockBefore;
    assert.ok(before !== undefined, "nothing noted where the note was sitting");
    const desc = this.node(id).locator(DESC).first().locator(".olai-md").first();
    const box = await desc.boundingBox();
    assert.ok(box !== null, `the note of "${id}" is not laid out`);
    // The CORNER and the measure, and deliberately not the height: a rendering
    // of the text is a different shape from the text, and the promise is that
    // the block does not jump — not that markdown renders to the same number
    // of lines it was written in.
    assert.deepStrictEqual(
      { x: Math.round(box.x), y: Math.round(box.y), width: Math.round(box.width) },
      {
        x: Math.round(before.x),
        y: Math.round(before.y),
        width: Math.round(before.width),
      },
      `the note of "${id}" moved when its rendering replaced its source`,
    );
  },
);
