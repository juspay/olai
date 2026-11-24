/**
 * Split panes: open, close, focus, deterministic links, URL restore,
 * collapse, the narrow tab strip.
 *
 * Selectors come from the client's testids, same as every other step
 * file. A pane is found by `data-pane` (its index) and asserted by
 * `data-pane-focused` / `data-href` — facts, never a colour.
 */

import * as assert from "node:assert";
import { Then, When } from "@olai/tests/harness/runner.ts";

import { attr } from "@olai/tests/harness/selectors.ts";
import { pressed } from "@olai/tests/harness/settling.ts";
import {
  nodeSelector,
  APP_HEADER,
  PANE,
  PANE_CLOSE,
  PANE_HEADER,
  PANE_RAIL,
  PANE_RESIZE,
  PANE_TAB,
  PANE_TABS,
  POLL_TIMEOUT,
  ZOOM,
  ZOOM_TITLE,
} from "@olai/tests/harness/world.ts";
import type { OlaiWorld } from "@olai/tests/harness/world.ts";

const paneAt = (world: OlaiWorld, index: number) => world.pane(index);

When(
  "I alt-click the zoom of {string}",
  async function (this: OlaiWorld, id: string) {
    await this.press(this.within(id, ZOOM), "click", ["Alt"]);
  },
);

When(
  "I alt-shift-click the zoom of {string}",
  async function (this: OlaiWorld, id: string) {
    await this.press(this.within(id, ZOOM), "click", ["Alt", "Shift"]);
  },
);

When(
  "I alt-click the zoom of {string} in pane {int}",
  async function (this: OlaiWorld, id: string, index: number) {
    const zoom = paneAt(this, index).locator(`${nodeSelector(id)} ${ZOOM}`).first();
    await this.press(zoom, "click", ["Alt"]);
  },
);

When(
  "I zoom into the node {string} in pane {int}",
  async function (this: OlaiWorld, id: string, index: number) {
    await this.press(paneAt(this, index).locator(`${nodeSelector(id)} ${ZOOM}`).first());
  },
);

When("I focus pane {int}", async function (this: OlaiWorld, index: number) {
  const pane = paneAt(this, index);
  await pane.waitFor({ state: "visible", timeout: POLL_TIMEOUT });
  await pane.click({ position: { x: 8, y: 8 } });
  await this.waitForFrame();
});

When("I close the focused pane", async function (this: OlaiWorld) {
  const close = this.frontLane().locator(`${PANE_HEADER}[data-pane-focused="true"] ${PANE_CLOSE}`);
  await close.waitFor({ state: "visible", timeout: POLL_TIMEOUT });
  await close.click();
  await this.waitForFrame();
});

When("I press Alt+Right", async function (this: OlaiWorld) {
  await pressed(this, "Alt+ArrowRight");
});

When("I open the address {string}", async function (this: OlaiWorld, address: string) {
  await this.open(address);
});

When(
  "I collapse pane {int} by dragging its divider",
  async function (this: OlaiWorld, index: number) {
    const handle = this.frontLane().locator(
      `${PANE_RESIZE}${attr("data-left", String(index))}, ${PANE_RESIZE}${attr("data-right", String(index))}`,
    ).first();
    await handle.waitFor({ state: "visible", timeout: POLL_TIMEOUT });
    const box = await handle.boundingBox();
    assert.ok(box !== null, "the divider has no box");
    // The handle sits between two panes. To shrink THIS one, drag toward
    // the neighbour: leftward if we are the left pane, rightward if we
    // are the right.
    const isLeft = (await handle.getAttribute("data-left")) === String(index);
    const dx = isLeft ? -800 : 800;
    await this.page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
    await this.page.mouse.down();
    await this.page.mouse.move(
      box.x + box.width / 2 + dx,
      box.y + box.height / 2,
      { steps: 8 },
    );
    await this.page.mouse.up();
    await this.waitForFrame();
  },
);

When("I expand the pane rail {int}", async function (this: OlaiWorld, index: number) {
  const rail = this.frontLane().locator(`${PANE_RAIL}${attr("data-pane", String(index))}`);
  await rail.waitFor({ state: "visible", timeout: POLL_TIMEOUT });
  await rail.click();
  await this.waitForFrame();
});

When("I shrink the window to a phone", async function (this: OlaiWorld) {
  await this.page.setViewportSize({ width: 390, height: 844 });
  await this.waitForFrame();
});

