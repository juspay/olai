import type { AnyTestId as TestId } from "@olai/ui-primitives/testids.ts"
import { TESTID } from "@olai/bundle/testids"
import * as assert from "node:assert";
import { execFileSync, type ChildProcess } from "node:child_process";
import * as fs from "node:fs";
import type { Server } from "node:net";
import * as path from "node:path";
import * as os from "node:os";

import { LONG_PRESS_MS, selector } from "@olai/web/testlib"
import { PLUGIN_TESTID } from "@olai/bundle/testids";
import { TESTID as KIND_OUTLINES } from "olai-plugin-outlines/testids";
import { TESTID as KIND_MARKDOWN } from "olai-plugin-markdown/testids";
import { TESTID as KIND_HYPERTEXT } from "olai-plugin-hypertext/testids";
import { TESTID as KIND_CSV } from "olai-plugin-csv/testids";
import { TESTID as KIND_IMAGE } from "olai-plugin-image/testids";
import { TESTID as KIND_PDF } from "olai-plugin-pdf/testids";
const ROW_TESTID = {
  "outline-olai": KIND_OUTLINES.outlineLink, markdown: KIND_MARKDOWN.documentLink,
  hypertext: KIND_HYPERTEXT.hypertextLink, csv: KIND_CSV.csvLink,
  image: KIND_IMAGE.imageLink, pdf: KIND_PDF.pdfLink,
};
import { makeReferrerWays } from "@olai/markdown-ui/ReferrersSection.tsx";
import { listenHeaderProxy, type HeaderProxy } from "./headerProxy.ts";
import type { LivePadi } from "olai-plugin-kolu/appliance/testlib";
import type { LiveOdu } from "olai-plugin-odu/appliance/testlib";
import type { FakeGoogleByName, FakeHimalayaByName } from "olai-plugin-mail/appliance/testlib";
import {
  setDefaultTimeout,
  setWorldConstructor,
  World,
} from "@cucumber/cucumber";
import type {
  Browser,
  BrowserContext,
  CDPSession,
  Locator,
  Page,
  Route,
} from "playwright";

import type { TerminalAgent } from "./mcp.ts";
import type { ScratchShare } from "./scratch.ts";
import { attr } from "./selectors.ts";

const OUTAGE_NOISE = (error: string): boolean =>
  error === "console.error: Failed to load resource: net::ERR_INTERNET_DISCONNECTED" ||
  (error.startsWith("console.error: WebSocket connection to 'ws://127.0.0.1:") &&
    (error.endsWith("failed: Error in connection establishment: net::ERR_INTERNET_DISCONNECTED") ||
      error.endsWith("failed: Error in connection establishment: net::ERR_CONNECTION_REFUSED") ||
      error.endsWith("failed: Error during WebSocket handshake: net::ERR_CONNECTION_RESET")))

export const placeOf = (url: URL): string => url.pathname + url.hash;

export const addressOf = (url: URL): string =>
  url.pathname + url.search + url.hash;

export const POLL_TIMEOUT = 15_000;

const LONG_PRESS_MARGIN_MS = 300;

const FLICK_PX = 150;
const FLICK_STEPS = 10;

interface Point {
  readonly x: number;
  readonly y: number;
}

export const HYDRATION_TIMEOUT = 30_000;

export const BACKSTOP_TIMEOUT = 90_000;

export const STEER_DEADLINE_TIMEOUT = 45_000;

export const QUIET_WINDOW_TIMEOUT = 40_000;

export const PAST_QUIET_WINDOW = 22_000;

export const SERVER_START_TIMEOUT = HYDRATION_TIMEOUT;

const PLAIN_PROBE = /^[\x20-\x21\x23-\x5B\x5D-\x7E]*$/;

const STEP_GUARD = 10_000;
setDefaultTimeout(Math.max(POLL_TIMEOUT, HYDRATION_TIMEOUT) + STEP_GUARD);

export const BACKSTOP_STEP_TIMEOUT = BACKSTOP_TIMEOUT + STEP_GUARD;

export const STEER_DEADLINE_STEP_TIMEOUT = STEER_DEADLINE_TIMEOUT + STEP_GUARD;

export const QUIET_WINDOW_STEP_TIMEOUT = QUIET_WINDOW_TIMEOUT + STEP_GUARD;

export const SCENARIO_SETUP_TIMEOUT = SERVER_START_TIMEOUT + STEP_GUARD;

export const AFTER_SHARE_TIMEOUT = SERVER_START_TIMEOUT * 2 + STEP_GUARD;

export const ROOT = "#root";

export const rowsOfKind = (kind: string): string => {
  const testid = (ROW_TESTID as Record<string, TestId | undefined>)[kind];
  if (testid === undefined) {
    throw new Error(
      `no served file is a "${kind}" — the kinds are ${Object.keys(ROW_TESTID).join(", ")}`,
    );
  }
  return selector(testid);
};

export type GitMode = "repo" | "none" | "broken";
export const APP_HEADER = selector(TESTID.appHeader);
export const WORDMARK = `${APP_HEADER} h1`;
export const SIDEBAR = selector(TESTID.sidebar);
export const SIDEBAR_TOGGLE = selector(TESTID.sidebarToggle);
export const SIDEBAR_BODY = selector(TESTID.sidebarBody);
export const SIDEBAR_SCRIM = selector(TESTID.sidebarScrim);
export const SIDEBAR_COLLAPSE = selector(TESTID.sidebarCollapse);
export const SIDEBAR_EXPAND = selector(TESTID.sidebarExpand);
export const SIDEBAR_RAIL = selector(TESTID.sidebarRail);
export const RAIL_OUTLINES = selector(TESTID.railOutlines);
export const RAIL_DOCS = selector(TESTID.railDocs);
export const SIDEBAR_RESIZE = selector(TESTID.sidebarResize);
export const OUTLINE_LIST = selector(TESTID.outlineList);
export const OUTLINE_LINK = selector(TESTID.outlineLink);
export const FILE_DIR = selector(TESTID.fileDir);
export const FILE_DIR_TOGGLE = selector(TESTID.fileDirToggle);
export const FILE_GLYPH = selector(TESTID.fileGlyph);
export const DOCUMENT_LINK = selector(TESTID.documentLink);
export const HYPERTEXT_LINK = selector(TESTID.hypertextLink);
export const IMAGE_VIEW = selector(TESTID.imageView);
export const PDF_EMBED = selector(TESTID.pdfEmbed);
export const BODY_REFUSED = selector(TESTID.bodyRefused);
export const DOCUMENT_PAGE = selector(TESTID.documentPage);
export const DOCUMENT_BODY = selector(TESTID.documentBody);
export const DOCUMENT_EDIT = selector(TESTID.documentEdit);
export const HEADINGS = "h1, h2, h3, h4, h5, h6";
export const BLOCKED = selector(TESTID.blocked);
export const TIP = selector(TESTID.tip);
export const SEE_REFS = selector(TESTID.seeRefs);

export const DOCUMENT_REFERRERS = selector(TESTID.documentReferrers);
export const rowReads = async (
  world: OlaiWorld,
  row: Locator,
  titles: string,
  what: string,
): Promise<void> => {
  await world.waitUntil(
    async () =>
      (await row.count()) > 0 &&
      (await row.locator(NODE_REF).allInnerTexts()).map(oneLine).join(", ") === titles,
    `${what} to read ${JSON.stringify(titles)}`,
  );
};

export const detailsOpen = async (locator: Locator): Promise<boolean> =>
  await locator.first().evaluate((el) => (el as HTMLDetailsElement).open);

