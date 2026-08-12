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

import type { TerminalAgent } from "./mcp.ts";

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

/** Which of the three git situations a scenario's server was started into
 *  (`@git:…`) — spelled here, where the world's field is, because `hooks.ts`
 *  already reads this module and a second copy of the three words is a second
 *  place for the tag pattern and the field to disagree. */
export type GitMode = "repo" | "none" | "broken";
/** The app header: wordmark + connection + agent + theme. Always on screen. */
export const APP_HEADER = selector(TESTID.appHeader);
/** The sidebar: the month and the file tree (directory chrome only). */
export const SIDEBAR = selector(TESTID.sidebar);
export const SIDEBAR_TOGGLE = selector(TESTID.sidebarToggle);
export const SIDEBAR_BODY = selector(TESTID.sidebarBody);
export const SIDEBAR_SCRIM = selector(TESTID.sidebarScrim);
export const SIDEBAR_COLLAPSE = selector(TESTID.sidebarCollapse);
export const SIDEBAR_EXPAND = selector(TESTID.sidebarExpand);
export const SIDEBAR_RAIL = selector(TESTID.sidebarRail);
export const SIDEBAR_RESIZE = selector(TESTID.sidebarResize);
/** The file tree: every outline and document under the folders they live in. */
export const OUTLINE_LIST = selector(TESTID.outlineList);
export const OUTLINE_LINK = selector(TESTID.outlineLink);
/** One folder in that tree. `data-path` / `data-collapsed` say which and how. */
export const FILE_DIR = selector(TESTID.fileDir);
export const FILE_DIR_TOGGLE = selector(TESTID.fileDirToggle);
/** One document entry in the file tree (no second list — same folders). */
export const DOCUMENT_LINK = selector(TESTID.documentLink);
/** One document, as a page: `/doc/<file>`. */
export const DOCUMENT_PAGE = selector(TESTID.documentPage);
/** The rendered markdown of a document — on its own page, or inline under the
 *  node that attaches it. */
export const DOCUMENT_BODY = selector(TESTID.documentBody);
/** A document's table of contents, above its body. A `<details>`: whether it is
 *  open is the element's own state. */
export const TOC = selector(TESTID.toc);
/** One line of it — a link to a heading in the same page. */
export const TOC_LINK = selector(TESTID.tocLink);
/** Every heading of a rendered block. Rendered markdown carries no testid —
 *  its tags come out of a file on disk — so the tags themselves are the
 *  selector, spelled once here like every other one rather than in the steps
 *  that reach for them. */
export const HEADINGS = "h1, h2, h3, h4, h5, h6";
/** A node's `doc`: the reference, carrying the RESOLVED path as `data-doc`. */
export const DOC_REF = selector(TESTID.docRef);
/** The link inside that reference, to the document's own page. */
export const DOC_LINK = selector(TESTID.docLink);
/** A node held up by an `after` edge: the mark column's waiting glyph on a row
 *  or a day entry, the named blockers on the node's own page. Absent entirely
 *  on a node with nothing in its way — WHETHER it is blocked, and by what, is
 *  `data-blocked` on the node itself. */
export const BLOCKED = selector(TESTID.blocked);
/** This app's own hover tip. Its text is also the control's `aria-label`, so a
 *  scenario asserting the label is asserting the sentence that matters. */
export const TIP = selector(TESTID.tip);
/** A node's free cross-references (`see`). */
export const SEE_REFS = selector(TESTID.seeRefs);
/** One link from a node to another node, in either of those rows. The target
 *  id rides `data-ref`, which is what a scenario picks one by. */
export const NODE_REF = selector(TESTID.nodeRef);
/** The main pane. Present only when the loaded set is valid. */
export const OUTLINE_TREE = selector(TESTID.outlineTree);
export const NODE = selector(TESTID.node);
export const NODE_TITLE = selector(TESTID.nodeTitle);
export const TAG = selector(TESTID.tag);
export const DATE = selector(TESTID.date);
/** The rollup badge beside a title: how many of the tasks under this node are
 *  done. An annotation — the node's OWN mark is the checkbox. */
