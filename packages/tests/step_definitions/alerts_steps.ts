/**
 * Being told the agent has stopped on you: the banner, the tab's own mark, and
 * what a press of the banner does.
 *
 * WHAT IS REAL HERE and what is not is worth saying once. The trigger is real
 * — the scripted agent asks a real question and the count lands on the real
 * chat cell. The worker is real: the server serves the framework's
 * notification `/sw.js` and the client's own boot registers it, and these
 * steps wait for it to be ACTIVE because the seam silently declines to deliver
 * through a registration that has none. The permission is real, granted to the
 * context by the `@alerts` tag. What is wrapped is the last inch of each of
 * the two things that LEAVE the browser — `showNotification` and the chime's
 * oscillators (`../support/alerts.ts`) — because neither becomes a DOM node in
 * any headless mode.
 *
 * A PRESS is the same story from the other side. Focusing the window, or
 * opening one where none is open, is the worker's own half and needs an OS
 * click nothing here can produce — so what these steps deliver is the message
 * the worker sends the page, on the framework's own channel, envelope for
 * envelope: the id, the ackable source and the durable claim a real press
 * makes the listener walk through. See the press step for why that matters.
 *
 * `@alerts-denied` is the same stage with the permission REFUSED, which is a
 * ruled behaviour of its own: the notification goes and the other two stay.
 */

import * as assert from "node:assert";
import { Given, Then, When } from "@cucumber/cucumber";

import { alertsOn } from "../support/alerts.ts";
import { CHAT_ASK, CHAT_PANEL, CHAT_TOGGLE, POLL_TIMEOUT, attr } from "../support/world.ts";
import type { OlaiWorld } from "../support/world.ts";

/** The message the notification worker posts to an open window when its banner
 *  is pressed, in the framework's own vocabulary (`@kolu/surface-app`'s
 *  `SW_MESSAGE_TYPE`) — and the payload olai puts in it
 *  (`client/notify.ts`'s `NotifyClick`).
 *
 *  Spelled here rather than imported for one reason: it is the WIRE between a
 *  service worker and a page, and a scenario that imported both ends would be
 *  asserting that two constants agree rather than that a press arrives. What
 *  holds the client to it is that the framework installs the listener, and what
 *  holds the framework to it is its own suite. A rename upstream fails this
 *  step, loudly, which is the right place for it to fail. */
const PRESS_TYPE = "notificationclick";

/** A question still waiting on somebody — the panel's own row with its own flag
 *  on, which is what the transcript scrolls to when a press lands. */
const WAITING_ASK = `${CHAT_ASK}${attr("data-asking", "true")}`;

// ── the worker ─────────────────────────────────────────────────────────

/**
 * Wait until this origin has an ACTIVE service worker.
 *
 * It is a step rather than a hook because it is a precondition a reader should
 * see: the seam declines to deliver through a registration that is still
 * installing, so a scenario that raced the activation would fail with "no
 * banner" and say nothing about why.
 */
Given("the notification worker is ready", async function (this: OlaiWorld) {
  await this.waitUntil(
    () =>
      this.page.evaluate(async () => {
        const registration = await navigator.serviceWorker.getRegistration();
        return registration?.active != null;
      }),
    "this origin's notification worker to activate",
    POLL_TIMEOUT,
  );
});

/**
 * The header toggle carries `data-asking` and always has — the one thing a
 * shut panel says on screen, and a button nobody is looking at.
 *
 * It is here rather than beside the composer's own "waiting on you" because
 * that line lives INSIDE the panel, and every scenario in this feature has the
 * panel shut. It is what makes an assertion of ABSENCE honest: the question
 * really did arrive, and this browser really did say nothing about it.
 */
Then(
  "the agent button says the agent is waiting on me",
  async function (this: OlaiWorld) {
    await this.expectAttribute(
      CHAT_TOGGLE,
      "data-asking",
      "true",
      "the agent toggle",
    );
  },
);

// ── the banner ─────────────────────────────────────────────────────────

/** Every banner this page has raised, waited for — a banner is raised off a
 *  frame the server sent, so a bare read would race it. */
const banners = async (world: OlaiWorld, atLeast: number) => {
  await world.waitUntil(
    async () => (await alertsOn(world.page)).banners.length >= atLeast,
    `${atLeast} notification(s) to be raised`,
    POLL_TIMEOUT,
  );
  return (await alertsOn(world.page)).banners;
};

Then(
  "a notification says {string}",
  async function (this: OlaiWorld, expected: string) {
    const raised = await banners(this, 1);
    const last = raised[raised.length - 1];
    assert.ok(
      last !== undefined && last.body.includes(expected),
      `the notification says "${last?.body}", which does not carry "${expected}"`,
    );
  },
);

Then(
  "the notification is titled {string}",
  async function (this: OlaiWorld, expected: string) {
    const raised = await banners(this, 1);
    assert.strictEqual(raised[raised.length - 1]?.title, expected);
  },
);

// The shape rather than the word. An unnamed conversation's banner wears
// what this deployment calls itself (`web`'s `noticeOf`, fed the `calledApp`
// the wire named), and under reuse the box's name is the machine's own — so
// the assertion holds to the FORMULA rather than a literal, exactly the
// derivation `the_app_is_named.feature` proves the server composes by.
Then(
  "the notification is titled what the app calls itself",
  async function (this: OlaiWorld) {
    const raised = await banners(this, 1);
    const title = raised[raised.length - 1]?.title;
    assert.ok(
      title !== undefined && /^olai \[.+\]$/.test(title),
      `the banner is titled "${title}" — an unnamed conversation should wear the deployment's own word, "olai [box]"`,
    );
  },
);

