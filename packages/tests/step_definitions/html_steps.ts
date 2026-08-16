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
import type { FrameLocator } from "playwright";

// The policy the client actually writes, not a copy of it — see the step that
// reads it, and `sealed.ts`'s own note on why it is a named function. It takes
// this app's origin now, because the one thing the policy says that is not a
// constant is where the pictures are.
import { policyOf } from "@olai/web/src/client/document/sealed.ts";

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

// ── the pictures a page may and may not draw ───────────────────────────

/**
 * DECODED, not merely present, and that is the only reading that means anything
 * here: a refused `<img>` is in the DOM, is visible, has the `src` the file
 * wrote, and has drawn nothing at all. Every picture step below asks the
 * browser this one question.
 *
 * `decode()` rather than `naturalWidth` alone, and the difference is not
 * pedantic: a PNG's width is in its header, so an image whose PIXELS never
 * arrived still reports one. (Found the hard way here — a fixture picture with
 * a malformed body passed a width check and rendered a blank box.) The answer
 * is the width of a picture that actually decoded, and zero for everything
 * else.
 */
const drawn = (frame: FrameLocator, selector: string) =>
  frame.locator(selector).first().evaluate(async (node) => {
    const picture = node as HTMLImageElement;
    try {
      await picture.decode();
      return picture.naturalWidth;
    } catch {
      return 0;
    }
  });

/** …and the wait that has to come first: an `<img>` is in the DOM the moment
 *  the document parses, so reading its width straight away would be reading it
 *  before the fetch it is about could possibly have finished. */
const pictureIn = async (world: OlaiWorld, selector: string) => {
  const frame = await inside(world);
  await frame
    .locator(selector)
    .first()
    .waitFor({ state: "attached", timeout: HYDRATION_TIMEOUT });
  return frame;
};

Then(
  "the preview draws its picture {string}",
  async function (this: OlaiWorld, selector: string) {
    const frame = await pictureIn(this, selector);
    await this.waitUntil(
      async () => (await drawn(frame, selector)) > 0,
      `the picture ${selector} inside the preview to be decoded`,
    );
  },
);

// …and the refusals, which are the whole point of the fixture. Each of these
// is in the DOM — asserted, so a typo'd selector cannot pass as "nothing was
// drawn" — and each has to have fetched nothing: a climb out of the served
// directory, the same climb spelled `%2e%2e`, a remote host, a `data:` URI.
// Given a moment to be wrong first, because a picture that HAD been allowed
// would arrive a frame or two after the markup did.
Then(
  "the preview draws no picture for {string}",
  async function (this: OlaiWorld, selectors: string) {
    const wrong: string[] = [];
    for (const selector of selectors.split(",").map((one) => one.trim())) {
      const frame = await pictureIn(this, selector);
      await this.page.waitForTimeout(POLL_TIMEOUT / 10);
      const width = await drawn(frame, selector);
      if (width > 0) wrong.push(`${selector} drew ${width}px wide`);
    }
    assert.deepStrictEqual(
      wrong,
      [],
      "these addresses were fetched and drawn inside the preview, and every " +
        "one of them is outside what a sealed frame may ask for",
    );
  },
);

/**
 * WHAT LEFT, as against what was asked for — and on a page that names somebody
 * else's server on purpose, those are two different lists.
 *
 * `report.html` carries a remote picture, so the ATTEMPT is recorded the moment
 * the markup is parsed: a browser records a request when a document asks for
 * one, before anything has decided whether it may happen. "The page requested
 * nothing off this server" (the markdown side's step) is therefore the wrong
 * question here, and a weaker one — what this asks is whether each of those
 * attempts was STOPPED, and by what.
 *
 * By the POLICY, specifically, and that is the whole reason the reason is read.
 * `example.invalid` cannot resolve, by construction — so a fixture pointing at
 * it would fail to reach anyone whether or not this app had a content policy at
 * all, and a step that accepted any failure would go green on a preview with
 * the seal taken off. What the browser says about a refusal is the difference
 * between "we stopped it" and "the internet did": Playwright hands this one
 * back as `csp` and the same family of blocks is spelled `ERR_BLOCKED_BY_*`
 * elsewhere, so both are matched and a failure prints every reason it saw —
 * this pattern is about a browser's WORDING, and a rewording of it should fail
 * here legibly rather than read as a policy that stopped working.
 *
 * The last assertion is the fixture's own teeth: at least one address off this
 * server has to have been attempted, or this step is a sentence about nothing.
 */
