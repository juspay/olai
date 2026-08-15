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

import * as assert from "node:assert";
import { execFileSync, type ChildProcess } from "node:child_process";
import * as fs from "node:fs";
import type { Server } from "node:net";
import * as path from "node:path";
import * as os from "node:os";

// Aliased: `NODE_REF` below is the see/after reference ELEMENT (`NodeRefs.tsx`),
// and this is the ATTRIBUTE a pressable node reference in the chat panel
// carries. Two different things, one word — so the import says which.
import { NODE_REF as CHAT_NODE_REF_ATTR } from "@olai/web/src/client/chat/refs.ts";
// The client's own long-press deadline, for the same reason the testids are
// imported rather than re-spelled: a scenario that held a finger for a number
// this file had guessed would become a tap the day that one moved.
import { LONG_PRESS_MS } from "@olai/web/src/client/longPress.ts";
import { selector, TESTID } from "@olai/web/src/client/testids.ts";
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

/** Per-step budget for interaction polls against a settled UI — a click
 *  landing, an attribute flipping, a subtree appearing. */
export const POLL_TIMEOUT = 15_000;

/** How much longer than the client's own deadline a held finger stays down.
 *  Enough that a loaded runner's timer running late is still a long press, and
 *  small enough that a scenario holding one is not a scenario waiting. */
const LONG_PRESS_MARGIN_MS = 300;

/** How far a flick travels, and in how many steps. Far enough to be a scroll
 *  rather than a jitter (the client drops a press past 10px), spread over the
 *  press deadline so the finger is still down while it passes. */
const FLICK_PX = 150;
const FLICK_STEPS = 10;

/** Where a finger is, in CSS pixels of the viewport. */
interface Point {
  readonly x: number;
  readonly y: number;
}

/** Per-step budget for HYDRATION polls: the first paint after `goto`, which
 *  waits on the bundle, the WebSocket handshake and the first full snapshot.
 *  A separate axis from interaction on purpose — the first frame can take
 *  seconds on a cold, loaded CI runner while every interaction after it lands
 *  in milliseconds, and sharing one constant would make the whole suite wait
 *  for the slowest thing in it. */
export const HYDRATION_TIMEOUT = 30_000;

/**
 * Per-step budget for a change only the store's BACKSTOP can deliver.
 *
 * A third axis, and it exists because of one asymmetry between platforms.
 * Nearly every change to the served directory reaches a page promptly: the
 * watcher sees it and opens the probe latch. A change to the WATCHED ROOT
 * ITSELF — it was removed, it stopped being readable — is the one the watcher
 * cannot report on Linux and macOS alike (macOS delivers nothing for it, so
 * the first probe that notices is the unconditional sweep). The product is the
 * same on both and the guarantee is "by the next probe"; only the wait differs.
 *
 * So this is `@olai/store`'s `DEFAULT_BACKSTOP` (60s) plus room for the probe,
 * the publish and the frame. Kept apart from the other two rather than folded
 * into them, because sharing a constant would make the whole suite wait on the
 * slowest thing in it — which is exactly the argument above.
 */
export const BACKSTOP_TIMEOUT = 90_000;

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

/**
 * The same envelope for the one step that waits on {@link BACKSTOP_TIMEOUT},
 * passed to that step's own definition rather than raised globally.
 *
 * The rule above is why this exists in this shape. A `setDefaultTimeout` wide
 * enough for a backstop would give EVERY step a kill budget of a minute and a
 * half, so a step that genuinely hung would take that long to say so instead
 * of failing on its own far more specific timeout. And the outer envelope has
 * to be the wider of the two: raising the inner one without this is a step
 * whose own budget can never be reached, which is exactly how CI found it —
 * a 90s wait killed at 40s by an envelope nobody had told.
 */
export const BACKSTOP_STEP_TIMEOUT = BACKSTOP_TIMEOUT + STEP_GUARD;

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
/** The app header: wordmark + connection + git + agent + preferences. Always on
 *  screen. */
export const APP_HEADER = selector(TESTID.appHeader);
/** The `olai` wordmark in that bar. A TAG rather than a test id: it is the
 *  app's name and the bar's one heading, and markup that exists only to be read
 *  back by a test is markup every reader ships. What it is here FOR is the
 *  geometry — a row of pills too wide for the bar lands on top of it. */
export const WORDMARK = `${APP_HEADER} h1`;
/** The sidebar: the month and the file tree (directory chrome only). */
export const SIDEBAR = selector(TESTID.sidebar);
export const SIDEBAR_TOGGLE = selector(TESTID.sidebarToggle);
export const SIDEBAR_BODY = selector(TESTID.sidebarBody);
export const SIDEBAR_SCRIM = selector(TESTID.sidebarScrim);
export const SIDEBAR_COLLAPSE = selector(TESTID.sidebarCollapse);
export const SIDEBAR_EXPAND = selector(TESTID.sidebarExpand);
export const SIDEBAR_RAIL = selector(TESTID.sidebarRail);
/** The rail's way to the agenda — the collapsed column's face of the entry,
 *  carrying the same `data-owed` as a dot. */
export const RAIL_AGENDA = selector(TESTID.railAgenda);
/** The rail's two ways INTO the directory — the collapsed column's outlines
 *  and documents buttons, which draw the tree's own glyphs. */
export const RAIL_OUTLINES = selector(TESTID.railOutlines);
export const RAIL_DOCS = selector(TESTID.railDocs);
export const SIDEBAR_RESIZE = selector(TESTID.sidebarResize);
/** The file tree: every outline and document under the folders they live in. */
export const OUTLINE_LIST = selector(TESTID.outlineList);
export const OUTLINE_LINK = selector(TESTID.outlineLink);
/** One folder in that tree. `data-path` / `data-collapsed` say which and how. */
export const FILE_DIR = selector(TESTID.fileDir);
export const FILE_DIR_TOGGLE = selector(TESTID.fileDirToggle);
/** The glyph in front of a row's name, saying what KIND it is. `data-glyph`
 *  is `outline` / `document` / `folder` — the fact, not the ink. */
