/**
 * `playwright` is pinned to the version of `pkgs.playwright-driver` in the
 * pinned nixpkgs; the driver refuses a browser build it was not compiled
 * against, so the pin stays in ONE manifest and everything else reads it here.
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
