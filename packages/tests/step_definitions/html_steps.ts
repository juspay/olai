/**
 * A `.html` in the vault: the row, the page, and the seal around the file.
 *
 * Most of these read INSIDE the frame, through Playwright's `frameLocator`,
 * and that is the point rather than an inconvenience: what the file says is in
 * there, and what the file may NOT do is everything out here. A step that read
 * the app's DOM for the file's heading would be asserting the exact thing this
 * feature exists to forbid.
 *
 * The two "untouched" steps are the probe's other end. `report.html`'s script
 * RUNS now, and tries to write `localStorage`, set a cookie and mark the app's
 * `<body>`; each is read from the APP's side, because that is the origin that
 * would have been reached and the only place the damage would show. They are
 * deliberately asserted after a step that has already seen the preview draw —
 * an empty storage is trivially true of a page that never loaded.
 */

import * as assert from "node:assert";
import { Then, When } from "@cucumber/cucumber";
import type { Locator } from "playwright";

// The policy the server actually writes, not a copy of it — see the step that
// reads it, and `seal.ts`'s own note on why it is a named function. It takes
// the HOST the request was made to, because the one thing the policy says that
// is not a constant is where this vault's files are. `mediaHref` is the other
// half of the same contract: the address a preview frame is pointed at.
import { isPicture } from "@olai/format";
import { MEDIA_PREFIX, mediaHref, mediaTarget, sealPolicy } from "@olai/surface";