export const FILE_GLYPH = selector(TESTID.fileGlyph);
/** One document entry in the file tree (no second list — same folders). */
export const DOCUMENT_LINK = selector(TESTID.documentLink);
/** One document, as a page: `/doc/<file>`. */
export const DOCUMENT_PAGE = selector(TESTID.documentPage);
/** The rendered markdown of a document — on its own page, or inline under the
 *  node that attaches it. */
export const DOCUMENT_BODY = selector(TESTID.documentBody);
/** The way into a document's editor, on its page header. */
export const DOCUMENT_EDIT = selector(TESTID.documentEdit);
/** The editor itself — a textarea holding the document's SOURCE, verbatim.
 *  Present exactly while the page is in its edit mode. */
export const DOCUMENT_EDITOR = selector(TESTID.documentEditor);
export const DOCUMENT_SAVE = selector(TESTID.documentSave);
export const DOCUMENT_CANCEL = selector(TESTID.documentCancel);
/** What the last document write had to say; `data-tone` is which mood. */
export const DOCUMENT_SAID = selector(TESTID.documentSaid);
/** The explicit "overwrite anyway" after a conflict refusal. */
export const DOCUMENT_OVERWRITE = selector(TESTID.documentOverwrite);
/** The notice, while the editor is open, that the file moved on disk. */
export const DOCUMENT_DRIFTED = selector(TESTID.documentDrifted);
/** The two sidebar path boxes — a new outline's and a new document's — are
 *  reached through the client's own table (`file/making.ts`) rather than
 *  through constants here: the steps that drive them are one pair over the
 *  KIND (`step_definitions/new_file_steps.ts`), so a selector per kind spelled
 *  in this file would be the copy that pair exists to delete. */
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
/** What a node itself says it comes AFTER — its own field, drawn on its page
 *  beside the DERIVED `blocked by` row above it. The two are different claims:
 *  this one is what `set_after` writes, and only this one carries an `×`. */
export const AFTER_REFS = selector(TESTID.afterRefs);
/** The `×` on one drawn reference — drop that target. `data-ref` is which. */
export const REF_DROP = selector(TESTID.refDrop);

// ── writing a node's edges ─────────────────────────────────────────────
/** The panel that writes one relation of one node, in place under the row or
 *  under a zoomed node's heading. `data-relation` says which of `see` /
 *  `after`; present only while it is open. */
export const EDGE_PANEL = selector(TESTID.edgePanel);
/** What the node says right now, inside that panel — one chip per target. */
export const EDGE_HELD = selector(TESTID.edgeHeld);
/** The `×` on one of those chips; `data-ref` is the target it drops. */
export const EDGE_DROP = selector(TESTID.edgeDrop);
/** Its search box — the server's own node search, the same one ⌘K, the header
 *  box and the `((` widget call. */
export const EDGE_SEARCH = selector(TESTID.edgeSearch);
/** One hit in it; `data-id` is the node it would name. */
export const EDGE_HIT = selector(TESTID.edgeHit);
/** What the last edge WRITE said — a refusal verbatim (the loop an `after`
 *  would close), or a nudge. `data-tone` is which mood. Never the same line as
 *  a refused SEARCH. */
export const EDGE_SAID = selector(TESTID.edgeSaid);
/** One of the two edge verbs on a zoomed node's page, where a heading has no
 *  `•••` to put them in. `data-relation` says which. */
export const EDGE_VERB = selector(TESTID.edgeVerb);
/** One link from a node to another node, in either of those rows. The target
 *  id rides `data-ref`, which is what a scenario picks one by. */
export const NODE_REF = selector(TESTID.nodeRef);
/** The main pane. Present only when the loaded set is valid. */
export const OUTLINE_TREE = selector(TESTID.outlineTree);
export const NODE = selector(TESTID.node);
export const NODE_TITLE = selector(TESTID.nodeTitle);
export const TAG = selector(TESTID.tag);
export const DATE = selector(TESTID.date);
/** The bar that narrows the page — the box, what it found, and what it
 *  refused. On the two routes that may carry a filter and nowhere else. */
export const FILTER_BAR = selector(TESTID.filterBar);
export const FILTER_INPUT = selector(TESTID.filterInput);
export const FILTER_COUNT = selector(TESTID.filterCount);
export const FILTER_CLEAR = selector(TESTID.filterClear);
/** A known operator with an unknown value, in the grammar's own words. The
 *  scenario asserts on the WORDS: a query that quietly found nothing is what
 *  this line exists to make impossible. */
export const FILTER_REFUSAL = selector(TESTID.filterRefusal);
/** The same refusal on the two doors that ask the SERVER for it — the ⌘K
 *  palette and the header box. One name, because it is one sentence about one
 *  grammar; where each door draws it is that door’s own business. */
export const SEARCH_REFUSAL = selector(TESTID.searchRefusal);
/** The date picker, in place under the row it was opened on — from the pill
 *  above, or from the `•••` menu's `Set date…`. Its box is a native
 *  `<input type="date">`, so what it holds is the ten characters the record
 *  will hold; its button's LABEL is the verb, and `Clear date` is the menu's
 *  own words for the same edit once the box has been emptied. */
export const DATE_PICKER = selector(TESTID.datePicker);
export const DATE_PICKER_DAY = selector(TESTID.datePickerDay);
export const DATE_PICKER_SET = selector(TESTID.datePickerSet);
export const DATE_PICKER_CANCEL = selector(TESTID.datePickerCancel);
/** Said when the node stores a value a day box cannot hold — a datetime,
 *  quoted verbatim, with what picking a day would do to it. */
export const DATE_PICKER_NOTICE = selector(TESTID.datePickerNotice);
/** The rollup badge beside a title: how many of the tasks under this node are
 *  done. An annotation — the node's OWN mark is the checkbox. */
