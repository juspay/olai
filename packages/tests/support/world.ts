/**
 * The Cucumber World: one instance per scenario, holding the Playwright page
 * and the handful of locators every feature reaches for.
 *
 * Selectors live here as named constants rather than inline in steps, because
 * they are a CONTRACT with the client: `data-testid` and `data-*` attributes
 * only, never a CSS class. A class is a styling decision that a refactor is
 * entitled to change; a `data-testid` is a promise.
 *
 * The names themselves are not re-spelled here — they are IMPORTED from the
 * client that writes them. A contract copied into both halves is a contract
 * kept by memory: renaming an attribute over there would still compile over
 * here and fail thirty seconds later as a bare timeout. Imported, the same
 * rename is a type error before the browser ever starts.
 */

import type { ChildProcess } from "node:child_process";
import * as fs from "node:fs";
import * as path from "node:path";

import { selector, TESTID } from "@olai/web/src/client/testids.ts";
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

/** The mount point — `index.html`'s, not the client's, so it is the one
 *  selector here the client does not own and the one spelled out locally. */
export const ROOT = "#root";
/** The sidebar: one entry per `.jsonl` found under the served directory. */
export const OUTLINE_LIST = selector(TESTID.outlineList);
export const OUTLINE_LINK = selector(TESTID.outlineLink);
/** The sidebar's second list: one entry per `.md` found. */
export const DOCUMENT_LIST = selector(TESTID.documentList);
export const DOCUMENT_LINK = selector(TESTID.documentLink);
/** One document, as a page: `/doc/<file>`. */
export const DOCUMENT_PAGE = selector(TESTID.documentPage);
/** The rendered markdown of a document — on its own page, or inline under the
 *  node that attaches it. */
export const DOCUMENT_BODY = selector(TESTID.documentBody);
/** A node's `doc`: the reference, carrying the RESOLVED path as `data-doc`. */
export const DOC_REF = selector(TESTID.docRef);
/** The link inside that reference, to the document's own page. */
export const DOC_LINK = selector(TESTID.docLink);
/** The main pane. Present only when the loaded set is valid. */
export const OUTLINE_TREE = selector(TESTID.outlineTree);
export const NODE = selector(TESTID.node);
export const NODE_TITLE = selector(TESTID.nodeTitle);
export const TAG = selector(TESTID.tag);
export const DATE = selector(TESTID.date);
export const DESC = selector(TESTID.desc);
export const TOGGLE = selector(TESTID.toggle);
/** The bullet on every row: the link to that node's own page. */
export const ZOOM = selector(TESTID.zoom);
/** The heading of a zoomed page. Carries the CANONICAL node's id, which is
 *  what lets a scenario say "zooming a mirror lands on the node itself". */
export const ZOOM_TITLE = selector(TESTID.zoomTitle);
export const BREADCRUMBS = selector(TESTID.breadcrumbs);
export const CRUMB = selector(TESTID.crumb);
/** The month in the sidebar, and one day of it. A day says what it is in
 *  `data-` facts — `data-dated`, `data-today`, `data-open` — never in the
 *  colour it is painted. */
export const CALENDAR = selector(TESTID.calendar);
export const CALENDAR_DAY = selector(TESTID.calendarDay);
export const CALENDAR_PREV = selector(TESTID.calendarPrev);
export const CALENDAR_NEXT = selector(TESTID.calendarNext);
/** One day, as a page: `/d/<date>` and `/today`. */
export const DAY_PAGE = selector(TESTID.dayPage);
export const DAY_GROUP = selector(TESTID.dayGroup);
export const DAY_EMPTY = selector(TESTID.dayEmpty);
/** The per-view Visible/Hidden switch for nodes that are done. */
export const DONE_TOGGLE = selector(TESTID.doneToggle);
/** Shown in the main pane when `/n/<id>` names no node. The sidebar stays. */
export const NOT_FOUND = selector(TESTID.notFound);
/** Shown INSTEAD of the sidebar and the tree when a set has never validated. */
export const ERROR_VIEW = selector(TESTID.errorView);
export const ERROR_FILE_GROUP = selector(TESTID.errorFileGroup);
export const ERROR_ROW = selector(TESTID.error);
export const CROSS_FILE_ERRORS = selector(TESTID.crossFileErrors);
/** Shown OVER a last-good tree: the files on disk stopped validating. */
export const STALE_BANNER = selector(TESTID.staleBanner);
/** Shown IN ONE outline's place: that file could not be read, the rest are live. */
export const OUTLINE_FAILURE = selector(TESTID.outlineFailure);
/** The connection dot, on screen in every shape of the app. The state it is
 *  reporting is its `data-connection`, never its colour. */
export const CONNECTION = selector(TESTID.connection);
/** Over everything: the server that served this page has been replaced. */
export const RESTARTED = selector(TESTID.restarted);
/** The button in that surface. */
export const RELOAD = selector(TESTID.reload);

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

