/**
 * `playwright` is pinned to the version of `pkgs.playwright-driver` in the
 * pinned nixpkgs, so the pin stays in ONE manifest: a plugin that owns e2e
 * steps names `@olai/tests` and re-exports these types from here.
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