export const PROGRESS = selector(TESTID.progress);
export const DESC = selector(TESTID.desc);
export const TOGGLE = selector(TESTID.toggle);
/** The `•••` trigger left of the collapse triangle. */
export const NODE_MENU = selector(TESTID.nodeMenu);
export const NODE_MENU_PANEL = selector(TESTID.nodeMenuPanel);
export const NODE_MENU_ITEM = selector(TESTID.nodeMenuItem);
/** The question that panel asks before the one verb that takes a branch away.
 *  Present only while it is asking. */
export const NODE_MENU_CONFIRM = selector(TESTID.nodeMenuConfirm);
/** What the last verb had to say, beside the `•••`. `data-tone` is which of
 *  the two moods it is in — `alarm` for a refusal, `aside` for a nudge. */
export const NODE_MENU_SAID = selector(TESTID.nodeMenuSaid);
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
/** Either of them: the editor the caret is in, whichever field it is. A page
 *  matching neither has no caret in a row, which is the state ⌘Z is answered
 *  from — and is what `support/caret.ts` is written around. */
export const CARET_EDITOR = `${TITLE_EDITOR}, ${DESC_EDITOR}`;
/** A row that does not exist yet — an editor standing where `Enter` will put
 *  one. Finding one is finding a DRAFT, never a write. */
export const NEW_ROW = selector(TESTID.newRow);
/** The shortlist under a caret — the `!` day picker, the `#`/`@` tag list, the
 *  `((` node search. `data-kind` says which of the three, so a scenario names
 *  the widget rather than inferring it from the rows. */
export const COMPLETIONS = selector(TESTID.completions);
export const COMPLETION_ITEM = selector(TESTID.completionItem);
/** Where a `((` hit sits — the second line of its row. */
export const COMPLETION_ITEM_PLACE = selector(TESTID.completionItemPlace);
/** What a write that LANDED had to say — the rollup's nudge, in the same
 *  place and the opposite mood. */
export const EDIT_NUDGE = selector(TESTID.editNudge);
/** What the last commit was refused with, under the row it was typed in. */
export const EDIT_REFUSAL = selector(TESTID.editRefusal);
/** What ⌘Z / ⌘⇧Z had to say — over the page rather than under a row, because
 *  an undo is pressed with no draft open. `data-tone` is which mood it is. */
export const UNDO_SAID = selector(TESTID.undoSaid);
/** The way in on a page with no rows at all. */
export const START_LINE = selector(TESTID.startLine);
/** The bullet, as something to pick a row up by. Present on every editable
 *  row; a press that never travels is still the bullet's own link. */
export const DRAG_HANDLE = selector(TESTID.dragHandle);
/** The line drawn where a dragged row would land — present only while one is
 *  being dragged. `data-parent`, `data-after` and `data-depth` are what it
 *  PROMISES, which is a prediction right up until the pointer is released. */
export const DROP_LINE = selector(TESTID.dropLine);
/** The band a drag-across pulls — present only while one is being pulled.
 *  `data-rows` is how many rows it is crossing, which is the half of the
 *  gesture that is still a prediction while the pointer is down. */
export const SWEEP_BAND = selector(TESTID.sweepBand);
/** The bar a multi-selection draws. `data-rows` is the count the bulk verbs
 *  are asked of — the picked rows nothing else picked contains. */
export const SELECTION_BAR = selector(TESTID.selectionBar);
export const SELECTION_TRASH = selector(TESTID.selectionTrash);
export const SELECTION_CONFIRM = selector(TESTID.selectionConfirm);
/** Said in the Trash button's place when the pick holds a placement. */
export const SELECTION_NOTE = selector(TESTID.selectionNote);
/** What the last bulk gesture — a key over the pick, or a drop — had to say.
 *  `data-tone` is which of the two moods it is in. */
export const SELECTION_SAID = selector(TESTID.selectionSaid);
/** The heading of a zoomed page. Carries the CANONICAL node's id, which is
 *  what lets a scenario say "zooming a mirror lands on the node itself". */
export const ZOOM_TITLE = selector(TESTID.zoomTitle);
/** Said on a zoomed page with no rows — a leaf, or Prefs hiding finished work. */
export const EMPTY_UNDER = selector(TESTID.emptyUnder);
export const BREADCRUMBS = selector(TESTID.breadcrumbs);
export const CRUMB = selector(TESTID.crumb);
/** The month in the sidebar, and one day of it. A day says what it is in
 *  `data-` facts — `data-dated`, `data-today`, `data-open` — never in the
 *  colour it is painted. */
export const CALENDAR = selector(TESTID.calendar);
export const CALENDAR_DAY = selector(TESTID.calendarDay);
export const CALENDAR_PREV = selector(TESTID.calendarPrev);
export const CALENDAR_NEXT = selector(TESTID.calendarNext);
/** The button a BARE day is — no node, no note — which mints that day's note.
 *  Inside the `calendarDay` cell, so `data-date` rides one level up. */
export const CALENDAR_MINT = selector(TESTID.calendarMint);
/** What minting had to say when it was refused, under the grid. */
export const CALENDAR_SAID = selector(TESTID.calendarSaid);
/** One day, as a page: `/d/<date>` and `/today`. */
export const DAY_PAGE = selector(TESTID.dayPage);
export const DAY_GROUP = selector(TESTID.dayGroup);
export const DAY_EMPTY = selector(TESTID.dayEmpty);
/** The agenda: the same dates read forward. `data-date` is the day it was
 *  answered for, which `/agenda` does not spell. */
export const AGENDA_PAGE = selector(TESTID.agendaPage);
/** One of its three sections; `data-section` is which of them, and a section
 *  with nothing in it is not drawn at all. */
export const AGENDA_SECTION = selector(TESTID.agendaSection);
/** One day inside Upcoming; `data-date` is which, and its heading is the link
 *  to that day's own page. */