When("I tap pane tab {int}", async function (this: OlaiWorld, index: number) {
  const tab = this.frontLane().locator(`${PANE_TAB}${attr("data-pane", String(index))}`);
  await tab.waitFor({ state: "visible", timeout: POLL_TIMEOUT });
  await tab.click();
  await this.waitForFrame();
});

When("I close the focused pane from the keyboard", async function (this: OlaiWorld) {
  // The header's × is desktop chrome. On a phone the same verb is the
  // chord, and it is the one that must not throw after a tab switch.
  //
  // `ControlOrMeta`, which is Playwright's own spelling of the platform's
  // modifier and the same split `keys.ts` makes — Meta on Apple, Control
  // elsewhere. Spelled `Control` here, this step pressed a chord macOS never
  // matches: the pane simply did not close, and the assertion after it read
  // the pane that was still there. Linux never noticed, because there the two
  // are the same key.
  await pressed(this, "ControlOrMeta+Shift+w");
});

When(
  "I press Alt+Right without the page claiming it",
  async function (this: OlaiWorld) {
    await this.page.evaluate(() => {
      const onKey = (event: KeyboardEvent) => {
        if (event.key !== "ArrowRight" || !event.altKey) return;
        window.removeEventListener("keydown", onKey);
        (window as unknown as { __claimed?: boolean }).__claimed =
          event.defaultPrevented;
      };
      (window as unknown as { __claimed?: boolean }).__claimed = undefined;
      window.addEventListener("keydown", onKey);
    });
    await pressed(this, "Alt+ArrowRight");
    const claimed = await this.page.evaluate(
      () => (window as unknown as { __claimed?: boolean }).__claimed,
    );
    assert.strictEqual(
      claimed,
      false,
      "the page claimed Alt+Right",
    );
    await this.waitForFrame();
  },
);

Then("there are {int} panes", async function (this: OlaiWorld, n: number) {
  await this.waitUntil(
    async () => (await this.frontLane().locator(`${PANE}:visible`).count()) === n,
    `${n} panes on screen`,
  );
});

/**
 * WHAT A PANE IS DRAWING, READ ONCE — and the read-once is the whole point.
 *
 * Every other assertion here waits, which is right for a claim about where the
 * app ends up and useless for a claim about a STEP: an assertion that waits
 * cannot tell "the action established this" from "the action returned early and
 * the app caught up while I looked". So this reads now, and it is used
 * immediately after an action whose own wait is the thing under test.
 *
 * It is discriminating because a navigation is a round trip: a click step that
 * returned before the destination arrived cannot have had it arrive in the same
 * tick.
 */
Then(
  "pane {int} is already drawing the outline {string}",
  async function (this: OlaiWorld, index: number, file: string) {
    const drawn = await this.frontLane()
      .locator(`${PANE}${attr("data-pane", String(index))}`)
      .first()
      .getAttribute("data-drawn-file");
    assert.strictEqual(
      drawn,
      file,
      `pane ${index} is drawing ${JSON.stringify(drawn)} — the step before this one returned `
        + "before the page it was waiting for had arrived",
    );
  },
);

Then("pane {int} is focused", async function (this: OlaiWorld, index: number) {
  await this.expectAttribute(
    `${PANE}${attr("data-pane", String(index))}`,
    "data-pane-focused",
    "true",
    `pane ${index}`,
  );
});

Then(
  "pane {int} is showing {string}",
  async function (this: OlaiWorld, index: number, href: string) {
    await this.expectAttribute(
      `${PANE}${attr("data-pane", String(index))}`,
      "data-href",
      href,
      `pane ${index}`,
    );
  },
);

Then(
  "the zoomed node in pane {int} is {string}",
  async function (this: OlaiWorld, index: number, id: string) {
    const title = paneAt(this, index).locator(ZOOM_TITLE);
    await title.waitFor({ state: "visible", timeout: POLL_TIMEOUT });
    assert.strictEqual(await title.getAttribute("data-node-id"), id);
  },
);

Then("a pane rail is shown for pane {int}", async function (this: OlaiWorld, index: number) {
  await this.page
    .locator(`${PANE_RAIL}${attr("data-pane", String(index))}`)
    .waitFor({ state: "visible", timeout: POLL_TIMEOUT });
});

