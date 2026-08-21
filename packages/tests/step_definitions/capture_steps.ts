/**
 * `POST /capture`, driven at the real server this scenario is reading.
 *
 * The endpoint's own promises — which file a capture lands in, what it is
 * refused for, what the record holds — are `@olai/server`'s `capture.test.ts`,
 * over a socket, against the files on disk. Nothing here re-asserts them.
 *
 * What only a BROWSER can say is the reason these steps exist: a line sent from
 * somewhere else, while a person is reading something else, reaches the page
 * they have open — the Inbox door lights up and counts it, today's journal
 * lists it, and the `message://` pointer a captured mail holds renders as a
 * link the browser will hand to the OS. That last one is written two packages
 * from where it is allowed (`@olai/server`'s `capture.ts` composes the
 * autolink, `@olai/web`'s `markdown/sanitise.ts` names the scheme), and this is
 * the only place the whole chain is asked at once.
 *
 * `@scratch:` on every scenario that uses these: a capture WRITES the served
 * directory, and it mints `_olai/Inbox.olai` in it.
 */

import * as assert from "node:assert";
import { Then, When } from "@cucumber/cucumber";

import { attr, DAY_PAGE, DESC, HYDRATION_TIMEOUT, nodeSelector } from "../support/world.ts";
import type { OlaiWorld } from "../support/world.ts";

/** The path and the header, spelled the way a CLIENT does — `@olai/server`'s
 *  own constants are deliberately not imported, which is the fake ACP agent's
 *  argument one door over: a capture client is a third party, and a fixture
 *  derived from the implementation under test agrees with it by construction. */
const CAPTURE_PATH = "/capture";
const IDENTITY_HEADER = "Tailscale-User-Login";

/** The id the last capture minted, per scenario. A WeakMap rather than a field
 *  on the world: what a capture answered is this file's business, and the world
 *  is shared by fifty step modules that have no use for it. */
const lastCaptured = new WeakMap<OlaiWorld, string>();

/** A request that is not the browser's. `this.baseUrl` is the server this
 *  scenario is reading, so the capture and the page are one process and one
 *  store — which is the whole thing being asked. */
const post = (
  world: OlaiWorld,
  body: unknown,
  identity: string | null,
): Promise<Response> =>
  fetch(`${world.baseUrl}${CAPTURE_PATH}`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      ...(identity === null ? {} : { [IDENTITY_HEADER]: identity }),
    },
    body: JSON.stringify(body),
  });

const captured = async (
  world: OlaiWorld,
  body: unknown,
  identity: string,
): Promise<void> => {
  const answered = await post(world, body, identity);
  // ONCE. A `Response` body is a stream, so reading it for the diagnostic and
  // then again for the id is a `TypeError` that reports as "the capture
  // failed" whatever the server actually said.
  const said = await answered.text();
  assert.strictEqual(answered.status, 201, `the capture was refused: ${said}`);
  const reply = JSON.parse(said) as { id?: unknown };
  assert.strictEqual(typeof reply.id, "string", "a capture that landed named no node");
  lastCaptured.set(world, reply.id as string);
};

When(
  "{string} captures {string} over HTTP",
  async function (this: OlaiWorld, login: string, title: string) {
    await captured(this, { title }, login);
  },
);

/** The mail case, which is what the `message:` rider is about: the pointer IS
 *  the attachment, and the note is what holds it. */
When(
  "{string} captures the mail {string} pointing at {string}",
  async function (this: OlaiWorld, login: string, title: string, url: string) {
    await captured(this, { title, text: "worth a reply", url }, login);
  },
);

When("a capture arrives with no identity header", async function (this: OlaiWorld) {
  const answered = await post(this, { title: "this should not land" }, null);
  assert.strictEqual(
    answered.status,
    401,
    "a capture with no identity header was not refused",
  );
});

/** The id the last capture ANSWERED with — the only name a caller has for a row
 *  it did not choose an id for, which is why the door hands one back. */
const mintedIn = (world: OlaiWorld): string => {
  const id = lastCaptured.get(world);
  assert.ok(id !== undefined, "no capture has landed in this scenario yet");
  return id;
};

/** The node the last capture made, at its own address. */
When("I open what was captured", async function (this: OlaiWorld) {
  await this.openNode(mintedIn(this));
});

/**
 * A capture arrives DATED, and this is the half of that only a browser can
 * answer: the row is on the day page, which is where a line sent while nobody
 * was looking at the inbox gets noticed.
 *
 * Asked by ID rather than by title, because the reader never chose one — and
 * asked of `/today`, because the day a capture arrives on is the day the server
 * stamped it with, which is the day this reader is standing on.
 */
Then("what was captured is on today", async function (this: OlaiWorld) {
  await this.open("/today");
  await this.page
    .locator(`${DAY_PAGE} ${nodeSelector(mintedIn(this))}`)
    .first()
    .waitFor({ state: "visible", timeout: HYDRATION_TIMEOUT });
});

/**
 * The pointer, as the BROWSER ended up with it.
 *
 * `href` off the DOM rather than the note's text, because what is being asked
 * is whether the anchor survived the sanitiser — a stripped `message:` leaves
 * the words on the page and takes the link, which reads as working.
 *
 * …and that this app did NOT claim the press either: a scheme it has no page
 * for is the browser's, and the browser hands one it cannot open to the OS. An
 * anchor this app routes is written by `<Link>`, which stamps `data-file`.
 */
Then("the note links to {string}", async function (this: OlaiWorld, href: string) {
  const anchor = this.page.locator(`${DESC} a${attr("href", href)}`).first();
  await anchor.waitFor({ state: "attached", timeout: HYDRATION_TIMEOUT });
  assert.strictEqual(
    await anchor.getAttribute("data-file"),
    null,
    "a captured mail's pointer was drawn as one of this app's own links",
  );
});