const REFERRING_ROWS = makeReferrerWays({
  see: KIND_OUTLINES.backlinkSeeRefs,
  mention: KIND_OUTLINES.backlinkMentionRefs,
  link: KIND_OUTLINES.backlinkLinkRefs,
})
export const backlinkRow = (label: string): string => {
  const drawn = REFERRING_ROWS.find((one) => one.label === label);
  if (drawn === undefined) {
    throw new Error(`the referenced-by section draws no \`${label}\` row`);
  }
  return selector(drawn.refs);
};

export const EDGE_HELD = selector(TESTID.edgeHeld);

export const NODE_REF = selector(TESTID.nodeRef);
export const OUTLINE_TREE = selector(TESTID.outlineTree);
export const NODE = selector(TESTID.node);
export const NODE_TITLE = selector(TESTID.nodeTitle);
export const LANDING_SAID = selector(TESTID.landingSaid);
export const TAG = selector(TESTID.tag);
export const HIT = selector(TESTID.hit);
export const DESC_HIT = selector(TESTID.descHit);
export const DATE = selector(TESTID.date);
export const FILTER_BAR = selector(TESTID.filterBar);
export const FILTER_INPUT = selector(TESTID.filterInput);
export const FILTER_COUNT = selector(TESTID.filterCount);
export const FILTER_CLEAR = selector(TESTID.filterClear);
export const FILTER_REFUSAL = selector(TESTID.filterRefusal);
export const PANE = selector(TESTID.pane);
export const PANE_RAIL = selector(TESTID.paneRail);
export const PANE_HEADER = selector(TESTID.paneHeader);
export const PANE_CLOSE = selector(TESTID.paneClose);
export const PANE_RESIZE = selector(TESTID.paneResize);
export const PANE_TABS = selector(TESTID.paneTabs);
export const PANE_TAB = selector(TESTID.paneTab);
export const SEARCH_REFUSAL = selector(TESTID.searchRefusal);
export const SEARCH_COUNT = selector(TESTID.searchCount);
export const REPEAT = selector(TESTID.repeat);
export const REPEAT_PICKER = selector(TESTID.repeatPicker);
export const REPEAT_PICKER_RULE = selector(TESTID.repeatPickerRule);
export const REPEAT_PICKER_SET = selector(TESTID.repeatPickerSet);
export const REPEAT_PICKER_SAID = selector(TESTID.repeatPickerSaid);
export const REPEAT_PICKER_CANCEL = selector(TESTID.repeatPickerCancel);
export const PROPS = selector(TESTID.props);
export const PROP = selector(TESTID.prop);
export const PROP_VALUE = selector(TESTID.propValue);
export const PROP_EDIT = selector(TESTID.propEdit);
export const PROP_EDIT_KEY = selector(TESTID.propEditKey);
export const PROGRESS = selector(TESTID.progress);
export const TOOK = selector(TESTID.took);
export const DESC = selector(TESTID.desc);
export const NOTE_MARK = selector(TESTID.noteMark);
export const FOLDED_DONE = selector(TESTID.foldedDone);
export const TOGGLE = selector(TESTID.toggle);
export const NODE_MENU = selector(TESTID.nodeMenu);
export const NODE_MENU_PANEL = selector(TESTID.nodeMenuPanel);
export const NODE_MENU_ITEM = selector(TESTID.nodeMenuItem);
export const NODE_GUTTER = selector(TESTID.nodeGutter);
export const ZOOM = selector(TESTID.zoom);
export const TITLE_EDITOR = selector(TESTID.titleEditor);
export const DESC_EDITOR = selector(TESTID.descEditor);
export const CARET_EDITOR = `${TITLE_EDITOR}, ${DESC_EDITOR}`;
export const NEW_ROW = selector(TESTID.newRow);
export const COMPLETIONS = selector(TESTID.completions);
export const COMPLETION_ITEM = selector(TESTID.completionItem);
export const EDIT_REFUSAL = selector(TESTID.editRefusal);
export const UNDO_SAID = selector(TESTID.undoSaid);
export const DRAG_HANDLE = selector(TESTID.dragHandle);
export const DROP_LINE = selector(TESTID.dropLine);
export const SELECTION_SAID = selector(TESTID.selectionSaid);
export const ZOOM_TITLE = selector(TESTID.zoomTitle);
export const EMPTY_UNDER = selector(TESTID.emptyUnder);
export const BREADCRUMBS = selector(TESTID.breadcrumbs);
export const CRUMB = selector(TESTID.crumb);
export const CALENDAR = selector(PLUGIN_TESTID.calendar);
export const CALENDAR_DAY = selector(PLUGIN_TESTID.calendarDay);
export const CALENDAR_PREV = selector(PLUGIN_TESTID.calendarPrev);
export const CALENDAR_NEXT = selector(PLUGIN_TESTID.calendarNext);
export const CALENDAR_ROW = selector(PLUGIN_TESTID.calendarRow);
export const CALENDAR_TODAY = selector(PLUGIN_TESTID.calendarToday);
export const CALENDAR_TOGGLE = selector(PLUGIN_TESTID.calendarToggle);
export const DAY_PAGE = selector(PLUGIN_TESTID.dayPage);
export const DAY_MINT = selector(PLUGIN_TESTID.dayMint);
export const DAY_MINT_SAID = selector(PLUGIN_TESTID.dayMintSaid);
export const DAY_GROUP = selector(PLUGIN_TESTID.dayGroup);
export const DAY_EMPTY = selector(PLUGIN_TESTID.dayEmpty);
export const AGENDA_LINK = selector(PLUGIN_TESTID.agendaLink);
export const PADI_PILL = selector(PLUGIN_TESTID.padi);
export const SPACES_PILL = selector(PLUGIN_TESTID.spaces);
export const PADI_FEED = selector(PLUGIN_TESTID.padiFeed);
export const PADI_FEED_FOOT = selector(PLUGIN_TESTID.padiFeedFoot);
export const PADI_FEED_WRENCH = selector(PLUGIN_TESTID.padiFeedWrench);
export const TRASH_LINK = selector(TESTID.trashLink);
export const NOTHING = selector(TESTID.nothing);

const REGEXP_SPECIAL = /[.*+?^${}()|[\]\\]/g;

export const emptyPage = (page: Page, line?: string) => {
  const shown = page.locator(NOTHING).locator("visible=true");
  const exactly = (words: string): RegExp =>
    new RegExp("^\\s*" + words.replace(REGEXP_SPECIAL, "\\$&") + "\\s*$");
  const said = (line === undefined ? shown : shown.filter({ hasText: exactly(line) })).first();
  return {
    said,
    lines: said.locator("xpath=../p"),
    detail: said.locator("xpath=following-sibling::p"),
    block: said.locator("xpath=../.."),
  };
};

export const NOT_FOUND = selector(TESTID.notFound);
export const ERROR_VIEW = selector(TESTID.errorView);
export const ERROR_ROW = selector(TESTID.error);
export const OUTLINE_FAILURE = selector(TESTID.outlineFailure);
export const CONNECTION = selector(TESTID.connection);
export const HEALTH = selector(TESTID.health);
export const HEALTH_PANEL = selector(TESTID.healthPanel);
export const APP_CHROME = selector(TESTID.appChrome);

export const APP_CHROME_CONTROLS: ReadonlyArray<string> = [
  PLUGIN_TESTID.headerSearch,
  PLUGIN_TESTID.headerSearchOpen,
  TESTID.health,
  TESTID.prefsTrigger,
  PLUGIN_TESTID.identity,
];

