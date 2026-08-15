/**
 * A `.html` in the vault: the row, the page, and the seal around the markup.
 *
 * Most of these read INSIDE the frame, through Playwright's `frameLocator`,
 * and that is the point rather than an inconvenience: what the file says is in
 * there, and what the file may NOT do is everything out here. A step that read
 * the app's DOM for the file's heading would be asserting the exact thing this
 * feature exists to forbid.
 *
 * The two "untouched" steps are the probe's other end. `report.html`'s script
 * tries to write `localStorage`, set a cookie and mark the app's `<body>`; each
 * is read from the APP's side, because that is the origin that would have been
 * reached and the only place the damage would show. They are deliberately
 * asserted after a step that has already seen the preview draw — an empty
 * storage is trivially true of a page that never loaded.
 */

import * as assert from "node:assert";
import { Then, When } from "@cucumber/cucumber";

import {
  DOCUMENT_EDIT,
  HYDRATION_TIMEOUT,
  HYPERTEXT_LINK,
  HYPERTEXT_PREVIEW,
  POLL_TIMEOUT,
} from "../support/world.ts";
import type { OlaiWorld } from "../support/world.ts";

// ── the row in the tree ────────────────────────────────────────────────

// The same question the documents step asks, about the other kind, through the
// world that owns the waiting (`expectListed`).
Then(
  "the pages listed are {string}",
  async function (this: OlaiWorld, expected: string) {
    await this.expectListed(
      HYPERTEXT_LINK,
      expected.split(",").map((file) => file.trim()),
      "page(s)",
    );
  },
);

When("I click the page {string}", async function (this: OlaiWorld, file: string) {
  await this.showSidebar();
  const link = this.hypertextLink(file);
  await link.waitFor({ state: "visible", timeout: HYDRATION_TIMEOUT });
  await link.click();
  await this.waitForFrame();
});

// The same address a document has, because it is the same page model — so it
// is opened the same way, through the world's own `openDocument`.
When("I open the page {string}", async function (this: OlaiWorld, file: string) {
  await this.openDocument(file);
});

// ── what is drawn in the frame ─────────────────────────────────────────

/** The frame ELEMENT, on screen — what every step below starts from, so a
 *  failure says "there is no preview" rather than timing out on something
 *  inside one. */
const preview = async (world: OlaiWorld) => {
  const frame = world.page.locator(HYPERTEXT_PREVIEW);
  await frame.waitFor({ state: "visible", timeout: HYDRATION_TIMEOUT });
  return frame;
};

/** …and the document inside it, which is where everything the FILE says is
 *  read. Asked through `frameLocator` because that is the only way in: nothing
 *  in there can reach a testid out here, which is the point. */
const inside = async (world: OlaiWorld) => {
  await preview(world);
  return world.page.frameLocator(HYPERTEXT_PREVIEW);
};

Then(
  "the preview shows the heading {string}",
  async function (this: OlaiWorld, text: string) {
    const frame = await inside(this);
    await frame
      .locator("h1", { hasText: text })
      .first()
      .waitFor({ state: "visible", timeout: HYDRATION_TIMEOUT });
  },
);

Then(
  "the preview says {string}",
  async function (this: OlaiWorld, text: string) {
    const frame = await inside(this);
    const probe = frame.locator("#probe");
    await probe.waitFor({ state: "visible", timeout: HYDRATION_TIMEOUT });
    assert.strictEqual(
      (await probe.textContent())?.trim(),
      text,
      "the paragraph the file's own script would have rewritten",
    );
  },
);

// The file's own `<style>`, read as the COMPUTED colour of what it styled: a
// heading that came out the app's ink is a frame that dropped the stylesheet,
// which is what a policy without `style-src 'unsafe-inline'` would do.
Then(
  "the preview draws {string} in the file's own colour",
  async function (this: OlaiWorld, text: string) {
    const frame = await inside(this);
    const heading = frame.locator("h1", { hasText: text }).first();
    await heading.waitFor({ state: "visible", timeout: HYDRATION_TIMEOUT });
    const colour = await heading.evaluate((node) =>
      getComputedStyle(node as Element).color
    );
    assert.strictEqual(
      colour,
      "rgb(20, 83, 45)",
      "the heading is not wearing the colour the file's own stylesheet gives it",
    );
  },
);

