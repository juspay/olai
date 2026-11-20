import * as assert from "node:assert";
import * as fs from "node:fs";
import * as path from "node:path";
import { Given, Then, When } from "@olai/tests/harness/runner.ts";
import type { Locator } from "@olai/tests/harness/playwright.ts";
import { MARKER_FILE } from "@olai/tests/harness/scripted.ts";
import { attr, HYDRATION_TIMEOUT, POLL_TIMEOUT } from "@olai/tests/harness/world.ts";
import { PLUGIN_TESTID } from "@olai/tests/harness/testids.ts";
import { selector } from "@olai/web/testlib";

import { oneLine } from "@olai/tests/harness/world.ts";
import type { OlaiWorld } from "@olai/tests/harness/world.ts";

import {
  CHAT_IDENTITY,
  CHAT_LINK,
  CHAT_LINK_OPEN,
  CHAT_SIGN_IN,
  CHAT_SIGN_IN_BY_HAND,
  CHAT_SIGN_IN_CANCEL,
  CHAT_SIGN_IN_COMMAND,
  CHAT_SIGN_IN_CURRENT,
  CHAT_SIGN_IN_INPUT,
  CHAT_SIGN_IN_METHOD,
  CHAT_SIGN_IN_OUTPUT,
  CHAT_SIGN_IN_RETRY,
  CHAT_SIGN_IN_STATUS,
} from "../selectors.ts";

const mark = (world: OlaiWorld, marker: string): void => {
  fs.writeFileSync(path.join(world.scratch(), marker), "");
};

Given("the agent needs a sign-in", function (this: OlaiWorld) {
  mark(this, MARKER_FILE.needsAuth);
});

When("the person finishes signing in", function (this: OlaiWorld) {
  mark(this, MARKER_FILE.atThePage);
});

When("the agent reports it is signed in as:", function (this: OlaiWorld, identity: string) {
  fs.writeFileSync(path.join(this.scratch(), MARKER_FILE.identity), identity);
});

Then("the agent line says who is signed in as {string}", async function (this: OlaiWorld, said: string) {
  await this.waitUntil(
    async () => {
      const chip = this.chat(CHAT_IDENTITY);
      if ((await chip.count()) === 0) return false;
      return oneLine(await chip.innerText()) === said;
    },
    `the agent line to say "${said}"`,
    HYDRATION_TIMEOUT,
  );
});

Then("the agent line says nobody is signed in", async function (this: OlaiWorld) {
  await this.waitUntil(
    async () => {
      const chip = this.chat(CHAT_IDENTITY);
      if ((await chip.count()) === 0) return false;
      return oneLine(await chip.innerText()) === "Not signed in";
    },
    "the agent line to say nobody is signed in",
    HYDRATION_TIMEOUT,
  );
});

Then("the agent line names no account", async function (this: OlaiWorld) {
  await this.waitUntil(
    async () => (await this.chat(CHAT_IDENTITY).count()) === 0,
    "the agent line to draw no account",
    HYDRATION_TIMEOUT,
  );
});

Given("the agent offers no way in but still reports its account", function (this: OlaiWorld) {
  mark(this, MARKER_FILE.identityOnly);
});

Then("the account in the agent line is a button", async function (this: OlaiWorld) {
  await this.waitUntil(
    async () => (await this.chat(CHAT_IDENTITY).getAttribute("data-pressable")) === "true",
    "the account chip to be pressable",
    HYDRATION_TIMEOUT,
  );
});

Then("the account in the agent line is not a button", async function (this: OlaiWorld) {
  await this.waitUntil(
    async () => (await this.chat(CHAT_IDENTITY).getAttribute("data-pressable")) === "false",
    "the account chip to be a label",
    HYDRATION_TIMEOUT,
  );
});

When("I press the account in the agent line", async function (this: OlaiWorld) {
  const chip = this.chat(CHAT_IDENTITY);
  await chip.waitFor({ state: "visible", timeout: POLL_TIMEOUT });
  await chip.click();
});

Then("the sign-in names the current account {string}", async function (this: OlaiWorld, said: string) {
  await this.waitUntil(
    async () => {
      const line = this.chat(CHAT_SIGN_IN_CURRENT);
      if ((await line.count()) === 0) return false;
      return oneLine(await line.innerText()).includes(said);
    },
    `the chooser to name "${said}"`,
    HYDRATION_TIMEOUT,
  );
});

Then("the sign-in names no current account", async function (this: OlaiWorld) {
  await this.waitUntil(
    async () => (await this.chat(CHAT_SIGN_IN_CURRENT).count()) === 0,
    "the chooser to name no current account",
    HYDRATION_TIMEOUT,
  );
});

const methodButton = (world: OlaiWorld, method: string): Locator =>
  world.chat(`${CHAT_SIGN_IN_METHOD}${attr("data-method", method)}`);

const byHand = (world: OlaiWorld, method: string): Locator =>
  world.chat(`${CHAT_SIGN_IN_BY_HAND}${attr("data-method", method)}`);

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