export const PROGRESS = selector(TESTID.progress);
export const DESC = selector(TESTID.desc);
export const TOGGLE = selector(TESTID.toggle);
/** The `•••` trigger left of the collapse triangle. */
export const NODE_MENU = selector(TESTID.nodeMenu);
export const NODE_MENU_PANEL = selector(TESTID.nodeMenuPanel);
export const NODE_MENU_ITEM = selector(TESTID.nodeMenuItem);
/** A row's own line — its gutter controls and title, and nothing from the
 *  rows nested under it. What makes "this node has no checkbox" askable
 *  without reaching into markup shape. */
export const NODE_GUTTER = selector(TESTID.nodeGutter);
/** The bullet on every row: the link to that node's own page. */
export const ZOOM = selector(TESTID.zoom);
/** The status box beside that bullet: checked for done, half for doing, empty
 *  for todo — and absent entirely on a node with no mark. */
export const CHECKBOX = selector(TESTID.checkbox);
/** The caret in a row: an input where the title span was, present only while
 *  that row is being typed in. A page with none of these has no editor open,
 *  which is how "nothing is being edited" is asked. */
export const TITLE_EDITOR = selector(TESTID.titleEditor);
/** The note as text, under the row, while it is being written. */
export const DESC_EDITOR = selector(TESTID.descEditor);
/** A row that does not exist yet — an editor standing where `Enter` will put
 *  one. Finding one is finding a DRAFT, never a write. */
export const NEW_ROW = selector(TESTID.newRow);
/** What a write that LANDED had to say — the rollup's nudge, in the same
 *  place and the opposite mood. */
export const EDIT_NUDGE = selector(TESTID.editNudge);
/** What the last commit was refused with, under the row it was typed in. */
export const EDIT_REFUSAL = selector(TESTID.editRefusal);
/** The way in on a page with no rows at all. */
export const START_LINE = selector(TESTID.startLine);
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
/** The git readout beside it: `data-git` is the state, its `aria-label` is the
 *  sentence (git's own words included), and it is ABSENT on a `--no-commit`
 *  serve — which is a claim a scenario makes rather than an accident. */
export const GIT = selector(TESTID.git);
/** Over everything: the server that served this page has been replaced. */
export const RESTARTED = selector(TESTID.restarted);
/** The button in that surface, and in the fault card — one control, one name. */
export const RELOAD = selector(TESTID.reload);
/** In the whole app's place: the CLIENT threw while drawing, and the boundary
 *  around the shell caught it. Its `fault-detail` is what threw, verbatim. */
export const FAULT = selector(TESTID.fault);
export const FAULT_DETAIL = selector(TESTID.faultDetail);
/** The card's second way out, off the page that faulted. */
export const FAULT_HOME = selector(TESTID.faultHome);

/** The theme picker in the header: a pill that opens the chip strip. The
 *  browser tests import DEFAULT_THEME / storage key from `theme/palettes.ts`
 *  rather than reading attributes. A chip's `data-value` is the theme it
 *  offers and `aria-pressed` says whether it is the one in force — never the
 *  colour it is painted, which is the subject here and so the last thing to
 *  assert on. */
export const THEME_PICKER = selector(TESTID.themePicker);
export const THEME_TRIGGER = selector(TESTID.themeTrigger);
export const THEME_CHIP = selector(TESTID.themeChip);

/** The agent panel. Absent entirely when no ACP agent is configured, which is
 *  a state the suite never runs in: every server it spawns is pointed at the
 *  scripted agent (`support/hooks.ts`). */
export const CHAT_TOGGLE = selector(TESTID.chatToggle);
export const CHAT_PANEL = selector(TESTID.chatPanel);
export const CHAT_PILL = selector(TESTID.chatPill);
export const CHAT_STRIP = selector(TESTID.chatStrip);
export const CHAT_RESIZE = selector(TESTID.chatResize);
export const CHAT_SHEET = selector(TESTID.chatSheet);
export const CHAT_SHEET_SCRIM = selector(TESTID.chatSheetScrim);
export const CHAT_SHEET_HANDLE = selector(TESTID.chatSheetHandle);
export const PALETTE = selector(TESTID.palette);
export const PALETTE_ITEM = selector(TESTID.paletteItem);
export const PALETTE_ASK_ERROR = selector(TESTID.paletteAskError);
export const CHAT_TITLE = selector(TESTID.chatTitle);
export const CHAT_WORKING = selector(TESTID.chatWorking);
export const CHAT_MODEL = selector(TESTID.chatModel);
export const CHAT_SESSIONS = selector(TESTID.chatSessions);
export const CHAT_SESSION = selector(TESTID.chatSession);
export const CHAT_TRANSCRIPT = selector(TESTID.chatTranscript);
export const CHAT_NO_AGENT = selector(TESTID.chatNoAgent);
export const CHAT_ENTRY = selector(TESTID.chatEntry);
export const CHAT_NEW = selector(TESTID.chatNew);
export const CHAT_ENTRY_STREAMING =
  `${selector(TESTID.chatEntry)}[data-kind="agent"][data-streaming="true"]`;