export const AGENDA_DAY = selector(TESTID.agendaDay);
/** Said in place of all three when nothing is due. */
export const AGENDA_EMPTY = selector(TESTID.agendaEmpty);
/** The way to it from the directory column, above the month. */
export const AGENDA_LINK = selector(TESTID.agendaLink);
/** What that entry REPORTS, wrapped round the link: `data-owed` is the face it
 *  wears (`overdue` / `today` / `quiet`) and `data-overdue` / `data-today` are
 *  the two counts, whichever of them is on screen. */
export const AGENDA_OWED = selector(TESTID.agendaOwed);
/** The number on it. Absent when nothing is owed — a quiet entry wears no chip
 *  rather than a zero. */
export const AGENDA_COUNT = selector(TESTID.agendaCount);
/** The trash: every archive the directory holds, read-only, one verb. */
export const TRASH_PAGE = selector(TESTID.trashPage);
/** One row of it — an archived node; `data-node-id` is which. */
export const TRASH_ROW = selector(TESTID.trashRow);
/** The one verb a trash row offers. */
export const TRASH_PUT_BACK = selector(TESTID.trashPutBack);
/** What the last put-back had to say, under its row; `data-tone` is the mood. */
export const TRASH_SAID = selector(TESTID.trashSaid);
/** Said in the rows' place when nothing is in the trash. */
export const TRASH_EMPTY = selector(TESTID.trashEmpty);
/** The way to it, at the foot of the directory column. */
export const TRASH_LINK = selector(TESTID.trashLink);
/** THE day's note, above those groups: a document named for the date itself.
 *  `data-file` is which. */
export const DAY_NOTE = selector(TESTID.dayNote);
/** Its heading — the way from the day to the document's own page. */
export const DAY_NOTE_LINK = selector(TESTID.dayNoteLink);
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
/**
 * The row of pills in the header that are about the APP, and the two halves of
 * the tombstone over the retired `● git` readout.
 *
 * There is no `git` test id any more: the readout was a second chip answering
 * the question the Commit pill already answers, which is the bug
 * `one-git-indicator` closed. Holding that shut takes a claim about the ROW
 * rather than about the chip that went — a twin under a different name would
 * pass any assertion phrased as "the old one is absent". So the scenario counts
 * what is IN the row ({@link APP_CHROME_CONTROLS}), and the attribute the
 * readout carried is checked as well, for a chip that arrives carrying no test
 * id at all.
 */
export const APP_CHROME = selector(TESTID.appChrome);

/** Everything that belongs in that row, and nothing else may be. In order — a
 *  list a person has to come and edit is exactly the point: adding chrome to
 *  the header is a decision, and a second control reporting on git is the
 *  decision this fence is here to make somebody look at. The theme pill was the
 *  fifth entry until `preferences-panel`, which is the same decision made
 *  again: a preference with a door of its own, beside the door to the
 *  preferences. */
export const APP_CHROME_CONTROLS: ReadonlyArray<string> = [
  // The search box, and beside it the magnifier a phone gets instead (the bar
  // has no room for a box at 390pt, and a phone has no ⌘K). Added here as the
  // deliberate edit this list exists to demand: the row gained a DOOR, not a
  // second answer about git — the Commit pill is still the only control in it
  // that reports on the repository, which is the whole of what the fence
  // below guards.
  TESTID.headerSearch,
  TESTID.headerSearchOpen,
  TESTID.connection,
  TESTID.commitPill,
  TESTID.chatToggle,
  TESTID.prefsTrigger,
];

/** The attribute that readout carried. Kept as a selector so the fence catches
 *  a second git chip that carries no test id of its own. */
export const RETIRED_GIT_READOUT = "[data-git]";
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

/**
 * The preferences: the header's one trigger, the panel behind it, and what is
 * on it.
 *
 * The theme chips are a ROW of that panel rather than a popover of their own —
 * so every theming scenario comes through this trigger, which is the whole of
 * what `preferences-panel` changed about them. The browser tests still import
 * DEFAULT_THEME / storage key from `theme/palettes.ts` rather than reading
 * attributes; a chip's `data-value` is the theme it offers and `aria-pressed`
 * says whether it is the one in force — never the colour it is painted, which
 * is the subject here and so the last thing to assert on.
 */
export const PREFS_TRIGGER = selector(TESTID.prefsTrigger);
export const PREFS_PANEL = selector(TESTID.prefsPanel);
export const PREFS_ROW = selector(TESTID.prefsRow);
export const PREFS_HINT = selector(TESTID.prefsHint);
export const PREFS_CHOICE = selector(TESTID.prefsChoice);
export const PREFS_SCOPE = selector(TESTID.prefsScope);
export const THEME_CHIP = selector(TESTID.themeChip);
export const FONT_SELECT = selector(TESTID.fontSelect);

/** The Commit pill in the chrome, and the panel it opens. The pill is ALWAYS
 *  drawn, and it is the header's ONE answer about git — `data-state` is which
 *  of its eight faces it is wearing (the fault among them, since the readout
 *  retired into it), and that is what a scenario asserts on. What git SAID is
 *  its `aria-label` and its tip, never a colour. */
export const COMMIT_PILL = selector(TESTID.commitPill);
export const COMMIT_PANEL = selector(TESTID.commitPanel);
/** What olai last recorded here, in the panel — or the words that say it never
 *  has, which is a fact no count of what is pending can express. */
export const COMMIT_LAST = selector(TESTID.commitLast);
/** One node that changed. `data-sort` is WHAT changed about it — never the
 *  words it is rendered as, which the view is entitled to reword. */
export const COMMIT_CHANGE = selector(TESTID.commitChange);
export const COMMIT_MESSAGE = selector(TESTID.commitMessage);
export const COMMIT_NOW = selector(TESTID.commitNow);
export const COMMIT_BLOCKED = selector(TESTID.commitBlocked);
/** One dirty file that is NOT a served outline — a document a person edited, a
 *  source file, an outline outside the served root. `data-path` is which and
 *  `data-how` what happened to it, never the chip's own words. */