export const RETIRED_GIT_READOUT = "[data-git]";
export const OFFLINE = selector(TESTID.offline);
export const RELOAD = selector(TESTID.reload);
export const FAULT = selector(TESTID.fault);
export const FAULT_DETAIL = selector(TESTID.faultDetail);

export const PREFS_TRIGGER = selector(TESTID.prefsTrigger);
export const PREFS_PANEL = selector(TESTID.prefsPanel);
export const PLUGINS_TRIGGER = selector(TESTID.pluginsTrigger);
export const PLUGINS_PANEL = selector(TESTID.pluginsPanel);
export const PLUGINS_STARTED = selector(TESTID.pluginsStarted);
export const PLUGIN_SWITCH = selector(TESTID.pluginSwitch);
export const PLUGIN_GROUP = selector(TESTID.pluginGroup);
export const PLUGIN_CONFIRM = selector(TESTID.pluginConfirm);
export const PLUGIN_CONFIRM_OFF = selector(TESTID.pluginConfirmOff);
export const PLUGIN_CONFIRM_KEEP = selector(TESTID.pluginConfirmKeep);
export const PLUGINS_REFUSED = selector(TESTID.pluginsRefused);
export const PLUGIN_CONFIG = `:is(${selector(TESTID.pluginConfig)}, ${selector(TESTID.pluginKnob)})`;
export const PLUGINS_SOURCE = selector(TESTID.pluginsSource);
export const PLUGINS_APPROVE = selector(TESTID.pluginsApprove);
export const PLUGINS_APPROVE_ALWAYS = selector(TESTID.pluginsApproveAlways);
export const PLUGINS_MOVED = selector(TESTID.pluginsMoved);
export const PREFS_ROW = selector(TESTID.prefsRow);
export const PREFS_HINT = selector(TESTID.prefsHint);
export const PREFS_CHOICE = selector(TESTID.prefsChoice);
export const PREFS_SWITCH = selector(TESTID.prefsSwitch);
export const PREFS_VALUE = selector(TESTID.prefsValue);
export const PREFS_SCOPE = selector(TESTID.prefsScope);
export const PREFS_SET_BY = selector(TESTID.prefsSetBy);
export const COMMIT_RESUME = selector(PLUGIN_TESTID.commitResume);
export const THEME_CHIP = selector(TESTID.themeChip);
export const FONT_SELECT = selector(TESTID.fontSelect);

export const COMMIT_PILL = selector(PLUGIN_TESTID.commitPill);
export const UPTIME = selector(TESTID.uptime);
export const GIT_NEWS = selector(PLUGIN_TESTID.gitNews);
export const COMMIT_PANEL = selector(PLUGIN_TESTID.commitPanel);

export const CHAT_PANEL = selector(PLUGIN_TESTID.chatPanel);
export const FRONT_LANE = `${selector(PLUGIN_TESTID.lane)}[data-lane-front="true"], main[aria-label="Alternate layout fixture"]`;

export const PALETTE = selector(TESTID.palette);
export const PALETTE_ITEM = selector(TESTID.paletteItem);
export const PALETTE_LIST = selector(TESTID.paletteList);
export const PALETTE_ASK_ERROR = selector(TESTID.paletteAskError);
export const PALETTE_INPUT = selector(TESTID.paletteInput);
export const PALETTE_CAPTURE = selector(TESTID.paletteCapture);
export const PALETTE_CONFIRM = selector(TESTID.paletteConfirm);
export const PALETTE_SAID = selector(TESTID.paletteSaid);
export const PALETTE_MODAL = `dialog:has(${PALETTE})`;
export const SHORTCUTS = selector(TESTID.shortcuts);
export const HEADER_SEARCH = selector(PLUGIN_TESTID.headerSearch);
export const HEADER_SEARCH_OPEN = selector(PLUGIN_TESTID.headerSearchOpen);
export const HEADER_SEARCH_RESULTS = selector(PLUGIN_TESTID.headerSearchResults);
export const PIN_SHELF = selector(TESTID.pinShelf);

export const CHAT_ENTRY_STREAMING =
  `${selector(PLUGIN_TESTID.chatEntry)}[data-kind="agent"][data-streaming="true"]`;


export const CHAT_WAKE_QUERY = selector(PLUGIN_TESTID.chatWakeQuery);
export const CHAT_WAKE_FILE = selector(PLUGIN_TESTID.chatWakeFile);
export const CHAT_DIFF = selector(PLUGIN_TESTID.chatDiff);
export const CHAT_DIFF_LINE = selector(PLUGIN_TESTID.chatDiffLine);
export const CHAT_DIFF_GUTTER = selector(PLUGIN_TESTID.chatDiffGutter);
export const CHAT_DIFF_MARK = selector(PLUGIN_TESTID.chatDiffMark);
export const CHAT_DIFF_TEXT = selector(PLUGIN_TESTID.chatDiffText);
export const CHAT_DIFF_EXPAND = selector(PLUGIN_TESTID.chatDiffExpand);
export const CHAT_DIFF_WHOLESALE = selector(PLUGIN_TESTID.chatDiffWholesale);
export const CHAT_OUTLINE_DIFF = selector(PLUGIN_TESTID.chatOutlineDiff);
export const CHAT_OUTLINE_CHANGE = selector(PLUGIN_TESTID.chatOutlineChange);
export const OUTLINES_STORY = selector(PLUGIN_TESTID.outlinesStory);
export const OUTLINES_NUDGE = selector(PLUGIN_TESTID.outlinesNudge);
export const CHAT_REFUSAL = selector(PLUGIN_TESTID.chatRefusal);
export const CHAT_USAGE = selector(PLUGIN_TESTID.chatUsage);
export const CHAT_TROUBLE = selector(PLUGIN_TESTID.chatTrouble);
export const CHAT_ASK = selector(PLUGIN_TESTID.chatAsk);
export const CHAT_ASK_CHOICE = selector(PLUGIN_TESTID.chatAskChoice);
export const CHAT_ASK_TEXT = selector(PLUGIN_TESTID.chatAskText);
export const CHAT_ASK_SUBMIT = selector(PLUGIN_TESTID.chatAskSubmit);
export const CHAT_ASK_DISMISS = selector(PLUGIN_TESTID.chatAskDismiss);
export const CHAT_ASK_OUTCOME = selector(PLUGIN_TESTID.chatAskOutcome);
export const CHAT_GRIP = selector(PLUGIN_TESTID.chatGrip);
export const CHAT_INPUT = selector(PLUGIN_TESTID.chatInput);
export const CHAT_COMPLETION = selector(PLUGIN_TESTID.chatCompletion);
export const CHAT_COMPLETION_ROW = selector(PLUGIN_TESTID.chatCompletionRow);
export const CHAT_COMPLETION_SECTION = selector(PLUGIN_TESTID.chatCompletionSection);
export const CHAT_SAID = selector(PLUGIN_TESTID.chatSaid);
export const CHAT_MINE = selector(PLUGIN_TESTID.chatMine);
export const chatNodeRef = (id: string): string => `a[href="/#${encodeURIComponent(id)}"]`;
export const NODE_REF_ANY = `a[href^="/#"]`;

export const SETTLED_SELECTOR =
  `${APP_HEADER}[data-layout="docked"], ${ERROR_VIEW}, ${FAULT}`;

export const NO_RELOAD_MARK = "__olaiNoReloadMark";

export const oneLine = (text: string): string =>
  text.replace(/\s+/g, " ").trim();

export { attr } from "./selectors.ts";

export const nodeSelector = (id: string): string =>
  `${NODE}${attr("data-node-id", id)}`;

export const daySelector = (date: string): string =>
  `${CALENDAR_DAY}${attr("data-date", date)}`;

