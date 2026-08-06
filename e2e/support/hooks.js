// Browser lifecycle, scenario lifecycle.
//
// One chromium per worker (launching one is the expensive part), one context
// and one server per scenario (isolation is the point). The browser is
// nixpkgs' — playwright-driver pins it, PLAYWRIGHT_BROWSERS_PATH points at it,
// and the npm `playwright` beside it is the same version (flake.nix).

import {
  After,
  AfterAll,
  Before,
  BeforeAll,
  Status,
  setDefaultTimeout,
  setWorldConstructor,
} from "@cucumber/cucumber";
import { chromium } from "playwright";

import { OlaiWorld } from "./world.js";

// A step here can be waiting on a racket start-up, a filesystem watcher's
// 2-second poll fallback, and an agent subprocess. Cucumber's 5s default is a
// budget for none of those.
setDefaultTimeout(30_000);

setWorldConstructor(OlaiWorld);

let browser;

BeforeAll(async () => {
  browser = await chromium.launch({ headless: true });
});

AfterAll(async () => {
  if (browser) await browser.close();
});

// What the fake agent had stored when it woke up. A property of the machine,
// not of anything a client says (fake-acp-agent.rkt), so it is a property of
// the server a scenario boots — and a tag is how a scenario asks for one.
// "foreign" is only other directories' conversations; anything else is two of
// this directory's own plus a newer foreign one.
const STORED_SESSIONS = {
  "@stored-sessions": "1",
  "@foreign-sessions": "foreign",
};

Before(async function ({ pickle }) {
  const env = {};
  for (const { name } of pickle.tags) {
    if (name in STORED_SESSIONS) env.OLAI_FAKE_ACP_STORED = STORED_SESSIONS[name];
  }
  await this.boot(browser, env);
});

// The server's own output is the first thing worth reading when a scenario
// fails — a load error, an agent that would not start — and it dies with the
// scenario, so it is attached here or nowhere.
After(async function ({ result }) {
  if (result?.status === Status.FAILED && this.server) {
    this.attach(this.server.log(), "text/plain");
  }
  await this.shutdown();
});
