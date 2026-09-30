/**
 * SIGNING IN — the panel's own row, driven through the browser.
 *
 * The two things a scenario does here that no other vocabulary does:
 *
 *   - **it arms the agent**, with a dot-file ({@link MARKER.needsAuth}), so
 *     that the next open and the next turn are refused with ACP's
 *     `authRequired` — the protocol's only way of asking for a signature, and
 *     the whole of what puts the row on screen.
 *   - **it says the person finished at a vendor's page**
 *     ({@link MARKER.atThePage}), because a device-code or OAuth elicitation
 *     waits for exactly that and this suite cannot visit one.
 *
 * The rest is reading what a person would: which methods are on offer, what a
 * process has printed, where a card sends them, and whether the row is gone.
 * Every one of those is an assertion about the PAGE — the row's state, its
 * data attributes — never about the panel's own bookkeeping.
 */

import * as assert from "node:assert";
import * as fs from "node:fs";
import * as path from "node:path";
import { Given, Then, When } from "@olai/tests/harness/runner.ts";
import type { Locator } from "@olai/tests/harness/playwright.ts";
import { MARKER } from "@olai/tests/harness/scripted.ts";
import { attr, HYDRATION_TIMEOUT, POLL_TIMEOUT } from "@olai/tests/harness/world.ts";
import { PLUGIN_TESTID } from "@olai/tests/harness/testids.ts";
import { selector } from "@olai/web/testlib";

import { oneLine } from "@olai/tests/harness/world.ts";
import type { OlaiWorld } from "@olai/tests/harness/world.ts";

import {
  CHAT_LINK,
  CHAT_LINK_OPEN,
  CHAT_SIGN_IN,
  CHAT_SIGN_IN_CANCEL,
  CHAT_SIGN_IN_INPUT,
  CHAT_SIGN_IN_OUTPUT,
  CHAT_SIGN_IN_RETRY,
  CHAT_SIGN_IN_STATUS,
} from "../selectors.ts";

/** Write one of the markers the scripted agent reads. Empty, which is the
 *  idiom: the file's EXISTENCE is the claim, and a dot-file is not an edit. */
const mark = (world: OlaiWorld, marker: string): void => {
  fs.writeFileSync(path.join(world.scratch(), marker), "");
};

Given("the agent needs a sign-in", function (this: OlaiWorld) {
  // BEFORE ANYTHING IS OPENED, so the refusal a scenario is about is the one it
  // meets: the marker is read at the moment of each request, not at boot.
  mark(this, MARKER.needsAuth);
});

When("the person finishes signing in", function (this: OlaiWorld) {
  mark(this, MARKER.atThePage);
});

/** One method's button, by the id it is pressed with — so a scenario names a
 *  method the agent advertised rather than a translation of its name. The
 *  attribute goes through the suite's `attr`, which is the only place a value a
 *  reader typed is escaped into a selector (`../selectors.test.ts`). */
const methodButton = (world: OlaiWorld, method: string): Locator =>
  world.chat(attr("data-method", method));

When("I press the sign-in for {string}", async function (this: OlaiWorld, method: string) {
  const button = methodButton(this, method);
  await button.waitFor({ state: "visible", timeout: POLL_TIMEOUT });
  await button.click();
});

When("I type {string} into the sign-in", async function (this: OlaiWorld, code: string) {
  const line = this.chat(CHAT_SIGN_IN_INPUT);
  await line.waitFor({ state: "visible", timeout: POLL_TIMEOUT });
  await line.fill(code);
  await line.press("Enter");
});

When("I press the way to try the sign-in again", async function (this: OlaiWorld) {
  const again = this.chat(CHAT_SIGN_IN_RETRY);
  await again.waitFor({ state: "visible", timeout: POLL_TIMEOUT });
  await again.click();
});

When("I cancel the sign-in", async function (this: OlaiWorld) {
  const cancel = this.chat(CHAT_SIGN_IN_CANCEL);
  await cancel.waitFor({ state: "visible", timeout: POLL_TIMEOUT });
  await cancel.click();
});

Then("the panel offers a sign-in", async function (this: OlaiWorld) {
  await this.waitUntil(
    async () => (await this.chat(CHAT_SIGN_IN).getAttribute("data-kind")) === "choosing",
    "the sign-in chooser to be on screen",
    HYDRATION_TIMEOUT,
  );
});

/** WAITED FOR, and the wait is not a licence: a sign-in that SUCCEEDED is a
 *  process exiting and a frame coming back, so the row is on screen for a beat
 *  after the last thing a person did. What is claimed is the end state — that
 *  it goes and does not come back on its own — and a row a press already took
 *  away satisfies this on the first look.
 *
 *  IT IS ALSO WHAT A FAILURE LOOKS LIKE FROM HERE, deliberately: a row that
 *  stays (because the sign-in failed, or because a cancelled attempt's own
 *  refusal put it back) is a timeout at this line rather than a green run with
 *  a stale control on screen. */
Then("the panel offers no sign-in", async function (this: OlaiWorld) {
  await this.waitUntil(
    async () => (await this.chat(CHAT_SIGN_IN).count()) === 0,
    "the sign-in row to go",
    HYDRATION_TIMEOUT,
  );
});

Then("the sign-in offers {string}", async function (this: OlaiWorld, method: string) {
  await this.waitUntil(
    async () => (await methodButton(this, method).count()) > 0,
    `a sign-in button for "${method}"`,
    POLL_TIMEOUT,
  );
});

