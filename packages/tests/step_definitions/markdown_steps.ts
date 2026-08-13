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
import type { Route } from "playwright";

import { DOCUMENT_BODY, HYDRATION_TIMEOUT, POLL_TIMEOUT } from "../support/world.ts";
import type { OlaiWorld } from "../support/world.ts";

/**
 * The chunk's URL, as the bundler names it: `[name]-[hash].js` under the hashed
 * asset prefix, where the name is the split module's own — so the chunk holding
 * `markdown/pipeline.ts` is `pipeline-<hash>.js`. ONE spelling, used both to
 * intercept the request and to read the recording back, so what a scenario holds
 * up and what it then claims was never asked for cannot drift apart.
 */
const CHUNK_URL = /\/assets\/pipeline-[^/]+\.js$/;

const asked = (world: OlaiWorld): ReadonlyArray<string> =>
  world.requests.filter((url) => CHUNK_URL.test(url));

Given("the markdown pipeline is held up", async function (this: OlaiWorld) {
  const held: Route[] = [];
  this.heldMarkdown = held;
  // Registered before the page is opened, so it catches the fetch whenever the
  // app makes it — the point of the scenario is that it has not arrived YET.
  await this.page.route(CHUNK_URL, (route) => {
    held.push(route);
  });
});

Given("the markdown pipeline never arrives", async function (this: OlaiWorld) {
  await this.page.route(CHUNK_URL, (route) => route.abort("failed"));
});

When("the markdown pipeline arrives", async function (this: OlaiWorld) {
  const held = this.heldMarkdown;
  assert.ok(
    held !== undefined,
    "nothing is holding the markdown pipeline up, so there is nothing to let through",
  );
  assert.ok(
    held.length > 0,
    "the page never asked for the markdown pipeline, so letting it through proves nothing",
  );
  for (const route of held) await route.continue();
  this.heldMarkdown = [];
  await this.waitForFrame();
});

Then("nothing has asked for the markdown pipeline", function (this: OlaiWorld) {
  const requested = asked(this);
  assert.deepStrictEqual(
    [...requested],
    [],
    `this page fetched the markdown pipeline it should not need:\n  ${requested.join("\n  ")}`,
  );
});

Then("the markdown pipeline was fetched once", function (this: OlaiWorld) {
  assert.strictEqual(
    asked(this).length,
    1,
    `the page asked for the markdown pipeline ${asked(this).length} time(s)`,
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
