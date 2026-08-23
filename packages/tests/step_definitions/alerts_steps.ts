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
 * context by the `@alerts` tag. The one thing wrapped is `showNotification`
 * itself (`../support/banners.ts`), because an OS banner is drawn outside the
 * browser and there is no headless mode in which it becomes a DOM node.
 *
 * A PRESS is the same story from the other side. Focusing the window, or
 * opening one where none is open, is the worker's own half and needs an OS
 * click nothing here can produce — so what these steps deliver is the message
 * the worker sends the page, on the framework's own channel, which is exactly
 * what the page receives from a real press with a window open.
 */

import * as assert from "node:assert";
import { Given, Then, When } from "@cucumber/cucumber";

import { bannersOn } from "../support/banners.ts";
import { CHAT_ASK, CHAT_PANEL, CHAT_TOGGLE, POLL_TIMEOUT, attr } from "../support/world.ts";
import type { OlaiWorld } from "../support/world.ts";

/** The message the notification worker posts to an open window when its banner
 *  is pressed, in the framework's own vocabulary (`@kolu/surface-app`'s
 *  `SW_MESSAGE_TYPE`) — and the payload olai puts in it
 *  (`client/chat/attention/notice.ts`'s `AskClick`).
 *
 *  Spelled here rather than imported for one reason: it is the WIRE between a
 *  service worker and a page, and a scenario that imported both ends would be
 *  asserting that two constants agree rather than that a press arrives. What
 *  holds the client to it is that the framework installs the listener, and what
 *  holds the framework to it is its own suite. A rename upstream fails this
 *  step, loudly, which is the right place for it to fail. */
const PRESS = { type: "notificationclick", data: { kind: "ask" } };

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
    async () => (await bannersOn(world.page)).length >= atLeast,
    `${atLeast} notification(s) to be raised`,
    POLL_TIMEOUT,
  );
  return await bannersOn(world.page);
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

/**
 * Nothing was raised — asserted after the panel has actually reported the
 * question, which is what makes it an absence rather than a race. The step
 * before this one in every scenario that uses it is the one that waits for the
 * form.
 */
Then("no notification has been raised", async function (this: OlaiWorld) {
  const raised = await bannersOn(this.page);
  assert.deepStrictEqual(
    raised.map((one) => one.body),
    [],
    "a notification was raised where the reader was already looking",
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
  assert.strictEqual(mark.title, "olai");
  assert.ok(!mark.dotted, "the tab's icon still carries a dot");
});

// ── pressing it ────────────────────────────────────────────────────────

When("the notification is pressed", async function (this: OlaiWorld) {
  await this.page.evaluate((press) => {
    navigator.serviceWorker.dispatchEvent(
      new MessageEvent("message", { data: press }),
    );
  }, PRESS);
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
