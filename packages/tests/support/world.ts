/**
 * The Cucumber World: one instance per scenario, holding the Playwright page
 * and the handful of locators every feature reaches for.
 *
 * Selectors live here as named constants rather than inline in steps, because
 * they are a CONTRACT with the client: `data-testid` and `data-*` attributes
 * only, never a CSS class. A class is a styling decision that a refactor is
 * entitled to change; a `data-testid` is a promise. When the client renames
 * one, exactly one line in this file moves.
 */

import {
  setDefaultTimeout,
  setWorldConstructor,
  World,
} from "@cucumber/cucumber";
import type { Browser, BrowserContext, Locator, Page } from "playwright";

/** Per-step budget for interaction polls against a settled UI — a click
 *  landing, an attribute flipping, a subtree appearing. */
export const POLL_TIMEOUT = 15_000;

/** Per-step budget for HYDRATION polls: the first paint after `goto`, which
 *  waits on the bundle, the WebSocket handshake and the first full snapshot.
 *  A separate axis from interaction on purpose — the first frame can take
 *  seconds on a cold, loaded CI runner while every interaction after it lands
 *  in milliseconds, and sharing one constant would make the whole suite wait
 *  for the slowest thing in it. */
export const HYDRATION_TIMEOUT = 30_000;

/** How long a freshly spawned server gets to print its listening line. Not a
 *  poll budget — it bounds a child process — but it is derived from the same
 *  scale so `hooks.ts` and this file cannot drift. */
export const SERVER_START_TIMEOUT = HYDRATION_TIMEOUT;

/** Cucumber's outer kill-timeout. DERIVED, so the relationship
 *  `POLL_TIMEOUT < HYDRATION_TIMEOUT < setDefaultTimeout` holds structurally:
 *  raising either inner budget can never leave the outer envelope too tight to
 *  let the inner timeout report its own, far more specific, error. */
const STEP_GUARD = 10_000;
setDefaultTimeout(Math.max(POLL_TIMEOUT, HYDRATION_TIMEOUT) + STEP_GUARD);

/** The `Before` hook may have to boot a server before it can open a page. */
export const SCENARIO_SETUP_TIMEOUT = SERVER_START_TIMEOUT + STEP_GUARD;

// ── the UI contract ────────────────────────────────────────────────────

export const ROOT = "#root";
/** The sidebar: one entry per `.jsonl` found under the served directory. */
export const OUTLINE_LIST = '[data-testid="outline-list"]';
export const OUTLINE_LINK = '[data-testid="outline-link"]';
/** The main pane. Present only when the loaded set is valid. */
export const OUTLINE_TREE = '[data-testid="outline-tree"]';
export const NODE = '[data-testid="node"]';
export const NODE_TITLE = '[data-testid="node-title"]';
export const TAG = '[data-testid="tag"]';
export const DATE = '[data-testid="date"]';
export const DESC = '[data-testid="desc"]';
export const TOGGLE = '[data-testid="toggle"]';
/** Shown INSTEAD of the sidebar and the tree when the set does not validate. */
export const ERROR_VIEW = '[data-testid="error-view"]';
export const ERROR_FILE_GROUP = '[data-testid="error-file-group"]';
export const ERROR_ROW = '[data-testid="error"]';
export const CROSS_FILE_ERRORS = '[data-testid="cross-file-errors"]';

/** The app has finished its first render when it has committed to one of its
 *  two shapes: a sidebar (the set loaded) or the error view (it did not).
 *  Waiting on either — rather than on the one the scenario expects — means a
 *  broken-set regression fails with "expected a tree, found the error view for
 *  house.jsonl:3" instead of a bare 30-second timeout. */
export const SETTLED_SELECTOR = `${OUTLINE_LIST}, ${ERROR_VIEW}`;

/** A sentinel planted on `window` to prove a later assertion ran against the
 *  SAME document. Any full page load wipes it, so a step that claims "without
 *  a reload" can prove it rather than assume it. */
export const NO_RELOAD_MARK = "__olaiNoReloadMark";

export class OlaiWorld extends World {
  browser!: Browser;
  context!: BrowserContext;
  page!: Page;

  /** Uncaught page errors and `console.error` output, collected for the whole
   *  scenario by the `Before` hook. A feature asserts on this explicitly — a
   *  silent client-side exception behind a green UI assertion is exactly the
   *  bug an e2e suite exists to catch. */
  errors: string[] = [];