/** Rendered text, flattened to one line.
 *
 *  Everything read out of the DOM goes through this before it is compared or
 *  printed. `innerText` carries the layout's newlines and indentation, which
 *  are a styling decision — a step that asserted on them would be asserting on
 *  the stylesheet. Shared rather than re-spelled per file so two steps cannot
 *  end up normalising the same text two different ways. */
export const oneLine = (text: string): string =>
  text.replace(/\s+/g, " ").trim();

/** One node, as a selector. Spelled once: the world composes locators from it,
 *  and the steps that need a selector STRING — the retrying attribute waits —
 *  cannot take a `Locator`. */
export const nodeSelector = (id: string): string =>
  `${NODE}[data-node-id="${id}"]`;

/** One day of the month, by the date it stands for. Same reason as above. */
export const daySelector = (date: string): string =>
  `${CALENDAR_DAY}[data-date="${date}"]`;
/** One line, with the `#` that marks a tag dropped.
 *
 *  The `#` is dropped on BOTH sides of every title comparison because the
 *  format stores the title verbatim and leaves the split to the view: whether
 *  the styled tag reads `#home` or `home` is a presentation choice the view is
 *  entitled to make. What a title assertion is actually for is that the words
 *  survive being cut apart into text and tag spans and put back together.
 *
 *  Stripped BEFORE the whitespace is flattened, so a `#` the view sets off on
 *  its own does not leave a double space behind — which is exactly the detail a
 *  second copy of this got backwards, and why it lives beside `oneLine` rather
 *  than in whichever step file compares titles. */