Then("the sign-in does not offer {string}", async function (this: OlaiWorld, method: string) {
  assert.equal(
    await methodButton(this, method).count(),
    0,
    `the sign-in offers "${method}", which it should not`,
  );
});

Then("the sign-in is running {string}", async function (this: OlaiWorld, method: string) {
  await this.waitUntil(
    async () => {
      const row = this.chat(CHAT_SIGN_IN);
      return (await row.getAttribute("data-kind")) === "terminal" &&
        (await row.getAttribute("data-method")) === method;
    },
    `the sign-in for "${method}" to be running`,
    HYDRATION_TIMEOUT,
  );
});

Then("the sign-in says {string}", async function (this: OlaiWorld, text: string) {
  await this.waitUntil(
    async () => {
      const output = this.chat(CHAT_SIGN_IN_OUTPUT);
      if ((await output.count()) === 0) return false;
      return oneLine(await output.innerText()).includes(text);
    },
    `the sign-in to print "${text}"`,
    HYDRATION_TIMEOUT,
  );
});

Then("the sign-in has stopped", async function (this: OlaiWorld) {
  await this.waitUntil(
    async () => {
      const status = this.chat(CHAT_SIGN_IN_STATUS);
      if ((await status.count()) === 0) return false;
      const said = await status.innerText();
      return said.startsWith("Exit") || said === "Stopped";
    },
    "the sign-in to stop",
    HYDRATION_TIMEOUT,
  );
  // ... and it is offered again, which is the difference between a failure a
  // person can act on and a row that merely stopped.
  await this.waitUntil(
    async () => (await this.chat(CHAT_SIGN_IN_RETRY).count()) > 0,
    "a way to try the sign-in again",
    POLL_TIMEOUT,
  );
});

Then("the card sends them to {string}", async function (this: OlaiWorld, host: string) {
  await this.waitUntil(
    async () => (await this.chat(CHAT_LINK).getAttribute("data-host")) === host,
    `a card sending them to ${host}`,
    HYDRATION_TIMEOUT,
  );
});

/** A link drawn out of a PROCESS'S output, which is the whole reason the
 *  output is not a `<pre>` of text: the URL a login prints is the thing a person
 *  has to open, and a client that only quoted it would leave them copying. */
Then(
  "the sign-in makes a link of {string}",
  async function (this: OlaiWorld, url: string) {
    await this.waitUntil(
      async () =>
        // `attr` and not an interpolated selector: the URL is a value from
        // outside this file, and `../selectors.test.ts` is the fence that says
        // so (`@olai/tests/harness/selectors.ts` is where the escaping lives).
        (await this.chat(CHAT_SIGN_IN_OUTPUT).locator(`a${attr("href", url)}`).count()) > 0,
      `the sign-in to link ${url}`,
      HYDRATION_TIMEOUT,
    );
  },
);

Then("the card says {string}", async function (this: OlaiWorld, text: string) {
  await this.waitUntil(
    async () => {
      const card = this.chat(CHAT_LINK);
      if ((await card.count()) === 0) return false;
      return oneLine(await card.innerText()).includes(text);
    },
    `the card to say "${text}"`,
    HYDRATION_TIMEOUT,
  );
});

/**
 * TAKE THE AGENT AWAY, mid-anything — the seat released, which is the scope
 * going out from under whatever it was running.
 *
 * The CLOSE control is the gesture a person has (it takes the node's binding
 * property off and the seat closes), and what it is held to here is the panel's
 * own face: the fold this row was drawn in is GONE, because there is no agent
 * left for it to be about.
 */
When("I take the agent away", async function (this: OlaiWorld) {
  const node = this.activeAgent;
  assert.ok(node, "open a named node agent first");
  const close = this.chat(selector(PLUGIN_TESTID.chatCloseAgent));
  await close.waitFor({ state: "visible", timeout: POLL_TIMEOUT });
  await close.click();
  await this.page
    .locator(`${selector(PLUGIN_TESTID.agentFold)}${attr("data-agent", this.nodeId(node))}`)
    .waitFor({ state: "detached", timeout: HYDRATION_TIMEOUT });
});

/**
 * ... AND THE COMMAND IT WAS RUNNING IS DEAD.
 *
 * A killed process leaves nothing behind but its exit, so the command says so
 * itself on the way out (`packages/tests/agent/fake-login.ts`'s SIGTERM
 * handler). This is the assertion behind `chat.md`'s "the scope going away does
 * the same" — the one claim about a sign-in that no row can be read for.
 */
Then("the login command was stopped", async function (this: OlaiWorld) {
  const marker = path.join(this.scratch(), MARKER.loginStopped);
  await this.waitUntil(
    async () => fs.existsSync(marker),
    "the login command to be stopped",
    HYDRATION_TIMEOUT,
  );
});

Then("the card is done with", async function (this: OlaiWorld) {
  await this.waitUntil(
    async () => (await this.chat(CHAT_LINK).getAttribute("data-done")) === "true",
    "the agent to say the page is done with",
    HYDRATION_TIMEOUT,
  );
});

Then("the card links to {string}", async function (this: OlaiWorld, url: string) {
  // WHAT THE ANCHOR ACTUALLY GOES TO — the host is drawn as its text, and the
  // whole URL is the one thing that has to survive to the `href`.
  await this.waitUntil(
    async () => (await this.chat(CHAT_LINK_OPEN).getAttribute("href")) === url,
    `the card to link to ${url}`,
    POLL_TIMEOUT,
  );
});
