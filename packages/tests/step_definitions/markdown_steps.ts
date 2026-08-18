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
import { DOCUMENT_BODY, HYDRATION_TIMEOUT, POLL_TIMEOUT } from "../support/world.ts";
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

Then("nothing has asked for the markdown pipeline", function (this: OlaiWorld) {
  const requested = PIPELINE.asked(this);
  assert.deepStrictEqual(
    [...requested],
    [],
    `this page fetched the markdown pipeline it should not need:\n  ${requested.join("\n  ")}`,
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
    // The mark is on what the PIPELINE drew, which on a document's page is
    // inside the body rather than the body itself: the surface is the editor's
    // now, and the rendering is what it falls back to (`client/mde/Mde.tsx`).
    const failed = this.page
      .locator(`${DOCUMENT_BODY}[data-markdown="failed"], ${DOCUMENT_BODY} [data-markdown="failed"]`)
      .first();
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
