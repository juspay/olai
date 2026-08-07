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

import {
  ARCHIVE,
  ARCHIVE_OUTLINE,
  SECOND,
  SECOND_OUTLINE,
} from "./outline.js";
import { OlaiWorld, PHONE_VIEWPORT } from "./world.js";

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

// The roots a scenario wants staged BESIDE the outline, by tag: a second file
// for the anchors that reach across them, the archive for the work that has
// been put away. Boot-time like the sessions above, and for a reason of its
// own — `serve DIR` globs its top level once at startup, so which files a set
// holds is a fact about the server, not something a step can arrange later.
const EXTRA_ROOTS = {
  "@cross-file": [SECOND_OUTLINE, SECOND],
  "@archived": [ARCHIVE_OUTLINE, ARCHIVE],
};

// The screen is the other thing a scenario asks for by tag. Not an assertion
// but a LAYOUT: below phone-max the skin puts the sidebar above the outline and
// the chat panel over it (web/chat-panel, sheet mode), and a scenario about
// that has to be run there.
Before(async function ({ pickle }) {
  const env = {};
  let viewport;
  const extras = [];
  // @daily is the one root that cannot be a fixture: a journal is only worth
  // looking at when one of its days is TODAY, so `olai daily` writes it at
  // boot rather than a file in fixtures/ pretending (world.daily).
  let journal = false;
  for (const { name } of pickle.tags) {
    if (name in STORED_SESSIONS) env.OLAI_FAKE_ACP_STORED = STORED_SESSIONS[name];
    if (name === "@phone") viewport = PHONE_VIEWPORT;
    if (name in EXTRA_ROOTS) extras.push(EXTRA_ROOTS[name]);
    if (name === "@daily") journal = true;
  }
  await this.boot(browser, env, viewport, extras, journal);
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
