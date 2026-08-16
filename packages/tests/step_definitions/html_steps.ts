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

/** How far the frame and its page may disagree and still be "the same height":
 *  the tape measure rounds up to a whole pixel and a browser lays out in
 *  fractions, so an exact equality would be a flake with a story. */
const ROUNDING_PX = 2;

/** The two heights every step below compares.
 *
 *  `frame` is the preview element's own CONTENT box out here — `clientHeight`,
 *  so the seal's border is not counted as page. `page` is the height of the
 *  document INSIDE it, taken independently of the tape measure that reported
 *  it: the client believes a number that came over `postMessage`, and the whole
 *  question every step asks is whether that number was the truth. */
interface Heights {
  readonly frame: number;
  readonly page: number;
}

/**
 * Wait until the two heights say `settled`, and fail saying what they said.
 *
 * A WAIT, because it is one: the height arrives a frame or two after the
 * preview draws — the seal's script measures once the document is parsed and
 * the message crosses the frame boundary — so a step that read once would be
 * reading the `70dvh` fallback and calling it a measurement.
 *
 * The poll is the world's own (`waitUntil`), not a second one written here; the
 * only thing this adds is the last reading, because "timed out waiting until
 * the frame fits its page" is a worse sentence than the two numbers. Same shape
 * as `theme_steps.ts` uses for the same reason.
 *
 * `settled` is evaluated in exactly ONE place — the poll — and the failure path
 * does not re-check it, it just reports. That is deliberate: an earlier draft
 * waited on the predicate and then asserted the predicate again, which is one
 * editor away from waiting for X and asserting Y, and a step that waits for
 * something other than what it checks either passes on a value it never waited
 * for or burns the whole timeout before failing anyway (opencode's review of
 * this PR named the shape). With no second evaluation there is no second
 * condition to drift from the first.
 */
const untilHeights = async (
  world: OlaiWorld,
  settled: (seen: Heights) => boolean,
  describe: string,
  complain: (seen: Heights) => string,
): Promise<void> => {
  // Resolved ONCE. Both are lazy handles that re-resolve at use, so hoisting
  // them costs nothing and saves two `waitFor` round trips per tick — `inside`
  // waits on the frame that `preview` just waited on.
  const element = await preview(world);
  const inner = await inside(world);
  const reading = async (): Promise<Heights> => {
    // Independent reads of two different documents, so they go together rather
    // than one after the other.
    const [frame, page] = await Promise.all([
      element.evaluate((node) => (node as HTMLElement).clientHeight),
      inner.locator("body").evaluate(() => document.documentElement.offsetHeight),
    ]);
    return { frame, page };
  };

  let seen = await reading();
  try {
    await world.waitUntil(async () => settled((seen = await reading())), describe);
  } catch {
    // The timeout knows it never held; only this knows what was there instead.
    assert.fail(complain(seen));
  }
};

Then("the preview is as tall as the page it shows", async function (this: OlaiWorld) {
  await untilHeights(
    this,
    ({ frame, page }) => Math.abs(frame - page) <= ROUNDING_PX,
    "the frame is the height of the page in it",
    ({ frame, page }) =>
      `the frame is ${frame}px tall and the page inside it is ${page}px — ` +
      `the frame is still a guess rather than the height of what it shows`,
  );
});

/** The two directions one step asks in, as the word the feature says and what
 *  it means — a table rather than two near-identical step bodies, since only
 *  the comparison and the complaint differ.
 *
 *  `tall` throughout is the VIEWPORT's height, which is what these bounds are
 *  written against: `dvh` in a browser with no address bar in motion is
 *  exactly the page's own height. */
const AGAINST_VIEWPORT = {
  shorter: {
    holds: (frame: number, tall: number) => frame < tall,
    complain: (seen: Heights, tall: number) =>
      `a page of ${seen.page}px got a frame of ${seen.frame}px, which is the whole ` +
      `viewport (${tall}px) or more — a short page is claiming a screenful`,
  },
  taller: {
    holds: (frame: number, tall: number) => frame > tall,
    complain: (seen: Heights, tall: number) =>
      `a page of ${seen.page}px got a frame of only ${seen.frame}px against a ` +
      `${tall}px viewport — a long page is being folded back into a box`,
  },
} as const;

Then(
  "the preview is {word} than the viewport",
  async function (this: OlaiWorld, which: string) {
    const how = AGAINST_VIEWPORT[which as keyof typeof AGAINST_VIEWPORT];
    assert.ok(how !== undefined, `no such comparison as "${which} than the viewport"`);
    const tall = this.viewport().height;
    await untilHeights(
      this,
      ({ frame }) => how.holds(frame, tall),
      `the frame is ${which} than the ${tall}px viewport`,
      (seen) => how.complain(seen, tall),
    );
  },
);