export const COMMIT_OTHER = selector(TESTID.commitOther);
/** The box that says whether a file is going into this commit; `data-path` is
 *  which file. Everything is ticked until somebody says otherwise. */
export const COMMIT_TICK = selector(TESTID.commitTick);
/** What the panel is a list OF — the whole repository, and the part of it olai
 *  serves. */
export const COMMIT_SCOPE = selector(TESTID.commitScope);
/** What is committed here and nowhere else; `data-commits` is how many. */
export const COMMIT_UNPUSHED = selector(TESTID.commitUnpushed);
export const COMMIT_PUSH = selector(TESTID.commitPush);

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
export const PALETTE_INPUT = selector(TESTID.paletteInput);
export const PALETTE_CAPTURE = selector(TESTID.paletteCapture);
export const PALETTE_CONFIRM = selector(TESTID.paletteConfirm);
export const PALETTE_SAID = selector(TESTID.paletteSaid);
export const PALETTE_SCRIM = selector(TESTID.paletteScrim);
export const SHORTCUTS = selector(TESTID.shortcuts);

export const CHAT_TITLE = selector(TESTID.chatTitle);
export const CHAT_WORKING = selector(TESTID.chatWorking);
export const CHAT_MODEL = selector(TESTID.chatModel);
export const CHAT_SESSIONS = selector(TESTID.chatSessions);
export const CHAT_SESSION_LIST = selector(TESTID.chatSessionList);
export const CHAT_SESSIONS_REFUSED = selector(TESTID.chatSessionsRefused);
export const CHAT_SESSION = selector(TESTID.chatSession);
export const CHAT_TRANSCRIPT = selector(TESTID.chatTranscript);
export const CHAT_MISSING = selector(TESTID.chatMissing);
export const CHAT_MISSING_SERVER = selector(TESTID.chatMissingServer);
export const CHAT_MISSING_WHY = selector(TESTID.chatMissingWhy);
export const CHAT_NO_AGENT = selector(TESTID.chatNoAgent);
export const CHAT_ENTRY = selector(TESTID.chatEntry);
export const CHAT_NEW = selector(TESTID.chatNew);
export const CHAT_ENTRY_STREAMING =
  `${selector(TESTID.chatEntry)}[data-kind="agent"][data-streaming="true"]`;
export const CHAT_TOOL = selector(TESTID.chatTool);
export const CHAT_TOOL_FOLD = selector(TESTID.chatToolFold);
export const CHAT_TOOL_DETAIL = selector(TESTID.chatToolDetail);
export const CHAT_TOOL_PROGRESS = selector(TESTID.chatToolProgress);
export const CHAT_TOOL_LOCATIONS = selector(TESTID.chatToolLocations);
export const CHAT_DIFF = selector(TESTID.chatDiff);
export const CHAT_DIFF_LINE = selector(TESTID.chatDiffLine);
export const CHAT_DIFF_GUTTER = selector(TESTID.chatDiffGutter);
export const CHAT_DIFF_MARK = selector(TESTID.chatDiffMark);
export const CHAT_DIFF_TEXT = selector(TESTID.chatDiffText);
export const CHAT_DIFF_EXPAND = selector(TESTID.chatDiffExpand);
export const CHAT_DIFF_WHOLESALE = selector(TESTID.chatDiffWholesale);
export const CHAT_OUTLINE_DIFF = selector(TESTID.chatOutlineDiff);
export const CHAT_OUTLINE_CHANGE = selector(TESTID.chatOutlineChange);
export const CHAT_WROTE = selector(TESTID.chatWrote);
export const CHAT_NUDGE = selector(TESTID.chatNudge);
export const CHAT_REFUSAL = selector(TESTID.chatRefusal);
export const CHAT_USAGE = selector(TESTID.chatUsage);
export const CHAT_TROUBLE = selector(TESTID.chatTrouble);
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
/** How big a NON-picture attachment is, beside its name — what a document
 *  chip says where a picture shows itself. */
export const CHAT_ATTACHMENT_SIZE = selector(TESTID.chatAttachmentSize);
/** The `+` beside the box: the file picker, and the only way in on a phone. */
export const CHAT_ATTACH_BUTTON = selector(TESTID.chatAttachButton);
/** The panel saying a dragged file would land HERE. Present only while a drag
 *  carrying files is over the panel's body. */
export const CHAT_DROP = selector(TESTID.chatDrop);
/** A node a message is ABOUT — armed in the composer, or sent, on the row.
 *  `data-node` is the id, which is what was armed and what was sent. */
export const CHAT_CONTEXT = selector(TESTID.chatContext);
export const CHAT_CONTEXT_CHIP = selector(TESTID.chatContextChip);
export const CHAT_CONTEXT_REMOVE = selector(TESTID.chatContextRemove);
/** What the agent said, rendered. Reached by the scenarios that ask whether an
 *  id INSIDE it became a reference — everything else about an answer is read
 *  off the transcript as text. */
export const CHAT_SAID = selector(TESTID.chatSaid);
/** A node named in the panel and pressable, by the id it points at. One
 *  selector for all three shapes — a chip, the node an olai write was about,
 *  and an id the agent wrote in its own prose — because they are one
 *  affordance and a scenario should not have to know which produced it.
 *
 *  The ATTRIBUTE is imported from the client that writes it, like every other
 *  name in this file: a rename over there is a type error here rather than a
 *  timeout. Note the id it carries is the RESOLVED one — a span saying `echo`
 *  points at the node `echo` is a placement of, because that is the node a
 *  reader can be shown. */