Then(
  "the sign-in makes a link of {string}",
  async function (this: OlaiWorld, url: string) {
    await this.waitUntil(
      async () =>
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

Then("the login command was stopped", async function (this: OlaiWorld) {
  const written = path.join(this.scratch(), MARKER_FILE.loginPid);
  try {
    await this.waitUntil(
      async () => stillRunning(written) === null,
      "the login command to be stopped",
      HYDRATION_TIMEOUT,
    );
  } catch {
    assert.fail(`the login command was not stopped — ${stillRunning(written)} (${written})`);
  }
});

/** `kill(pid, 0)` asks the kernel and signals nothing: it answers "there is
 *  SOMETHING with this number", so the command line is asked too and a pid
 *  reused by a later process does not read as this script. */
const stillRunning = (written: string): string | null => {
  if (!fs.existsSync(written)) return "no pid was written";
  const pid = Number.parseInt(fs.readFileSync(written, "utf8").trim(), 10);
  if (!Number.isSafeInteger(pid)) return `the pid file says ${JSON.stringify(fs.readFileSync(written, "utf8"))}`;
  try {
    process.kill(pid, 0);
  } catch {
    return null;
  }
  const line = commandLineOf(pid);
  return line !== null && !line.includes("fake-login") ? null : line ?? `pid ${pid} is running`;
};

/** `null` where the platform does not say (no `/proc`), which reads as
 *  "still here". */
const commandLineOf = (pid: number): string | null => {
  try {
    return fs.readFileSync(`/proc/${pid}/cmdline`, "utf8").replaceAll("\0", " ").trim();
  } catch {
    return null;
  }
};

Then("the card is done with", async function (this: OlaiWorld) {
  await this.waitUntil(
    async () => (await this.chat(CHAT_LINK).getAttribute("data-done")) === "true",
    "the agent to say the page is done with",
    HYDRATION_TIMEOUT,
  );
});

Then("the card links to {string}", async function (this: OlaiWorld, url: string) {
  await this.waitUntil(
    async () => (await this.chat(CHAT_LINK_OPEN).getAttribute("href")) === url,
    `the card to link to ${url}`,
    POLL_TIMEOUT,
  );
});

const outlinesHeld = (world: OlaiWorld): ReadonlyArray<string> => {
  const root = world.scratch();
  const found: Array<string> = [];
  const walk = (dir: string) => {
    for (const entry of fs.readdirSync(path.join(root, dir), { withFileTypes: true })) {
      const here = dir === "" ? entry.name : `${dir}/${entry.name}`;
      if (entry.isDirectory()) { if (!entry.name.startsWith(".")) walk(here); continue }
      const text = fs.readFileSync(path.join(root, here), "utf8");
      const lines = text.split("\n").filter(line => line.trim() !== "");
      if (lines.length > 0 && lines.every(line => line.startsWith("{") && line.endsWith("}"))) found.push(here);
    }
  };
  walk("");
  return found;
};

Then("the pending conversation is unfolded as {string} with engine {string}", async function(this: OlaiWorld, name: string, engine: string) {
  let id: string | undefined;
  await this.waitUntil(async () => {
    id = outlinesHeld(this)
      .flatMap(file => [...this.servedNodesSoFar(file)])
      .find(node => {
        const custom = node.custom as Record<string, unknown> | undefined;
        return (custom?.["chat-agent-session"] ?? custom?.["agent-session"]) === engine;
      })?.id as string | undefined;
    return id !== undefined;
  }, "the new node to name only its engine before authentication", HYDRATION_TIMEOUT);
  assert.ok(id);
  this.nodeNames.set(name, id);
  this.activeAgent = name;
  await this.chatRoot().waitFor({ state: "visible", timeout: HYDRATION_TIMEOUT });
});

Then("the open conversation has session id {string}", async function(this: OlaiWorld, session: string) {
  await this.waitUntil(async () => await this.chat(selector(PLUGIN_TESTID.chatPanel)).getAttribute("data-session-id") === session,
    `the intended session ${session} to be opened`, HYDRATION_TIMEOUT);
});

Then("the sign-in shows {string} as a command to run by hand", async function (this: OlaiWorld, method: string) {
  await this.waitUntil(
    async () => (await byHand(this, method).count()) > 0,
    `a by-hand sign-in for "${method}"`,
    HYDRATION_TIMEOUT,
  );
  assert.equal(
    await methodButton(this, method).count(),
    0,
    `the sign-in draws a button for "${method}", which cannot finish from here`,
  );
});

Then("the command to run by hand includes {string}", async function (this: OlaiWorld, text: string) {
  const shown = this.chat(CHAT_SIGN_IN_COMMAND);
  await shown.waitFor({ state: "visible", timeout: POLL_TIMEOUT });
  const said = oneLine(await shown.innerText());
  assert.ok(said.includes(text), `the command reads "${said}", which does not include "${text}"`);
});

Then("no sign-in process was started", function (this: OlaiWorld) {
  const ran = path.join(this.scratch(), ".opencode-login-ran");
  assert.ok(!fs.existsSync(ran), `a sign-in process ran: ${ran} exists`);
});
