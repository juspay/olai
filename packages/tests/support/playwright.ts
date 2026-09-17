/**
 * THE BROWSER'S DOOR, and it is the same argument as `./runner.ts` one library
 * over: `playwright` is pinned to the version of `pkgs.playwright-driver` in
 * the pinned nixpkgs (this package's manifest says why, and what the failure
 * looks like when it drifts). A plugin that owns e2e steps names `@olai/tests`,
 * so the pin stays in ONE manifest.
 *
 * TYPES ONLY. Nothing here launches or drives a browser: the page a step reads
 * is `this.page` off the world, which `support/hooks.ts` owns for the length of
 * a scenario. A step that wanted to open a browser of its own would be a
 * scenario with two lifetimes in it.
 */

export type {
  Browser,
  BrowserContext,
  CDPSession,
  ConsoleMessage,
  ElementHandle,
  Frame,
  JSHandle,
  Locator,
  Page,
  Request,
  Response,
  Route,
} from "playwright";