const BLOCKED_BY_POLICY = /^csp$|blocked_by_csp|blocked_by_client|blocked_by_response/i;

Then("the preview reached nothing off this server", function (this: OlaiWorld) {
  const elsewhere = this.offSite();
  assert.ok(
    elsewhere.length > 0,
    "nothing in this page even NAMES another server — the fixture has lost the " +
      "remote picture this step exists to watch being refused",
  );
  const stopped = new Set(
    this.refused
      .filter((one) => BLOCKED_BY_POLICY.test(one.why))
      .map((one) => one.url),
  );
  const got = elsewhere.filter((url) => !stopped.has(url));
  assert.deepStrictEqual(
    got,
    [],
    `these addresses were not stopped by the policy:\n  ${got.join("\n  ")}\n` +
      `what the browser said about the ones it refused:\n  ` +
      this.refused.map((one) => `${one.url} — ${one.why}`).join("\n  "),
  );
});

/**
 * A vault whose pictures take a moment, which is what makes the height
 * scenario an experiment rather than a race.
 *
 * The frame measures itself when the document has parsed, and an `<img>` is a
 * zero-tall box until its bytes land — so whether the first measurement is
 * correct depends entirely on whether the picture beat it. Over a loopback
 * socket with a one-kilobyte PNG it usually does, which means an unheld run
 * would pass whether or not the second reading (`./sealed.ts`'s settled report)
 * existed at all. Held for longer than a first layout takes, the order is the
 * one every real page with a photograph in it sees: measure, then arrive.
 *
 * `route` rather than a slower fixture, because size is not the knob — a bigger
 * file is still a race, just with different odds.
 *
 * WHICH addresses are held is read out of the seal's own policy rather than
 * spelled here: the `img-src` source IS the route a preview's pictures travel,
 * so this holds back exactly what the client says a frame may fetch, and a
 * route moved over there is a step that follows it rather than one that quietly
 * holds nothing.
 */
const SLOW_PICTURE_MS = 750;

const picturesFrom = (world: OlaiWorld): string => {
  const source = /img-src (\S+)/.exec(policyOf(world.baseUrl));
  assert.ok(source !== null, "the seal's policy no longer names where pictures come from");
  return `${source[1]}**`;
};

When("the vault's pictures are slow to arrive", async function (this: OlaiWorld) {
  await this.page.route(picturesFrom(this), async (route) => {
    await new Promise((wake) => setTimeout(wake, SLOW_PICTURE_MS));
    await route.continue();
  });
});

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

/** The viewport the bounds are written against: `dvh` in a browser with no
 *  address bar in motion is exactly the page's own height. */
const viewport = (world: OlaiWorld): number => {
  const size = world.page.viewportSize();
  assert.ok(size !== null, "this scenario has no viewport size");
  return size.height;
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
 *  the comparison and the complaint differ. */
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
    const tall = viewport(this);
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
    const tall = viewport(this);
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
  "the preview's markup is sealed with a policy that fetches only pictures",
  async function (this: OlaiWorld) {
    const frame = await preview(this);
    const srcdoc = (await frame.getAttribute("srcdoc")) ?? "";
    assert.ok(
      srcdoc.startsWith("<!doctype html>"),
      "the seal does not open the markup — a meta policy after the file's own " +
        "content is a policy the parser ignores",
    );
    // The exact policy the client writes, computed by the client's own function
    // rather than re-spelled, for the reason every selector in `world.ts` is
    // imported: a widening made over there would still read as sealed over
    // here. The unit test beside it (`sealed.test.ts`) is what says the policy
    // is the strict one — every directive, including that `img-src` is one path
    // on this origin and not a scheme, a host or `'self'`; this says the strict
    // one is what the browser was actually handed, at the address this server
    // is really on.
    assert.ok(
      srcdoc.includes(`content="${policyOf(this.baseUrl)}"`),
      `the policy in front of the markup is not the sealed one: ${srcdoc.slice(0, 240)}`,
    );
  },
);