import { saysThat } from "../support/said.ts";
import {
  DOCUMENT_EDIT,
  HYDRATION_TIMEOUT,
  HYPERTEXT_LINK,
  HYPERTEXT_PREVIEW,
  HYPERTEXT_SAID,
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

/**
 * WHAT THE PAGE'S OWN SCRIPT DREW, which is the ruling of 2026-08-16 read as a
 * fact on a screen rather than as a policy string.
 *
 * A page that builds its own content is the ordinary saved dashboard, and under
 * the old seal it drew NOTHING — the script was refused by hash, so the file
 * was a heading over an empty box. So the assertion is not "the script ran": it
 * is that the elements it created are there and each has a real box, because an
 * element appended by a script that could not style it is as invisible as one
 * that was never appended.
 */
Then(
  "the preview drew {int} boxes for {string}",
  async function (this: OlaiWorld, many: number, selector: string) {
    const drawn = (await inside(this)).locator(selector);
    await this.waitUntil(
      async () => (await drawn.count()) === many,
      `${many} element(s) matching ${selector} to be drawn inside the preview ` +
        `by the page's own script`,
    );
    const boxes = await Promise.all(
      Array.from({ length: many }, (_, at) => drawn.nth(at).boundingBox()),
    );
    const flat = boxes
      .map((box, at) =>
        box === null || box.width === 0 || box.height === 0
          ? `${selector}[${at}] is ${box === null ? "not rendered" : "0 by 0"}`
          : null
      )
      .filter((one) => one !== null);
    assert.deepStrictEqual(
      flat,
      [],
      "the page's script appended elements that take up no room at all — it " +
        "ran far enough to build them and not far enough to size them",
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
const drawn = (picture: Locator) =>
  picture.evaluate(async (node) => {
    const image = node as HTMLImageElement;
    try {
      await image.decode();
      return image.naturalWidth;
    } catch {
      return 0;
    }
  });

/** The `<img>` itself, once it is in the DOM — which is the wait that has to
 *  come first: an `<img>` is there the moment the document parses, so reading
 *  its width straight away would be reading it before the fetch it is about
 *  could possibly have finished. Resolved ONCE and handed to {@link drawn}, so
 *  a step that reads a picture twice looks it up once. */
const pictureIn = async (world: OlaiWorld, selector: string): Promise<Locator> => {
  const picture = (await inside(world)).locator(selector).first();
  await picture.waitFor({ state: "attached", timeout: HYDRATION_TIMEOUT });
  return picture;
};

Then(
  "the preview draws its picture {string}",
  async function (this: OlaiWorld, selector: string) {
    const picture = await pictureIn(this, selector);
    await this.waitUntil(
      async () => (await drawn(picture)) > 0,
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
    const named = selectors.split(",").map((one) => one.trim());
    const pictures = await Promise.all(named.map((one) => pictureIn(this, one)));
    // ONCE, not once per selector: every one of these was asked for by the same
    // page load, so one grace period covers the lot — and the four in the
    // fixture used to cost four of them.
    await this.page.waitForTimeout(POLL_TIMEOUT / 10);
    const widths = await Promise.all(pictures.map(drawn));
    const wrong = named
      .map((selector, at) => ({ selector, width: widths[at]! }))
      .filter((one) => one.width > 0)
      .map((one) => `${one.selector} drew ${one.width}px wide`);
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
 * would pass whether or not the second reading (`@olai/surface`'s `seal.ts`
 * tags it `settled`) existed at all. Held for longer than a first layout takes, the order is the
 * one every real page with a photograph in it sees: measure, then arrive.
 *
 * `route` rather than a slower fixture, because size is not the knob — a bigger
 * file is still a race, just with different odds.
 *
 * WHICH addresses are held is read off the two things that own the answer
 * rather than written out here (below), so a route or an allowlist moved over
 * there is a step that follows it rather than one that quietly holds nothing.
 */
const SLOW_PICTURE_MS = 750;

/**
 * PICTURES ONLY, which the route no longer is: it answers the page itself now,
 * and holding that back too would delay the document and its picture equally —
 * an experiment that proves nothing, since what is under test is a picture
 * arriving AFTER the page has been measured.
 *
 * Both halves are asked of the code that owns them — `mediaTarget` for which
 * file of this vault a URL names, decoding and all, and `@olai/format`'s
 * `isPicture` for whether that file is a picture — rather than written out here.
 * A rule copied into a step is a second rule from the day it is written: an
 * earlier draft of this one re-spelled the suffix list and had already lost
 * `.bmp` and `.ico`, which the route serves, so a fixture using either would
 * have raced the measurement this step exists to lose.
 */
const heldBack = (world: OlaiWorld) => (url: URL): boolean => {
  const target = mediaTarget(url.pathname);
  return `${url.origin}` === world.baseUrl && target !== null && isPicture(target);
};

When("the vault's pictures are slow to arrive", async function (this: OlaiWorld) {
  await this.page.route(heldBack(this), async (route) => {
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
  // Resolved ONCE, and the frame is waited for ONCE: `inside` waits on the same
  // element `preview` just waited on, so asking it here would be the same round
  // trip twice on every tick. Both handles are lazy and re-resolve at use.
  const element = await preview(world);
  const inner = world.page.frameLocator(HYPERTEXT_PREVIEW);
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
 * needs an ABSOLUTE url for a reason that CHANGED with this rule and still
 * holds: a served page has a real address now, so `url=/` would resolve — onto
 * this server's own root, which is not where the frame has to be stopped from
 * going. The attack this scenario is about is the frame leaving the vault, so
 * the fixture has to name somewhere outside it.
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

/** A click on anything else in there — a submit button, so far. Given a moment
 *  afterwards, because what the scenario using it asserts is that something did
 *  NOT happen: reading immediately would be reading before the navigation or
 *  the request it is about could have started. */
When(
  "I click {string} inside the preview",
  async function (this: OlaiWorld, selector: string) {
    const frame = await inside(this);
    await frame.locator(selector).first().click();
    await this.page.waitForTimeout(POLL_TIMEOUT / 10);
  },
);

/**
 * …and it is STILL on that page a moment later, which is the assertion a
 * snapshot cannot make.
 *
 * A document the frame reached on its own is given `SAYS_HELLO` to identify
 * itself before the file is put back (`Hypertext.tsx`), so a frame that was
 * going to be brought home has been brought home by the time this reads. The
 * grace is the same `POLL_TIMEOUT / 10` every other "did NOT happen" step in
 * this file waits, and it is an order of magnitude past that budget.
 *
 * The heading is read and COMPARED rather than waited for, so a frame that was
 * restored fails here immediately and says which page it is on instead — where
 * waiting for a heading that is never coming would burn the whole timeout and
 * report nothing but its absence.
 */
Then(
  "the preview stays on the heading {string}",
  async function (this: OlaiWorld, text: string) {
    const frame = await inside(this);
    const heading = frame.locator("h1").first();
    await heading.waitFor({ state: "visible", timeout: HYDRATION_TIMEOUT });
    await this.page.waitForTimeout(POLL_TIMEOUT / 10);
    assert.strictEqual(
      (await heading.textContent())?.trim(),
      text,
      "the preview did not stay on the page the frame reached — a document of " +
        "this vault greets as it parses, so it should have been kept rather " +
        "than replaced by the file that sent it",
    );
  },
);

/** The place inside the page THE APP'S OWN ADDRESS names — the half of a
 *  fragment that makes a section a thing a reader can copy out of the bar and
 *  send. Read separately from the path, because `the address is` compares
 *  pathnames and would pass over a fragment that never arrived. */
Then(
  "the address carries the anchor {string}",
  async function (this: OlaiWorld, anchor: string) {
    await this.waitUntil(
      async () => (await this.page.evaluate(() => location.hash)) === anchor,
      `the app's address to carry ${anchor}`,
    );
  },
);

/**
 * WHERE THE DOCUMENT PAGE IS SCROLLED TO, as the heading nearest the top of the
 * viewport.
 *
 * The `.md` landing cannot be read the way the frame's is: there is no inner
 * `location.hash` to ask, because the app scrolled its own page to an element
 * whose id it had to translate first (`markdown/render.ts`'s `landingId`). So
 * what is read is the OUTCOME a reader would see — the heading they are looking
 * at — which is also the assertion that survives the id scheme changing.
 *
 * A tolerance, because `scrollIntoView` lands the element at the top of the
 * viewport and the sticky header sits over the first few pixels of it.
 */
Then(
  "the document is scrolled to the heading {string}",
  async function (this: OlaiWorld, text: string) {
    const heading = this.documentBody().locator("h1, h2, h3", { hasText: text }).first();
    await heading.waitFor({ state: "visible", timeout: HYDRATION_TIMEOUT });
    await this.waitUntil(async () => {
      const top = await heading.evaluate((node) => node.getBoundingClientRect().top);
      return Math.abs(top) < 160;
    }, `the heading ${JSON.stringify(text)} to be at the top of the page`);
  },
);

/** WHAT THE PREVIEW SAID about a click it could not answer, through the suite's
 *  one reader of every said-line in this client (`support/said.ts`): the words,
 *  and the MOOD as a `data-` fact rather than a colour. A refusal in the aside
 *  tone would be a reason-nothing-happened a screen reader is not interrupted
 *  for, which is the distinction that helper exists to hold. */
Then(
  "the preview says it cannot open that link",
  async function (this: OlaiWorld) {
    await saysThat(
      this,
      HYPERTEXT_SAID,
      "does not serve",
      "preview's refusal",
      "alarm",
    );
  },
);

/** …and the other half: nothing was said at all, which is what every click this
 *  app CAN answer leaves behind. Asserted after something on the new page has
 *  been waited for, so it is a fact about the page that arrived. */
Then("the preview says nothing about the link", async function (this: OlaiWorld) {
  assert.strictEqual(
    await this.page.locator(HYPERTEXT_SAID).count(),
    0,
    "the preview drew a refusal about a click it answered perfectly well",
  );
});

/** No preview at all on this page — which is what an OUTLINE looks like: a
 *  different page shape entirely, not a `.html` page with an empty frame on it.
 *  Read after something on the new page has been waited for, so "not there" is
 *  a fact about the page that arrived rather than about one still arriving. */
Then("there is no preview on this page", async function (this: OlaiWorld) {
  assert.strictEqual(
    await this.page.locator(HYPERTEXT_PREVIEW).count(),
    0,
    "a preview frame is still on the page, so this is not the page the link opened",
  );
});

/** WHERE IN ITS PAGE the frame is, as the frame's own `location.hash` — the
 *  half of "a link with a fragment is left to the frame" that a heading cannot
 *  say. Read inside the frame, because a fragment is not part of `baseURI` and
 *  nothing out here can see it. */
Then(
  "the preview is at the anchor {string}",
  async function (this: OlaiWorld, anchor: string) {
    const frame = await inside(this);
    await this.waitUntil(
      async () => (await frame.locator("body").evaluate(() => location.hash)) === anchor,
      `the preview to be at ${anchor}`,
    );
  },
);

/** A modified click on something in the preview — the press a reader makes when
 *  they want the BROWSER's behaviour rather than this app's, which is the one
 *  `press.ts`'s rule (and the copy of it the seal ships) refuses to claim.
 *  Given a moment afterwards for the same reason the plain click is: what the
 *  scenario asserts is that something did NOT happen. */
When(
  "I {word}-click {string} inside the preview",
  async function (this: OlaiWorld, modifier: string, selector: string) {
    const frame = await inside(this);
    await frame.locator(selector).first().click({
      modifiers: [modifier === "meta" ? "Meta" : modifier === "shift" ? "Shift" : "Alt"],
    });
    await this.page.waitForTimeout(POLL_TIMEOUT / 10);
  },
);

/**
 * The app, INSIDE the preview — the thing that must never be left there. Read
 * as the mount point rather than as a testid, because `#root` is in the shell's
 * own HTML from the first byte, so it is there before any hydration and cannot
 * pass by arriving late.
 *
 * Read as a SETTLED state rather than as a snapshot, and that is what the new
 * rule cost this step. A document the frame arrived at by itself is given a
 * moment to say it is one of this vault's before it is replaced (the file's own
 * scripts run now, so a relative link to a sibling page is a navigation that
 * must be allowed to stand — `Hypertext.tsx` argues the whole of it), so a
 * frame bouncing off a page that keeps leaving passes through the destination
 * briefly on each bounce. What a reader is owed is where it ENDS UP and that it
 * ends up anywhere at all: the three lines below are "give it time to be
 * wrong", "it comes home, or empties" and "and it stays there", which together
 * say more than one reading at one moment did — a frame ping-ponging forever
 * fails the second, and one that came home and left again fails the third.
 */
Then("the app is not loaded inside the preview", async function (this: OlaiWorld) {
  const frame = await inside(this);
  const app = frame.locator("#root");
  await this.page.waitForTimeout(POLL_TIMEOUT / 10);
  await this.waitUntil(
    async () => (await app.count()) === 0,
    "the preview frame to stop being this app — the page walked the frame off " +
      "to somewhere the seal's policy does not follow it, and nothing put the " +
      "file back",
  );
  await this.page.waitForTimeout(POLL_TIMEOUT / 20);
  assert.strictEqual(
    await app.count(),
    0,
    "this app is loaded inside the preview frame — the page walked the frame " +
      "off again after being brought back, and the budget that is supposed to " +
      "bound that did not",
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

// ── a link that opens a page of this vault ─────────────────────────────

/** The directory column's own answer to "which file is open" — `aria-current`,
 *  which is what the entry's wash is drawn from (`Sidebar.tsx`) and what a
 *  screen reader announces. Read here rather than inferred from the address,
 *  because the ask was that a link inside a preview lands EXACTLY where the
 *  sidebar's own click lands, and the marked entry is the half of that the URL
 *  cannot say. */
Then(
  "the sidebar marks the page {string} as the one open",
  async function (this: OlaiWorld, file: string) {
    await this.showSidebar();
    const entry = this.hypertextLink(file);
    await entry.waitFor({ state: "visible", timeout: HYDRATION_TIMEOUT });
    await this.waitUntil(
      async () => (await entry.getAttribute("aria-current")) === "page",
      `the sidebar entry for ${file} to be the one marked as open`,
    );
  },
);

/**
 * THE FORGER: a page that posts this app's own messages at it, which any
 * previewed file can do because its scripts run.
 *
 * The prefix is SPELLED here, and that is the one place in this suite where
 * spelling a wire constant is the right thing rather than the usual mistake —
 * for `fake-acp-agent.ts`' reason, which is the same reason: an adversary has no
 * access to olai's constants, and a fixture that derived the message from the
 * implementation under test would agree with it by construction and prove
 * nothing about a hostile page that guesses.
 *
 * A guess that guessed WRONG would make every assertion in that scenario vacuous
 * — a stream of unrecognised strings moving nothing, for the wrong reason — so
 * the fixture carries its own teeth: `#honest` sends one well-formed message
 * naming a file this vault really holds, and the scenario watches it land. Only
 * the ADDRESS in it is built rather than spelled (`mediaHref`), because that is
 * the bijection both ends of this app already agree on and is not what is being
 * forged.
 *
 * WHAT IS FORGED, and each is a different way through: a page of the right shape
 * that is not there, a climb out of the vault, a climb spelled inside it, one of
 * the APP's own addresses (the shape a page reaching for a route would try), a
 * bare path with no route at all, and a well-formed name for a file no directory
 * holds.
 */
const FORGED_PREFIX = "olai:open-page:";

const FORGERIES: ReadonlyArray<string> = [
  `${FORGED_PREFIX}${mediaHref("nowhere.html")}`,
  `${FORGED_PREFIX}${MEDIA_PREFIX}../../etc/hostname`,
  `${FORGED_PREFIX}${MEDIA_PREFIX}notes/../../secrets.md`,
  `${FORGED_PREFIX}/doc/finishes.md`,
  `${FORGED_PREFIX}finishes.md`,
  `${FORGED_PREFIX}${mediaHref("Daily/nothing.md")}`,
];

When(
  "I rewrite {string} as a page that posts forged addresses at the app",
  function (this: OlaiWorld, file: string) {
    this.writeServed(
      file,
      `<!doctype html>\n<html lang="en"><head><meta charset="utf-8">` +
        `<title>Forger</title></head>\n<body><h1>Forger</h1>\n` +
        `<p id="probe">nothing of this page's should move the app</p>\n` +
        `<button id="honest" type="button">the one that is real</button>\n` +
        `<script>\n` +
        `  ${JSON.stringify(FORGERIES)}.forEach(function (said) {\n` +
        `    parent.postMessage(said, "*")\n` +
        `  })\n` +
        `  document.getElementById("honest").addEventListener("click", function () {\n` +
        `    parent.postMessage(${JSON.stringify(FORGED_PREFIX)} + ${
          JSON.stringify(mediaHref("finishes.md"))
        }, "*")\n` +
        `  })\n` +
        `</script>\n</body></html>\n`,
    );
  },
);

/** …and the same message from somewhere that is not the frame. The app
 *  identifies its sender by IDENTITY rather than by origin — every sandboxed
 *  frame in every tab posts as the same opaque `"null"` — so this is the case
 *  that check exists for, sent from the app's own window at a file the vault
 *  really holds. */
When(
  "something other than the preview asks the app to open {string}",
  async function (this: OlaiWorld, file: string) {
    await this.page.evaluate(
      (said: string) => window.postMessage(said, "*"),
      `${FORGED_PREFIX}${mediaHref(file)}`,
    );
    await this.page.waitForTimeout(POLL_TIMEOUT / 10);
  },
);

// ── the seal ───────────────────────────────────────────────────────────

Then(
  "the preview is sandboxed into nobody's origin",
  async function (this: OlaiWorld) {
    const frame = await preview(this);
    // The ATTRIBUTE, exactly as written. `allow-scripts` is there so the seal's
    // own tape measure and the FILE's own scripts can run (`@olai/surface`'s
    // `seal.ts` argues it); `allow-same-origin` is
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

/** The address the preview frame is pointed at, as the browser holds it — the
 *  file's own URL on the media route, plus the visit counter the component
 *  navigates with. Read off the element rather than rebuilt here, because half
 *  of what these steps assert is that it IS this app's address. */
const pointedAt = async (world: OlaiWorld): Promise<string> => {
  const src = await (await preview(world)).getAttribute("src");
  // Written as a path by the component and resolved here against this server,
  // which is the same thing the browser did with it.
  const at = src === null ? null : new URL(src, world.baseUrl);
  assert.ok(
    at !== null && at.origin === world.baseUrl && at.pathname.startsWith(MEDIA_PREFIX),
    `the preview frame is not pointed at this server's media route: ${src}`,
  );
  return at.href;
};

/** What the preview's own address answers, asked for again rather than read
 *  out of the frame: a frame in an opaque origin cannot be asked what its
 *  headers or its bytes were. Two steps below want that response and neither
 *  should have to remember that finding the address comes first. */
const answered = async (world: OlaiWorld) => {
  const answer = await world.page.request.get(await pointedAt(world));
  assert.strictEqual(
    answer.status(),
    200,
    `the preview's own address answers ${answer.status()}`,
  );
  return answer;
};

Then(
  "the preview's response is sealed with a policy that fetches only this vault",
  async function (this: OlaiWorld) {
    // The RESPONSE, because that is where the seal is now: a `<meta>` policy
    // cannot carry `sandbox`, and `sandbox` is the directive that makes this
    // address safe for a reader who types it instead of opening the preview.
    const answer = await answered(this);
    // The exact policy the server writes, computed by the server's own function
    // rather than re-spelled, for the reason every selector in `world.ts` is
    // imported: a widening made over there would still read as sealed over
    // here. The unit test beside it (`@olai/surface`'s `seal.test.ts`) is what
    // says the policy is the strict one — every directive, including that its
    // one source is this route on this host and not a scheme, a host or
    // `'self'`; this says the strict one is what the browser was actually
    // handed, at the address this server is really on.
    assert.strictEqual(
      answer.headers()["content-security-policy"],
      sealPolicy(new URL(this.baseUrl).host),
      "the policy the preview's own address answers with is not the sealed one",
    );
    const body = await answer.text();
    assert.ok(
      body.startsWith("<!doctype html>"),
      "the seal does not open the response — a document that fell into quirks " +
        "mode is a page drawn wrong for a reason nobody can find",
    );
  },
);

/**
 * WHAT A RELATIVE ADDRESS IN THE FILE RESOLVES AGAINST, read as the browser's
 * own answer rather than as the mechanism that produced it.
 *
 * `document.baseURI` INSIDE the frame is the whole assertion: it is the value
 * every `<img src="art/shot.png">` and every `<a href="other.html">` in there
 * is resolved against. Served at its own address, a page's base is that address
 * — which is what makes a relative link land on the file beside it instead of
 * on a URL that was never meant to be one.
 *
 * `report.html` carries a `<base>` of its own pointing at `example.invalid`, so
 * this is also where the seal's `base-uri 'none'` is read: honoured, that
 * element would move every relative address in the file to somebody else's
 * server, and this step would fail with that address in the message.
 */
Then(
  "the preview resolves the file's addresses beside {string}",
  async function (this: OlaiWorld, file: string) {
    const base = await (await inside(this))
      .locator("body")
      .evaluate(() => document.baseURI);
    assert.strictEqual(
      // The visit counter the frame navigates with is part of the address and
      // is not part of what resolves against it — a query belongs to the URL
      // that carries it.
      base.split("?")[0],
      `${this.baseUrl}${mediaHref(file)}`,
      "a relative address in the previewed file does not resolve beside the " +
        "file itself — so either the frame is not on the file's own address, " +
        "or the file's own `<base>` won",
    );
  },
);

/** …and the other half of that promise: the file's own `<base>` is STILL THERE
 *  in the bytes. Nothing was stripped or rewritten to make the addresses work
 *  — the element is refused by the policy, and the file on disk is what the
 *  reader is shown. */
Then("the preview was handed the file whole", async function (this: OlaiWorld) {
  const body = await (await answered(this)).text();
  assert.ok(
    body.includes(`<base href="https://example.invalid/vault/"`),
    "the file's own `<base>` is not in the bytes the browser was handed — the " +
      "seal is a prefix, and a preview that edited the file to make its " +
      "pictures work would be lying about what is on disk",
  );
});

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
 * `report.html` carries four addresses it may not fetch, a `<base>` it may not
 * set and a tab it may not navigate; the seal refuses every one of them;
 * Chromium says so on the console, and the suite's error listener records every
 * console error there is. So "there should be no page errors" is the wrong
 * question on these pages — and the right one is stronger than the question it
 * replaces, because it reads the refusals as EVIDENCE: nothing else went wrong,
 * and the things that were supposed to be stopped were stopped, said by the
 * browser rather than by us.
 *
 * THE SCRIPT ONE IS GONE, and its absence is the whole of the ruling of
 * 2026-08-16 read from the console: the file's own script is supposed to run
 * now, so a browser complaining that it refused one would be a preview that had
 * not been fixed. What proves it ran is the paragraph it rewrites, in the
 * scenario that reads it.
 *
 * Matched loosely (the shape of the sentence, not the sentence — Chromium's
 * current ones are "Refused to load the image '…' because it violates the
 * following Content Security Policy directive: default-src …" and "Setting the
 * document's base URI to '…' violates the following Content Security Policy
 * directive: base-uri 'none'") so a browser that rewords its message fails on
 * the wording of THIS assertion rather than on a security regression that never
 * happened.
 *
 * The first two are required to have HAPPENED, not merely tolerated. A pattern
 * that only permits a message is one the fixture can satisfy by losing its
 * teeth — the picture probes could be deleted, or quietly start drawing, and an
 * allowance would say nothing either way. The navigation one is tolerated
 * rather than required: the sandbox refuses it before any policy is consulted,
 * and how a browser words THAT is not something this suite should pin.
 */
const REFUSALS = {
  picture: /(?:loading|refused to load) the image[\s\S]*content security policy/i,
  base: /(?:refused to set|setting) the document's base uri/i,
  navigation: /unsafe (?:javascript )?attempt to initiate navigation|sandboxed/i,
} as const;

Then(
  "the only complaints are the browser refusing what the file may not do",
  function (this: OlaiWorld) {
    const others = this.errors.filter(
      (said) => !Object.values(REFUSALS).some((shape) => shape.test(said)),
    );
    assert.deepStrictEqual(
      others,
      [],
      `the page reported ${others.length} error(s) that are not refusals:\n  ` +
        others.join("\n  "),
    );
    assert.ok(
      this.errors.some((said) => REFUSALS.picture.test(said)),
      "the browser never refused a picture in `report.html` — either the policy " +
        "stopped naming which addresses a preview may fetch, or the fixture " +
        "stopped carrying the ones it may not",
    );
    assert.ok(
      this.errors.some((said) => REFUSALS.base.test(said)),
      "the browser never refused `report.html`'s own `<base>` — so either " +
        "`base-uri 'none'` has left the policy, and a saved page may point " +
        "every address in itself at the server it came from, or the fixture " +
        "stopped carrying one",
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