export const chatNodeRef = (id: string): string => `[${CHAT_NODE_REF_ATTR}="${id}"]`;
/** ...and any of them at all, for the steps that assert an absence. */
export const NODE_REF_ANY = `[${CHAT_NODE_REF_ATTR}]`;

/** The app has finished its first render when it has committed to one of its
 *  three shapes: a docked header (the set loaded and the directory column is
 *  present), the error view (it did not), or the fault card (the client threw
 *  while drawing). Waiting on any — rather than on the one the scenario
 *  expects — means a broken-set regression fails with "expected a tree, found
 *  the error view for house.olai:3" instead of a bare 30-second timeout.
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

/** Wait for a list to be drawn before reading it. Reading a locator's elements
 *  the instant a page renders races the frame that adds the second one, and an
 *  empty list compares as a perfectly plausible wrong answer. */
export const drawn = async (found: Locator): Promise<Locator> => {
  await found
    .first()
    .waitFor({ state: "visible", timeout: POLL_TIMEOUT })
    .catch(() => undefined);
  return found;
};

/**
 * One `data-` fact off every element of a drawn list, in DOM order, against a
 * comma-separated expectation.
 *
 * The WHOLE list, not "contains X": the order and the membership are both the
 * promise — a group that should not be there, a node above the one it is dated
 * after, or a second document claiming a date silently dropped, is exactly the
 * bug.
 *
 * Here rather than in whichever step file first wanted it, because "assert an
 * ordered list of `data-` facts" is what every list on a day page is asked
 * with, and two features ask it now.
 */
