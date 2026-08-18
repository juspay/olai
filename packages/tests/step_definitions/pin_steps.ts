/**
 * THE PINNED SHELF: the column's own short list, and the file underneath it.
 *
 * The steps come in two kinds and the split is the feature's whole point. Some
 * ask what the SIDEBAR draws — which doors, in what order, under what names —
 * and some write or read `Pins.olai` DIRECTLY, because a shelf stored in the
 * directory is one an agent can write and one whose order is a fact about a
 * file rather than about a browser.
 *
 * The addresses are the app's own spelling (`web/src/client/routes.ts`), and
 * they travel through these steps VERBATIM: what a scenario writes into
 * `Pins.olai` is what the shelf reads back, and a step that normalised one
 * would be a step that could pass over a shelf drawing something else.
 */

import assert from "node:assert/strict";

import { DataTable, Given, Then, When } from "@cucumber/cucumber";

import { selector, TESTID } from "@olai/web/src/client/testids.ts";

import { attr } from "../support/selectors.ts";
import { POLL_TIMEOUT } from "../support/world.ts";
import type { OlaiWorld } from "../support/world.ts";

const SHELF = selector(TESTID.pinShelf);
const PIN = selector(TESTID.pin);
const PIN_LINK = selector(TESTID.pinLink);
const PIN_REMOVE = selector(TESTID.pinRemove);

/** The file the shelf IS. Named once here, from the format's own constant, so
 *  a scenario naming it and a step reading it cannot disagree. */
const PINS_FILE = "Pins.olai";

/** One row of the shelf, by the address it opens — which is the fact the row
 *  publishes (`data-at`) and the only one that identifies it, since two pins
 *  may draw the same words and none of them draws its own id. */
const pinAt = (world: OlaiWorld, address: string) =>
  // Through `attr` rather than built here: an address arrives as a Gherkin
  // argument, and the suite's one escaper is what keeps a value with a quote
  // in it from becoming a selector that means something else
  // (`selectors.test.ts` sweeps for the hand-built shape).
  world.page.locator(`${PIN}${attr("data-at", address)}`);

/** Every address on the shelf, in the order it is drawn. */
const shelved = async (world: OlaiWorld): Promise<ReadonlyArray<string>> =>
  await world.page
    .locator(PIN)
    .evaluateAll((rows) => rows.map((one) => one.getAttribute("data-at") ?? ""));

/** The shelf, made out of nothing but addresses — the write an AGENT makes,
 *  and the shape the ordering scenarios start from. `Pins.olai` is an ordinary
 *  outline, so this is `add_node` five times spelled as the file it produces. */
Given(
  "the directory has the pins:",
  async function (this: OlaiWorld, table: DataTable) {
    const titles = table.raw().map(([title]) => String(title));
    this.writeServed(
      PINS_FILE,
      titles
        .map((title, at) =>
          JSON.stringify({ id: `p${at}`, ord: `a${at}`, title })
        )
        .join("\n"),
    );
    await this.showSidebar();
  },
);

/** One more pin, appended as another writer would leave it — the scenario
 *  about a shelf that grows under a page nobody reloaded. */
When(
  "the directory grows a pin to {string}",
  async function (this: OlaiWorld, address: string) {
    await this.showSidebar();
    if (this.servedNodesSoFar(PINS_FILE).length === 0) {
      this.writeServed(PINS_FILE, JSON.stringify({ id: "p0", ord: "a0", title: address }));
      return;
    }
    this.appendServed(PINS_FILE, { id: "pn", ord: "z0", title: address });
  },
);

/** A record RETITLED where it lives — an agent's `set_title`, spelled as the
 *  file it produces. The shelf is not touched, and that is the claim: it holds
 *  no copy of the name to update. */
When(
  "the file {string} renames {string} to {string}",
  async function (this: OlaiWorld, file: string, id: string, title: string) {
    this.writeServed(
      file,
      this.servedNodes(file)
        .map((node) => JSON.stringify(node["id"] === id ? { ...node, title } : node))
        .join("\n"),
    );
  },
);

/** The chord — the page's own door onto the shelf, and a TOGGLE over one
 *  address, so the same press takes it back off. */
When("I pin the page", async function (this: OlaiWorld) {
  await this.page.keyboard.press("ControlOrMeta+Shift+p");
  await this.waitForFrame();
});

When("I follow the pin {string}", async function (this: OlaiWorld, address: string) {
  await this.showSidebar();
  await pinAt(this, address).locator(PIN_LINK).click();
});

/** The `×` on the row — the shelf's own way off it. It is revealed on hover,
 *  so `force` for the same reason the `•••` needs it: opacity is not something
 *  Playwright's actionability check sees through. */
When("I unpin {string}", async function (this: OlaiWorld, address: string) {
  await this.showSidebar();
  await pinAt(this, address).hover();
  await pinAt(this, address).locator(PIN_REMOVE).click({ force: true });
  await this.waitForFrame();
});

/**
 * A pin picked up and dropped ABOVE another — the reorder, as a pointer makes
 * it.
 *
 * The travel is what makes it a drag rather than a click (`client/pointer.ts`'s
 * `TRAVEL_PX`), and the landing is the TOP HALF of the target row, which is
 * the gap above it (`client/pins/reorder.ts`). Moved in steps so the
 * intermediate `pointermove`s the gesture is built on actually arrive.
 */
When(
  "I drag the pin {string} above {string}",
  async function (this: OlaiWorld, address: string, target: string) {
    await this.showSidebar();
    const from = await pinAt(this, address).boundingBox();
    const onto = await pinAt(this, target).boundingBox();
    assert.ok(from !== null && onto !== null, "both pins have to be laid out to drag one");
    await this.page.mouse.move(from.x + from.width / 2, from.y + from.height / 2);
    await this.page.mouse.down();
    await this.page.mouse.move(onto.x + onto.width / 2, onto.y + 2, { steps: 10 });
    await this.page.mouse.up();
    await this.waitForFrame();
  },
);

Then("the pinned shelf is not drawn", async function (this: OlaiWorld) {
  await this.showSidebar();
  await this.page.locator(SHELF).waitFor({ state: "detached", timeout: POLL_TIMEOUT });
});

Then(
  "the pinned shelf holds {string}",
  async function (this: OlaiWorld, address: string) {
    await this.showSidebar();
    await pinAt(this, address).waitFor({ state: "visible", timeout: POLL_TIMEOUT });
  },
);

/** The whole shelf, in order — which is the half presence cannot answer, and
 *  the half a reorder is entirely about. */
Then(
  "the pinned shelf reads {string}",
  async function (this: OlaiWorld, expected: string) {
    await this.showSidebar();
    const want = expected.split(" ").filter((one) => one !== "");
    await this.waitUntil(
      async () => (await shelved(this)).join(" ") === want.join(" "),
      `the shelf to read ${JSON.stringify(want.join(" "))}, and it reads ${
        JSON.stringify((await shelved(this)).join(" "))
      }`,
    );
  },
);

/** What a door is CALLED — read off the set on the frame it is drawn, which is
 *  why this waits rather than reads once: the claim is usually that a name
 *  CHANGED. */
Then(
  "the pin {string} is named {string}",
  async function (this: OlaiWorld, address: string, name: string) {
    await this.showSidebar();
    const row = pinAt(this, address).locator(PIN_LINK);
    await this.waitUntil(
      async () => (await row.innerText()).trim() === name,
      `the pin at ${JSON.stringify(address)} to be named ${JSON.stringify(name)}`,
    );
  },
);