Then("no pane rail is shown", async function (this: OlaiWorld) {
  await this.waitUntil(
    async () => (await this.frontLane().locator(PANE_RAIL).count()) === 0,
    "no pane rail on screen",
  );
});

Then("the pane tabs are shown", async function (this: OlaiWorld) {
  await this.frontLane().locator(PANE_TABS).waitFor({ state: "visible", timeout: POLL_TIMEOUT });
});

Then("there are {int} pane tabs", async function (this: OlaiWorld, n: number) {
  await this.waitUntil(
    async () => (await this.frontLane().locator(PANE_TAB).count()) === n,
    `${n} pane tabs`,
  );
});

/**
 * A PHONE SCROLLS THE DOCUMENT, so this is the window's own scroll — what a
 * reader does half-way down a long conversation.
 *
 * IT FAILS WHEN THE PAGE DID NOT SCROLL, which is the whole of its worth: the
 * step used to ask for a scroll, wait 150 ms and assert nothing, so a page
 * with nothing to scroll — or one whose scroll went to a box instead of the
 * document — passed every assertion about what "stays in view" afterwards. A
 * document with no room to scroll is the failure, not a quiet pass.
 *
 * NO FIXED WAIT: the end is waited FOR, by reading the scroll back until it
 * is at the bottom (smooth scrolling and a transcript still settling both
 * land here), and a scroll that never arrives fails as itself.
 */
When("I scroll the page to its end", async function (this: OlaiWorld) {
  const room = await this.page.evaluate(() => {
    const doc = document.documentElement
    window.scrollTo(0, doc.scrollHeight)
    return doc.scrollHeight - window.innerHeight
  });
  assert.ok(room > 1, `the page has nothing to scroll: ${room}px of room under the viewport`);
  await this.waitUntil(
    async () => await this.page.evaluate(() =>
      window.scrollY > 0 && window.scrollY + window.innerHeight >= document.documentElement.scrollHeight - 2),
    "the page to be scrolled to its end",
  );
});

/** ...and the strip is still there afterwards, pinned under the app header:
 *  the way back to the page a conversation is about must not scroll away.
 *
 *  THE SCROLL IS RE-ASSERTED HERE, because this is the step a scenario trusts:
 *  a strip at the top of an UNSCROLLED page is where a strip always is, and
 *  says nothing about what happens when a person reads to the end. */
Then("the pane tabs stay under the header", async function (this: OlaiWorld) {
  const tabs = this.frontLane().locator(PANE_TABS);
  await tabs.waitFor({ state: "visible", timeout: POLL_TIMEOUT });
  const scrolled = await this.page.evaluate(() => window.scrollY);
  assert.ok(scrolled > 0, "the page is not scrolled, so nothing here is about staying in view");
  const header = await this.page.locator(APP_HEADER).boundingBox();
  const box = await tabs.boundingBox();
  assert.ok(header && box && Math.abs(box.y - header.y - header.height) <= 1,
    `the pane strip scrolled away: ${JSON.stringify({ header, box, scrolled })}`);
  // THE BAR ITSELF IS STILL THERE TOO: the strip is pinned UNDER it, so a bar
  // that scrolled away would take the strip with it and this measurement
  // would still agree.
  assert.ok(header && Math.abs(header.y) <= 1, `the app header scrolled away: ${JSON.stringify(header)}`);
});

When("I scroll pane {int} to its middle", async function(this: OlaiWorld, index: number) {
  await this.pane(index).evaluate(root => {
    let host = root.parentElement
    while (host && !/auto|scroll/.test(getComputedStyle(host).overflowY)) host = host.parentElement
    if (!host || host.scrollHeight <= host.clientHeight) throw new Error("pane has no scrollable content")
    host.scrollTop = (host.scrollHeight - host.clientHeight) / 2
  })
})

Then("pane {int} keeps its title {string} above its scroller", async function(this: OlaiWorld, index: number, title: string) {
  const heading = this.frontLane().locator(`${PANE_HEADER}${attr("data-pane", String(index))}`)
  assert.ok((await heading.innerText()).includes(title))
  // UNDER THE BAR, which holds the tabs too: nothing else stands above the
  // panes but the 2px a pane keeps for its focus mark.
  const bar = await this.page.locator(APP_HEADER).boundingBox()
  const box = await heading.boundingBox()
  const top = await this.pane(index).evaluate(root => {
    let host = root.parentElement
    while (host && !/auto|scroll/.test(getComputedStyle(host).overflowY)) host = host.parentElement
    return host?.getBoundingClientRect().top
  })
  const gap = bar && box ? box.y - bar.y - bar.height : Number.NaN
  assert.ok(bar && box && top !== undefined && gap >= -1 && gap <= 3
    && Math.abs(box.y + box.height - top) <= 1,
    `pane ${index} title scrolled away: ${JSON.stringify({ bar, box, top })}`)
})