// ── the seal ───────────────────────────────────────────────────────────

Then(
  "the preview is sandboxed with no scripts and no same-origin",
  async function (this: OlaiWorld) {
    const frame = await preview(this);
    // The ATTRIBUTE, exactly as written: an empty `sandbox` is every
    // restriction on, and the two that matter are named in the message because
    // they are the two a well-meaning patch adds ("just to make this one page
    // work"). `null` here is a frame with no sandbox at all, which is the
    // one-character regression this step exists for.
    assert.strictEqual(
      await frame.getAttribute("sandbox"),
      "",
      "the preview frame's sandbox is not the empty one — allow-scripts or " +
        "allow-same-origin would let a served file into this app's origin",
    );
  },
);

Then(
  "the preview's markup is sealed with a policy that fetches nothing",
  async function (this: OlaiWorld) {
    const frame = await preview(this);
    const srcdoc = (await frame.getAttribute("srcdoc")) ?? "";
    assert.ok(
      srcdoc.startsWith("<!doctype html>"),
      "the seal does not open the markup — a meta policy after the file's own " +
        "content is a policy the parser ignores",
    );
    assert.ok(
      srcdoc.includes(`content="default-src 'none'; style-src 'unsafe-inline'"`),
      `the policy in front of the markup is not the sealed one: ${srcdoc.slice(0, 200)}`,
    );
  },
);

// ── what the script could not do ───────────────────────────────────────

Then("the app's storage is untouched by the preview", async function (this: OlaiWorld) {
  const written = await this.page.evaluate(() => ({
    keys: Object.keys(localStorage).filter((key) => key.includes("pwned")),
    cookie: document.cookie,
  }));
  assert.deepStrictEqual(written.keys, [], "the preview wrote into this app's localStorage");
  assert.ok(
    !written.cookie.includes("pwned"),
    `the preview set a cookie on this app's origin: ${written.cookie}`,
  );
});

/**
 * The BROWSER's own words, and the only console error a page with a preview on
 * it is allowed to carry.
 *
 * `report.html` has a script; the frame refuses to run it; Chromium says so on
 * the console, and the suite's error listener records every console error there
 * is. So "there should be no page errors" is the wrong question on these pages —
 * and the right one is stronger than the question it replaces, because it reads
 * the refusal as EVIDENCE: nothing else went wrong, and the thing that was
 * supposed to be stopped was stopped, said by the browser rather than by us.
 *
 * Matched loosely (the shape of the sentence, not the sentence) so a Chromium
 * that rewords its message fails on the wording of THIS assertion rather than
 * on a security regression that never happened.
 */
const REFUSED = /blocked script execution/i;

Then(
  "the only complaint is the browser refusing the file's script",
  function (this: OlaiWorld) {
    const others = this.errors.filter((said) => !REFUSED.test(said));
    assert.deepStrictEqual(
      others,
      [],
      `the page reported ${others.length} error(s) that are not the refusal:\n  ` +
        others.join("\n  "),
    );
    assert.ok(
      this.errors.some((said) => REFUSED.test(said)),
      "the browser never refused the script in `report.html` — either the frame " +
        "stopped being sandboxed, or the fixture stopped carrying a script",
    );
  },
);

Then("the app's page is untouched by the preview", async function (this: OlaiWorld) {
  const marked = await this.page.evaluate(() =>
    document.body.getAttribute("data-pwned")
  );
  assert.strictEqual(marked, null, "the preview reached this app's DOM");
});

// ── the affordance a document has and this page does not ───────────────

Then("there is no way to edit this page", async function (this: OlaiWorld) {
  // The preview first, because "not there" is the assertion: reading for the
  // control before the page has drawn would pass for the wrong reason.
  await preview(this);
  assert.strictEqual(
    await this.page.locator(DOCUMENT_EDIT).count(),
    0,
    "this page offers an Edit control for a file the ops layer will refuse to write",
  );
});

Then("there is a way to edit this page", async function (this: OlaiWorld) {
  await this.page
    .locator(DOCUMENT_EDIT)
    .waitFor({ state: "visible", timeout: POLL_TIMEOUT });
});