export const CHAT_TOOL = selector(TESTID.chatTool);
export const CHAT_TOOL_DETAIL = selector(TESTID.chatToolDetail);
export const CHAT_TOOL_PROGRESS = selector(TESTID.chatToolProgress);
export const CHAT_TOOL_LOCATIONS = selector(TESTID.chatToolLocations);
export const CHAT_REFUSAL = selector(TESTID.chatRefusal);
export const CHAT_ASK = selector(TESTID.chatAsk);
export const CHAT_ASK_CHOICE = selector(TESTID.chatAskChoice);
export const CHAT_ASK_TEXT = selector(TESTID.chatAskText);
export const CHAT_ASK_SUBMIT = selector(TESTID.chatAskSubmit);
export const CHAT_ASK_DISMISS = selector(TESTID.chatAskDismiss);
export const CHAT_ASK_OUTCOME = selector(TESTID.chatAskOutcome);
export const CHAT_INPUT = selector(TESTID.chatInput);
export const CHAT_QUEUED = selector(TESTID.chatQueued);
export const CHAT_WAITING = selector(TESTID.chatWaiting);
export const CHAT_SEND = selector(TESTID.chatSend);
export const CHAT_CANCEL = selector(TESTID.chatCancel);
export const CHAT_SLASH_COMMAND = selector(TESTID.chatSlashCommand);
/** A picture on a message — pending in the composer, or sent, on the row. Its
 *  `data-name` is the file name, which is the only thing about it every tab
 *  agrees on; the preview is drawn ONLY by the tab that has the Blob. */
export const CHAT_ATTACHMENT = selector(TESTID.chatAttachment);
export const CHAT_ATTACHMENT_PREVIEW = selector(TESTID.chatAttachmentPreview);

/** The app has finished its first render when it has committed to one of its
 *  three shapes: a docked header (the set loaded and the directory column is
 *  present), the error view (it did not), or the fault card (the client threw
 *  while drawing). Waiting on any — rather than on the one the scenario
 *  expects — means a broken-set regression fails with "expected a tree, found
 *  the error view for house.jsonl:3" instead of a bare 30-second timeout.
 *
 *  The FAULT is the third for exactly that reason and no other: it is the one
 *  shape no scenario but `the_client_breaks.feature` ever wants, so leaving it
 *  out is how every other scenario would meet a client bug — as a timeout
 *  naming a selector, with nothing about the fault anywhere near it. `open()`
 *  quotes the card instead.
 *
 *  The HEADER's `data-layout="docked"`, not the sidebar nav. Below 48rem the
 *  directory sheet starts shut and the nav is a zero-size host (no border, no
 *  body), so waiting on the sidebar's box would either time out or need a ghost
 *  1px rule to keep Playwright's `visible` happy. The header is always a real
 *  box once the set is on screen, and `docked` is exactly "a directory is
 *  present". Settle waits for `visible` so a render that never gets a box is
 *  red rather than a silent pass on an attached but empty node. */
export const SETTLED_SELECTOR =
  `${APP_HEADER}[data-layout="docked"], ${ERROR_VIEW}, ${FAULT}`;

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

/** A laid-out box, in CSS pixels — what `boundingBox`/`getBoundingClientRect`
 *  both answer with. */
export interface Box {
  readonly x: number;
  readonly y: number;
  readonly width: number;
  readonly height: number;
}

export class OlaiWorld extends World {
  browser!: Browser;
  context!: BrowserContext;
  page!: Page;