// The cap, said as the PROMISE rather than as the number that keeps it. "Two
// screens" is a styling decision (`Hypertext.tsx`'s class), and a step that
// re-spelled it here would be a contract kept by memory in two halves of the
// repo — green while asserting something weaker if the bound were ever
// narrowed, red for no defect if it were widened. What a reader is owed is
// this: the frame STOPPED SHORT of its page, so an enormous file cannot make an
// enormous element, and the rest of the page is still in there to scroll. A
// frame that had swallowed the whole document fails the first half; one that
// had dropped the document fails the second.
Then(
  "the preview stops short of its page and scrolls the rest",
  async function (this: OlaiWorld) {
    const tall = this.viewport().height;
    await untilHeights(
      this,
      ({ frame, page }) => page > frame && frame > tall,
      "the frame stopped short of the page it holds",
      ({ frame, page }) =>
        frame >= page
          ? `the frame is ${frame}px and the page in it is ${page}px — it grew to ` +
            `hold the whole document, so an enormous file makes an enormous element`
          : `the frame is only ${frame}px against a ${tall}px viewport — it is ` +
            `bounded, but so far under one screen that the cap is not what stopped it`,
    );
  },
);

// ── walking the frame off its own document ─────────────────────────────

/**
 * A fixture that tries to leave, written HERE rather than in the feature
 * because it needs the one thing a `.feature` file cannot spell: this server's
 * address.
 *
 * A `<meta http-equiv="refresh">` is the walk-off that needs no script, and it
 * needs an ABSOLUTE url — a sandboxed `srcdoc` document is an opaque origin, so
 * a relative one has nothing to resolve against and simply does not fire (which
 * is a trap worth naming: a fixture written with `url=/` would pass this
 * scenario by never attacking it).
 *
 * The destination is THIS APP. Not for drama — it is the destination that makes
 * the failure legible and needs no network: unsealed, the frame would load
 * olai inside olai, and with `allow-scripts` on the context that page's
 * JavaScript would run, in a document with no `default-src 'none'` over it.
 * The seal cannot follow the frame there; `sandbox` can. That is the gap this
 * scenario exists for.
 */
/** The two ways out, as the head and body each needs. A `refresh` goes in the
 *  HEAD, where the parser keeps it and every browser honours it; a link is a
 *  link. Both point at an ABSOLUTE address for the reason above. */
const WALKS_OFF = {
  "refreshing itself": (to: string) => ({
    head: `<meta http-equiv="refresh" content="0;url=${to}/">`,
    body: "",
  }),
  "a link the reader follows": (to: string) => ({
    head: "",
    body: `<a id="away" href="${to}/">follow me</a>`,
  }),
} as const;

When(
  "I rewrite {string} as a page that walks the frame off by {string}",
  function (this: OlaiWorld, file: string, how: string) {
    const walk = WALKS_OFF[how as keyof typeof WALKS_OFF];
    assert.ok(walk !== undefined, `no such walk-off as "${how}"`);
    const { head, body } = walk(this.baseUrl);
    this.writeServed(
      file,
      `<!doctype html>\n<html lang="en"><head><meta charset="utf-8">${head}` +
        `<title>Walk off</title></head>\n<body><h1>Walk off</h1>\n` +
        `<p id="probe">the frame is on the sealed document</p>\n` +
        `${body}\n</body></html>\n`,
    );
  },
);

When("I follow the link out of the preview", async function (this: OlaiWorld) {
  const frame = await inside(this);
  await frame.locator("#away").click();
});

// The app, INSIDE the preview — the thing that must never be there. Read as the
// mount point rather than as a testid, because `#root` is in the shell's own
// HTML from the first byte, so it is there before any hydration and cannot pass
// by arriving late.
Then("the app is not loaded inside the preview", async function (this: OlaiWorld) {
  const frame = await inside(this);
  // Given a moment to be wrong: the walk-off is a navigation, so asserting
  // immediately would pass against a frame that simply had not left yet.
  await this.page.waitForTimeout(POLL_TIMEOUT / 10);
  assert.strictEqual(
    await frame.locator("#root").count(),
    0,
    "this app is loaded inside the preview frame — the page walked the frame " +
      "off `about:srcdoc`, where the seal's policy does not follow it, and " +
      "nothing put the seal back",
  );
});

// …and the positive half: it came home. The file's own markup is back in the
// frame, which is what says the restore RAN rather than the navigation merely
// having failed.
Then("the preview is back on the sealed document", async function (this: OlaiWorld) {
  const frame = await inside(this);
  await frame
    .locator("#probe")
    .waitFor({ state: "visible", timeout: HYDRATION_TIMEOUT });
});

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
