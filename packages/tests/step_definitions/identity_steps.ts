/**
 * Who is looking: every answer has a face — anonymous, the person, a
 * failed door. Last in the chrome row.
 *
 * The Givens write the proxy's headers onto THIS scenario's context before
 * the first navigation — Playwright sends them on every HTTP request,
 * which is how `tailscale serve` injects them and how the websocket
 * upgrade carries them. The chip reads `who.get` off that upgrade; a
 * failed ask is a throw, not an intercepted GET.
 *
 * WHICH picture a person wears is the server's answer and not this
 * suite's: the identity ROW's ladder resolves it, and what the steps here
 * assert is the `src` the chip drew. The remote hosts on that ladder are
 * fulfilled locally (the "is a real image" Given) — a suite that fetched
 * github.com to see whether an `<img>` appeared would be testing the
 * network, and would fail on a machine that has none.
 *
 * TWO NAMES COME FROM THE ROW ITSELF, through the reading door that has no
 * runtime in it (`olai-plugin-identity/who`): the header names a Given
 * injects, so a step writes the header olai actually reads, and the
 * gravatar URL a Then expects, so a hash spelled twice cannot disagree.
 * The chip's testid comes from the same row's `./testids`, merged into
 * `@olai/bundle/testids` with every other plugin's — it left
 * `@olai/web`'s table with the chip.
 */

import * as assert from "node:assert";
import { Given, Then } from "@cucumber/cucumber";
import type { Locator } from "playwright";

import {
  DEFAULT_IDENTITY_HEADERS,
  gravatarOf,
} from "olai-plugin-identity/who";
import { PLUGIN_TESTID } from "@olai/bundle/testids";
import { selector } from "@olai/web/testlib";

import { APP_CHROME, APP_HEADER, POLL_TIMEOUT } from "../support/world.ts";
import type { OlaiWorld } from "../support/world.ts";

const IDENTITY = selector(PLUGIN_TESTID.identity);

/** A one-pixel PNG, which is a real image and not a fixture file: what the
 *  scenarios need from a remote avatar is that the browser could draw it. */
const ONE_PIXEL = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==",
  "base64",
);

Given(
  "I am the Tailscale user {string}",
  async function (this: OlaiWorld, login: string) {
    await this.proxyInjects(DEFAULT_IDENTITY_HEADERS.login, login);
  },
);

Given(
  "the proxy also says my name is {string}",
  async function (this: OlaiWorld, name: string) {
    assert.ok(DEFAULT_IDENTITY_HEADERS.name, "there is no default name header");
    await this.proxyInjects(DEFAULT_IDENTITY_HEADERS.name, name);
  },
);

Given(
  "the proxy also sends my picture {string}",
  async function (this: OlaiWorld, url: string) {
    assert.ok(
      DEFAULT_IDENTITY_HEADERS.picture,
      "there is no default picture header",
    );
    await this.proxyInjects(DEFAULT_IDENTITY_HEADERS.picture, url);
  },
);

/** That URL answers with an image, so the chip's `<img>` is one the
 *  browser really drew rather than a broken one that still has the src. */
Given(
  "the picture at {string} is a real image",
  async function (this: OlaiWorld, url: string) {
    await this.page.route(url, (route) =>
      route.fulfill({ status: 200, contentType: "image/png", body: ONE_PIXEL }),
    );
  },
);

Then(
  "nothing fetched {string}",
  function (this: OlaiWorld, path: string) {
    const hits = this.requests.filter((url) => {
      try {
        return new URL(url).pathname === path;
      } catch {
        return url.includes(path);
      }
    });
    assert.equal(
      hits.length,
      0,
      `the page fetched ${path}, which a connected tab must not: ${hits.join(", ")}`,
    );
  },
);

/** The chip is an icon; the words live on `aria-label` (and the hover
 *  tip, which is a portal). A labelled pill would put them in the slot. */
async function iconOnly(slot: Locator) {
  assert.equal(
    (await slot.innerText()).trim(),
    "",
    "who is looking put words on the chip; they belong in the tooltip",
  );
}

Then(
  "the header identity could not be asked",
  async function (this: OlaiWorld) {
    const slot = this.page.locator(IDENTITY);
    await slot.waitFor({ state: "attached", timeout: POLL_TIMEOUT });
    await this.expectAttribute(
      IDENTITY,
      "data-who",
      "error",
      "the identity slot",
    );
    assert.equal(
      await slot.locator("[aria-label]").getAttribute("aria-label"),
      "could not tell who is looking",
    );
    await iconOnly(slot);
    assert.equal(
      await slot.locator("svg").count(),
      1,
      "a failed door drew no icon",
    );
    assert.equal(
      await slot.locator("img").count(),
      0,
      "a failed who fetch drew a person",
    );
  },
);