  /** Uncaught page errors and `console.error` output, collected for the whole
   *  scenario by the `Before` hook. A feature asserts on this explicitly — a
   *  silent client-side exception behind a green UI assertion is exactly the
   *  bug an e2e suite exists to catch. */
  errors: string[] = [];

  /** Every URL the page has asked for, in order, collected by the same hook.
   *  Two questions are asked of it and they are different questions: whether
   *  anything left this server (`offSite`), and whether a particular gesture
   *  reached the network at all (`watchRequests`). One listener, because two
   *  recordings of one fact can only ever disagree. */
  requests: string[] = [];

  /** How far down the page a scenario deliberately scrolled, so a later step
   *  can claim the page came back to exactly there. A number the SCENARIO
   *  chose to remember rather than one written down here: how tall a page is
   *  depends on the fixture, the window and the stylesheet, and a step that
   *  asserted a pixel count would be asserting on all three. */
  scrolledTo?: number;

  /** Which fixture corpus this scenario's server is serving, from its
   *  `@corpus:<name>` or `@scratch:<name>` tag. See `support/hooks.ts`. */
  corpus!: string;
  /** Whether this scenario's agent has stored conversations (`@agent-stored`),
   *  so a restart adopts one rather than opening a fresh session. Carried on
   *  the world because a restart mid-scenario has to spawn the SAME shape of
   *  server the first boot had. */
  storedSessions = false;
  /** Whether this scenario's server has an agent at all — false for
   *  `@no-agent`, which is how the panel's no-agent state is reached. Carried
   *  for the same reason: a restart has to reproduce the first boot. */
  hasAgent = true;
  /** Whether this scenario's host is running kolu (`@kolu`), so its sessions
   *  are handed kolu's terminals as well as olai's own tools. Carried for the
   *  same reason again: a restart has to reproduce the first boot. */
  hasKolu = false;
  /** Which git situation this scenario's server was started into (`@git:…`),
   *  or `undefined` for the `--no-commit` every other scenario runs with.
   *  Carried for the same reason as the three above: a restart mid-scenario has
   *  to reproduce the first boot, and this one decides both the argv and what
   *  the served directory IS. */
  gitMode?: GitMode;
  /** The URL that corpus's server answers on; also the context's `baseURL`. */
  baseUrl!: string;

  /** The directory being served, for a `@scratch:` scenario — a private copy
   *  of the corpus that this scenario is allowed to EDIT while the server
   *  watches it. Undefined for the shared corpora, which are the tracked
   *  fixtures and must not be written to. */
  served?: string;
  /** The server process a `@scratch:` scenario owns, killed in `After`. */
  ownServer?: ChildProcess;
  /** A coding agent in a terminal, for the scenarios about the tool surface
   *  olai does not own the client of: `olai mcp` over the same directory the
   *  page is watching. Killed in `After` beside the server. */
  terminalAgent?: TerminalAgent;
  /** The tool names that agent was offered, and the last tool RESULT it got.
   *  Both are read by later steps than the one that provoked them, which is
   *  what makes them the world's rather than a module's — a step file holding
   *  them would share them across scenarios. */
  toolsOffered: string[] = [];
  toolAnswer?: Record<string, unknown>;
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

  /** Open the app and wait for it to commit to a shape.
   *
   *  One of those shapes is the client having thrown, and no scenario that
   *  came through here wanted it — so it is reported HERE, with the card's own
   *  text, rather than left to fail as a timeout on whatever element the next
   *  step was looking for. The one feature that does want it opens the page
   *  itself (`step_definitions/fault_steps.ts`). */
  async open(path = "/"): Promise<void> {
    await this.settle(path);
    const fault = this.page.locator(FAULT_DETAIL);
    if ((await fault.count()) > 0) {
      throw new Error(
        `the client threw while drawing ${path}, so the app is a fault card:\n` +
          oneLine(await fault.innerText()),
      );
    }
  }