// ── what a pane is called ──────────────────────────────────────────────
//
// A pane's header, its collapsed rail and its narrow-screen tab say the page's
// NAME — a document by its stem, the way the sidebar and the tab strip say it
// (`garden`, not `/garden.olai`), a node by its id, `Home` for the front page
// — and the close and expand buttons carry that name in their accessible
// names, so a screen reader hears which pane a press acts on.

const words = async (locator: ReturnType<OlaiWorld["page"]["locator"]>): Promise<string> =>
  (await locator.innerText()).replace(/[×\s]+$/u, "").trim();

Then(
  "pane {int}'s header reads {string}, and its close button is called {string}",
  async function (this: OlaiWorld, index: number, name: string, close: string) {
    const header = this.frontLane().locator(`${PANE_HEADER}${attr("data-pane", String(index))}`);
    await header.waitFor({ state: "visible", timeout: POLL_TIMEOUT });
    await this.waitUntil(async () => (await words(header)) === name,
      `pane ${index}'s header to read ${JSON.stringify(name)}`);
    assert.strictEqual(await header.locator(PANE_CLOSE).getAttribute("aria-label"), close);
  },
);

Then(
  "the pane rail {int} reads {string}, and is called {string}",
  async function (this: OlaiWorld, index: number, name: string, expand: string) {
    const rail = this.frontLane().locator(`${PANE_RAIL}${attr("data-pane", String(index))}`);
    await rail.waitFor({ state: "visible", timeout: POLL_TIMEOUT });
    assert.strictEqual((await rail.innerText()).trim(), name);
    assert.strictEqual(await rail.getAttribute("aria-label"), expand);
  },
);

Then("the pane tabs read {string}", async function (this: OlaiWorld, names: string) {
  await this.waitUntil(
    async () => (await this.frontLane().locator(PANE_TAB).allInnerTexts()).map((one) => one.trim()).join(" | ") === names,
    `the pane tabs to read ${JSON.stringify(names)}`,
  );
});

When("I widen the first pane by dragging its divider", async function (this: OlaiWorld) {
  const handle = this.frontLane().locator(PANE_RESIZE).first();
  const box = await handle.boundingBox();
  assert.ok(box !== null, "the divider has no box");
  const before = new URL(this.page.url()).searchParams.get("w");
  await this.page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
  await this.page.mouse.down();
  await this.page.mouse.move(box.x + box.width / 2 + 60, box.y + box.height / 2, { steps: 8 });
  await this.page.mouse.up();
  await this.waitUntil(async () => new URL(this.page.url()).searchParams.get("w") !== before,
    "the resize to change the workspace widths");
});

// ── each tab's own place in the page ───────────────────────────────────
//
// A split below `md` is a strip of tabs over ONE page, and the thing that
// scrolls there is the document — so "where this tab stands" is the window's
// own scroll, read at the moment a scenario asks and compared after a tab has
// been away and come back. The failure these are written against is a tab
// that inherits wherever the tab before it left the window.

/** What a scenario remembered about the tab it was reading. One per world,
 *  and a world is one scenario, so nothing here outlives the run. */
const stood = new WeakMap<OlaiWorld, number>();

/**
 * Down a screen, and no further: part way through a long page is the only
 * place a drifting restore shows. Fails when the page had nowhere to go,
 * which is a scenario asserting nothing.
 *
 * AND IT WAITS FOR THE PAGE TO SETTLE THERE. A document whose blocks are
 * still being drawn moves under a scroll that lands in the middle of it, so
 * what the next step remembers has to be where the page CAME TO REST rather
 * than the number this step asked for — otherwise the scenario is about this
 * step's own race and not about tabs at all.
 */
