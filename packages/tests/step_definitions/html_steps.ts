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

// The policy the client actually writes, not a copy of it — see the step that
// reads it, and `sealed.ts`'s own note on why it is a named constant.
import { POLICY as SEAL_POLICY } from "@olai/web/src/client/document/sealed.ts";

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

// ── how tall the frame is ──────────────────────────────────────────────

/**
 * The two heights every step below compares, read as a pair.
 *
 * `frame` is the preview element's own CONTENT box out here — `clientHeight`,
 * so the seal's border is not counted as page. `page` is the height of the
 * document INSIDE it, taken independently of the tape measure that reported it:
 * the client believes a number that came over `postMessage`, and the whole
 * question is whether that number was the truth.
 *
 * Read as a POLL, because it is one. The height arrives a frame or two after
 * the preview draws — the seal's script measures on `DOMContentLoaded` and the
 * message crosses the frame boundary — so a step that read once would be
 * reading the `70dvh` fallback and calling it a measurement.
 */
const ROUNDING_PX = 2;

const bothHeights = async (
  world: OlaiWorld,
  settled: (frame: number, page: number) => boolean,
): Promise<{ frame: number; page: number }> => {
  const deadline = Date.now() + POLL_TIMEOUT;
  let seen = { frame: 0, page: 0 };
  for (;;) {
    const element = await preview(world);
    const inner = await inside(world);
    seen = {
      frame: await element.evaluate((node) => (node as HTMLElement).clientHeight),
      page: await inner
        .locator("body")
        .evaluate(() => document.documentElement.offsetHeight),
    };
    if (settled(seen.frame, seen.page) || Date.now() > deadline) return seen;
    await world.page.waitForTimeout(100);
  }
};

/** The viewport the bounds are written in: `dvh` in a browser with no address
 *  bar in motion is exactly the page's own height. */
const viewport = (world: OlaiWorld): number => {
  const size = world.page.viewportSize();
  if (size === null) throw new Error("the page has no viewport to measure against");
  return size.height;
};

Then("the preview is as tall as the page it shows", async function (this: OlaiWorld) {
  const seen = await bothHeights(this, (frame, page) => Math.abs(frame - page) <= ROUNDING_PX);
  assert.ok(
    Math.abs(seen.frame - seen.page) <= ROUNDING_PX,
    `the frame is ${seen.frame}px tall and the page inside it is ${seen.page}px — ` +
      `the frame is still a guess rather than the height of what it shows`,
  );
});

Then("the preview is shorter than the viewport", async function (this: OlaiWorld) {
  const tall = viewport(this);
  const seen = await bothHeights(this, (frame) => frame < tall);
  assert.ok(
    seen.frame < tall,
    `a page of ${seen.page}px got a frame of ${seen.frame}px, which is the whole ` +
      `viewport (${tall}px) or more — a short page is claiming a screenful`,
  );
});

Then("the preview is taller than the viewport", async function (this: OlaiWorld) {
  const tall = viewport(this);
  const seen = await bothHeights(this, (frame) => frame > tall);
  assert.ok(
    seen.frame > tall,
    `a page of ${seen.page}px got a frame of only ${seen.frame}px against a ` +
      `${tall}px viewport — a long page is being folded back into a box`,
  );
});

// The BOUND, and the behaviour past it, in one step because they are one fact:
// the frame stops growing at two screens and the page carries on inside it. A
// step that only checked the cap would pass on a frame that had silently
// dropped the rest of the document.
Then(
  "the preview stops at two viewports and scrolls the rest",
  async function (this: OlaiWorld) {
    const bound = viewport(this) * 2;
    const seen = await bothHeights(
      this,
      (frame, page) => frame <= bound + ROUNDING_PX && page > frame,
    );
    assert.ok(
      seen.frame <= bound + ROUNDING_PX,
      `the frame grew to ${seen.frame}px, past the two-viewport bound of ${bound}px — ` +
        `an enormous file can make an enormous element`,
    );
    assert.ok(
      seen.page > seen.frame,
      `the frame is ${seen.frame}px and the page in it measures only ${seen.page}px — ` +
        `the page it is supposed to be scrolling is not there`,
    );
  },
);

// ── the seal ───────────────────────────────────────────────────────────

Then(
  "the preview is sandboxed into nobody's origin",
  async function (this: OlaiWorld) {
    const frame = await preview(this);
    // The ATTRIBUTE, exactly as written. `allow-scripts` is there so the seal's
    // own tape measure can run (`sealed.ts` argues it); `allow-same-origin` is
    // the one that must never join it, because a document with BOTH can reach
    // its own frame element and take the sandbox off. Asserted as an equality
    // rather than as "does not contain same-origin", so any third token is a
    // failure too — the regressions here are all one word added by somebody
    // making one page work.
    assert.strictEqual(
      await frame.getAttribute("sandbox"),
      "allow-scripts",
      "the preview frame's sandbox is not the sealed one — another token, and " +
        "`allow-same-origin` above all, would let a served file into this " +
        "app's origin",
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
    // The exact policy the client writes, imported rather than re-spelled, for
    // the reason every selector in `world.ts` is imported: a widening made over
    // there would still read as sealed over here. The unit test beside it
    // (`sealed.test.ts`) is what says the policy is the strict one; this says
    // the strict one is what the browser was actually handed.
    assert.ok(
      srcdoc.includes(`content="${SEAL_POLICY}"`),
      `the policy in front of the markup is not the sealed one: ${srcdoc.slice(0, 240)}`,
    );
    assert.ok(
      !/script-src[^"]*'unsafe-inline'/.test(srcdoc),
      "the policy admits inline scripts wholesale — the seal admits exactly " +
        "one script, by hash, and that is the difference between running our " +
        "tape measure and running the file's",
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
 * `report.html` has a script; the seal's policy refuses to run it; Chromium
 * says so on the console, and the suite's error listener records every console
 * error there is. So "there should be no page errors" is the wrong question on
 * these pages — and the right one is stronger than the question it replaces,
 * because it reads the refusal as EVIDENCE: nothing else went wrong, and the
 * thing that was supposed to be stopped was stopped, said by the browser rather
 * than by us.
 *
 * It is the CONTENT POLICY's refusal now rather than the sandbox's ("blocked
 * script execution … because the document's frame is sandboxed"), because the
 * sandbox admits scripts so the seal's own tape measure can run and the policy
 * is what names the single script allowed to be one. Both wordings are matched:
 * which mechanism says no is the argument in `sealed.ts`, and this step's job
 * is that SOMETHING did — a run where neither sentence appears is a run where
 * the file's script executed.
 *
 * Matched loosely (the shape of the sentence, not the sentence — Chromium's
 * current one is "Executing inline script violates the following Content
 * Security Policy directive …") so a browser that rewords its message fails on
 * the wording of THIS assertion rather than on a security regression that never
 * happened.
 */
const REFUSED =
  /inline script[\s\S]*content security policy|blocked script execution/i;

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