  /** Go to a path and wait for the app to commit to one of its shapes — the
   *  whole of the opening protocol except the verdict on which shape it is.
   *  Its own method because the ONE feature that wants a fault card
   *  (`step_definitions/fault_steps.ts`) needs everything here and none of the
   *  rejection above; a second copy of this over there is how the burger
   *  regression that `SETTLED_SELECTOR` documents would be re-learnt. */
  async settle(path = "/"): Promise<void> {
    await this.page.goto(path);
    // `visible`: a node that exists but never gets a box is exactly the class
    // of layout defect settle is meant to catch. SETTLED_SELECTOR keys on the
    // docked header (always a real box when the set loaded), the error view,
    // or the fault card — not on the shut phone sheet's empty nav.
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

  /**
   * Make the sidebar's contents reachable, wherever the viewport put them.
   *
   * Below 48rem they are behind a burger and start collapsed, so a step that
   * clicks an outline, a document or a day has to open it first. Above it
   * there is no burger and this does nothing — which is why it is one call at
   * the top of those steps rather than a `@phone` branch inside each.
   *
   * Takes a PAGE, defaulting to the scenario's, because a second tab of the
   * same browser is still a browser at whatever width the context has (see the
   * cross-tab theme scenario): the rule is about the viewport, not about which
   * document is in front.
   */
  async showSidebar(page: Page = this.page): Promise<void> {
    const burger = page.locator(SIDEBAR_TOGGLE);
    if (!(await burger.isVisible())) return;
    if ((await burger.getAttribute("data-open")) === "true") return;
    await burger.click();
    await page
      .locator(SIDEBAR_BODY)
      .waitFor({ state: "visible", timeout: POLL_TIMEOUT });
  }

  /** One sidebar document entry, by the path it stands for. */
  documentLink(file: string): Locator {
    return this.page.locator(`${DOCUMENT_LINK}[data-file="${file}"]`);
  }

  /** The rendered document on screen — its own page, or the one drawn inline
   *  under a zoomed node. Both are the same component and the same pipeline,
   *  so a step says "the document" and means whichever is there. Here rather
   *  than in a step file because two of them now ask (`document_steps.ts`,
   *  `toc_steps.ts`), and `.first()` being the right answer is one decision. */
  documentBody(): Locator {
    return this.page.locator(DOCUMENT_BODY).first();
  }

  /** One folder in the sidebar's file tree, by its root-relative path. */
  fileDir(path: string): Locator {
    return this.page.locator(`${FILE_DIR}[data-path="${path}"]`);
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

  /** A node's OWN control. `.first()` is the node's own: a descendant's
   *  matches inside the scope too, and the node's own is rendered before any
   *  child's. */
  within(id: string, control: string): Locator {
    return this.node(id).locator(control).first();
  }

  /** Press something, and let the render settle.
   *
   *  The gesture is a parameter because it is the only thing a phone scenario
   *  changes: a tap is a `touchstart`/`touchend` pair on a context with no
   *  mouse, and finding out that a control is reachable without one is the
   *  whole point of tapping it. Everything around it — waiting for the thing
   *  to be visible, waiting out the frame the click schedules — is the same
   *  either way, and was three copies before it was a parameter. */
  async press(target: Locator, gesture: "click" | "tap" = "click"): Promise<void> {
    await target.waitFor({ state: "visible", timeout: POLL_TIMEOUT });
    await target[gesture]();
    await this.waitForFrame();
  }

  /** Click a node's own control. */
  async clickWithin(id: string, control: string): Promise<void> {
    await this.press(this.within(id, control));
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

  /** The other half of {@link expectAttribute}: wait for something to carry
   *  that attribute NOT AT ALL. Absence is an answer a page gives — a node
   *  with no status is a bullet rather than an unfinished task — and it is
   *  waited for the same way, by a selector that only matches once the
   *  attribute is gone, so it retries across the render that removes it. */
  async expectAttributeAbsent(
    selector: string,
    attribute: string,
    what: string,
    timeout = POLL_TIMEOUT,
  ): Promise<void> {
    try {
      await this.page
        .locator(`${selector}:not([${attribute}])`)
        .first()
        .waitFor({ state: "attached", timeout });
    } catch {
      const actual = await this.page
        .locator(selector)
        .first()
        .getAttribute(attribute)
        .catch(() => null);
      throw new Error(
        `expected ${what} to carry no ${attribute}, but it is ` +
          `${actual === null ? "absent from the page" : `"${actual}"`}`,
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

  /** What one served outline HOLDS, as the records on disk — the read half of
   *  `writeServed`, and here for the same reason: everything that touches the
   *  served directory goes through `scratch()`, so a scenario reading (or
   *  writing) the tracked fixtures is not a thing that can happen quietly. */
  servedNodes(file: string): ReadonlyArray<Record<string, unknown>> {
    return fs
      .readFileSync(path.join(this.scratch(), file), "utf8")
      .split("\n")
      .filter((line) => line.trim() !== "")
      .map((line) => JSON.parse(line) as Record<string, unknown>);
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

  /** Where something is on screen, and how big.
   *
   *  The one measurement these features take, and they take it for one reason:
   *  a target a finger has to hit is a SIZE, and no attribute can carry it —
   *  it is the sum of a font, a padding and a breakpoint, so the only honest
   *  way to ask is to measure what the browser laid out. An element that is
   *  not there, or is not laid out at all, has no box, and that is a different
   *  failure from a box that is too small. */
  async box(locator: Locator, what: string): Promise<Box> {
    await locator.waitFor({ state: "visible", timeout: POLL_TIMEOUT });
    const box = await locator.boundingBox();
    if (box === null) throw new Error(`${what} is not laid out, so it has no box`);
    return box;
  }

  /** Every match, measured — in ONE round trip.
   *
   *  A step that asks "is every one of these big enough" asks about ten or
   *  thirty elements, and asking Playwright for each box in turn is two
   *  blocking round trips per element. `evaluateAll` reads them all in a
   *  single pass of the page's own layout, which is also the only pass: the
   *  rects come from one flush rather than one per element. */
  async boxes(locator: Locator, what: string): Promise<ReadonlyArray<Box>> {
    await locator.first().waitFor({ state: "visible", timeout: POLL_TIMEOUT });
    const boxes = await locator.evaluateAll((elements) =>
      elements.map((element) => {
        const rect = element.getBoundingClientRect();
        return { x: rect.x, y: rect.y, width: rect.width, height: rect.height };
      }),
    );
    if (boxes.length === 0) throw new Error(`no ${what} is on screen to measure`);
    return boxes;
  }

  /** Ask the server for something the PAGE does not render: the manifest, an
   *  icon. Through the browser context, so it goes to the same origin with the
   *  same base URL the page has.
   *
   *  The body comes back as BYTES. Half of what this fetches is PNG, and
   *  decoding 120KB of it as UTF-8 to find out that it is not empty would be
   *  the assertion paying for a string nothing reads. */
  async fetch(path: string): Promise<{
    readonly status: number;
    readonly contentType: string;
    readonly body: Buffer;
  }> {
    const response = await this.page.request.get(path);
    return {
      status: response.status(),
      contentType: response.headers()["content-type"] ?? "",
      body: await response.body(),
    };
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

  /** The paper the page was painted in before a theme was picked. The only
   *  colour any scenario holds on to, and it is compared against itself: what
   *  a palette's paper IS is a design decision, and that it CHANGED is the
   *  claim. */
  paperBefore?: string;

  /** The URLs that left this server. Normally empty and it must stay that way:
   *  the bundle, the stylesheet and the syntax highlighter are all shipped by
   *  the server someone pointed at their own outlines, and a request to
   *  anywhere else is a page telling a third party what is being read.
   *  `data:` is not a request to anywhere. */
  offSite(): ReadonlyArray<string> {
    return this.requests.filter(
      (url) => !url.startsWith(this.baseUrl) && !url.startsWith("data:"),
    );
  }

  /** Where in `requests` a scenario started watching, or `undefined` while
   *  none is. */
  private askedFrom?: number;

  /** Start watching what the page asks for, so a later step can claim that a
   *  gesture reached the network — or did not. A MARK into the one recording
   *  rather than a second listener. */
  watchRequests(): void {
    this.askedFrom = this.requests.length;
  }

  /** What it has asked for since, or the diagnostic for a step that forgot to
   *  start watching — an empty list would otherwise read as a pass. */
  requestsWatched(): ReadonlyArray<string> {
    if (this.askedFrom === undefined) {
      throw new Error(
        "nothing is watching what the page asks for; a step has to start " +
          "watching before the gesture it is making a claim about",
      );
    }
    return this.requests.slice(this.askedFrom);
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