/**
 * Nothing was raised — asserted after the panel has actually reported the
 * question, which is what makes it an absence rather than a race. The step
 * before this one in every scenario that uses it is the one that waits for the
 * form.
 */
Then("no notification has been raised", async function (this: OlaiWorld) {
  const raised = (await alertsOn(this.page)).banners;
  assert.deepStrictEqual(
    raised.map((one) => one.body),
    [],
    "a notification was raised where the reader was already looking",
  );
});

// ── the chime ──────────────────────────────────────────────────────────
//
// A sound has no DOM and no headless ear, so what is asserted is that the
// module opened oscillators and started them — the one call that makes the
// noise. HOW MANY is deliberately not a step: `chime.ts` plays a fifth, so a
// ring is two notes, and a scenario counting notes would be a scenario about
// the tune.

Then("the chime rang", async function (this: OlaiWorld) {
  await this.waitUntil(
    async () => (await alertsOn(this.page)).notes > 0,
    "the chime to play",
    POLL_TIMEOUT,
  );
});

Then("no chime rang", async function (this: OlaiWorld) {
  assert.strictEqual(
    (await alertsOn(this.page)).notes,
    0,
    "a chime played where the reader was already looking",
  );
});

// ── the tab's own mark ─────────────────────────────────────────────────

/** What the tab is wearing: its title, and whether the favicon carries a dot.
 *
 *  The favicon is read as the DRAWING it is — the mark is an SVG this client
 *  generates and hands the tab as a blob, and the dot is the one circle in it
 *  (`client/theme/mark.ts`) — rather than by comparing blob URLs, which change
 *  on every repaint and would pass for a page that had merely re-themed. */
const tabMark = (world: OlaiWorld) =>
  world.page.evaluate(async () => {
    const link = document.querySelector<HTMLLinkElement>('link[rel="icon"]');
    const drawn = link === null ? "" : await (await fetch(link.href)).text();
    return { title: document.title, dotted: drawn.includes("<circle") };
  });

Then("the tab says something is waiting", async function (this: OlaiWorld) {
  await this.waitUntil(
    async () => (await tabMark(this)).title.startsWith("●"),
    "the tab's title to carry the waiting mark",
    POLL_TIMEOUT,
  );
  const mark = await tabMark(this);
  assert.ok(mark.dotted, "the tab's icon carries no dot");
});

Then("the tab says nothing is waiting", async function (this: OlaiWorld) {
  await this.waitUntil(
    async () => !(await tabMark(this)).title.startsWith("●"),
    "the tab's title to lose the waiting mark",
    POLL_TIMEOUT,
  );
  const mark = await tabMark(this);
  // The deployment's word for itself: `olai [box]`, the machine the server
  // answers for (`the_app_is_named.feature` pins the crossing). Which box is
  // not this step's business — that the mark came OFF and left the name
  // standing is.
  assert.match(mark.title, /^olai \[.+\]$/);
  assert.ok(!mark.dotted, "the tab's icon still carries a dot");
});

// ── pressing it ────────────────────────────────────────────────────────

/**
 * Press it — as the WORKER presses it, envelope for envelope.
 *
 * The three fields are the whole point. A real `notificationclick` always
 * carries an `id`, and the page-side listener then refuses to route until it
 * has an ACKABLE sender (`event.source`) and a DURABLE claim on that id in
 * `sessionStorage` — the handshake that stops a still-loading window from
 * dropping a press, and stops the worker's fallback navigation from firing the
 * same press twice. A message with no `id` skips all of it down a branch a
 * real click never takes, so a step that sent one would be exercising a
 * fallback and calling it the press.
 *
 * So: a fresh `id`, and `navigator.serviceWorker.controller` as the source —
 * the real worker, which is what the page acks to. The ack reaches a worker
 * with no waiter for this id and is dropped there, which is exactly what
 * happens to a late ack in production.
 *
 * What is still NOT this is the OS click itself and the window focus that
 * follows it: those are outside the browser and outside a headless stage. This
 * is the message that click sends an open window, delivered on the channel it
 * is sent on.
 */
When("the notification is pressed", async function (this: OlaiWorld) {
  // A press cannot be acked to a worker that is not controlling this page yet,
  // and `clients.claim()` is what makes it controller — so wait for it rather
  // than race it.
  await this.waitUntil(
    () => this.page.evaluate(() => navigator.serviceWorker.controller !== null),
    "the notification worker to be controlling this page",
    POLL_TIMEOUT,
  );
  await this.page.evaluate((type) => {
    navigator.serviceWorker.dispatchEvent(
      new MessageEvent("message", {
        data: { type, data: { kind: "ask" }, id: crypto.randomUUID() },
        source: navigator.serviceWorker.controller,
      }),
    );
  }, PRESS_TYPE);
});

Then("the panel is open at the question", async function (this: OlaiWorld) {
  const panel = this.page.locator(CHAT_PANEL);
  await panel.waitFor({ state: "visible", timeout: POLL_TIMEOUT });
  const waiting = this.page.locator(WAITING_ASK);
  await waiting.waitFor({ state: "visible", timeout: POLL_TIMEOUT });
  // In view rather than merely present: the press promises the question is
  // where the reader is looking, and a form below the fold of a long
  // conversation is a promise the panel did not keep.
  const inView = await waiting.evaluate((form) => {
    const box = form.getBoundingClientRect();
    return box.top < window.innerHeight && box.bottom > 0;
  });
  assert.ok(inView, "the waiting question is not on screen");
});
