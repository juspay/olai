import { TEST_CLAIMS } from "@olai/format/testlib"
import * as assert from "node:assert";
import { Then, When } from "@olai/tests/harness/runner.ts";
import type { Locator } from "@olai/tests/harness/playwright.ts";

import { isPicture } from "@olai/format";
import {
  BODY_REFUSED as REFUSED_SAID,
  MEDIA_PREFIX,
  mediaHref,
  mediaTarget,
  ROUNDING,
  sealPolicy,
} from "@olai/surface";

import { saysThat } from "@olai/tests/harness/said.ts";
import { TESTID } from "@olai/tests/harness/testids.ts";
import { selector } from "@olai/web/testlib";
import {
  BODY_REFUSED,
  DOCUMENT_BODY,
  DOCUMENT_EDIT,
  HEADINGS,
  HYDRATION_TIMEOUT,
  HYPERTEXT_LINK,
  POLL_TIMEOUT,
} from "@olai/tests/harness/world.ts";
import {
  HYPERTEXT_PREVIEW,
  HYPERTEXT_SAID,
} from "../selectors.ts";
import type { OlaiWorld } from "@olai/tests/harness/world.ts";

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
  await this.expandReference();
  const link = this.hypertextLink(file);
  await link.waitFor({ state: "visible", timeout: HYDRATION_TIMEOUT });
  await link.click();
  await this.waitForFrame();
});

When("I open the page {string}", async function (this: OlaiWorld, file: string) {
  await this.openDocument(file);
});

const preview = async (world: OlaiWorld) => {
  const frame = world.page.locator(HYPERTEXT_PREVIEW);
  await frame.waitFor({ state: "visible", timeout: HYDRATION_TIMEOUT });
  return frame;
};

const inside = async (world: OlaiWorld) => {
  await preview(world);
  return world.page.frameLocator(HYPERTEXT_PREVIEW);
};

Then(
  "the page says the file could not be read",
  async function (this: OlaiWorld) {
    await this.page
      .locator(BODY_REFUSED)
      .first()
      .waitFor({ state: "visible", timeout: HYDRATION_TIMEOUT });
    await saysThat(
      this,
      BODY_REFUSED,
      REFUSED_SAID,
      "unreadable page",
      "alarm",
    );
  },
);