export const expectAbsent = async (
  world: OlaiWorld,
  present: string,
  absent: string,
  complaint: string,
): Promise<void> => {
  await world.page
    .locator(present)
    .first()
    .waitFor({ state: "visible", timeout: HYDRATION_TIMEOUT });
  assert.strictEqual(await world.page.locator(absent).count(), 0, complaint);
};

export const expectGone = async (
  world: OlaiWorld,
  selector: string,
  complaint: string,
): Promise<void> => {
  await world.page
    .locator(selector)
    .first()
    .waitFor({ state: "detached", timeout: POLL_TIMEOUT })
    .catch(() => undefined);
  assert.strictEqual(
    await world.page.locator(`${selector}:visible`).count(),
    0,
    complaint,
  );
};

export const drawn = async (found: Locator): Promise<Locator> => {
  await found
    .first()
    .waitFor({ state: "visible", timeout: POLL_TIMEOUT })
    .catch(() => undefined);
  return found;
};

export const expectDrawn = async (
  world: OlaiWorld,
  found: Locator,
  attribute: string,
  expected: string,
): Promise<void> => {
  const wanted = expected.split(",").map((one) => one.trim());
  const read = async (): Promise<ReadonlyArray<string | null>> =>
    await (await drawn(found)).evaluateAll(
      (all, name) => all.map((element) => element.getAttribute(name)),
      attribute,
    );
  await world.waitUntil(
    async () => JSON.stringify(await read()) === JSON.stringify(wanted),
    `the drawn ${attribute} list to be ${JSON.stringify(wanted)}`,
  ).catch(() => undefined);
  assert.deepStrictEqual(await read(), wanted);
};
export const expectBefore = async (
  world: OlaiWorld,
  found: Locator,
  attribute: string,
  first: string,
  second: string,
): Promise<void> => {
  await world.waitUntil(async () => {
    const drawn = await found.evaluateAll(
      (all, name) => all.map((element) => element.getAttribute(name)),
      attribute,
    );
    return drawn.indexOf(first) !== -1 &&
      drawn.indexOf(first) < drawn.indexOf(second);
  }, `"${first}" to be drawn above "${second}"`);
};