When("I scroll this tab down a screen", async function (this: OlaiWorld) {
  const room = await this.page.evaluate(() => {
    window.scrollTo({ top: window.innerHeight, behavior: "instant" });
    return document.documentElement.scrollHeight - window.innerHeight;
  });
  assert.ok(room > 1, `this tab has nothing to scroll: ${room}px of room under the viewport`);
  let was = "";
  let still = 0;
  await this.waitUntil(async () => {
    const now = await this.page.evaluate(() => `${window.scrollY}/${document.documentElement.scrollHeight}`);
    still = now === was ? still + 1 : 0;
    was = now;
    // THREE READINGS THE SAME, position and height both: a document drawing
    // its blocks is still the same height for one reading at a time, and a
    // page that settles and then moves again is the thing this is waiting
    // out.
    return still >= 3 && !now.startsWith("0/");
  }, "this tab to come to rest part way down its page");
});

/** Where the page stands now, as the place this tab must come back to. */
When("I remember where this tab stands", async function (this: OlaiWorld) {
  stood.set(this, await this.page.evaluate(() => window.scrollY));
});

When("I press Alt+Left", async function (this: OlaiWorld) {
  await pressed(this, "Alt+ArrowLeft");
});

/** BACK WHERE IT WAS, read once rather than waited for: putting a tab back is
 *  part of the same update that draws it, so a place that is not there by the
 *  frame after the switch is the bug — and the number it came back at is the
 *  whole of what a failure has to say. */
Then("this tab stands where it was left", async function (this: OlaiWorld) {
  const was = stood.get(this);
  assert.ok(was !== undefined, "no scenario remembered where this tab stood");
  assert.ok(was > 0, "the tab was remembered at the top, where every tab starts");
  await this.waitForFrame();
  const now = await this.page.evaluate(() => ({
    at: window.scrollY,
    room: document.documentElement.scrollHeight - window.innerHeight,
  }));
  assert.ok(Math.abs(now.at - was) <= 2,
    `this tab was left at ${was}px and came back at ${now.at}px (${now.room}px of room): each tab keeps its own place`);
});

/** THE NEWEST LINE, on a phone — the document is the chat's scrollport there,
 *  so a conversation opened at its end is a window scrolled to the bottom. */
Then("this tab is at the end of what it shows", async function (this: OlaiWorld) {
  const seen = { at: 0, room: 0 };
  await this.waitUntil(async () => {
    Object.assign(seen, await this.page.evaluate(() => ({
      at: window.scrollY,
      room: document.documentElement.scrollHeight - window.innerHeight,
    })));
    return seen.room > 1 && seen.at >= seen.room - 48;
  }, "this tab to stand at the end of what it shows").catch(() => {
    assert.fail(`this tab stands at ${seen.at}px of ${seen.room}px: a chat opens at its newest line`);
  });
});

/** THE FIRST LINE — a page this tab has not shown before opens where every
 *  page opens, at its top. Read once rather than waited for, and after a
 *  frame: putting an arriving tab where it belongs is part of the update that
 *  draws it, so a wait would only be waiting for a drift to arrive. The page
 *  must have had somewhere to drift TO, or this says nothing. */
Then("this tab is at the top of what it shows", async function (this: OlaiWorld) {
  await this.waitForFrame();
  const now = await this.page.evaluate(() => ({
    at: window.scrollY,
    room: document.documentElement.scrollHeight - window.innerHeight,
  }));
  assert.ok(now.room > 1, `this tab shows nothing taller than the screen: ${now.room}px of room`);
  assert.ok(now.at <= 2, `this tab stands at ${now.at}px of ${now.room}px: a page it has not shown opens at its top`);
});

// ── the focus mark, and the pane's close button ─────────────────────────
//
// In a split the pane with the caret wears a 2px accent edge along its top and
// nothing else does. Read as a person sees it — the computed top border of each
// column — and compared against the accent the sheet asks for, never against a
// colour written down here.

type Mark = { readonly index: number; readonly width: number; readonly style: string; readonly colour: string };

/** Every column's top edge in the lane in front, by pane index. */
const marks = (world: OlaiWorld): Promise<ReadonlyArray<Mark>> =>
  world.frontLane().locator(PANE_HEADER).evaluateAll((headers) => headers.map((header) => {
    const style = getComputedStyle(header.parentElement!);
    return {
      index: Number(header.getAttribute("data-pane")),
      width: Number.parseFloat(style.borderTopWidth),
      style: style.borderTopStyle,
      colour: style.borderTopColor,
    };
  }));