Then("there is no preview frame", async function (this: OlaiWorld) {
  const count = await this.frontLane().locator(`${HYPERTEXT_PREVIEW}:visible`).count();
  assert.strictEqual(
    count,
    0,
    `the unreadable page still draws a preview frame`,
  );
});

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
  "the preview shows the text {string}",
  async function (this: OlaiWorld, text: string) {
    const frame = await inside(this);
    await frame
      .locator("body", { hasText: text })
      .first()
      .waitFor({ state: "attached", timeout: HYDRATION_TIMEOUT });
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

When("I grow the preview", async function (this: OlaiWorld) {
  await (await inside(this)).locator("body").evaluate(() => {
    const grow = (window as unknown as { grow?: () => void }).grow
    if (typeof grow !== "function") {
      throw new Error("the preview has no grow() — the fixture did not arm one")
    }
    grow()
  })
});

Then(
  "the preview drew {int} boxes for {string}",
  async function (this: OlaiWorld, many: number, selector: string) {
    const drawn = (await inside(this)).locator(selector);
    if (many === 0) {
      await this.waitForFrame();
      assert.strictEqual(
        await drawn.count(),
        0,
        `${selector} is already in the preview, so the growth this step says ` +
          "is still ahead has already happened",
      );
    } else {
      await this.waitUntil(
        async () => (await drawn.count()) === many,
        `${many} element(s) matching ${selector} to be drawn inside the preview ` +
          `by the page's own script`,
      );
    }
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

Then(
  "the preview draws no picture for {string}",
  async function (this: OlaiWorld, selectors: string) {
    const named = selectors.split(",").map((one) => one.trim());
    const pictures = await Promise.all(named.map((one) => pictureIn(this, one)));
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

Then(
  "the preview fetched the vault's pictures at {string}",
  async function (this: OlaiWorld, wanted: string) {
    const paths = wanted.split(",").map((one) => one.trim());
    const pathOf = (url: string): string => {
      try {
        const at = new URL(url);
        return `${at.pathname}${at.search}`;
      } catch {
        return url;
      }
    };
    await this.waitUntil(async () => {
      const asked = new Set(this.requests.map(pathOf));
      return paths.every((one) => asked.has(one));
    }, `the preview to fetch ${wanted}`);
    const refused = this.refused
      .filter((one) => paths.includes(pathOf(one.url)))
      .map((one) => `${pathOf(one.url)} — ${one.why}`);
    assert.deepStrictEqual(
      refused,
      [],
      "these pictures are files of this vault, named beside the page that " +
        "draws them, and the browser was not allowed to fetch them",
    );
  },
);

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

Then(
  "the websocket never carried {string}",
  function (this: OlaiWorld, text: string) {
    assert.ok(
      !this.socketCarried(text),
      `the socket delivered "${text}" to this tab — a body the page draws from ` +
        "a fetch of its own, sent a second time down the wire",
    );
  },
);

Then("the websocket carried {string}", function (this: OlaiWorld, text: string) {
  assert.ok(
    this.socketCarried(text),
    `nothing the socket delivered carried "${text}" — the reader who genuinely ` +
      "needs a body is not being sent one",
  );
});

const SLOW_PICTURE_MS = 750;

const heldBack = (world: OlaiWorld) => (url: URL): boolean => {
  const target = mediaTarget(TEST_CLAIMS, url.pathname);
  return `${url.origin}` === world.baseUrl && target !== null && isPicture(TEST_CLAIMS, target);
};

When("the vault's pictures are slow to arrive", async function (this: OlaiWorld) {
  await this.page.route(heldBack(this), async (route) => {
    await new Promise((wake) => setTimeout(wake, SLOW_PICTURE_MS));
    await route.continue();
  });
});

const ROUNDING_PX = ROUNDING;

const SETTLED_MS = 1500;

interface Heights {
  readonly frame: number;
  readonly page: number;
}

const untilHeights = async (
  world: OlaiWorld,
  settled: (seen: Heights) => boolean,
  describe: string,
  complain: (seen: Heights) => string,
): Promise<void> => {
  const element = await preview(world);
  const inner = world.page.frameLocator(HYPERTEXT_PREVIEW);
  const reading = async (): Promise<Heights> => {
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

Then(
  "the preview settles at one height",
  async function (this: OlaiWorld) {
    const element = await preview(this);
    const window_ = async (): Promise<Array<number>> => {
      const seen = await element.evaluate(
        (node, watching) =>
          new Promise<Array<number>>((done) => {
            const box = node as HTMLElement;
            const heights: Array<number> = [];
            const until = performance.now() + watching;
            const tick = () => {
              heights.push(box.clientHeight);
              if (performance.now() < until) requestAnimationFrame(tick);
              else done(heights);
            };
            requestAnimationFrame(tick);
          }),
        SETTLED_MS,
      );
      return seen.filter((tall, at) => at > 0 && tall !== seen[at - 1]!);
    };
    let moved = await window_();
    try {
      await this.waitUntil(
        async () => (moved = await window_()).length === 0,
        `the frame to hold one height for ${SETTLED_MS}ms`,
      );
    } catch {
      assert.fail(
        `the frame changed height ${moved.length} times over the last ` +
          `${SETTLED_MS}ms with nobody touching the page (${moved.join(", ")}) ` +
          `— it is following a page that is following it back`,
      );
    }
  },
);

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

When(
  "I click {string} inside the preview",
  async function (this: OlaiWorld, selector: string) {
    const frame = await inside(this);
    await frame.locator(selector).first().click();
    await this.page.waitForTimeout(POLL_TIMEOUT / 10);
  },
);

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

Then(
  "the address carries the anchor {string}",
  async function (this: OlaiWorld, anchor: string) {
    await this.waitUntil(
      async () => (await this.page.evaluate(() => location.hash)) === anchor,
      `the app's address to carry ${anchor}`,
    );
  },
);

const AT_THE_TOP = 160;

const landedOn = async (
  world: OlaiWorld,
  where: Locator,
  text: string,
  whose: string,
  under = 0,
): Promise<void> => {
  const heading = where.locator(HEADINGS).filter({ hasText: text }).first();
  await heading.waitFor({ state: "visible", timeout: HYDRATION_TIMEOUT });
  await world.waitUntil(async () => {
    const top = await heading.evaluate((node) => node.getBoundingClientRect().top);
    return Math.abs(top - under) < AT_THE_TOP;
  }, `the heading ${JSON.stringify(text)} to be at the top of ${whose}`);
};

Then(
  "the document is scrolled to the heading {string}",
  async function (this: OlaiWorld, text: string) {
    await landedOn(this, this.documentBody(), text, "the page");
  },
);

Then(
  "the document in pane {int} is scrolled to the heading {string}",
  async function (this: OlaiWorld, index: number, text: string) {
    const seat = await this.page.locator(selector(TESTID.mainStrip)).boundingBox();
    await landedOn(
      this,
      this.pane(index).locator(DOCUMENT_BODY).first(),
      text,
      `pane ${index}`,
      seat?.height ?? 0,
    );
  },
);

Then(
  "the section {string} is on screen",
  async function (this: OlaiWorld, anchor: string) {
    const element = await preview(this);
    const inner = this.page.frameLocator(HYPERTEXT_PREVIEW);
    await inner.locator("body").waitFor({ state: "attached", timeout: HYDRATION_TIMEOUT });
    await this.waitUntil(async () => {
      const [frameTop, insideTop, tall] = await Promise.all([
        element.evaluate((node) => node.getBoundingClientRect().top),
        inner.locator("body").evaluate(
          (_body, id) =>
            document.getElementById(id)?.getBoundingClientRect().top ?? null,
          anchor,
        ),
        this.page.evaluate(() => window.innerHeight),
      ]);
      if (insideTop === null) return false;
      const where = frameTop + insideTop;
      return where >= 0 && where < tall;
    }, `the section ${JSON.stringify(anchor)} to be inside the window`);
  },
);

When("I narrow the window", async function (this: OlaiWorld) {
  const size = this.viewport();
  await this.page.setViewportSize({
    width: Math.round(size.width * 0.7),
    height: size.height,
  });
  await this.waitForFrame();
});

Then("the page is scrolled to the top", async function (this: OlaiWorld) {
  await this.page.waitForTimeout(POLL_TIMEOUT / 10);
  const where = await this.page.evaluate(() => window.scrollY);
  assert.ok(
    where < 40,
    `the page is scrolled to ${where}px — a link whose anchor names nothing ` +
      `should leave the reader at the top rather than wherever the page they ` +
      `came from was`,
  );
});

When("I remember where the page is scrolled", async function (this: OlaiWorld) {
  this.scrolledTo = await this.page.evaluate(() => window.scrollY);
});

Then("the page is scrolled where it was left", async function (this: OlaiWorld) {
  const was = this.scrolledTo;
  assert.ok(was !== undefined && was > 0, "nothing was remembered to compare against");
  await this.waitUntil(async () => {
    const now = await this.page.evaluate(() => window.scrollY);
    return Math.abs(now - was) < 40;
  }, `the page to be back at ${was}px`);
  await this.page.waitForTimeout(POLL_TIMEOUT / 10);
  const settled = await this.page.evaluate(() => window.scrollY);
  assert.ok(
    Math.abs(settled - was) < 40,
    `the page was restored to ${was}px and then moved to ${settled}px — ` +
      `something re-applied the address's anchor on a history restore`,
  );
});

Then(
  "the preview says it cannot open that link",
  async function (this: OlaiWorld) {
    await saysThat(
      this,
      HYPERTEXT_SAID,
      "isn't in this folder",
      "preview's refusal",
      "alarm",
    );
  },
);

Then("the preview says nothing about the link", async function (this: OlaiWorld) {
  assert.strictEqual(
    await this.page.locator(HYPERTEXT_SAID).count(),
    0,
    "the preview drew a refusal about a click it answered perfectly well",
  );
});

Then("there is no preview on this page", async function (this: OlaiWorld) {
  assert.strictEqual(
    await this.page.locator(HYPERTEXT_PREVIEW).count(),
    0,
    "a preview frame is still on the page, so this is not the page the link opened",
  );
});

const hash = async (world: OlaiWorld): Promise<string> =>
  (await inside(world)).locator("body").evaluate(() => location.hash);

Then(
  "the preview is at the anchor {string}",
  async function (this: OlaiWorld, anchor: string) {
    await this.waitUntil(
      async () => (await hash(this)) === anchor,
      `the preview to be at ${anchor}`,
    );
  },
);

Then("the preview is at no anchor", async function (this: OlaiWorld) {
  await this.waitUntil(
    async () => (await hash(this)) === "",
    "the preview to be at no anchor",
  );
  await this.page.waitForTimeout(POLL_TIMEOUT / 10);
  assert.strictEqual(
    await hash(this),
    "",
    "the frame was re-pointed at the section a second time, which is a landing " +
      "spent twice",
  );
});

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

Then("the preview exhausts its walk-off budget and becomes empty", async function (this: OlaiWorld) {
  const frame = await preview(this);
  await this.waitUntil(
    async () => (await frame.getAttribute("src")) === "about:blank",
    "the preview to exhaust its walk-off budget and navigate to about:blank",
  );
  const body = (await inside(this)).locator("body");
  await body.waitFor({ state: "attached", timeout: POLL_TIMEOUT });
  await this.waitUntil(
    () => body.evaluate(element => element.ownerDocument.URL === "about:blank" && element.childNodes.length === 0),
    "the preview's terminal document to be empty about:blank",
  );
});

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

Then("the preview is back on the sealed document", async function (this: OlaiWorld) {
  const frame = await inside(this);
  await frame
    .locator("#probe")
    .waitFor({ state: "visible", timeout: HYDRATION_TIMEOUT });
});

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

const forged = (href: string, intent = "go") =>
  ({ type: "olai:link", href, action: "click", intent, x: 0, y: 0, width: 0, height: 0 });

const FORGERIES: ReadonlyArray<unknown> = [
  forged("/nowhere.html"),
  forged("/../../etc/hostname"),
  forged("/Daily/nothing.md"),
  forged("finishes.md"),
  forged("//collector.test/finishes.md"),
  forged("/finishes.md", "anywhere"),
  `olai:open-page:${mediaHref("finishes.md")}`,
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
        `    parent.postMessage(${JSON.stringify(forged("/finishes.md"))}, "*")\n` +
        `  })\n` +
        `</script>\n</body></html>\n`,
    );
  },
);

When(
  "I rewrite {string} as a page that asks for itself",
  function (this: OlaiWorld, file: string) {
    const asking = forged(`/${file}`);
    this.writeServed(
      file,
      `<!doctype html>\n<html lang="en"><head><meta charset="utf-8">` +
        `<title>Itself</title></head>\n<body><h1>Itself</h1>\n` +
        `<p id="probe">a page that keeps asking for its own address</p>\n` +
        `<p><a id="again" href="${file.split("/").pop()}">this very page</a></p>\n` +
        `<script>\n` +
        `  for (var i = 0; i < 12; i++) {\n` +
        `    parent.postMessage(${JSON.stringify(asking)}, "*")\n` +
        `  }\n` +
        `</script>\n</body></html>\n`,
    );
  },
);

When("I remember how much history there is", async function (this: OlaiWorld) {
  this.historyWas = await this.page.evaluate(() => history.length);
});

Then(
  "the history has grown by {int}",
  async function (this: OlaiWorld, many: number) {
    const was = this.historyWas;
    assert.ok(was !== undefined, "nothing was remembered to compare against");
    await this.page.waitForTimeout(POLL_TIMEOUT / 10);
    const now = await this.page.evaluate(() => history.length);
    assert.strictEqual(
      now - was,
      many,
      `the tab went from ${was} history entries to ${now}, which is ` +
        `${now - was} more rather than ${many} — a page asking for its own ` +
        `address is spending the reader's back button`,
    );
  },
);

When(
  "something other than the preview asks the app to open {string}",
  async function (this: OlaiWorld, file: string) {
    await this.page.evaluate(
      (said: unknown) => window.postMessage(said, "*"),
      forged(`/${file}`),
    );
    await this.page.waitForTimeout(POLL_TIMEOUT / 10);
  },
);

Then(
  "the preview is sandboxed into nobody's origin",
  async function (this: OlaiWorld) {
    const frame = await preview(this);
    assert.strictEqual(
      await frame.getAttribute("sandbox"),
      "allow-scripts",
      "the preview frame's sandbox is not the sealed one — another token, and " +
        "`allow-same-origin` above all, would let a served file into this " +
        "app's origin",
    );
  },
);

const pointedAt = async (world: OlaiWorld): Promise<string> => {
  const src = await (await preview(world)).getAttribute("src");
  const at = src === null ? null : new URL(src, world.baseUrl);
  assert.ok(
    at !== null && at.origin === world.baseUrl && at.pathname.startsWith(MEDIA_PREFIX),
    `the preview frame is not pointed at this server's media route: ${src}`,
  );
  return at.href;
};

When("I remember where the preview is pointed", async function (this: OlaiWorld) {
  this.previewPointedAt = await pointedAt(this);
});

Then("the preview is pointed where it was", async function (this: OlaiWorld) {
  const before = this.previewPointedAt;
  assert.ok(
    before !== undefined,
    "no step remembered where the preview was pointed, so there is nothing " +
      "to compare against — an assertion over that would pass for the wrong " +
      "reason",
  );
  assert.strictEqual(
    await pointedAt(this),
    before,
    "the preview frame was re-pointed — it reloaded the file it was already " +
      "showing",
  );
});

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
    const answer = await answered(this);
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

Then(
  "the preview resolves the file's addresses beside {string}",
  async function (this: OlaiWorld, file: string) {
    const base = await (await inside(this))
      .locator("body")
      .evaluate(() => document.baseURI);
    assert.strictEqual(
      base.split("?")[0],
      `${this.baseUrl}${mediaHref(file)}`,
      "a relative address in the previewed file does not resolve beside the " +
        "file itself — so either the frame is not on the file's own address, " +
        "or the file's own `<base>` won",
    );
  },
);

Then("the preview was handed the file whole", async function (this: OlaiWorld) {
  const body = await (await answered(this)).text();
  assert.ok(
    body.includes(`<base href="https://example.invalid/vault/"`),
    "the file's own `<base>` is not in the bytes the browser was handed — the " +
      "seal is a prefix, and a preview that edited the file to make its " +
      "pictures work would be lying about what is on disk",
  );
});

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

const REFUSALS = {
  picture: /(?:loading|refused to load) the image[\s\S]*content security policy/i,
  base: /(?:refused to set|setting) the document's base uri/i,
  navigation: /unsafe (?:javascript )?attempt to initiate navigation|sandboxed/i,
} as const;

Then(
  "the only complaints are the browser refusing what the file may not do",
  async function (this: OlaiWorld) {
    await this.waitUntil(
      async () =>
        this.errors.some((said) => REFUSALS.picture.test(said)) &&
        this.errors.some((said) => REFUSALS.base.test(said)),
      "the browser to refuse a picture and a base URI in the preview",
    );
    const others = this.errors.filter(
      (said) => !Object.values(REFUSALS).some((shape) => shape.test(said)),
    );
    assert.deepStrictEqual(
      others,
      [],
      `the page reported ${others.length} error(s) that are not refusals:\n  ` +
        others.join("\n  "),
    );
  },
);

Then("the app's page is untouched by the preview", async function (this: OlaiWorld) {
  const marked = await this.page.evaluate(() =>
    document.body.getAttribute("data-pwned")
  );
  assert.strictEqual(marked, null, "the preview reached this app's DOM");
});

Then("there is no way to edit this page", async function (this: OlaiWorld) {
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