/**
 * NO ROW, NO CHIP — and the distinction this step exists to hold is that it
 * is not `anonymous`.
 *
 * A serve that mounted the identity row and got no login draws the silhouette
 * and says so (`the header shows anonymous`). A serve that did not mount the
 * row draws NOTHING in that seat: the plugin's chunk was never fetched, its
 * fiber never mounted, and the face never registered. The scenario injects a
 * real login to make the difference visible — the header a full serve reads as
 * Ada is the header nobody here is reading.
 *
 * It waits for the chrome first, so an empty seat is an answer rather than a
 * page that has not drawn its bar yet.
 */
Then("the header has no identity chip", async function (this: OlaiWorld) {
  await this.waitForFrame();
  const header = this.page.locator(APP_HEADER);
  await header
    .locator(APP_CHROME)
    .waitFor({ state: "visible", timeout: POLL_TIMEOUT });
  assert.equal(
    await header.locator(IDENTITY).count(),
    0,
    "the identity chip is still in the header of a serve that did not mount the row",
  );
});

Then("the header shows anonymous", async function (this: OlaiWorld) {
  const slot = this.page.locator(IDENTITY);
  await slot.waitFor({ state: "attached", timeout: POLL_TIMEOUT });
  await this.expectAttribute(
    IDENTITY,
    "data-who",
    "none",
    "the identity slot",
  );
  assert.equal(
    await slot.getAttribute("aria-label")
      ?? await slot.locator("[aria-label]").getAttribute("aria-label"),
    "anonymous",
    "anonymous must be a spoken face, not an empty slot",
  );
  await iconOnly(slot);
  assert.equal(
    await slot.locator("svg").count(),
    1,
    "anonymous drew no icon",
  );
  assert.equal(
    await slot.locator("img").count(),
    0,
    "anonymous drew a picture, which is a person",
  );
});

/** Somebody is looking, and it is this login. WHAT they wear is the next
 *  step's question: a person with no picture is a person all the same. */
Then(
  "the header shows the identity {string}",
  async function (this: OlaiWorld, login: string) {
    const slot = this.page.locator(IDENTITY);
    await slot.waitFor({ state: "attached", timeout: POLL_TIMEOUT });
    await this.expectAttribute(IDENTITY, "data-who", "yes", "the identity chip");
    await this.expectAttribute(IDENTITY, "data-login", login, "the identity chip");
    await iconOnly(slot);
  },
);

Then(
  "the header calls me {string}",
  async function (this: OlaiWorld, said: string) {
    const slot = this.page.locator(IDENTITY);
    await slot.waitFor({ state: "attached", timeout: POLL_TIMEOUT });
    assert.equal(
      await slot.locator("[aria-label]").getAttribute("aria-label"),
      said,
      "the words are the tooltip, and they name the person and the account",
    );
  },
);

/** The fourth rung: no picture anywhere on the ladder is the silhouette
 *  the chip draws itself, with no remote image at all. */
Then("the identity chip draws no picture", async function (this: OlaiWorld) {
  const slot = this.page.locator(IDENTITY);
  await slot.waitFor({ state: "attached", timeout: POLL_TIMEOUT });
  assert.equal(
    await slot.locator("img").count(),
    0,
    "a person with no picture on any rung drew a remote image",
  );
  assert.equal(
    await slot.locator("svg").count(),
    1,
    "a person with no picture drew no silhouette either",
  );
});

const drawnPicture = async (world: OlaiWorld): Promise<string> => {
  const src = await world.page
    .locator(`${IDENTITY} img`)
    .getAttribute("src", { timeout: POLL_TIMEOUT });
  assert.ok(src, "the identity chip drew no picture");
  return src;
};

Then(
  "the identity picture is {string}",
  async function (this: OlaiWorld, url: string) {
    assert.equal(await drawnPicture(this), url);
  },
);

Then(
  "the identity picture is the gravatar of {string}",
  async function (this: OlaiWorld, email: string) {
    const src = await drawnPicture(this);
    assert.equal(
      src,
      gravatarOf(email),
      `the identity picture is ${src}, not the gravatar of ${email}`,
    );
  },
);