/** A colour that paints something: neither the keyword nor zero alpha. */
const opaque = (colour: string): boolean =>
  colour !== "transparent" && !/,\s*0\s*\)$/.test(colour) && !/\/\s*0\s*\)$/.test(colour);

const drawn = (mark: Mark): boolean => mark.style !== "none" && mark.width >= 2 && opaque(mark.colour);

/** The accent the sheet asks for, resolved by the browser and kept out of any
 *  forced palette, so it can be compared with what a column actually wears. */
const accent = (world: OlaiWorld): Promise<string> =>
  world.page.evaluate(() => {
    const probe = document.createElement("div");
    probe.style.cssText = "position:absolute;visibility:hidden;forced-color-adjust:none;color:var(--color-accent)";
    document.body.append(probe);
    const colour = getComputedStyle(probe).color;
    probe.remove();
    return colour;
  });

Then("pane {int} alone carries the focus mark", async function (this: OlaiWorld, index: number) {
  await this.waitUntil(async () => {
    const all = await marks(this);
    return all.length >= 2 && all.every((mark) => (mark.index === index) === drawn(mark));
  }, `pane ${index}, and no other pane, to wear the focus mark`).catch(async () => {
    assert.fail(`the columns' top edges are ${JSON.stringify(await marks(this))}; only pane ${index} should be marked`);
  });
});

Then("the focus mark is drawn in the accent", async function (this: OlaiWorld) {
  const mark = (await marks(this)).find(drawn);
  assert.ok(mark !== undefined, "no column wears a focus mark");
  assert.strictEqual(mark.colour, await accent(this), "the focus mark is not the page's accent");
});

/** Under a forced palette the mark is still two pixels and still painted, in a
 *  colour the SCREEN chose — which also proves the emulation reached it. A
 *  box-shadow mark would be deleted there and fail the first half. */
Then("the focus mark is drawn in the screen's own colour", async function (this: OlaiWorld) {
  const mark = (await marks(this)).find(drawn);
  assert.ok(mark !== undefined, `under forced colours no column wears a focus mark: ${JSON.stringify(await marks(this))}`);
  assert.notStrictEqual(mark.colour, await accent(this), "the focus mark is still the page's own accent");
});

const closeOf = (world: OlaiWorld, index: number) =>
  world.frontLane().locator(`${PANE_HEADER}${attr("data-pane", String(index))} ${PANE_CLOSE}`);

const opacityOf = (world: OlaiWorld, index: number): Promise<string> =>
  closeOf(world, index).evaluate((el) => getComputedStyle(el).opacity);

/** A click on the pane's name moves where the next `Tab` starts from, as it
 *  does for a person, and the `Tab` takes the next control after it. */
When("I click pane {int}'s name and press Tab", async function (this: OlaiWorld, index: number) {
  const name = this.frontLane().locator(`${PANE_HEADER}${attr("data-pane", String(index))} span`).first();
  await name.waitFor({ state: "visible", timeout: POLL_TIMEOUT });
  await name.click();
  await pressed(this, "Tab");
});

Then("pane {int}'s close button has the keyboard, and is drawn", async function (this: OlaiWorld, index: number) {
  const close = closeOf(this, index);
  assert.ok(await close.evaluate((el) => el === document.activeElement && el.matches(":focus-visible")),
    `the keyboard is not on pane ${index}'s close button`);
  assert.strictEqual(await opacityOf(this, index), "1", `pane ${index}'s close button has the keyboard but is not drawn`);
});

When("the pointer leaves the panes", async function (this: OlaiWorld) {
  // The top-left corner is the app's name in the bar: outside every pane.
  await this.page.mouse.move(2, 2);
  await this.waitForFrame();
});

When("I point at pane {int}", async function (this: OlaiWorld, index: number) {
  await this.frontLane().locator(`${PANE_HEADER}${attr("data-pane", String(index))}`).hover();
  await this.waitForFrame();
});

Then("pane {int}'s close button is not drawn", async function (this: OlaiWorld, index: number) {
  await this.waitUntil(async () => (await opacityOf(this, index)) === "0",
    `pane ${index}'s close button to wait for a pointer`);
});

/** Opacity is the claim: a transparent button is still a button Playwright
 *  would call visible, and a thumb would land on it blindly. */
Then("pane {int}'s close button is drawn", async function (this: OlaiWorld, index: number) {
  await this.waitUntil(async () => (await opacityOf(this, index)) === "1",
    `pane ${index}'s close button to be drawn`);
});
