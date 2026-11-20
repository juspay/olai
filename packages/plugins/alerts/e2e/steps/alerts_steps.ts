import * as assert from "node:assert";
import { Given, Then, When } from "@olai/tests/harness/runner.ts";

import { alertsOn } from "@olai/tests/harness/alerts.ts";
import { CHAT_ASK, CHAT_PANEL, POLL_TIMEOUT, attr } from "@olai/tests/harness/world.ts";
import type { OlaiWorld } from "@olai/tests/harness/world.ts";

const PRESS_TYPE = "notificationclick";

const WAITING_ASK = `${CHAT_ASK}${attr("data-asking", "true")}`;

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

Then("no notification has been raised", async function (this: OlaiWorld) {
  const raised = (await alertsOn(this.page)).banners;
  assert.deepStrictEqual(
    raised.map((one) => one.body),
    [],
    "a notification was raised where the reader was already looking",
  );
});

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
  assert.match(mark.title, /^olai \[.+\]$/);
  assert.ok(!mark.dotted, "the tab's icon still carries a dot");
});

When("the notification is pressed", async function (this: OlaiWorld) {
  await this.waitUntil(
    () => this.page.evaluate(() => navigator.serviceWorker.controller !== null),
    "the notification worker to be controlling this page",
    POLL_TIMEOUT,
  );
  const raised = await banners(this, 1);
  const tag = raised.at(-1)!.tag;
  const PLUGIN = "olai:plugin:";
  const data = tag.startsWith("olai:due:")
    ? { kind: "due" }
    : tag.startsWith(PLUGIN)
    ? { kind: "plugin", name: tag.slice(PLUGIN.length) }
    : { kind: "ask" };
  await this.page.evaluate(({ type, data }) => {
    navigator.serviceWorker.dispatchEvent(
      new MessageEvent("message", {
        data: { type, data, id: crypto.randomUUID() },
        source: navigator.serviceWorker.controller,
      }),
    );
  }, { type: PRESS_TYPE, data });
});

Then("the panel is open at the question", async function (this: OlaiWorld) {
  const panel = this.chat(CHAT_PANEL);
  await panel.waitFor({ state: "visible", timeout: POLL_TIMEOUT });
  const waiting = this.chat(WAITING_ASK);
  await waiting.waitFor({ state: "visible", timeout: POLL_TIMEOUT });
  const inView = await waiting.evaluate((form) => {
    const box = form.getBoundingClientRect();
    return box.top < window.innerHeight && box.bottom > 0;
  });
  assert.ok(inView, "the waiting question is not on screen");
});