export const expectDrawn = async (
  found: Locator,
  attribute: string,
  expected: string,
): Promise<void> => {
  assert.deepStrictEqual(
    await (await drawn(found)).evaluateAll(
      (all, name) => all.map((element) => element.getAttribute(name)),
      attribute,
    ),
    expected.split(",").map((one) => one.trim()),
  );
};
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

  /** Requests for a split chunk a scenario is deliberately sitting on, keyed by
   *  the module the chunk is named after — so it can stand in the moment before
   *  that chunk has arrived rather than race it (`support/chunks.ts`). Two are
   *  split out now (the markdown pipeline, the `•••` menu's primitive) and a
   *  scenario may hold either; empty unless one asked to. */
  heldChunks = new Map<string, Route[]>();
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
  /** Where this scenario PUSHES to, once it has asked for one: a bare
   *  repository in a temp directory, wired up as `origin`. Undefined for every
   *  scenario that is not about pushing, which is all but one of them. */
  remote?: string;
  /** The server process a `@scratch:` scenario owns, killed in `After`. */
  ownServer?: ChildProcess;
  /** A listen on this scenario's port, held between stop and restart so
   *  another worker cannot steal it. Released by `startOwnServer`, or by
   *  `After` if the scenario never came back. */
  portHold?: Server;
  /** A coding agent in a terminal, for the scenarios about the tool surface
   *  olai does not own the client of: an HTTP POST at this server's `/mcp`. */
  terminalAgent?: TerminalAgent;
  /** The tool names that agent was offered, and the last tool RESULT it got.
   *  Both are read by later steps than the one that provoked them, which is
   *  what makes them the world's rather than a module's — a step file holding
   *  them would share them across scenarios. */
  toolsOffered: string[] = [];
  toolAnswer?: Record<string, unknown>;
  /** What that server has printed, as a box the spawn listener appends to
   *  for the life of the child. A string field that was assigned after boot
   *  dropped the stale-tab line when it arrived in the gap between "serving"
   *  and the new listener — the restart flake under load. */
  serverLog: { text: string } = { text: "" };

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

  /** The agenda COLD — one address, spelling no day, which is what makes it a
   *  bookmark rather than a page you can only click to. */
  async openAgenda(): Promise<void> {
    await this.open("/agenda");
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

  /**
   * Wait until something rendered inside `where` draws `text` in bold.
   *
   * The cheapest true statement that the markdown PIPELINE ran over text this
   * suite put there, which is why several steps ask it — of this page's
   * document, and of a second tab's, where the whole point is that a save
   * reached a reader who was not the writer. One spelling, so a change to how
   * `**bold**` renders is one place rather than a pair kept in step by hand;
   * scoped to a locator rather than to the page because "the document" and
   * "whatever that other tab is showing" are two different scopes.
   */
  async rendersBold(where: Locator, text: string): Promise<void> {
    await this.waitUntil(
      async () =>
        (await where.locator("strong, b").allInnerTexts()).some(
          (value) => value.trim() === text,
        ),
      `${JSON.stringify(text)} to be rendered in bold`,
    );
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

  /** The path AND the query — what a reader would copy out of the bar when the
   *  page is narrowed. Its own accessor beside {@link pathname} because the
   *  filter is part of the address (`routes.ts`) and every other assertion in
   *  this suite is about a path: a step asserting "/o/house.olai" must not
   *  start passing for a page that is also filtered. */
  address(): string {
    const url = new URL(this.page.url());
    return url.pathname + url.search;
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

  /**
   * HOLD a finger on something — the gesture a phone opens a row's `•••` menu
   * with, since there is no `•••` drawn to tap (`client/longPress.ts`).
   *
   * Through the DevTools protocol rather than through Playwright, which has a
   * tap and no way to say "and keep it down": `Input.dispatchTouchEvent` goes
   * in at the same place a real finger does, so Chromium's own gesture
   * recogniser sees the press — which is the half that matters here. The
   * client's answer to a long press is only half its behaviour; the other half
   * is the browser's own (the `contextmenu` it raises, the text-selection
   * callout that comes with it, the click a lift synthesises), and a synthetic
   * `pointerdown` dispatched into the page would produce none of it and would
   * pass over exactly the collisions this gesture has to avoid.
   *
   * The hold is the client's own deadline plus a margin: the number is
   * IMPORTED rather than guessed, so raising it there does not quietly turn
   * every scenario here into a tap.
   */
  async hold(target: Locator): Promise<void> {
    await this.holdDown(target);
    await this.letGo();
  }

  /**
   * HOLD a finger, and KEEP IT DOWN — the first half of a touch drag, and the
   * first half of {@link hold} above.
   *
   * The two cannot be one method: a drag is what the finger does AFTER the
   * deadline, so a scenario about one has to be able to stop between them —
   * what the client does at that moment is lift the row
   * (`client/drag/dragging.ts`), which is a state on the page a step can assert
   * before anything has moved. But the deadline is one number and one wait, so
   * the shorter gesture is written in terms of this one rather than beside it.
   */
  async holdDown(target: Locator): Promise<void> {
    this.held = await this.middleOf(target, "held");
    await this.finger("touchStart", this.held);
    await this.page.waitForTimeout(LONG_PRESS_MS + LONG_PRESS_MARGIN_MS);
    await this.waitForFrame();
  }

  /** Move the finger that is already down, in steps rather than in one jump —
   *  a hand makes a path, and a gesture that arrived as a single event would
   *  pass over the frames the affordance is drawn in.
   *
   *  WHERE IT STARTED IS THE WORLD'S, not a step's: a drag is three steps and
   *  the path is measured from the press, so the alternative is a step file
   *  keeping the point in a module-global — one per worker, outliving the
   *  scenario that put it there. */
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

  /**
   * Shrink the viewport until the page has somewhere to scroll TO, and say so
   * if it has not.
   *
   * No fixture in this suite is taller than a screen on its own — the corpora
   * are outlines a person can read inside a scenario — so every scenario about
   * the page MOVING has to make its own room, and two of them do (a phone, and
   * a short laptop). The dimensions are each caller's, because 390px would
   * change the layout a desktop scenario is testing; the ASSERTION is not, and
   * it is the half that gives those steps their value: a fixture that grew past
   * one of the two heights, or a layout that stopped scrolling the document,
   * would otherwise leave the scenario after it passing over nothing.
   */
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

  /** ...and let it go, which for a drag is the drop. */
  async letGo(): Promise<void> {
    this.held = undefined;
    await this.finger("touchEnd");
    await this.waitForFrame();
  }

  /** Where the finger that is currently down went in, for as long as it is
   *  down. `undefined` between gestures, which is what makes "no finger is down
   *  to drag" an assertion rather than a stale point from the last scenario. */
  private held?: Point;

  /**
   * A finger that lands on something and then SCROLLS the page with it.
   *
   * The other half of the long press, and the reason it is a gesture this
   * suite can make: a press that opened a menu under a thumb on its way down
   * the outline would make the whole app unusable, so the scenario that says
   * it does not has to be a real drag — down, moving, up — rather than a tap
   * with a comment.
   */
  async flick(target: Locator): Promise<void> {
    const at = await this.middleOf(target, "flicked");
    await this.finger("touchStart", at);
    // Ten steps over the same span the deadline covers, so the finger is still
    // down when it passes: a drag that finished before the press could fire
    // would prove nothing about the press being dropped.
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

  /**
   * Tap SOMEWHERE ELSE, which {@link clickAway} cannot do on a phone: the
   * sidebar it presses is a drawer there, and putting it up first would be
   * pressing something rather than pressing nothing.
   *
   * The page below the tree is that nothing — no control, no navigation. The
   * point is checked against the menu panel because that is the one thing a
   * phone scenario has open over the page, and a "tap outside" that landed
   * inside it would pass by dismissing nothing.
   */
  async tapAway(): Promise<void> {
    const tree = await this.box(this.page.locator(OUTLINE_TREE).first(), "the outline tree");
    const view = this.page.viewportSize();
    assert.ok(view !== null, "this scenario has no viewport size");
    // Clear of the bottom of the screen, where a phone keeps the agent's strip.
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
    // Playwright's own, since this one is an ordinary tap: what the two
    // gestures above need the protocol for is a finger that STAYS down.
    await this.page.touchscreen.tap(at.x, at.y);
    await this.waitForFrame();
  }

  /** The middle of something, waited for and measured — where a finger that
   *  means to land on it goes. */
  private async middleOf(target: Locator, what: string): Promise<Point> {
    const box = await this.box(target, `the target being ${what}`);
    return { x: box.x + box.width / 2, y: box.y + box.height / 2 };
  }

  /** One touch event, through the DevTools protocol. The session is opened
   *  once per scenario: a session per press is a round trip per press, and it
   *  is attached to the page rather than to anything a step owns. */
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

  /**
   * Press SOMEWHERE ELSE — which is a gesture in its own right, because three
   * things in this app shut when it happens (a row's note, the `•••` menu, the
   * header's popovers).
   *
   * The sidebar is that somewhere: it is outside every row's gutter and every
   * panel, and pressing its top-left corner follows no navigation, so what a
   * scenario is left holding afterwards is the dismissal and nothing else.
   */
  async clickAway(): Promise<void> {
    const sidebar = this.page.locator(SIDEBAR).first();
    await sidebar.waitFor({ state: "visible", timeout: POLL_TIMEOUT });
    await sidebar.click({ position: { x: 8, y: 8 } });
    await this.waitForFrame();
  }

  /**
   * Put the caret on a node's own control WITHOUT a pointer.
   *
   * `attached` rather than `visible`, and `evaluate` rather than Playwright's
   * own `focus()`: the gutter's controls are `opacity-0` until the row is
   * hovered or something in it is focused, and taking the focus is exactly
   * what a scenario is doing here — waiting for them to be visible first would
   * be waiting for the thing the gesture causes.
   */
  async focusWithin(id: string, control: string): Promise<void> {
    const target = this.within(id, control);
    await target.waitFor({ state: "attached", timeout: POLL_TIMEOUT });
    await target.evaluate((el) => (el as HTMLElement).focus());
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

  /**
   * What a day cell in the month says about ITSELF.
   *
   * Four facts and one helper, because they are one widget: something is dated
   * the day, a document is named for it, it is today, it is the day being read.
   * Each is a `data-` attribute rather than the colour it is painted — the
   * marks are a promise and the palette is a styling decision a refactor may
   * change — and asking them through one method is what keeps a failure saying
   * which day and which fact rather than which selector.
   *
   * Here beside {@link daySelector} and {@link calendarDay} rather than in a
   * step file, because two features ask it now (the journal's three marks and
   * the daily notes' fourth) and the union of facts is the contract: a copy per
   * feature is a union widened twice every time the cell learns to say one more
   * thing.
   */
  async expectDayMark(
    date: string,
    fact: "data-dated" | "data-noted" | "data-today" | "data-open",
    expected: boolean,
  ): Promise<void> {
    await this.expectAttribute(
      daySelector(date),
      fact,
      String(expected),
      `the day ${date}`,
    );
  }

  /** The link a day cell is when it has something to show — and the empty
   *  locator it is when it has not, which is the assertion an inert day is. */
  dayLink(date: string): Locator {
    return this.calendarDay(date).locator("a");
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

  /**
   * The same records, off a file the served set MAY NOT HOLD YET — the reader
   * every assertion that WAITS for something to arrive in one goes through.
   *
   * Some writes in this app mint the file they land in: `archive` writes
   * `Archive.olai` the first time anything is put away. A scenario polling
   * for a node to ARRIVE there is polling for the FILE too, and a reader that
   * threw would fail on the first poll — at speed it usually does not, under
   * load it does, and what the failure then names is an ENOENT out of a helper
   * rather than the claim that was being made. Nothing written yet is "nothing
   * there yet", which is safe here precisely BECAUSE every caller waits: a
   * file that never arrives still fails, as the assertion it was making.
   *
   * ENOENT and nothing else. A line that is not JSON, or a directory where a
   * file should be, is a fault this suite reports rather than polls through.
   *
   * A step that WRITES the served directory calls {@link servedNodes} instead:
   * there, a missing file is a scenario naming something its corpus does not
   * hold, and it should say so the moment it is asked.
   */
  servedNodesSoFar(file: string): ReadonlyArray<Record<string, unknown>> {
    try {
      return this.servedNodes(file);
    } catch (cause) {
      if ((cause as NodeJS.ErrnoException).code === "ENOENT") return [];
      throw cause;
    }
  }

  /** One more record at the end of a served outline, as another writer would
   *  leave it — a `git pull`, the agent, a second tab.
   *
   *  APPENDED rather than written whole, which is the whole point of it having
   *  its own method: `writeServed` replaces the file, so a scenario using it
   *  mid-run would also undo whatever the keys under test have just done. What
   *  these scenarios are about is a page meeting a set that moved UNDERNEATH
   *  it. */
  appendServed(file: string, record: Record<string, unknown>): void {
    const lines = this.servedNodes(file).map((node) => JSON.stringify(node));
    this.writeServed(file, [...lines, JSON.stringify(record)].join("\n"));
  }

  removeServed(file: string): void {
    fs.rmSync(path.join(this.scratch(), file));
  }

  /** Ask git about the served directory — for the `@git` scenarios, whose
   *  subject is what ends up in the log. Read-only by convention: what puts a
   *  commit there is the app, which is the whole thing under test. */
  git(...argv: ReadonlyArray<string>): string {
    return execFileSync("git", [...argv], {
      cwd: this.scratch(),
      encoding: "utf8",
    });
  }

  /**
   * Somewhere for this scenario's repository to PUSH to — a bare repository in
   * a temp directory, wired up as `origin` with the branch tracking it.
   *
   * A real remote rather than a stub, for the reason the served directory is a
   * real repository: what is under test is what git does, and the whole point
   * of the push button is that a person never has to check by hand whether it
   * worked. A local bare clone is the smallest thing that can be checked
   * afterwards, and it needs no network.
   */
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

  /** What the bare remote holds, once this scenario has given itself one. */
  remoteGit(...argv: ReadonlyArray<string>): string {
    if (this.remote === undefined) {
      throw new Error("this scenario has no remote — give it one first");
    }
    return execFileSync("git", [...argv], { cwd: this.remote, encoding: "utf8" });
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

  /** What the browser says is AT a point, named the way the page names it: the
   *  nearest enclosing `data-testid`, the tag when nothing on that branch has
   *  one, or `"nothing"`.
   *
   *  The other half of {@link box}, and it exists because a bounding box cannot
   *  answer the question the sticky chrome is about. A bar or a column that
   *  something else paints over is still laid out exactly where it should be,
   *  still `visible` to Playwright, and still not what a pointer would reach —
   *  so a z-layer defect passes every geometric assertion there is. Three
   *  features ask this (the header's layer, the drawer's over the burger, the
   *  pinned rail's), which is why it lives here rather than a third time in a
   *  step file. */
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

  /** The same question asked of the MIDDLE of something, which is what every
   *  caller wants: the point a reader would aim at. */
  async topmostTestidOver(locator: Locator, what: string): Promise<string> {
    const box = await this.box(locator, what);
    return await this.topmostTestidAt(box.x + box.width / 2, box.y + box.height / 2);
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

  /** What this BROWSER is keeping under a preference key, straight out of its
   *  storage.
   *
   *  Four features now ask it — the theme, the panel widths, what a page does
   *  with finished work, and what is folded — and each had spelled the same
   *  `evaluate` round trip for itself. Here for the reason `documentBody` is:
   *  more than one step file asks, and passing the key THROUGH `evaluate`
   *  rather than closing over it is the mistake this stops anybody making a
   *  fifth time (the browser context has no access to this process's scope).
   *
   *  `page` is a parameter for the scenarios about a SECOND tab, which read the
   *  same origin's storage from another document. */
  stored(key: string, page: Page = this.page): Promise<string | null> {
    return page.evaluate((name) => localStorage.getItem(name), key);
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