/**
 * WHAT A RELATIVE ADDRESS IN THE FILE RESOLVES AGAINST, read as the browser's
 * own answer rather than as the attribute that produced it.
 *
 * `document.baseURI` INSIDE the frame is the whole assertion: it is the value
 * every `<img src="art/shot.png">` in there is resolved against, after the
 * parser has taken every `<base>` in the document into account and picked the
 * first. `report.html` carries one of its own pointing at `example.invalid`, so
 * a seal that arrived second — or was left out — fails here with that address
 * in the message.
 *
 * The file's own base is then asserted to be STILL THERE in the markup, which
 * is the other half of the promise: nothing was stripped or rewritten to make
 * this work. What moved is what the addresses resolve against, not the file.
 */
Then(
  "the preview resolves the file's addresses under {string}",
  async function (this: OlaiWorld, route: string) {
    const frame = await preview(this);
    const base = await (await inside(this))
      .locator("body")
      .evaluate(() => document.baseURI);
    assert.strictEqual(
      base,
      `${this.baseUrl}${route}`,
      "a relative address in the previewed file does not resolve on this " +
        "server's media route — so either the seal's base is missing, or the " +
        "file's own base won",
    );
    const srcdoc = (await frame.getAttribute("srcdoc")) ?? "";
    assert.ok(
      srcdoc.includes(`<base href="https://example.invalid/vault/"`),
      "the file's own `<base>` is not in the markup the browser was handed — " +
        "the seal is a prefix, and a preview that edited the file to make its " +
        "pictures work would be lying about what is on disk",
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
 * The BROWSER's own words, and the only console errors a page with a preview on
 * it is allowed to carry.
 *
 * `report.html` has a script and four addresses it may not fetch; the seal's
 * policy refuses every one of them; Chromium says so on the console, and the
 * suite's error listener records every console error there is. So "there should
 * be no page errors" is the wrong question on these pages — and the right one
 * is stronger than the question it replaces, because it reads the refusals as
 * EVIDENCE: nothing else went wrong, and the things that were supposed to be
 * stopped were stopped, said by the browser rather than by us.
 *
 * The script one is the CONTENT POLICY's refusal now rather than the sandbox's
 * ("blocked script execution … because the document's frame is sandboxed"),
 * because the sandbox admits scripts so the seal's own tape measure can run and
 * the policy is what names the single script allowed to be one. Both wordings
 * are matched: which mechanism says no is the argument in `sealed.ts`, and this
 * step's job is that SOMETHING did — a run where neither sentence appears is a
 * run where the file's script executed.
 *
 * Matched loosely (the shape of the sentence, not the sentence — Chromium's
 * current ones are "Executing inline script violates the following Content
 * Security Policy directive …" and "Refused to load the image '…' because it
 * violates the following Content Security Policy directive: img-src …") so a
 * browser that rewords its message fails on the wording of THIS assertion
 * rather than on a security regression that never happened.
 *
 * Both kinds are required to have HAPPENED, not merely tolerated. A pattern
 * that only permits a message is one the fixture can satisfy by losing its
 * teeth — the picture probes could be deleted, or quietly start drawing, and an
 * allowance would say nothing either way.
 */
const REFUSALS = {
  script: /inline script[\s\S]*content security policy|blocked script execution/i,
  picture: /(?:loading|refused to load) the image[\s\S]*content security policy/i,
} as const;

const REFUSED = (said: string): boolean =>
  Object.values(REFUSALS).some((shape) => shape.test(said));

Then(
  "the only complaints are the browser refusing what the file may not do",
  function (this: OlaiWorld) {
    const others = this.errors.filter((said) => !REFUSED(said));
    assert.deepStrictEqual(
      others,
      [],
      `the page reported ${others.length} error(s) that are not refusals:\n  ` +
        others.join("\n  "),
    );
    assert.ok(
      this.errors.some((said) => REFUSALS.script.test(said)),
      "the browser never refused the script in `report.html` — either the frame " +
        "stopped being sandboxed, or the fixture stopped carrying a script",
    );
    assert.ok(
      this.errors.some((said) => REFUSALS.picture.test(said)),
      "the browser never refused a picture in `report.html` — either the policy " +
        "stopped naming which addresses a preview may fetch, or the fixture " +
        "stopped carrying the ones it may not",
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