export const readable = (text: string): string => oneLine(text.replace(/#/g, ""));

interface Cover {
  readonly pressable: boolean;
  readonly offscreen: boolean;
  readonly pinned: boolean;
  readonly clearBy: number;
  readonly by: string;
  readonly control: string;
  readonly at: number;
  readonly furthest: number;
}

const coverOf = (target: Locator): Promise<Cover> =>
  target.evaluate((el) => {
    const named = (node: Element | null): string => {
      if (node === null) return "nothing";
      const held = node as HTMLElement;
      const testid = held.dataset?.testid;
      const key = held.dataset?.rowKey;
      const tag = node.tagName.toLowerCase();
      if (testid !== undefined) return `<${tag} data-testid="${testid}">`;
      if (key !== undefined) return `<${tag} data-row-key="${key}">`;
      return `<${tag}>`;
    };
    const at = Math.round(window.scrollY);
    const furthest = Math.max(
      0,
      Math.round(document.documentElement.scrollHeight - window.innerHeight),
    );
    const where = { at, furthest };
    const box = el.getBoundingClientRect();
    const hit = document.elementFromPoint(
      box.x + box.width / 2,
      box.y + box.height / 2,
    );
    if (hit === null) {
      return { ...where, pressable: false, offscreen: true, pinned: false, clearBy: 0, by: "nothing — the point is off the screen", control: named(el) };
    }
    if (hit === el || el.contains(hit) || hit.contains(el)) {
      return { ...where, pressable: true, offscreen: false, pinned: false, clearBy: 0, by: named(hit), control: named(el) };
    }
    let pinned: Element | null = null;
    for (let node: Element | null = hit; node !== null; node = node.parentElement) {
      if (getComputedStyle(node).position === "sticky") {
        pinned = node;
        break;
      }
    }
    const covered = { ...where, pressable: false, offscreen: false, by: named(hit), control: named(el) };
    if (pinned === null) return { ...covered, pinned: false, clearBy: 0 };
    const over = pinned.getBoundingClientRect();
    let top = over.top;
    let bottom = over.bottom;
    const x = box.x + box.width / 2;
    const bands = [...document.querySelectorAll("*")].flatMap((node) => {
      const style = getComputedStyle(node);
      if (style.position !== "sticky") return [];
      const edge = Number.parseFloat(style.top);
      const rect = node.getBoundingClientRect();
      return Number.isFinite(edge) && rect.top <= edge + 1 && rect.bottom > 0
        && rect.left <= x && rect.right >= x ? [rect] : [];
    }).sort((a, b) => a.top - b.top);
    for (const band of [...bands].reverse().concat(bands)) {
      if (band.bottom < top - 1 || band.top > bottom + 1) continue;
      top = Math.min(top, band.top);
      bottom = Math.max(bottom, band.bottom);
    }
    const down = bottom - box.top + 1;
    const up = box.bottom - top + 1;
    const roomToMoveDown = at;
    const roomToMoveUp = furthest - at;
    const canDown = roomToMoveDown >= down;
    const canUp = roomToMoveUp >= up;
    const clearBy = canDown && (!canUp || down <= up) ? -down : canUp ? up : 0;
    return { ...covered, pinned: true, clearBy, by: named(pinned) };
  });

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

  private proxied: Record<string, string> = {};
  private headerProxy?: HeaderProxy;

  async proxyInjects(name: string, value: string): Promise<void> {
    this.proxied = { ...this.proxied, [name]: value };
    if (this.headerProxy === undefined) {
      this.headerProxy = await listenHeaderProxy(
        this.baseUrl,
        () => this.proxied,
      );
      this.baseUrl = this.headerProxy.url;
    }
    await this.context.setExtraHTTPHeaders(this.proxied);
  }

  async closeHeaderProxy(): Promise<void> {
    const proxy = this.headerProxy;
    this.headerProxy = undefined;
    if (proxy !== undefined) await proxy.close();
  }

  errors: string[] = [];

  offlineFrom: number | undefined = undefined

  noteOutage(): void {
    this.offlineFrom = Math.min(this.offlineFrom ?? this.errors.length, this.errors.length);
  }

  pageErrors(): ReadonlyArray<string> {
    const from = this.offlineFrom;
    return from === undefined
      ? this.errors
      : this.errors.filter((error, index) => index < from || !OUTAGE_NOISE(error));
  }

  requests: string[] = [];

  refused: Array<{ readonly url: string; readonly why: string }> = [];

  socketFrames?: string[];

  socketAsks?: string[];

  socketCarried(text: string): boolean {
    return this.framesMatching(
      this.socketFrames,
      0,
      [text],
      "nothing recorded what the socket delivered; a scenario asking about " +
        "the wire has to carry the @wire tag",
    ).length > 0;
  }

  private wireFrom?: { readonly asked: number; readonly said: number };

  markWire(): void {
    if (this.socketAsks === undefined || this.socketFrames === undefined) {
      throw new Error(
        "nothing recorded this tab's socket; a scenario counting wire calls " +
          "has to carry the @wire tag",
      );
    }
    this.wireFrom = {
      asked: this.socketAsks.length,
      said: this.socketFrames.length,
    };
  }

  socketAskedSince(...probes: ReadonlyArray<string>): number {
    return this.framesMatching(
      this.socketAsks,
      this.wireFrom?.asked,
      probes,
      "nothing is counting what this tab asks the surface; a step has to " +
        "mark the wire (and the scenario carry @wire) before the gesture it " +
        "is making a claim about",
    ).length;
  }

  socketSaidSince(...probes: ReadonlyArray<string>): number {
    return this.framesMatching(
      this.socketFrames,
      this.wireFrom?.said,
      probes,
      "nothing is counting what this tab's socket delivered; a step has to " +
        "mark the wire (and the scenario carry @wire) before the gesture it " +
        "is making a claim about",
    ).length;
  }

  private framesMatching(
    frames: ReadonlyArray<string> | undefined,
    from: number | undefined,
    probes: ReadonlyArray<string>,
    unarmed: string,
  ): ReadonlyArray<string> {
    if (frames === undefined || from === undefined) throw new Error(unarmed);
    for (const probe of probes) {
      if (PLAIN_PROBE.test(probe)) continue;
      throw new Error(
        `${JSON.stringify(probe)} is not a probe this can look for: only plain ` +
          "printable ASCII without a quote or a backslash is certain to appear " +
          "in a raw frame verbatim, so anything else would be absent from the " +
          "recording whether or not the server sent it",
      );
    }
    return frames
      .slice(from)
      .filter((frame) => probes.every((probe) => frame.includes(probe)));
  }

  scrolledTo?: number;

  historyWas?: number;

  corpus!: string;

  heldChunks = new Map<string, Route[]>();
  storedSessions = false;
  fastNodeIdle = false;
  fastSleep = false;
  sleepOff = false;
  remindEvery: number | undefined = undefined;
  hasAgent = true;


  padiFleet: string | undefined = undefined;
  padi: LivePadi | undefined = undefined;
  oduFleet: string | undefined = undefined;
  odu: LiveOdu | undefined = undefined;
  mailHimalayaFleet: string | undefined = undefined;
  mailHimalaya: FakeHimalayaByName | undefined = undefined;
  mailGoogleFleet: string | undefined = undefined;
  mailGoogle: FakeGoogleByName | undefined = undefined;
  mailDoors = false;
  fakes: ReadonlyArray<string> = [];
  agentSearchPath?: string;
  voteFakes(fakes: ReadonlyArray<string>): void {
    this.fakes = fakes;
  }
  gitMode?: GitMode;
  gitPolicy: { commit?: string; push?: string } = {};
  selectedRows: string | undefined = undefined;
  rowsOn: string | undefined = undefined;
  rowsOff: string | undefined = undefined;

  avatarTemplate?: string;
  baseUrl!: string;

  served?: string;
  scratchShare?: ScratchShare;
  remote?: string;
  ownServer?: ChildProcess;
  portHold?: Server;
  terminalAgent?: TerminalAgent;
  toolAnswer?: Record<string, unknown>;
  resourceRead?: string;
  serverLog: { text: string } = { text: "" };
  notedListAsks: number | null = null;
  notedAgentStarts: number | null = null;

  async waitForFrame(): Promise<void> {
    await this.page.evaluate(
      () =>
        new Promise<void>((resolve) =>
          requestAnimationFrame(() => requestAnimationFrame(() => resolve())),
        ),
    );
  }

  async open(path = "/"): Promise<void> {
    await this.settle(path);
    const fault = this.page.locator(FAULT_DETAIL);
    if ((await fault.count()) > 0) {
      throw new Error(
        `the client threw while drawing ${path}, so the app is a fault card:\n` +
          oneLine(await fault.textContent() ?? ""),
      );
    }
    await this.page.locator(OFFLINE).waitFor({
      state: "hidden",
      timeout: HYDRATION_TIMEOUT,
    });
  }

  async settle(path = "/"): Promise<void> {
    await this.page.goto(new URL(path, this.baseUrl).href);
    await this.page
      .locator(SETTLED_SELECTOR)
      .first()
      .waitFor({ state: "visible", timeout: HYDRATION_TIMEOUT });
    await this.waitForFrame();
  }

  async openNode(id: string): Promise<void> {
    await this.open(`/zoom/#${encodeURIComponent(id)}`);
  }

  async openDayPage(date: string): Promise<void> {
    await this.open(`/d/${encodeURIComponent(date)}`);
  }

  async openAgenda(): Promise<void> {
    await this.open("/agenda");
  }

  async openDocument(file: string): Promise<void> {
    await this.open(`/${file.split("/").map(encodeURIComponent).join("/")}`);
  }

  async showSidebar(page: Page = this.page): Promise<void> {
    const burger = page.locator(SIDEBAR_TOGGLE);
    if (!(await burger.isVisible())) return;
    if ((await burger.getAttribute("data-open")) === "true") return;
    await burger.click();
    await page
      .locator(SIDEBAR_BODY)
      .waitFor({ state: "visible", timeout: POLL_TIMEOUT });
  }

  async openStatus(page: Page = this.page): Promise<void> {
    const dot = page.locator(HEALTH);
    if (!(await dot.isVisible())) return;
    const panel = page.locator(HEALTH_PANEL);
    if (await panel.isVisible()) return;
    await dot.click();
    await panel.waitFor({ state: "visible", timeout: POLL_TIMEOUT });
  }

  async readStatus<T>(read: () => Promise<T>): Promise<T> {
    const dot = this.page.locator(HEALTH);
    const panel = this.page.locator(HEALTH_PANEL);
    if (!(await dot.isVisible()) || (await panel.isVisible())) return read();
    await this.page.evaluate(() => {
      (window as unknown as { __olaiStatusFocus?: Element | null }).__olaiStatusFocus =
        document.activeElement;
    });
    await this.openStatus();
    try {
      return await read();
    } finally {
      if (await panel.isVisible()) await dot.click();
      await panel.waitFor({ state: "hidden", timeout: POLL_TIMEOUT }).catch(() => undefined);
      await this.page.evaluate(() => {
        const held = window as unknown as { __olaiStatusFocus?: Element | null };
        const was = held.__olaiStatusFocus;
        delete held.__olaiStatusFocus;
        if (was instanceof HTMLElement && was !== document.body && was.isConnected) was.focus();
      });
    }
  }

  async expandReference(): Promise<void> {
    await this.showSidebar();
    const toggle = this.page.getByTestId(TESTID.referenceToggle);
    await toggle.waitFor({ state: "visible", timeout: HYDRATION_TIMEOUT });
    if ((await toggle.getAttribute("aria-expanded")) !== "true") await toggle.click();
  }

  documentLink(file: string): Locator {
    return this.fileLink(`${attr("data-testid", TESTID.referenceList)} ${DOCUMENT_LINK}`, file);
  }

  hypertextLink(file: string): Locator {
    return this.fileLink(`${attr("data-testid", TESTID.referenceList)} ${HYPERTEXT_LINK}`, file);
  }

  kindRows(kind: string): Locator {
    return this.page.locator(rowsOfKind(kind));
  }

  kindLink(kind: string, file: string): Locator {
    return this.fileLink(rowsOfKind(kind), file);
  }

  fileLink(testid: string, file: string): Locator {
    return this.page.locator(`${testid}${attr("data-file", file)}`);
  }

  async expectListed(
    testid: string,
    wanted: ReadonlyArray<string>,
    what: string,
  ): Promise<void> {
    const links = this.page.locator(testid);
    await this.waitUntil(
      async () => (await links.count()) === wanted.length,
      `the sidebar to list ${wanted.length} ${what}`,
    );
    assert.deepStrictEqual(
      await links.evaluateAll((nodes) =>
        nodes.map((node) => node.getAttribute("data-file"))
      ),
      [...wanted],
    );
  }

  documentBody(): Locator {
    return this.frontLane().locator(DOCUMENT_BODY).first();
  }

  async rendersBold(where: Locator, text: string): Promise<void> {
    await this.waitUntil(
      async () =>
        (await where.locator("strong, b").allInnerTexts()).some(
          (value) => value.trim() === text,
        ),
      `${JSON.stringify(text)} to be rendered in bold`,
    );
  }

  fileDir(path: string): Locator {
    return this.page.locator(`${FILE_DIR}${attr("data-path", path)}`).first();
  }


  async openCalendar(page: Page = this.page): Promise<void> {
    if ((await page.locator(CALENDAR).count()) > 0) return;
    await this.showSidebar(page);
    const toggle = page.locator(CALENDAR_TOGGLE);
    await toggle.waitFor({ state: "visible", timeout: HYDRATION_TIMEOUT });
    if ((await toggle.getAttribute("aria-expanded")) !== "true") await toggle.click();
    await page.locator(CALENDAR).waitFor({ state: "visible", timeout: POLL_TIMEOUT });
  }

  calendarDay(date: string): Locator {
    return this.page.locator(daySelector(date));
  }

  place(): string {
    return placeOf(new URL(this.page.url()));
  }

  address(): string {
    return addressOf(new URL(this.page.url()));
  }

  outlineLink(file: string): Locator {
    return this.fileLink(OUTLINE_LINK, file);
  }

  frontLane(): Locator { return this.page.locator(FRONT_LANE); }

  pane(index: number): Locator {
    return this.frontLane().locator(`${PANE}${attr("data-pane", String(index))}`);
  }

  everywhere(): Locator {
    return this.frontLane();
  }

  private readonly activeAgents = new WeakMap<Page, string>();
  private readonly menuNodes = new WeakMap<Page, string>();
  get activeAgent(): string | null { return this.activeAgents.get(this.page) ?? null; }
  set activeAgent(node: string | null) { if (node === null) this.activeAgents.delete(this.page); else this.activeAgents.set(this.page, node); }
  get menuNode(): string | null { return this.menuNodes.get(this.page) ?? null; }
  set menuNode(node: string | null) { if (node === null) this.menuNodes.delete(this.page); else this.menuNodes.set(this.page, node); }
  private chatHosts(...hosts: ReadonlyArray<string>): string {
    assert.ok(this.activeAgent, "select a node agent before addressing its conversation");
    const of = attr("data-agent", this.nodeId(this.activeAgent));
    return `:is(${FRONT_LANE}) :is(${hosts.join(", ")})${of}`;
  }
  private conversationScoped(selector: string): boolean {
    return selector.includes(FRONT_LANE);
  }
  chatSelector(control: string): string {
    return `${this.chatHosts(selector(PLUGIN_TESTID.agentFold), selector(PLUGIN_TESTID.agentPageHead), selector(PLUGIN_TESTID.agentPageFoot))} :is(${control})`;
  }
  chat(control: string, options?: Parameters<Page["locator"]>[1]): Locator { return this.page.locator(this.chatSelector(control), options); }
  chatLine(): Locator {
    return this.page.locator(this.chatHosts(selector(PLUGIN_TESTID.agentFold), selector(PLUGIN_TESTID.agentPageHead)));
  }
  chatRoot(): Locator {
    return this.page.locator(this.chatHosts(selector(PLUGIN_TESTID.agentFold), selector(PLUGIN_TESTID.agentPageFoot)));
  }
  readonly nodeNames = new Map<string, string>();
  nodeId(name: string): string { return this.nodeNames.get(name) ?? name; }

  node(id: string): Locator {
    return this.frontLane().locator(nodeSelector(this.nodeId(id)));
  }

  visibleNode(id: string): Locator {
    return this.frontLane().locator(`${nodeSelector(this.nodeId(id))}:visible`);
  }

  crumbs(): Locator {
    return this.frontLane().locator(`${BREADCRUMBS} ${CRUMB}`);
  }

  within(id: string, control: string): Locator {
    return this.visibleNode(id).locator(control).first();
  }

  pluginsPanel(): Locator {
    return this.page.locator(`${PLUGINS_PANEL}:visible`);
  }

  async showPlugins(): Promise<Locator> {
    const panel = this.pluginsPanel();
    if ((await panel.count()) > 0) return panel;
    const trigger = this.page.locator(PLUGINS_TRIGGER).locator("visible=true");
    await this.waitUntil(async () => {
      if ((await panel.count()) > 0 || (await trigger.isVisible())) return true;
      if (await this.page.locator(HEALTH).isVisible()) await this.openStatus().catch(() => undefined);
      else await this.showSidebar().catch(() => undefined);
      return (await panel.count()) > 0 || (await trigger.isVisible());
    }, "the plugins panel or its trigger");
    if ((await panel.count()) > 0) return panel;
    await this.press(trigger);
    await panel.waitFor({ state: "visible", timeout: POLL_TIMEOUT });
    return panel;
  }

  async hidePlugins(): Promise<void> {
    const panel = this.pluginsPanel();
    if ((await panel.count()) === 0) return;
    await panel.press("Escape");
    await this.page.locator(PLUGINS_PANEL).waitFor({ state: "detached", timeout: POLL_TIMEOUT });
    const health = this.page.locator(HEALTH_PANEL);
    if (await health.isVisible()) {
      await this.press(this.page.locator(HEALTH));
      await health.waitFor({ state: "hidden", timeout: POLL_TIMEOUT });
    }
  }

  async showPluginRow(
    plugin: string,
    options: { readonly detail?: boolean } = {},
  ): Promise<Locator> {
    const panel = this.pluginsPanel();
    const row = panel.locator(`${PREFS_ROW}${attr("data-pref", `plugin-${plugin}`)}`);
    await row.waitFor({ state: "attached", timeout: POLL_TIMEOUT });
    const reveal = async (): Promise<boolean> =>
      await row.evaluate((el) => {
        const details = el.closest("details");
        if (!(details instanceof HTMLDetailsElement) || details.open) return false;
        const summary = details.querySelector(":scope > summary");
        if (summary instanceof HTMLElement) summary.click();
        details.open = true;
        return true;
      }, undefined, { timeout: 1000 }).catch(() => false);
    await this.waitUntil(async () => {
      if (await reveal()) await this.waitForFrame();
      return await row.isVisible();
    }, `the ${plugin} row to be on screen in its group`);
    if (options.detail === false) return row;
    const name = row.locator(`button${attr("aria-controls", `plugins-detail-${plugin}`)}`);
    const open = async (): Promise<boolean> =>
      (await name.count()) === 0 ||
      (await name.getAttribute("aria-expanded", { timeout: 1000 }).catch(() => null)) === "true";
    await this.waitUntil(async () => {
      if (await open()) return true;
      await name.click({ timeout: 2000 }).catch(async () => {
        await name.evaluate((el) => { if (el instanceof HTMLElement) el.click(); }).catch(() => undefined);
      });
      await this.waitForFrame();
      return await open();
    }, `the ${plugin} row's detail to open`, 45_000);
    return row;
  }

  async press(
    target: Locator,
    gesture: "click" | "tap" = "click",
    modifiers?: ReadonlyArray<"Alt" | "Shift">,
  ): Promise<void> {
    await target.waitFor({ state: "visible", timeout: POLL_TIMEOUT });
    await this.intoReach(target);
    await target[gesture](modifiers === undefined ? {} : { modifiers: [...modifiers] });
    await this.waitForFrame();
  }

  async intoReach(target: Locator, what?: string): Promise<void> {
    const first = await coverOf(target);
    const before = first.offscreen
      ? await this.intoView(target)
      : first;
    if (before.pressable || !before.pinned) return;
    const overlay = await target.evaluate((el) => {
      for (let node: Element | null = el; node !== null; node = node.parentElement) {
        if (getComputedStyle(node).position === "fixed") return true;
      }
      return false;
    });
    if (overlay) {
      await target.evaluate((el) => {
        el.scrollIntoView({ block: "nearest", inline: "nearest" });
      });
      await this.waitForFrame();
      const recovered = await coverOf(target);
      if (recovered.pressable) return;
    }
    let state = before;
    for (;;) {
      const was = state.at;
      await this.page.evaluate((by) => window.scrollBy(0, by), state.clearBy);
      await this.waitForFrame();
      state = await coverOf(target);
      if (state.pressable) return;
      if (!state.pinned || state.at === was) break;
    }
    throw new Error(
      `${what ?? state.control} is under ${state.by}, which is pinned there, ` +
        `and the page will not come out from under it: it is at ${state.at}px ` +
        `of ${state.furthest}px. A press here is a press no reader could make ` +
        `— left alone, Playwright answers one by scrolling the page until it ` +
        `lands, which leaves the reader somewhere nobody chose.`,
    );
  }

  private async intoView(target: Locator): Promise<Cover> {
    await target.scrollIntoViewIfNeeded({ timeout: POLL_TIMEOUT });
    await this.waitForFrame();
    return await coverOf(target);
  }

  async clickWithin(id: string, control: string): Promise<void> {
    await this.press(this.within(id, control));
  }

  async hold(target: Locator): Promise<void> {
    await this.holdDown(target);
    await this.letGo();
  }

  async holdDown(target: Locator): Promise<void> {
    this.held = await this.middleOf(target, "held");
    await this.finger("touchStart", this.held);
    await this.page.waitForTimeout(LONG_PRESS_MS + LONG_PRESS_MARGIN_MS);
    await this.waitForFrame();
  }

  async dragFinger(to: Point, steps = 10): Promise<void> {
    const from = this.held;
    assert.ok(from !== undefined, "no finger is down to drag");
    for (let step = 1; step <= steps; step++) {
      await this.finger("touchMove", {
        x: from.x + ((to.x - from.x) * step) / steps,
        y: from.y + ((to.y - from.y) * step) / steps,
      });
      await this.page.waitForTimeout(20);
    }
    await this.waitForFrame();
  }

  async shrinkToScroll(width: number, height: number): Promise<void> {
    await this.page.setViewportSize({ width, height });
    await this.waitForFrame();
    const room = await this.page.evaluate(() => ({
      page: document.documentElement.scrollHeight,
      screen: window.innerHeight,
      at: window.scrollY,
    }));
    assert.ok(
      room.page > room.screen,
      `the outline is ${room.page}px on a ${room.screen}px screen, so there is nothing to scroll`,
    );
    assert.strictEqual(room.at, 0, "this scenario starts at the top of the page");
  }

  async letGo(): Promise<void> {
    this.held = undefined;
    await this.finger("touchEnd");
    await this.waitForFrame();
  }

  private held?: Point;

  clockedStart?: string;

  async flick(target: Locator): Promise<void> {
    const at = await this.middleOf(target, "flicked");
    await this.finger("touchStart", at);
    for (let step = 1; step <= FLICK_STEPS; step++) {
      await this.page.waitForTimeout(LONG_PRESS_MS / FLICK_STEPS);
      await this.finger("touchMove", {
        x: at.x,
        y: at.y - (FLICK_PX * step) / FLICK_STEPS,
      });
    }
    await this.finger("touchEnd");
    await this.waitForFrame();
  }

  async tapAway(): Promise<void> {
    const tree = await this.box(this.frontLane().locator(OUTLINE_TREE).first(), "the outline tree");
    const view = this.viewport();
    const at = { x: view.width - 12, y: Math.min(tree.y + tree.height + 24, view.height - 80) };
    const panels = this.page.locator(NODE_MENU_PANEL);
    const panel = (await panels.count()) > 0 ? await panels.first().boundingBox() : null;
    if (panel !== null) {
      assert.ok(
        at.x < panel.x || at.x > panel.x + panel.width || at.y < panel.y ||
          at.y > panel.y + panel.height,
        `tapping away landed inside the open panel (${JSON.stringify(at)} in ${
          JSON.stringify(panel)
        })`,
      );
    }
    await this.page.touchscreen.tap(at.x, at.y);
    await this.waitForFrame();
  }

  private async middleOf(target: Locator, what: string): Promise<Point> {
    const middle = async (): Promise<Point> => {
      const box = await this.box(target, `the target being ${what}`);
      return { x: box.x + box.width / 2, y: box.y + box.height / 2 };
    };
    const inTheWay = (at: Point): Promise<string | null> =>
      target.evaluate((element, point) => {
        const top = element.ownerDocument.elementFromPoint(point.x, point.y);
        if (top === null) return "nothing — the point is off the screen";
        if (top === element || element.contains(top) || top.contains(element)) return null;
        const named = top.closest("[data-testid]")?.getAttribute("data-testid");
        return named === null || named === undefined
          ? `<${top.tagName.toLowerCase()}>`
          : `<${top.tagName.toLowerCase()}> in "${named}"`;
      }, at);
    let at = await middle();
    const covered = await inTheWay(at);
    if (covered === null) return at;
    await target.evaluate(element => element.scrollIntoView({ block: "center", behavior: "instant" }));
    await this.waitForFrame();
    at = await middle();
    const still = await inTheWay(at);
    assert.equal(
      still,
      null,
      `a finger aimed at the target being ${what} would land on ${still} instead: ` +
        "something is drawn over it, and the gesture would be made on that",
    );
    return at;
  }

  private async finger(
    type: "touchStart" | "touchMove" | "touchEnd",
    at?: Point,
  ): Promise<void> {
    this.touching ??= await this.context.newCDPSession(this.page);
    await this.touching.send("Input.dispatchTouchEvent", {
      type,
      touchPoints: at === undefined ? [] : [at],
    });
  }
  private touching?: CDPSession;

  async clickAway(): Promise<void> {
    const sidebar = this.page.locator(SIDEBAR).first();
    await sidebar.waitFor({ state: "visible", timeout: POLL_TIMEOUT });
    await sidebar.click({ position: { x: 8, y: 8 } });
    await this.waitForFrame();
  }

  async focusWithin(id: string, control: string): Promise<void> {
    const target = this.within(id, control);
    await target.waitFor({ state: "attached", timeout: POLL_TIMEOUT });
    await target.evaluate((el) => (el as HTMLElement).focus());
    await this.waitForFrame();
  }

  nodeTitle(id: string): Locator {
    return this.visibleNode(id).locator(NODE_TITLE).first();
  }

  visibleChildNodes(id: string): Locator {
    return this.node(id).locator(`${NODE}:visible`);
  }

  async expectChromeAttribute(selector: string, attribute: string, expected: string, what: string, timeout = POLL_TIMEOUT): Promise<void> {
    return this.expectAttribute(selector, attribute, expected, what, timeout, this.page);
  }

  async expectAttribute(
    selector: string,
    attribute: string,
    expected: string,
    what: string,
    timeout = POLL_TIMEOUT,
    scope: Page | Locator = this.conversationScoped(selector) ? this.page : this.frontLane(),
  ): Promise<void> {
    try {
      await scope
        .locator(`${selector}${attr(attribute, expected)}`)
        .first()
        .waitFor({ state: "attached", timeout });
    } catch {
      const actual = await scope
        .locator(selector)
        .first()
        .getAttribute(attribute, { timeout: 1000 })
        .catch(() => null);
      throw new Error(
        `expected ${what} to have ${attribute}="${expected}", ` +
          `but it is ${actual === null ? "absent" : `"${actual}"`}`,
      );
    }
  }

  async expectAttributeAbsent(
    selector: string,
    attribute: string,
    what: string,
    timeout = POLL_TIMEOUT,
    scope: Page | Locator = this.conversationScoped(selector) ? this.page : this.frontLane(),
  ): Promise<void> {
    try {
      await scope
        .locator(`${selector}:not([${attribute}])`)
        .first()
        .waitFor({ state: "attached", timeout });
    } catch {
      const actual = await scope
        .locator(selector)
        .first()
        .getAttribute(attribute, { timeout: 1000 })
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
      nodeSelector(this.nodeId(id)),
      attribute,
      expected,
      `node "${id}"`,
    );
  }

  async expectDayMark(
    date: string,
    fact: "data-dated" | "data-noted" | "data-today" | "data-open",
    expected: boolean,
  ): Promise<void> {
    await this.openCalendar();
    await this.expectChromeAttribute(
      daySelector(date),
      fact,
      String(expected),
      `the day ${date}`,
    );
  }

  dayLink(date: string): Locator {
    return this.calendarDay(date).locator("a");
  }

  async nodeAttribute(id: string, attribute: string): Promise<string | null> {
    const node = this.node(id);
    await node.first().waitFor({ state: "attached", timeout: POLL_TIMEOUT });
    return node.first().getAttribute(attribute);
  }

  scratch(): string {
    if (this.served === undefined) {
      throw new Error(
        `this scenario edits the files it is served, so it must be tagged ` +
          `@scratch:${this.corpus} rather than @corpus:${this.corpus} — a shared ` +
          `corpus is one copy of a tracked fixture, served to every other ` +
          `scenario this worker runs`,
      );
    }
    return this.served;
  }

  writeServed(file: string, contents: string): void {
    const target = path.join(this.scratch(), file);
    fs.mkdirSync(path.dirname(target), { recursive: true });
    fs.writeFileSync(target, contents.endsWith("\n") ? contents : `${contents}\n`);
  }

  servedNodes(file: string): ReadonlyArray<Record<string, unknown>> {
    return fs
      .readFileSync(path.join(this.scratch(), file), "utf8")
      .split("\n")
      .filter((line) => line.trim() !== "")
      .map((line) => JSON.parse(line) as Record<string, unknown>);
  }

  servedNodesSoFar(file: string): ReadonlyArray<Record<string, unknown>> {
    try {
      return this.servedNodes(file);
    } catch (cause) {
      if ((cause as NodeJS.ErrnoException).code === "ENOENT") return [];
      throw cause;
    }
  }

  appendServed(file: string, record: Record<string, unknown>): void {
    const lines = this.servedNodes(file).map((node) => JSON.stringify(node));
    this.writeServed(file, [...lines, JSON.stringify(record)].join("\n"));
  }

  appendServedLine(file: string, line: string): void {
    const held = fs.readFileSync(path.join(this.scratch(), file), "utf8");
    this.writeServed(file, `${held}\n${line}\n`);
  }

  removeServed(file: string): void {
    fs.rmSync(path.join(this.scratch(), file));
  }

  git(...argv: ReadonlyArray<string>): string {
    return execFileSync("git", [...argv], {
      cwd: this.scratch(),
      encoding: "utf8",
    });
  }

  giveRemote(): string {
    const bare = fs.mkdtempSync(path.join(os.tmpdir(), "olai-e2e-remote-"));
    execFileSync("git", ["init", "--quiet", "--bare", "--initial-branch", "main"], {
      cwd: bare,
      stdio: "ignore",
    });
    this.git("branch", "--move", "main");
    this.git("remote", "add", "origin", bare);
    this.git("push", "--quiet", "--set-upstream", "origin", "main");
    this.remote = bare;
    return bare;
  }

  advanceRemote(subject: string, change?: { readonly file: string; readonly content: string }): void {
    const remote = this.remote;
    if (remote === undefined) {
      throw new Error("this scenario has no remote — say the repository has one first");
    }
    const work = fs.mkdtempSync(path.join(os.tmpdir(), "olai-e2e-other-"));
    const run = (...argv: ReadonlyArray<string>): void => {
      execFileSync("git", [...argv], { cwd: work, stdio: "ignore" });
    };
    execFileSync("git", ["clone", "--quiet", remote, work], { stdio: "ignore" });
    if (change !== undefined) {
      fs.writeFileSync(path.join(work, change.file), change.content);
      run("add", change.file);
      run(
        "-c",
        "user.email=someone@olai.invalid",
        "-c",
        "user.name=somebody else",
        "commit",
        "--quiet",
        "--no-verify",
        "-m",
        subject,
      );
    } else {
      run(
        "-c",
        "user.email=someone@olai.invalid",
        "-c",
        "user.name=somebody else",
        "commit",
        "--allow-empty",
        "--quiet",
        "--no-verify",
        "-m",
        subject,
      );
    }
    run("push", "--quiet");
  }

  remoteGit(...argv: ReadonlyArray<string>): string {
    if (this.remote === undefined) {
      throw new Error("this scenario has no remote — give it one first");
    }
    return execFileSync("git", [...argv], { cwd: this.remote, encoding: "utf8" });
  }

  async markPage(): Promise<void> {
    await this.page.evaluate((key) => {
      (window as unknown as Record<string, unknown>)[key] = true;
    }, NO_RELOAD_MARK);
  }

  viewport(): { readonly width: number; readonly height: number } {
    const size = this.page.viewportSize();
    assert.ok(size !== null, "this scenario has no viewport size");
    return size;
  }

  async box(locator: Locator, what: string): Promise<Box> {
    await locator.waitFor({ state: "visible", timeout: POLL_TIMEOUT });
    const box = await locator.boundingBox();
    if (box === null) throw new Error(`${what} is not laid out, so it has no box`);
    return box;
  }

  async topmostTestidAt(x: number, y: number): Promise<string> {
    return await this.page.evaluate(
      ({ x, y }) => {
        const element = document.elementFromPoint(x, y);
        return (
          element?.closest("[data-testid]")?.getAttribute("data-testid") ??
          element?.tagName ??
          "nothing"
        );
      },
      { x, y },
    );
  }

  async topmostTestidOver(locator: Locator, what: string): Promise<string> {
    const box = await this.box(locator, what);
    return await this.topmostTestidAt(box.x + box.width / 2, box.y + box.height / 2);
  }

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

  stored(key: string, page: Page = this.page): Promise<string | null> {
    return page.evaluate((name) => localStorage.getItem(name), key);
  }

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

  previewPointedAt?: string;

  paperBefore?: string;

  ringBefore?: { style: string; width: number; colour: string };
  scrollbarBefore?: string;
  blockBefore?: Box;

  offSite(): ReadonlyArray<string> {
    return this.requests.filter(
      (url) => !url.startsWith(this.baseUrl) && !url.startsWith("data:"),
    );
  }

  private askedFrom?: number;

  watchRequests(): void {
    this.askedFrom = this.requests.length;
  }

  requestsWatched(): ReadonlyArray<string> {
    if (this.askedFrom === undefined) {
      throw new Error(
        "nothing is watching what the page asks for; a step has to start " +
          "watching before the gesture it is making a claim about",
      );
    }
    return this.requests.slice(this.askedFrom);
  }

  async pageStillMarked(): Promise<boolean> {
    return this.page.evaluate(
      (key) => (window as unknown as Record<string, unknown>)[key] === true,
      NO_RELOAD_MARK,
    );
  }
}

setWorldConstructor(OlaiWorld);