export const readable = (text: string): string => oneLine(text.replace(/#/g, ""));

export class OlaiWorld extends World {
  browser!: Browser;
  context!: BrowserContext;
  page!: Page;

  /** Uncaught page errors and `console.error` output, collected for the whole
   *  scenario by the `Before` hook. A feature asserts on this explicitly — a
   *  silent client-side exception behind a green UI assertion is exactly the
   *  bug an e2e suite exists to catch. */
  errors: string[] = [];

  /** Every URL the page asked for that this server did not serve, collected by
   *  the same hook. It is normally empty and must stay that way: the bundle,
   *  the stylesheet and the syntax highlighter are all shipped by the server
   *  someone pointed at their own outlines, and a request to anywhere else is a
   *  page telling a third party what is being read. */
  offSite: string[] = [];

  /** Which fixture corpus this scenario's server is serving, from its
   *  `@corpus:<name>` or `@scratch:<name>` tag. See `support/hooks.ts`. */
  corpus!: string;
  /** The URL that corpus's server answers on; also the context's `baseURL`. */
  baseUrl!: string;

  /** The directory being served, for a `@scratch:` scenario — a private copy
   *  of the corpus that this scenario is allowed to EDIT while the server
   *  watches it. Undefined for the shared corpora, which are the tracked
   *  fixtures and must not be written to. */
  served?: string;
  /** The server process a `@scratch:` scenario owns, killed in `After`. */
  ownServer?: ChildProcess;
  /** What that server has printed since a scenario RESTARTED it (`support/hooks.ts`).
   *
   *  The one thing a scenario cannot see from the browser is what the server
   *  decided about a connection it refused: the stale-tab gate closes the socket
   *  at the handshake and says so on stdout, and nothing about that reaches the
   *  page except the absence of a connection. Asserting on the line is what
   *  makes "the gate fired" a fact rather than an inference from a UI state that
   *  could have been reached another way. */
  serverSaid = "";

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

  /** Open a node's own page COLD — the permalink, in a fresh document, with
   *  no click history behind it. That is the whole promise of `/n/<id>`, and
   *  navigating there in-app instead would never test it. */
  async openNode(id: string): Promise<void> {
    await this.open(`/n/${encodeURIComponent(id)}`);
  }

  /** One day's own page COLD — `/d/<date>` in a fresh document, which is what
   *  makes a day an address rather than a place you can only click to. */
  async openDayPage(date: string): Promise<void> {
    await this.open(`/d/${encodeURIComponent(date)}`);
  }

  /** One document's own page COLD, the way a link someone sent would arrive. */
  async openDocument(file: string): Promise<void> {
    await this.open(`/doc/${file.split("/").map(encodeURIComponent).join("/")}`);
  }

  /** One sidebar document entry, by the path it stands for. */
  documentLink(file: string): Locator {
    return this.page.locator(`${DOCUMENT_LIST} ${DOCUMENT_LINK}[data-file="${file}"]`);
  }

  /** A node's `doc` reference — its own, not a descendant's. */
  docRef(id: string): Locator {
    return this.node(id).locator(DOC_REF).first();
  }

  /** One day of the month in the sidebar. */
  calendarDay(date: string): Locator {
    return this.page.locator(daySelector(date));
  }

  /** The path the browser is actually at — what a reader would copy out of
   *  the URL bar, without the origin the harness picked at random. */
  pathname(): string {
    return new URL(this.page.url()).pathname;
  }

  /** One sidebar entry, by the relative path it stands for. */
  outlineLink(file: string): Locator {
    return this.page.locator(`${OUTLINE_LINK}[data-file="${file}"]`);
  }

  /** One node in the tree, by id. Ids are unique across the whole loaded set,
   *  so this never needs a scope — except inside a mirror, where the target's
   *  subtree is rendered a second time; those steps scope explicitly. */
  node(id: string): Locator {
    return this.page.locator(nodeSelector(id));
  }

  /** The same node, only if it is on screen. `:visible` because dropping a row
   *  and hiding it are both legitimate ways to hide something, and they read
   *  the same to the person looking at the page. */
  visibleNode(id: string): Locator {
    return this.page.locator(`${nodeSelector(id)}:visible`);
  }

  /** The trail above a zoomed node, crumb by crumb, in order. */
  crumbs(): Locator {
    return this.page.locator(`${BREADCRUMBS} ${CRUMB}`);
  }

  /** Click a node's OWN control. `.first()` is the node's own: a descendant's
   *  matches inside the scope too, and the node's own is rendered before any
   *  child's. */
  async clickWithin(id: string, control: string): Promise<void> {
    const target = this.node(id).locator(control).first();
    await target.waitFor({ state: "visible", timeout: POLL_TIMEOUT });
    await target.click();
    await this.waitForFrame();
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

  /** Wait for something to carry `attribute="expected"`, and say what it
   *  carries instead when it does not. The compound selector is what makes the
   *  wait RETRY — reading the attribute once races every animation frame
   *  between the click and the re-render — and `what` is what the failure
   *  calls the thing, so a step says "node `order`" rather than a selector.
   *
   *  The budget is the interaction one unless a caller says otherwise: an
   *  attribute that is waiting on the NETWORK rather than on a render (a wire
   *  re-dialling through its backoff after a server restart) is a different
   *  scale, and passing `HYDRATION_TIMEOUT` says which one this is. */
  async expectAttribute(
    selector: string,
    attribute: string,
    expected: string,
    what: string,
    timeout = POLL_TIMEOUT,
  ): Promise<void> {
    try {
      await this.page
        .locator(`${selector}[${attribute}="${expected}"]`)
        .first()
        .waitFor({ state: "attached", timeout });
    } catch {
      const actual = await this.page
        .locator(selector)
        .first()
        .getAttribute(attribute)
        .catch(() => null);
      throw new Error(
        `expected ${what} to have ${attribute}="${expected}", ` +
          `but it is ${actual === null ? "absent" : `"${actual}"`}`,
      );
    }
  }

  async expectNodeAttribute(
    id: string,
    attribute: string,
    expected: string,
  ): Promise<void> {
    await this.expectAttribute(
      nodeSelector(id),
      attribute,
      expected,
      `node "${id}"`,
    );
  }

  /** Read a `data-` attribute off a node, waiting for the node first so the
   *  failure says "no node `order`" rather than "expected 'done', got null". */
  async nodeAttribute(id: string, attribute: string): Promise<string | null> {
    const node = this.node(id);
    await node.first().waitFor({ state: "attached", timeout: POLL_TIMEOUT });
    return node.first().getAttribute(attribute);
  }

  /** The served directory this scenario is allowed to write to, or a
   *  diagnostic naming the tag it forgot. Everything that edits a file goes
   *  through here, so "a scenario wrote into the tracked fixtures" is not a
   *  thing that can happen quietly. */
  scratch(): string {
    if (this.served === undefined) {
      throw new Error(
        `this scenario edits the files it is served, so it must be tagged ` +
          `@scratch:${this.corpus} rather than @corpus:${this.corpus} — the shared ` +
          `corpora are tracked fixtures and are served to every other scenario too`,
      );
    }
    return this.served;
  }

  /** Replace one file of the served directory, as a person or a `git pull`
   *  would. The store notices on its own; nothing here tells it to look. */
  writeServed(file: string, contents: string): void {
    const target = path.join(this.scratch(), file);
    fs.mkdirSync(path.dirname(target), { recursive: true });
    fs.writeFileSync(target, contents.endsWith("\n") ? contents : `${contents}\n`);
  }

  removeServed(file: string): void {
    fs.rmSync(path.join(this.scratch(), file));
  }

  /** Plant the no-reload sentinel. */
  async markPage(): Promise<void> {
    await this.page.evaluate((key) => {
      (window as unknown as Record<string, unknown>)[key] = true;
    }, NO_RELOAD_MARK);
  }

  /** Poll until `check` holds, or fail saying what was being waited for.
   *
   *  Playwright's own locators already retry, so this is only for the
   *  assertions a selector cannot express — "this text has CHANGED", "that
   *  element is gone" — which is most of what a live page has to be asked. */
  async waitUntil(
    check: () => Promise<boolean>,
    describe: string,
    timeout = POLL_TIMEOUT,
  ): Promise<void> {
    const deadline = Date.now() + timeout;
    for (;;) {
      if (await check()) return;
      if (Date.now() >= deadline) {
        throw new Error(`timed out after ${timeout}ms waiting until ${describe}`);
      }
      await this.page.waitForTimeout(100);
    }
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