  /** Which fixture corpus this scenario's server is serving, from its
   *  `@corpus:<name>` tag. See `support/hooks.ts`. */
  corpus!: string;
  /** The URL that corpus's server answers on; also the context's `baseURL`. */
  baseUrl!: string;

  /** Wait for a double `requestAnimationFrame`.
   *
   *  Solid's reactivity is synchronous but its DOM effects are not observable
   *  until the browser has laid out: one frame flushes the effect queue, the
   *  second flushes anything that queue itself scheduled (a transition, a
   *  measured collapse). Asserting after a single frame passes locally and
   *  fails on a loaded runner, which is the worst failure mode available, so
   *  both frames are always waited for. */
  async waitForFrame(): Promise<void> {
    await this.page.evaluate(
      () =>
        new Promise<void>((resolve) =>
          requestAnimationFrame(() => requestAnimationFrame(() => resolve())),
        ),
    );
  }

  /** Open the app and wait for it to commit to a shape. */
  async open(path = "/"): Promise<void> {
    await this.page.goto(path);
    await this.page
      .locator(SETTLED_SELECTOR)
      .first()
      .waitFor({ state: "visible", timeout: HYDRATION_TIMEOUT });
    await this.waitForFrame();
  }

  /** One sidebar entry, by the relative path it stands for. */
  outlineLink(file: string): Locator {
    return this.page.locator(`${OUTLINE_LINK}[data-file="${file}"]`);
  }

  /** One node in the tree, by id. Ids are unique across the whole loaded set,
   *  so this never needs a scope — except inside a mirror, where the target's
   *  subtree is rendered a second time; those steps scope explicitly. */
  node(id: string): Locator {
    return this.page.locator(`${NODE}[data-node-id="${id}"]`);
  }

  /** A node's OWN title. Nodes nest, so a descendant's title also matches
   *  inside the scope — `.first()` is the node's own because the title is
   *  rendered before the children. */
  nodeTitle(id: string): Locator {
    return this.node(id).locator(NODE_TITLE).first();
  }

  /** The nodes rendered INSIDE a node — its children, or, for a mirror, the
   *  subtree it stands for. `:visible` because a collapsed node is free to
   *  keep its children in the DOM and hide them, or to drop them entirely;
   *  both are correct, and "the children are hidden" means the same thing to
   *  the person reading the screen either way. */
  visibleChildNodes(id: string): Locator {
    return this.node(id).locator(`${NODE}:visible`);
  }

  /** Wait for a node to carry `attribute="expected"`, and say what it carries
   *  instead when it does not. The compound selector is what makes the wait
   *  RETRY — reading the attribute once races every animation frame between
   *  the click and the re-render. */
  async expectNodeAttribute(
    id: string,
    attribute: string,
    expected: string,
  ): Promise<void> {
    const selector = `${NODE}[data-node-id="${id}"][${attribute}="${expected}"]`;
    try {
      await this.page
        .locator(selector)
        .first()
        .waitFor({ state: "attached", timeout: POLL_TIMEOUT });
    } catch {
      const actual = await this.nodeAttribute(id, attribute);
      throw new Error(
        `expected node "${id}" to have ${attribute}="${expected}", ` +
          `but it is ${actual === null ? "absent" : `"${actual}"`}`,
      );
    }
  }

  /** Read a `data-` attribute off a node, waiting for the node first so the
   *  failure says "no node `order`" rather than "expected 'done', got null". */
  async nodeAttribute(id: string, attribute: string): Promise<string | null> {
    const node = this.node(id);
    await node.first().waitFor({ state: "attached", timeout: POLL_TIMEOUT });
    return node.first().getAttribute(attribute);
  }

  /** Plant the no-reload sentinel. */
  async markPage(): Promise<void> {
    await this.page.evaluate((key) => {
      (window as unknown as Record<string, unknown>)[key] = true;
    }, NO_RELOAD_MARK);
  }

  /** Is the sentinel still there? False after any navigation. */
  async pageStillMarked(): Promise<boolean> {
    return this.page.evaluate(
      (key) => (window as unknown as Record<string, unknown>)[key] === true,
      NO_RELOAD_MARK,
    );
  }
}

setWorldConstructor(OlaiWorld);
