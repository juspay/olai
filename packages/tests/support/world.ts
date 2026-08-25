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
 * client that writes them, through the one door it publishes for this suite:
 * `@olai/web/testlib` (`imports.test.ts` sweeps this package for anything
 * deeper). A contract copied into both halves is a contract kept by memory:
 * renaming an attribute over there would still compile over here and fail
 * thirty seconds later as a bare timeout. Imported, the same rename is a
 * type error before the browser ever starts.
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
import {
  LONG_PRESS_MS,
  NODE_REF as CHAT_NODE_REF_ATTR,
  REFERRINGS,
  ROW_TESTID,
  selector,
  TESTID,
  type TestId,
} from "@olai/web/testlib";
import { listenHeaderProxy, type HeaderProxy } from "./headerProxy.ts";
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

/** Per-step budget for interaction polls against a settled UI — a click
 *  landing, an attribute flipping, a subtree appearing. */
/**
 * WHAT A READER WOULD COPY OUT OF THE BAR, as two readings of one URL — the
 * PLACE (everything but the query) and the whole ADDRESS.
 *
 * Functions over a `URL` rather than methods on the world, because both are
 * asked twice per assertion and from two sides: a step WAITS for the bar to
 * say something (Playwright hands its predicate a `URL`) and then ASSERTS what
 * it says (the world's accessors, below). Written out at each of those, they
 * are one expression maintained in four places — and the wait and the assert
 * drifting apart is the shape where a step passes on the way past: a race
 * where the pathname has landed and the fragment has not.
 *
 * The FRAGMENT is part of both, and that is not a detail: a node's address is
 * `/#<id>` and nothing else (`@olai/format`'s `address.ts`), so a reading that
 * took the pathname alone would answer `/` for every zoomed page — the front
 * page, and an assertion quietly passing for the wrong screen.
 */
export const placeOf = (url: URL): string => url.pathname + url.hash;

/** The place AND the query, in the URL's own order — which is why a narrowed
 *  node page is `/?q=…#<id>`. */
export const addressOf = (url: URL): string =>
  url.pathname + url.search + url.hash;

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

/**
 * Per-step budget for the one change only the CLIENT'S STEER DEADLINE can
 * deliver: a message put to an agent that took it and never answered.
 *
 * A fourth axis, on the same argument as the third. There is exactly one way to
 * see that face and it is to wait out `@olai/chat`'s own deadline
 * (the Claude leg's `STEER_TIMEOUT`, `@olai/chat`'s `agents/claude.ts`, thirty
 * seconds — the number is a claim about that agent's steering extension, not
 * about this suite, so it is not shortened to suit a test), and folding that wait into `HYDRATION_TIMEOUT` would make every
 * first paint in the suite wait on the slowest thing in it.
 *
 * Kept as a literal beside the interaction budgets rather than imported from
 * the client: this package deliberately imports NAMES from `@olai/*` and no
 * BEHAVIOUR, and a duration is neither — it is a number this suite must wait
 * PAST. The comment above is the contract; the scenario fails loudly and
 * specifically if it ever stops holding.
 */
export const STEER_DEADLINE_TIMEOUT = 45_000;

/**
 * Per-step budget for the one change only the SERVER's quiet window can
 * deliver: writes stopping, and what was waiting recording itself.
 *
 * A fifth axis, on the same argument as the third and the fourth. There is
 * exactly one way to see a flurry recorded and it is to stop writing and wait
 * out the window the server keeps (`@olai/format`'s `QUIET_MS`, fifteen
 * seconds — the number is a claim about the product, not about this suite, so
 * it is not shortened to suit a test), and folding that wait into
 * `HYDRATION_TIMEOUT` would make every first paint in the suite wait on it.
 *
 * Kept as a literal beside the other budgets rather than imported from the
 * client, exactly as `STEER_DEADLINE_TIMEOUT` is: this package imports NAMES
 * from `@olai/*` and no BEHAVIOUR, and a duration is neither — it is a number
 * this suite must wait PAST. The comment above is the contract; the scenario
 * fails loudly and specifically if it stops holding.
 */
export const QUIET_WINDOW_TIMEOUT = 40_000;

/**
 * ... and how long a scenario waits to prove the window did NOT fire.
 *
 * A negative claim about a timer can only be made by outliving it, so this is
 * the window itself plus room for the commit it would have made. Spelled rather
 * than derived from the budget above: that one is a DEADLINE a poll may return
 * early from, this one is a WAIT that is paid in full every time, and the two
 * will not always want to move together.
 */
export const PAST_QUIET_WINDOW = 22_000;

/** How long a freshly spawned server gets to print its listening line. Not a
 *  poll budget — it bounds a child process — but it is derived from the same
 *  scale so `hooks.ts` and this file cannot drift. */
export const SERVER_START_TIMEOUT = HYDRATION_TIMEOUT;

/** What a probe for `OlaiWorld.socketCarried` may be made of: printable ASCII,
 *  no `"` and no `\`. Those are the characters no text encoding this wire could
 *  use would rewrite, which is what makes "it is not in the raw frames" mean
 *  "it was not sent" rather than "it was spelled differently in there". */
const PLAIN_PROBE = /^[\x20-\x21\x23-\x5B\x5D-\x7E]*$/;

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

/** ... and the same again for the step that waits out a steer's deadline, for
 *  the same two reasons: the envelope must be wider than the wait it contains,
 *  and no other step should inherit a budget this wide. */
export const STEER_DEADLINE_STEP_TIMEOUT = STEER_DEADLINE_TIMEOUT + STEP_GUARD;

/** ... and once more for the step that waits out Auto-commit's quiet window. */
export const QUIET_WINDOW_STEP_TIMEOUT = QUIET_WINDOW_TIMEOUT + STEP_GUARD;

/** The `Before` hook may have to boot a server before it can open a page. */
export const SCENARIO_SETUP_TIMEOUT = SERVER_START_TIMEOUT + STEP_GUARD;

// ── the UI contract ────────────────────────────────────────────────────

/** The mount point — `index.html`'s, not the client's, so it is the one
 *  selector here the client does not own and the one spelled out locally. */
export const ROOT = "#root";

/** The sidebar row id for one of the registry's kinds, BY THE KIND'S NAME —
 *  the client's own table read rather than a fourth, fifth and sixth constant
 *  beside {@link DOCUMENT_LINK} and {@link HYPERTEXT_LINK}.
 *
 *  A kind the registry does not claim THROWS, and that is the point of the
 *  lookup being here: a scenario that says "the pictures listed are" would
 *  otherwise grip a selector nobody writes and fail thirty seconds later as a
 *  timeout, which reads as the app being broken rather than as the step being
 *  misspelled. */
export const rowsOfKind = (kind: string): string => {
  const testid = (ROW_TESTID as Record<string, TestId | undefined>)[kind];
  if (testid === undefined) {
    throw new Error(
      `no served file is a "${kind}" — the kinds are ${Object.keys(ROW_TESTID).join(", ")}`,
    );
  }
  return selector(testid);
};

/** Which of the three git situations a scenario's server was started into
 *  (`@git:…`) — spelled here, where the world's field is, because `hooks.ts`
 *  already reads this module and a second copy of the three words is a second
 *  place for the tag pattern and the field to disagree. */
export type GitMode = "repo" | "none" | "broken";
/** The app header: wordmark + chrome (search, connection, git, agent,
 *  preferences, who is looking). Always on screen. */
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
 *  is one of the registry's kinds or `folder` — the fact, not the ink. */
export const FILE_GLYPH = selector(TESTID.fileGlyph);
/** One document entry in the file tree (no second list — same folders). */
export const DOCUMENT_LINK = selector(TESTID.documentLink);
/** One `.html` entry in that same tree — its own id, so a step about documents
 *  goes on meaning documents. The three kinds the viewers added have one each
 *  for the same reason, and a step reaches them through the registry rather
 *  than through three more constants ({@link ROW_TESTID}). */
export const HYPERTEXT_LINK = selector(TESTID.hypertextLink);
/** A `.html` file's page: the sandboxed frame its markup is drawn in, and the
 *  only element of that page this app owns. */
export const HYPERTEXT_PREVIEW = selector(TESTID.hypertextPreview);
export const HYPERTEXT_SAID = selector(TESTID.hypertextSaid);
/** A `.csv` file's page: the table its rows are drawn as, and the line that
 *  says which rows a page this size left out. */
export const CSV_TABLE = selector(TESTID.csvTable);
export const CSV_CLAMP = selector(TESTID.csvClamp);
/** A picture's page: the `<img>`, which is the element that will not run an
 *  SVG. */
export const IMAGE_VIEW = selector(TESTID.imageView);
/** A `.pdf` file's page: the embed the browser's own viewer draws in. What is
 *  INSIDE it is the browser's and carries no id of ours, which is the same
 *  boundary the `.html` frame draws. */
export const PDF_EMBED = selector(TESTID.pdfEmbed);
export const BODY_REFUSED = selector(TESTID.bodyRefused);
/** One document, as a page: `/<file>`. */
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

// ── what refers to a node, read backwards ──────────────────────────────
/** The `<details>` under a zoomed node's heading. `data-count` is how many
 *  RECORDS refer to it; the element's own `open` says whether it is unfolded.
 *  Absent on a node nothing refers to. */
export const BACKLINKS = selector(TESTID.backlinks);
/** Its summary — the count in words, and what a pointer presses to open it. */
export const BACKLINKS_SUMMARY = selector(TESTID.backlinksSummary);
/** The same question one kind of thing over: the `<details>` under a
 *  DOCUMENT's body, absent on a document nothing points at. `data-count` is
 *  how many things do — a record that attaches or links it, or another
 *  document whose body links it. */
export const DOCUMENT_REFERRERS = selector(TESTID.documentReferrers);
/** Its summary — the count in words, and what a pointer presses to open it. */
export const DOCUMENT_REFERRERS_SUMMARY = selector(TESTID.documentReferrersSummary);
/** One row of that list. */
export const DOCUMENT_REFERRER = selector(TESTID.documentReferrer);
/**
 * One row inside it, found by the label a READER sees on it — the referrers
 * whose `see` lands here, or the ones whose title or note writes this node's
 * `@id`. Each holds `NODE_REF` links exactly as the forward rows do.
 *
 * Through the client's own table (`backlinks/way.ts`), which is what pairs a
 * way with its label and its testid: a suite that mapped a reader's word to a
 * testid here would be that pairing spelled a third time, and `EdgeRefs.tsx`'s
 * header says what a second spelling of it costs. THROWS on a label no row
 * carries — one rule, said once: a helper handing back `undefined` for the
 * caller to re-check is the same refusal written twice, and the second writer
 * is the one who forgets.
 */
/**
 * Every link one row of node references draws, in DOM order and counting
 * repeats — asserted as a WHOLE LIST rather than as a membership, because a row
 * drawing one target twice reads as a row drawing two and a step that looked
 * only for the target would pass over it.
 *
 * Here rather than in a step file because two suites ask it of two different
 * rows — the edge rows a node declares (`edge_steps.ts`) and the referenced-by
 * rows read backwards (`backlinks_steps.ts`) — and both had spelled the same
 * join, the same `oneLine` and the same waiting sentence for themselves. What
 * a row READS is one decision about one component (`NodeRefs.tsx`), so a change
 * to how it renders a link is one assertion to fix rather than two.
 */
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

/**
 * Whether a `<details>` is open — the BROWSER'S own answer, not a class this
 * app writes, which is the whole point of the two places that use one
 * (`document/Toc.tsx`, `backlinks/Backlinks.tsx`).
 *
 * One spelling of the cast, because it was four across two suites: what a
 * section reports about itself is one contract, and a DOM interface named at
 * four call sites is four edits with no compiler help.
 */
export const detailsOpen = async (locator: Locator): Promise<boolean> =>
  await locator.first().evaluate((el) => (el as HTMLDetailsElement).open);

export const backlinkRow = (label: string): string => {
  const drawn = REFERRINGS.find((one) => one.label === label);
  if (drawn === undefined) {
    throw new Error(`the referenced-by section draws no \`${label}\` row`);
  }
  return selector(drawn.refs);
};

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

// ── carrying a row to a new parent ─────────────────────────────────────
/** The move-to picker, in place under the row it was opened on. `data-row` is
 *  the RECORD being moved, `data-asked` the query its hits answer. */
export const MOVE_PICKER = selector(TESTID.movePicker);
/** Its search box — the server's own node search again, over the whole set. */
export const MOVE_SEARCH = selector(TESTID.moveSearch);
/** One destination in it; `data-id` is the node it would go under. */
export const MOVE_HIT = selector(TESTID.moveHit);
/** WHY the destination under the cursor cannot take the row — drawn at the
 *  aim, before `Enter`, and absent whenever the aim is a legal one. */
export const MOVE_REFUSED = selector(TESTID.moveRefused);
/** What the last MOVE said: the ops layer's refusal, or a nudge from one that
 *  landed. Never the same line as the aim's refusal above. */
export const MOVE_SAID = selector(TESTID.moveSaid);
/** The picker's way out for a pointer — and the one place in the panel that is
 *  not the search box, which is what makes it the position Escape has to be
 *  answered from as well. */
export const MOVE_CLOSE = selector(TESTID.movePickerClose);
/** One link from a node to another node, in either of those rows. The target
 *  id rides `data-ref`, which is what a scenario picks one by. */
export const NODE_REF = selector(TESTID.nodeRef);
/** The main pane. Present only when the loaded set is valid. */
export const OUTLINE_TREE = selector(TESTID.outlineTree);
export const NODE = selector(TESTID.node);
export const NODE_TITLE = selector(TESTID.nodeTitle);
export const TAG = selector(TESTID.tag);
/** A stretch of a title — or of the note line under one — the query LANDED on
 *  (`client/filter/lit.ts`). Drawn only where a filter put one, so its presence
 *  is half the assertion and its text is the other half. */
export const HIT = selector(TESTID.hit);
/** The one clamped line of a note a filter found the row BY, under the title of
 *  a row whose only hit is behind its ¶. */
export const DESC_HIT = selector(TESTID.descHit);
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
export const PANE = selector(TESTID.pane);
export const PANE_RAIL = selector(TESTID.paneRail);
export const PANE_HEADER = selector(TESTID.paneHeader);
export const PANE_CLOSE = selector(TESTID.paneClose);
export const PANE_RESIZE = selector(TESTID.paneResize);
export const PANE_TABS = selector(TESTID.paneTabs);
export const PANE_TAB = selector(TESTID.paneTab);
/** The same refusal on the two doors that ask the SERVER for it — the ⌘K
 *  palette and the header box. One name, because it is one sentence about one
 *  grammar; where each door draws it is that door’s own business. */
export const SEARCH_REFUSAL = selector(TESTID.searchRefusal);
/** …and the same count line on the same two doors: "8 of 20 matches", or no
 *  element at all when the door drew everything it found. Scoped by the step
 *  to the door it means, since one name serves both. */
export const SEARCH_COUNT = selector(TESTID.searchCount);
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
/** The `↻` pill beside a date, saying how the node COMES BACK in the format's
 *  own words — and, where the row is editable, the way into the picker below.
 *  `data-picks` carries which of the two it is, exactly as the date pill's
 *  does: a day page and the agenda draw a query, read-only. */
export const REPEAT = selector(TESTID.repeat);
/** The repeat picker, beside the date picker in every respect: in place under
 *  the row, opened from the pill above or from the `•••` menu's `Set repeat…`.
 *  Its control is a `<select>` over the format's CLOSED grammar, so what it
 *  holds is the text the record will hold, and its button's LABEL is the verb
 *  — `Stop repeating` being the menu's own words for the same edit once the
 *  empty option is chosen. */
export const REPEAT_PICKER = selector(TESTID.repeatPicker);
export const REPEAT_PICKER_RULE = selector(TESTID.repeatPickerRule);
export const REPEAT_PICKER_SET = selector(TESTID.repeatPickerSet);
export const REPEAT_PICKER_CANCEL = selector(TESTID.repeatPickerCancel);
/** The properties run under a node's title or a document page's path, and one
 *  `key value` chip of it. A chip carries `data-key`, and `data-system` on
 *  the read-only ones — the node's own facts, which have verbs of their own.
 *  A document's run is custom keys only. The value carries `data-door` where it
 *  turned out to NAME something, and nothing where it stayed text. */
export const PROPS = selector(TESTID.props);
export const PROP = selector(TESTID.prop);
export const PROP_VALUE = selector(TESTID.propValue);
/** ...and the disclosure a value too long to be a fact is drawn behind. */
export const PROP_FOLD = selector(TESTID.propFold);
/** The KEY half of a chip, which is the handle: pressing it opens the value for
 *  editing whatever the value is. A button only where the surface offers
 *  writing. */
export const PROP_KEY = selector(TESTID.propKey);
/** The box a value is typed in, in place of the chip's value — and, only while
 *  a NEW property is being named, the box its key is typed in. There is no
 *  panel and no Save button: Enter commits, Escape cancels, leaving commits
 *  what changed. */
export const PROP_EDIT = selector(TESTID.propEdit);
export const PROP_EDIT_KEY = selector(TESTID.propEditKey);
/** The `+` at the end of the run — the door onto adding one, drawn wherever
 *  there is a run to put it at the end of. */
export const PROP_ADD = selector(TESTID.propAdd);
/** What the last commit had to say, under the run — a refusal quoted verbatim,
 *  or a nudge that rode back on a write that landed. */
export const PROP_SAID = selector(TESTID.propSaid);
/** The rollup badge beside a title: how many of the tasks under this node are
 *  done. An annotation — the node's OWN mark is the checkbox. */
export const PROGRESS = selector(TESTID.progress);
export const DESC = selector(TESTID.desc);
/** The pilcrow beside a title: the door to the row's open state. Drawn only on
 *  a node that HAS one — a note, or a property somebody added — so its absence
 *  is the assertion that a row has nothing under it. */
export const NOTE_MARK = selector(TESTID.noteMark);
/** The one FACT a folded row may show beside its title (`client/hot.ts`) —
 *  `pr` on shipped work. The rollup is the other arm of that slot and keeps
 *  `PROGRESS` above. */
export const HOT_FACT = selector(TESTID.hotFact);
/** On a collapsed row: how much finished work the fold is holding back. */
export const FOLDED_DONE = selector(TESTID.foldedDone);
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
 *  from — and is what `support/caret.ts`'s reads are written around. */
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
/** The face a PANE wears while a row is held over it that cannot land there —
 *  the drag's other answer, and never drawn beside the line. `data-file` is the
 *  file that said no, and the sentence inside is the one the selection bar says
 *  once the pointer is released. */
export const DROP_REFUSED = selector(TESTID.dropRefused);
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
/** One day, as a page: `/d/<date>` and `/today`. */
export const DAY_PAGE = selector(TESTID.dayPage);
/** The day page's + day note — shown on any day without a note. */
export const DAY_MINT = selector(TESTID.dayMint);
/** Why minting one did not happen, beside the button. */
export const DAY_MINT_SAID = selector(TESTID.dayMintSaid);
export const DAY_GROUP = selector(TESTID.dayGroup);
export const DAY_EMPTY = selector(TESTID.dayEmpty);
/** The agenda: the same dates read forward. `data-date` is the day it was
 *  answered for, which `/agenda` does not spell. */
export const AGENDA_PAGE = selector(TESTID.agendaPage);
/** THE LINE, drawn exactly when something is owed — so its absence is a claim
 *  the page makes and not a layout accident. */
export const AGENDA_SPINE = selector(TESTID.agendaSpine);
/** One day ON that line. `data-date` is which day, `data-when` is which side of
 *  now it sits on, and its heading is the link to that day's own page. */
export const AGENDA_DAY = selector(TESTID.agendaDay);
/** A silence worth naming beside the line; `data-days` is how long the wait
 *  was. Absent wherever a gap is too short to be worth a word. */
export const AGENDA_QUIET = selector(TESTID.agendaQuiet);
/** Said in place of the line when nothing is due. */
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
/** The trash: the one `_olai/Trash.olai` the directory holds, read-only, one verb. */
export const TRASH_PAGE = selector(TESTID.trashPage);
/** One row of it — a trashed node; `data-node-id` is which. */
export const TRASH_ROW = selector(TESTID.trashRow);
/** The one verb a trash row offers. */
export const TRASH_PUT_BACK = selector(TESTID.trashPutBack);
/** What the last put-back had to say, under its row; `data-tone` is the mood. */
export const TRASH_SAID = selector(TESTID.trashSaid);
/** Said in the rows' place when nothing is in the trash. */
export const TRASH_EMPTY = selector(TESTID.trashEmpty);
/** The page's OWN verb: empty the Trash for good. Drawn only when the
 *  trash holds something, and never taken away by a filter. One id for its
 *  three states, so a step reaches the control rather than a state of it. */
export const TRASH_EMPTY_VERB = selector(TESTID.trashEmptyVerb);
/** The question that replaces it before anything is written. */
export const TRASH_EMPTY_CONFIRM = selector(TESTID.trashEmptyConfirm);
/** The way out of that question, which writes nothing. */
export const TRASH_EMPTY_CANCEL = selector(TESTID.trashEmptyCancel);
/** What the emptying said — the PAGE's line, since the write is about the
 *  one trash and there is no row to put it under. */
export const TRASH_PAGE_SAID = selector(TESTID.trashPageSaid);
/** The way to it, at the foot of the directory column. */
export const TRASH_LINK = selector(TESTID.trashLink);
/** And the way to the INBOX, beside Agenda — drawn only when the directory
 *  has one, which is what the scenarios about a never-captured vault read. */
export const INBOX_LINK = selector(TESTID.inboxLink);
/** What that entry REPORTS, wrapped round the link: `data-count` is how many
 *  top-level captures still await processing. */
export const INBOX_HELD = selector(TESTID.inboxHeld);
/** The number on it. Absent when the inbox is empty — a quiet door wears no
 *  chip rather than a zero. */
export const INBOX_COUNT = selector(TESTID.inboxCount);
/** THE day's note, above those groups: a document named for the date itself.
 *  `data-file` is which. */
export const DAY_NOTE = selector(TESTID.dayNote);
/** Its heading — the way from the day to the document's own page. */
export const DAY_NOTE_LINK = selector(TESTID.dayNoteLink);
/** Shown in the main pane when `/#<id>` names no node. The sidebar stays. */
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
  // Who is looking, last — an icon about the request, not about git.
  TESTID.identity,
];

/** The attribute that readout carried. Kept as a selector so the fence catches
 *  a second git chip that carries no test id of its own. */
export const RETIRED_GIT_READOUT = "[data-git]";
/** THE FREEZE: over everything, and everything under it inert — the wire
 *  cannot carry a question, so the app takes no gesture at all
 *  (`client/connection/Offline.tsx`). `data-connection` on it is the state that
 *  froze it, in the pill's own spelling. */
export const OFFLINE = selector(TESTID.offline);
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
export const PREFS_SET_BY = selector(TESTID.prefsSetBy);
export const PREFS_RESUME = selector(TESTID.prefsResume);
export const THEME_CHIP = selector(TESTID.themeChip);
export const FONT_SELECT = selector(TESTID.fontSelect);

/** The Commit pill in the chrome, and the panel it opens. The pill is ALWAYS
 *  drawn, and it is the header's ONE answer about git — `data-state` is which
 *  of its eight faces it is wearing (the fault among them, since the readout
 *  retired into it), and that is what a scenario asserts on. What git SAID is
 *  its `aria-label` and its tip, never a colour. */
export const COMMIT_PILL = selector(TESTID.commitPill);
export const GIT_NEWS = selector(TESTID.gitNews);
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
/** What git said when it last refused a push, verbatim. Off the git cell, so
 *  it is there for whoever opens the panel rather than only for the tab that
 *  made the request. */
export const COMMIT_PUSH_REFUSED = selector(TESTID.commitPushRefused);
/** Why the quiet-window loop stopped, in git's own words. Absent while the loop
 *  is running, which is what makes its PRESENCE the fact a scenario asserts. */
export const COMMIT_AUTO_PAUSED = selector(TESTID.commitAutoPaused);
/** What Auto-commit is about to do with what the panel is listing. Drawn only
 *  while it really is going to happen. */
export const COMMIT_AUTO_ARMED = selector(TESTID.commitAutoArmed);

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
export const PALETTE_LIST = selector(TESTID.paletteList);
export const PALETTE_ASK_ERROR = selector(TESTID.paletteAskError);
export const PALETTE_INPUT = selector(TESTID.paletteInput);
export const PALETTE_CAPTURE = selector(TESTID.paletteCapture);
export const PALETTE_CONFIRM = selector(TESTID.paletteConfirm);
export const PALETTE_SAID = selector(TESTID.paletteSaid);
export const PALETTE_SCRIM = selector(TESTID.paletteScrim);
export const SHORTCUTS = selector(TESTID.shortcuts);
/** The header box's panel of results, and the shelf of pins in the sidebar —
 *  here rather than spelled at a step file, which is where the rest of the
 *  suite's selectors live. */
export const HEADER_SEARCH = selector(TESTID.headerSearch);
export const HEADER_SEARCH_OPEN = selector(TESTID.headerSearchOpen);
export const HEADER_SEARCH_RESULTS = selector(TESTID.headerSearchResults);
export const PIN_SHELF = selector(TESTID.pinShelf);

export const CHAT_TITLE = selector(TESTID.chatTitle);
export const CHAT_WORKING = selector(TESTID.chatWorking);
export const CHAT_MODEL = selector(TESTID.chatModel);
/** WHO the conversation is with, beside the model. `data-agent` is the roster's
 *  own id, so a scenario names an agent rather than reading a brand name. */
export const CHAT_AGENT = selector(TESTID.chatAgent);
/** The mark in front of that name — its own selector because "icon and name"
 *  is the ruling, and a name with no mark passes an assertion about the name. */
export const CHAT_AGENT_MARK = selector(TESTID.chatAgentMark);
/** The picker: which agent this conversation is with. */
export const CHAT_CHOOSE = selector(TESTID.chatChoose);
/** One agent in it. */
export const CHAT_CHOOSE_AGENT = selector(TESTID.chatChooseAgent);
/** The way out of the picker `+ new` raised — absent when the panel is asking
 *  because it HAS no conversation. */
export const CHAT_CHOOSE_CANCEL = selector(TESTID.chatChooseCancel);
/** One agent the no-agent face tells you how to install. */
export const CHAT_INSTALL = selector(TESTID.chatInstall);
/** The composer PROMISING that a message sent now waits its turn at the agent
 *  and is got to when the running turn is over — drawn while a turn runs, for
 *  an agent whose queue is a fact olai has rather than a guess. */
export const CHAT_QUEUES = selector(TESTID.chatQueues);
/** The strip between the transcript and the box while the panel is busy —
 *  what a person sees when a turn or a boot is in flight and nothing has
 *  arrived to look at yet. */
export const CHAT_BUSY = selector(TESTID.chatBusy);
export const CHAT_SESSIONS = selector(TESTID.chatSessions);
export const CHAT_SESSION_LIST = selector(TESTID.chatSessionList);
export const CHAT_SESSIONS_REFUSED = selector(TESTID.chatSessionsRefused);
export const CHAT_SESSION = selector(TESTID.chatSession);
/** The heading over one agent's rows in the chats list. Drawn only where more
 *  than one agent has conversations here. */
export const CHAT_SESSION_AGENT = selector(TESTID.chatSessionAgent);
/** One agent in that list that could not be asked what it has stored. Its own
 *  selector and not the whole call's refusal, because the two are two states:
 *  this one leaves every other agent's conversations on the screen. */
export const CHAT_SESSION_UNREACHABLE = selector(TESTID.chatSessionUnreachable);
export const CHAT_TRANSCRIPT = selector(TESTID.chatTranscript);
/** The strip under the chat header: which MCP servers this conversation has.
 *  Drawn on every conversation, so its absence means there is none. */
export const CHAT_ROSTER = selector(TESTID.chatRoster);
/** One server on it. `data-server` is its name and `data-standing` is how it
 *  stands — the state as data, because which glyph says "connected" is a
 *  decision about pixels. */
export const CHAT_SERVER = selector(TESTID.chatServer);
/** The line saying the list is not the whole of what the agent can reach. */
export const CHAT_ROSTER_OWN = selector(TESTID.chatRosterOwn);
export const CHAT_MISSING = selector(TESTID.chatMissing);
export const CHAT_MISSING_SERVER = selector(TESTID.chatMissingServer);
export const CHAT_MISSING_WHY = selector(TESTID.chatMissingWhy);
export const CHAT_NO_AGENT = selector(TESTID.chatNoAgent);
export const CHAT_UNOPENED = selector(TESTID.chatUnopened);
export const CHAT_UNOPENED_WHY = selector(TESTID.chatUnopenedWhy);
export const CHAT_REOPEN = selector(TESTID.chatReopen);
export const CHAT_ENTRY = selector(TESTID.chatEntry);
export const CHAT_NEW = selector(TESTID.chatNew);
export const CHAT_ENTRY_STREAMING =
  `${selector(TESTID.chatEntry)}[data-kind="agent"][data-streaming="true"]`;
export const CHAT_TOOL = selector(TESTID.chatTool);
export const CHAT_TOOL_FOLD = selector(TESTID.chatToolFold);
export const CHAT_TOOL_DETAIL = selector(TESTID.chatToolDetail);
export const CHAT_TOOL_PROGRESS = selector(TESTID.chatToolProgress);
export const CHAT_TOOL_LOCATIONS = selector(TESTID.chatToolLocations);
export const CHAT_TOOL_ELAPSED = selector(TESTID.chatToolElapsed);
export const CHAT_LANE = selector(TESTID.chatLane);
export const CHAT_LANE_LABEL = selector(TESTID.chatLaneLabel);
export const CHAT_SPAWN = selector(TESTID.chatSpawn);
export const CHAT_SPAWN_WORKING = selector(TESTID.chatSpawnWorking);
export const CHAT_ARMED = selector(TESTID.chatArmed);
export const CHAT_WATCHING = selector(TESTID.chatWatching);
export const CHAT_WATCHING_TASK = selector(TESTID.chatWatchingTask);
export const CHAT_WATCHING_FOR = selector(TESTID.chatWatchingFor);
export const CHAT_ARMED_ENDED = selector(TESTID.chatArmedEnded);
export const CHAT_ARMED_STILL = selector(TESTID.chatArmedStill);
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
/** The strip on a `user` row that did not land, saying WHICH way in
 *  `data-delivery`, and the button that tries again — which only one of the two
 *  faces has. The words stay in the bubble above both. */
export const CHAT_DELIVERY = selector(TESTID.chatDelivery);
/** The strip on a `user` row the agent has not started on: it went out while a
 *  turn was running and is waiting its turn there. Not a delivery — nothing has
 *  failed — and it goes away when the agent takes the message up. */
export const CHAT_QUEUED = selector(TESTID.chatQueued);
export const CHAT_RESEND = selector(TESTID.chatResend);
export const CHAT_WAITING = selector(TESTID.chatWaiting);
export const CHAT_SEND = selector(TESTID.chatSend);
/** The other send: put these words INTO the turn the agent is running. Drawn
 *  only while there is a turn to interrupt and only for an agent that said it
 *  takes one — the visible door onto Alt+Enter, which is the same gesture. */
export const CHAT_INTERRUPT = selector(TESTID.chatInterrupt);
export const CHAT_CANCEL = selector(TESTID.chatCancel);
/** The shortlist over the message box, and one row of it. Both lists the
 *  composer completes draw the same box — the agent's commands under a `/`,
 *  what the directory holds under an `@` — so the row is named by its
 *  `data-value` (the command's name, the file's path, the node's id) and the
 *  box by its `data-kind`. The `@` list holds two BLOCKS, each with a label
 *  over its first row (`data-section`), which is a label and never a row: the
 *  arrows do not land on it. */
export const CHAT_COMPLETION = selector(TESTID.chatCompletion);
export const CHAT_COMPLETION_ROW = selector(TESTID.chatCompletionRow);
export const CHAT_COMPLETION_SECTION = selector(TESTID.chatCompletionSection);
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
/** What YOU typed, quoted. The other half of `CHAT_SAID`: a scenario that
 *  asks whether the human's words sat apart from the agent's finds them here,
 *  never by filtering the transcript for a string both speakers might use. */
export const CHAT_MINE = selector(TESTID.chatMine);
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
export const chatNodeRef = (id: string): string => attr(CHAT_NODE_REF_ATTR, id);
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

/** The one quote-safe way to grip a row by an attribute it carries, re-exported
 *  from `./selectors.ts` so every step goes on importing its selector
 *  vocabulary from one door. The rule lives next door because reaching it must
 *  not start Cucumber; the argument for both halves is over there. */
export { attr } from "./selectors.ts";

/** One node, as a selector. Spelled once: the world composes locators from it,
 *  and the steps that need a selector STRING — the retrying attribute waits —
 *  cannot take a `Locator`. */
export const nodeSelector = (id: string): string =>
  `${NODE}${attr("data-node-id", id)}`;

/** One day of the month, by the date it stands for. Same reason as above. */
export const daySelector = (date: string): string =>
  `${CALENDAR_DAY}${attr("data-date", date)}`;

/**
 * An ABSENCE, read off a page that has actually drawn something.
 *
 * "X is not on screen" is the assertion that passes for free on a page which
 * has drawn nothing at all, so it is never asked alone: `present` is the thing
 * whose arrival says the page is up, and only then is `absent` counted. Five
 * steps across three feature areas ask exactly this — a day drawing no note, a
 * day with no groups, and the three pages that must NOT say they are empty
 * while a filter is narrowing them — so it is one reading rather than five
 * copies of the wait-then-count.
 */
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

/**
 * GONE — a row that was on screen and is not any more, which is what hiding
 * finished work and narrowing a page both do.
 *
 * Polled for the element to detach rather than counted once: both of those
 * re-render, and reading the count in the same tick races the frame that drops
 * the row. The `catch` is deliberate — a row that was never there is already
 * gone, and the assertion below is what says so.
 */
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
  // WAITED FOR, THEN ASSERTED — the pattern the filter's count line already
  // uses, and for a reason that grew teeth when the filter became a question to
  // the server (`search-server-side`): a list read in the beat between a
  // keystroke and its answer is a list read one query early. The wait is what
  // makes the case pass; the assert is what makes a real failure print the two
  // lists rather than a bare timeout.
  await world.waitUntil(
    async () => JSON.stringify(await read()) === JSON.stringify(wanted),
    `the drawn ${attribute} list to be ${JSON.stringify(wanted)}`,
  ).catch(() => undefined);
  assert.deepStrictEqual(await read(), wanted);
};
/**
 * WHICH OF TWO IS DRAWN ABOVE THE OTHER, waited for rather than sampled.
 *
 * The sibling of {@link expectDrawn}, for the question that is about a PAIR
 * rather than about a whole list: sibling order after a move, and which block
 * of a two-kind completion comes first. Both were the same fifteen lines in two
 * step files — one `evaluateAll` over the attribute, one `indexOf` comparison,
 * one sentence — which is the shape this file exists to hold once (the reason
 * `expectDrawn` gives about its own two callers).
 *
 * `first` must be PRESENT as well as above: an absent row has an `indexOf` of
 * `-1`, which is above everything.
 */
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

/** What {@link OlaiWorld.intoReach} measured: whether the point a press would
 *  land on belongs to the control, what is there instead, and — when that
 *  something is pinned in the flow — how far the page has to move for the
 *  control to come out from under it. `clearBy` is a `scrollBy` argument, so
 *  negative moves the page UP, which moves the control DOWN the screen; 0 is
 *  "the page has no room to do it either way". */
interface Cover {
  readonly pressable: boolean;
  /** The point a press would land on is outside the viewport, so there is no
   *  element there to be on top or not — a fact of its own, because it is not
   *  pressable and there is nothing to clear. */
  readonly offscreen: boolean;
  readonly pinned: boolean;
  readonly clearBy: number;
  /** What is on top, and the control itself — named the way the DOM names
   *  them, for the sentence a refusal is reported with. */
  readonly by: string;
  readonly control: string;
  /** Where the page is, and the furthest down it goes — the other half of that
   *  sentence, because "it will not move" and "it is already there" read the
   *  same from outside. */
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
    // OFF THE SCREEN is neither pressable nor covered, and calling it either
    // is what would let this guard miss the case it exists for: a point
    // outside the viewport has no element at all, so a control below the fold
    // used to measure as "nothing on top" and go to the press unexamined —
    // where Playwright scrolls it in, meets whatever is pinned there, and
    // rescues it exactly as before. {@link OlaiWorld.intoReach} brings it in
    // first and asks again.
    if (hit === null) {
      return { ...where, pressable: false, offscreen: true, pinned: false, clearBy: 0, by: "nothing — the point is off the screen", control: named(el) };
    }
    // NOTHING ON TOP, said three ways: the point IS the control, is inside it,
    // or is an ancestor of it — a control the pointer reaches through its own
    // row is not covered by that row, and what to do about anything else is
    // Playwright's business rather than ours.
    if (hit === el || el.contains(hit) || hit.contains(el)) {
      return { ...where, pressable: true, offscreen: false, pinned: false, clearBy: 0, by: named(hit), control: named(el) };
    }
    // The nearest thing over it that HOLDS ITS PLACE IN THE FLOW. Walked up
    // from the hit rather than read off it: what a pointer lands on is a word
    // inside a pinned row, and the box that has to be cleared is the row's.
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
    // The two ways out, each a whole pixel past the boundary — a control whose
    // edge is exactly the cover's edge is still under it — and then the room
    // the page has for each: scrolling UP is what moves the control DOWN, so
    // what it needs is the page's distance from the top.
    const down = over.bottom - box.top + 1;
    const up = box.bottom - over.top + 1;
    const roomToMoveDown = at;
    const roomToMoveUp = furthest - at;
    const canDown = roomToMoveDown >= down;
    const canUp = roomToMoveUp >= up;
    const clearBy = canDown && (!canUp || down <= up) ? -down : canUp ? up : 0;
    return { ...covered, pinned: true, clearBy, by: named(pinned) };
  });

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

  /**
   * What the reverse proxy in front of this tab injects, as it accumulates.
   *
   * Playwright's `setExtraHTTPHeaders` does not apply to websocket
   * connections — the browser cannot set those headers — so a chip that
   * reads identity off the upgrade would never see them. The harness sits a
   * real reverse proxy in front instead, the way `tailscale serve` does.
   * Kept here, per scenario, and written back whole each time.
   */
  private proxied: Record<string, string> = {};
  private headerProxy?: HeaderProxy;

  /** Inject one more header on every request this tab makes from here on.
   *  Before the first navigation, which is when a proxy would have. */
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

  /** Drop the header proxy, if a scenario started one. */
  async closeHeaderProxy(): Promise<void> {
    const proxy = this.headerProxy;
    this.headerProxy = undefined;
    if (proxy !== undefined) await proxy.close();
  }

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

  /** …and every one of those the browser then REFUSED to make, with the reason
   *  it gave, collected by the same hook. A request is recorded above the
   *  moment a document asks for it, which is before anything decides whether it
   *  may happen — so `report.html`'s remote picture is in `requests` and never
   *  reached the network at all. The two together are what let a step say which
   *  of those it was ("the preview reached nothing off this server",
   *  `step_definitions/html_steps.ts`); the reason is kept because "blocked by
   *  the policy" and "that host does not exist" are the same silence otherwise,
   *  and a fixture pointing at an unresolvable host would prove the policy
   *  works by never testing it. */
  refused: Array<{ readonly url: string; readonly why: string }> = [];

  /**
   * Every frame the WEBSOCKET delivered to this tab, as text — or `undefined`
   * for a scenario that did not ask to be recorded (`@wire`, `hooks.ts`).
   *
   * The other wire, and the one nothing else here can see: `requests` is what
   * the page FETCHED, and everything a served file's content does afterwards
   * comes down one long-lived socket that makes no requests at all. A claim
   * about what the server chose to SEND a reader has to be made against this.
   *
   * It is the whole payload rather than a parse of it, deliberately. What a
   * step asks is whether some text was in what arrived — a document's body,
   * usually — and decoding the framing to answer that would be this suite
   * holding a second implementation of the protocol, which would go on passing
   * after the real one changed shape. A binary frame is decoded as UTF-8 for
   * the same reason: the question is about text that either is or is not in
   * those bytes.
   *
   * BY REQUEST, unlike its two neighbours, and that is the one thing about it
   * worth a sentence. `requests` and `errors` are small records; this is every
   * byte the socket delivered, retained for the scenario's life — a
   * transcript's token-by-token deltas, a document's whole body — and two
   * scenarios in the suite ask about it. So it is armed by a tag, and the
   * absence of the tag is a THROW rather than an empty list ({@link
   * socketCarried}), because the load-bearing assertion here is a negative one
   * and a negative over nothing recorded passes for the wrong reason.
   */
  socketFrames?: string[];

  /**
   * …and every frame the tab SENT down it — every question this reader asked —
   * under the same `@wire` tag, `undefined` without it.
   *
   * The mirror of {@link socketFrames}, and the half that answers a different
   * kind of claim: not "what did the server choose to send" but HOW OFTEN THIS
   * TAB ASKED. Nothing else here can say it. `requests` is what the page
   * fetched, and the surface fetches nothing — every procedure call and every
   * subscription this client opens is a frame on this socket
   * (`@kolu/surface`'s links), so a claim that a gesture costs ONE call, or
   * that a spent panel stopped watching, is a claim about this list.
   *
   * Read through {@link socketAskedSince}, which counts them from a mark: a
   * count over the scenario's whole life is a count of everything the boot did
   * too, and the questions worth counting are the ones a gesture caused.
   */
  socketAsks?: string[];

  /**
   * Whether anything the socket delivered carried this text — see {@link
   * socketFrames}.
   *
   * Over the WHOLE scenario, which is what tells it from {@link
   * socketSaidSince}: this asks whether a body ever crossed, and that one asks
   * what a gesture caused. The two ways either could quietly say "no" — a
   * recorder nobody armed, and a probe the framing could have rewritten — are
   * refused rather than documented, in {@link framesMatching}.
   */
  socketCarried(text: string): boolean {
    return this.framesMatching(
      this.socketFrames,
      0,
      [text],
      "nothing recorded what the socket delivered; a scenario asking about " +
        "the wire has to carry the @wire tag",
    ).length > 0;
  }

  /** Where in {@link socketAsks} and {@link socketFrames} a scenario started
   *  counting — both at once, because they are one act ({@link markWire}) and
   *  a scenario that marked one but not the other is not a state that
   *  exists. */
  private wireFrom?: { readonly asked: number; readonly said: number };

  /** Start counting what crosses this tab's socket, in both directions, so a
   *  later step can say what a gesture cost. `watchRequests`' arrangement one
   *  wire over: a MARK into the recordings rather than a second listener. */
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

  /**
   * How many questions carrying all of `probes` this tab has asked since that
   * mark.
   *
   * THE FIRST PROBE IS A WIRE TAG — `<member>/<verb>`, which is how kolu
   * addresses every member of a surface (`surfaceTag`,
   * `<prefix><member>/<verb>`; the prefix is left off so this is a substring of
   * whatever a composed surface makes the whole tag). A frame carrying it is
   * this tab opening that subscription or calling that procedure, and the count
   * is what a claim like "one call for the word, not one per letter" is made
   * against.
   *
   * ANOTHER PROBE BESIDE IT narrows the same question to the ARGUMENT: the
   * payload rides the frame, so a tag plus an id is "did this tab ask that
   * member about that node". That is how a claim about what a gesture asked
   * ABOUT is made — a picker that opened asking about the last list's rows
   * sends the right member with the wrong argument, and the tag alone cannot
   * tell the two apart.
   */
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

  /**
   * …and the answer to the same question in the other direction: how many
   * frames the server has DELIVERED since that mark carrying all of `probes`.
   *
   * SEVERAL probes rather than one, because what identifies a subscription's
   * answer is a field name and the thing it is about together — either alone
   * is a substring of frames from other members. It is how a claim that a tab
   * STOPPED WATCHING is made: a subscription nobody let go of goes on being
   * answered, and the answer arriving is the only trace it leaves.
   */
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

  /**
   * The frames from `from` on that carry ALL of `probes` — the one matcher the
   * three questions above are asked through, so the rule about what a probe may
   * be is written once.
   *
   * TWO REFUSALS rather than a quiet answer, because every caller's assertion
   * is a NEGATIVE and a negative over nothing recorded passes for the wrong
   * reason. A scenario that never armed the recorder (or never marked) throws
   * in `unarmed`'s words, the way `requestsWatched` does for the same class of
   * mistake. And a probe this cannot honestly look for throws too: the frames
   * are raw, so a probe only appears in them if the encoding carrying it left
   * it alone — `"a \"quote\""` is not in a JSON frame however squarely the body
   * was sent. What is admitted is therefore narrower than any one encoding's
   * rule and deliberately so: PRINTABLE ASCII with no `"` and no `\`
   * ({@link PLAIN_PROBE}), which no text encoding this wire could use escapes.
   * Being refused a probe costs a scenario one rewording; accepting one costs a
   * passing test that proves nothing. Non-ASCII is refused for that reason
   * rather than because JSON escapes it (JSON does not): whether `é` survives a
   * frame is the encoder's business, and this is not the place to find out.
   */
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

  /** How far down the page a scenario deliberately scrolled, so a later step
   *  can claim the page came back to exactly there. A number the SCENARIO
   *  chose to remember rather than one written down here: how tall a page is
   *  depends on the fixture, the window and the stylesheet, and a step that
   *  asserted a pixel count would be asserting on all three. */
  scrolledTo?: number;

  /** How many history entries the tab had when a scenario last looked — the
   *  ledger a page navigating the app with no reader in it would grow. Same
   *  arrangement as `scrolledTo` above and for the same reason: what the number
   *  IS depends on how the scenario got here, so the scenario remembers it and
   *  the step compares. */
  historyWas?: number;

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
  /** `@opencode`: this scenario's machine HAS opencode, so its server's roster
   *  is two agents and the panel asks which one a conversation is with. Every
   *  other scenario's agent search path is empty — see `hooks.ts`. */
  hasOpencode = false;
  /** Which git situation this scenario's server was started into (`@git:…`),
   *  or `undefined` for the `--no-commit` every other scenario runs with.
   *  Carried for the same reason as the three above: a restart mid-scenario has
   *  to reproduce the first boot, and this one decides both the argv and what
   *  the served directory IS. */
  gitMode?: GitMode;
  /** The git POLICY this scenario's server was started with (`@pin:commit=…`,
   *  `@pin:push=…`) — an empty object for the ordinary server, which pins
   *  nothing and leaves both preference rows to the browser. Carried for the
   *  same reason as `gitMode`: a restart has to reproduce the first boot, and
   *  this decides what every browser's preferences panel is allowed to do. */
  gitPin: { commit?: string; push?: string } = {};
  /** The avatar URL template this scenario's server was started with
   *  (`@avatar-template`), or `undefined` for the ordinary server, which has
   *  none and pictures people from the rungs below it. Carried for the same
   *  reason as `gitPin`: a restart has to reproduce the first boot, and a
   *  server that came back without its template would picture the open page's
   *  person differently — a different server rather than the same one
   *  restarted. */
  avatarTemplate?: string;
  /** The URL this tab talks to: the corpus's server, until `proxyInjects`
   *  sits the reverse proxy in front, after which it is the proxy. Restart
   *  and port reads in hooks.ts want the server's own URL, so a scenario
   *  that combined a Tailscale Given with a restart would fail here. */
  baseUrl!: string;

  /** The directory being served, for a `@scratch:` scenario — a private copy
   *  of the corpus that this scenario is allowed to EDIT while the server
   *  watches it. Undefined for the shared corpora, which are the tracked
   *  fixtures and must not be written to. A `@share-scratch` feature still
   *  sets this: the copy is private to this worker, shared with the other
   *  scratch scenarios of that feature on this worker. */
  served?: string;
  /**
   * Set only while this scenario is on a feature-shared scratch. Absent
   * means the copy is private (killed in After) or there is no copy. After
   * restores the tree and asks the server to re-read; the fixture origin
   * lives on the slot, not here.
   */
  scratchShare?: ScratchShare;
  /** Where this scenario PUSHES to, once it has asked for one: a bare
   *  repository in a temp directory, wired up as `origin`. Undefined for every
   *  scenario that is not about pushing, which is all but one of them. */
  remote?: string;
  /** The server process a `@scratch:` scenario is served by. Killed in
   *  `After` when the copy is private; left running when `@share-scratch`. */
  ownServer?: ChildProcess;
  /** A listen on this scenario's port, held between stop and restart so
   *  another worker cannot steal it. Released by `startOwnServer`, or by
   *  `After` if the scenario never came back. */
  portHold?: Server;
  /** A coding agent in a terminal, for the scenarios about the tool surface
   *  olai does not own the client of: an HTTP POST at this server's `/mcp`. */
  terminalAgent?: TerminalAgent;
  /** The last tool RESULT that agent got. Read by later steps than the one
   *  that provoked it, which is what makes it the world's rather than a
   *  module's — a step file holding it would share it across scenarios. */
  toolAnswer?: Record<string, unknown>;
  /** …and what a `resources/read` handed back, as its text. The other half of
   *  what an agent may reach: the tools are what it can DO and the resources
   *  are what it can SEE, and a body is one of those. */
  resourceRead?: string;
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
    // Absolute against THIS scenario's baseUrl: `proxyInjects` may have
    // pointed it at the header proxy after the Playwright context was
    // created with the server's own origin.
    await this.page.goto(new URL(path, this.baseUrl).href);
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
   *  no click history behind it. That is the whole promise of `/#<id>`, and
   *  navigating there in-app instead would never test it. */
  async openNode(id: string): Promise<void> {
    await this.open(`/#${encodeURIComponent(id)}`);
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
    await this.open(`/${file.split("/").map(encodeURIComponent).join("/")}`);
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
    return this.fileLink(DOCUMENT_LINK, file);
  }

  /** One sidebar `.html` entry, on the same terms. */
  hypertextLink(file: string): Locator {
    return this.fileLink(HYPERTEXT_LINK, file);
  }

  /** One sidebar row of ANY registered kind, by the kind's own name — the
   *  client's own per-kind id table, read rather than copied
   *  (`@olai/web`'s `file/kinds.ts`). It is what the viewers' steps grip, so
   *  a seventh kind is a row in that table and no new step here. A kind the
   *  registry does not claim is a scenario naming something that cannot
   *  exist, so it throws rather than timing out on a selector nobody
   *  writes. */
  kindRows(kind: string): Locator {
    return this.page.locator(rowsOfKind(kind));
  }

  /** ...and one of them, by the path it stands for. */
  kindLink(kind: string, file: string): Locator {
    return this.fileLink(rowsOfKind(kind), file);
  }

  /** One row of the sidebar tree, whichever kind of file it stands for. Each
   *  kind has a testid of its own — a step that says "the documents listed
   *  are …" is asking about ONE of them — but the SELECTOR shape is one thing,
   *  and it was three copies of the same template string before this. */
  fileLink(testid: string, file: string): Locator {
    return this.page.locator(`${testid}${attr("data-file", file)}`);
  }

  /**
   * Assert exactly which files the tree lists under one kind's testid, in the
   * order it draws them.
   *
   * WAITED FOR BY COUNT rather than read once: a file dropped into the served
   * directory arrives on a later frame, and reading during the frame that adds
   * it would see the tree without it. Here rather than in a step file because
   * two kinds ask it now — the documents and the pages — and a second copy of
   * the wait is how one of them quietly stops being live.
   */
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
    return this.page.locator(`${FILE_DIR}${attr("data-path", path)}`);
  }

  /** A node's `doc` reference — its own, not a descendant's. */
  docRef(id: string): Locator {
    return this.node(id).locator(DOC_REF).first();
  }

  /** One day of the month in the sidebar. */
  calendarDay(date: string): Locator {
    return this.page.locator(daySelector(date));
  }

  /** The PLACE the browser is at — {@link placeOf} of the bar, minus the
   *  origin the harness picked at random. */
  place(): string {
    return placeOf(new URL(this.page.url()));
  }

  /** The place AND the query — {@link addressOf} of the bar. Its own accessor
   *  beside {@link place} because most assertions in this suite are about the
   *  place alone: a step asserting "/house.olai" must not start passing for a
   *  page that is also filtered. */
  address(): string {
    return addressOf(new URL(this.page.url()));
  }

  /** One sidebar entry, by the relative path it stands for. */
  outlineLink(file: string): Locator {
    return this.fileLink(OUTLINE_LINK, file);
  }

  /** ONE PANE of the workspace, by its index — the scope every question about
   *  a split has to be asked in. A node id is unique in a SET and not on a
   *  SCREEN: two panes showing one file draw every row of it twice, so
   *  "the bullet of `knobs`" has no answer until a step says which column it
   *  means. Spelled once here for the reason every other selector is. */
  pane(index: number): Locator {
    return this.page.locator(`${PANE}${attr("data-pane", String(index))}`);
  }

  /** Where a row is looked for when the step does NOT name a pane: the whole
   *  page. The unscoped answer, as a scope — so the helpers that take one do
   *  not need a second arity for the lone case. */
  everywhere(): Locator {
    return this.page.locator("body");
  }

  /** One node in the tree, by id. Ids are unique across the whole loaded set,
   *  so this never needs a scope — except inside a mirror, where the target's
   *  subtree is rendered a second time, or inside a split, where a second pane
   *  may draw the same file; those steps scope explicitly ({@link pane}). */
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
   *  either way, and was three copies before it was a parameter.
   *
   *  MODIFIERS are the second parameter for the same reason, and they arrived
   *  the same way: an Alt-click opens a pane to the right, and every step that
   *  wanted one had written the trio out again with `{ modifiers }` on the end
   *  — four copies of the wait and the settle, each with its own spelling of
   *  the timeout. A tap takes them too (Playwright's own option on both), so
   *  this stays one call rather than a branch. */
  async press(
    target: Locator,
    gesture: "click" | "tap" = "click",
    modifiers?: ReadonlyArray<"Alt" | "Shift">,
  ): Promise<void> {
    await target.waitFor({ state: "visible", timeout: POLL_TIMEOUT });
    // A press this suite makes has to be a press a READER could make. The half
    // of that Playwright does not do for us is {@link intoReach} — its own
    // paragraph says what the alternative costs.
    await this.intoReach(target);
    await target[gesture](modifiers === undefined ? {} : { modifiers: [...modifiers] });
    await this.waitForFrame();
  }

  /**
   * PUT A CONTROL WHERE IT CAN BE PRESSED — out from under whatever is pinned
   * over it — and say so loudly when the page will not move far enough.
   *
   * What this exists for is a rescue Playwright performs in silence. A click
   * hit-tests the point it is about to press; when something else is on top,
   * the action is RETRIED, and every attempt re-runs "scroll into view if
   * needed" — so a press that could not land where it was aimed is answered by
   * scrolling the page to wherever the browser had to put it. Nothing says so
   * and the step passes, which is fine until the scenario is about WHERE THE
   * PAGE IS. `zoom_and_navigate.feature`'s scroll restore is: it scrolled to
   * the bottom, pressed a bullet lying under the pinned `kitchen` section
   * heading (`client/Tree.tsx` — a section holds its place while its own
   * branch scrolls past), and under load was rescued to the top before the
   * navigation. The client then remembered 0, restored 0, and had done nothing
   * wrong; the scenario had asked for a press nobody could make, against a
   * position sampled before the rescue.
   *
   * STICKY IS THE TEST, and it is the app's own distinction rather than a
   * guess. Something `sticky` holds its place IN THE FLOW (`AppHeader.tsx`
   * argues that choice for the bar): it is chrome the page scrolls under, it
   * will still be where it is next frame, and moving the page is exactly what
   * a reader does to reach what it covers. Something `fixed` is an overlay
   * over the whole app — the drawer, its scrim, both faces of the chat panel —
   * and scrolling the page out from under one of those is not a reader's
   * answer to it; neither is anything else on top, which is on its way
   * somewhere. Both are left exactly as they were, because waiting for them to
   * go is what Playwright already does, and does correctly.
   *
   * OFF THE SCREEN IS ITS OWN CASE, and it was the hole in the first cut of
   * this: a point outside the viewport has no element at it, `elementFromPoint`
   * answers `null`, and reading that as "nothing on top" sends a control below
   * the fold to the press unexamined — where Playwright scrolls it in, meets
   * whatever is pinned where it landed, and rescues it exactly as before. So
   * the scroll that brings it in is taken here, deliberately, and the cover is
   * measured afterwards, on a control that is actually on the screen.
   *
   * WHICH WAY IS ARITHMETIC, and the room decides it. The control can be moved
   * DOWN the screen (the page scrolls up) or UP it (the page scrolls down),
   * and the shorter of the two is preferred — but only among the ones the page
   * can actually do, which is the whole point at the BOTTOM of a page, where
   * one of the two does not exist and asking for it is a no-op that reads as
   * "the correction did not work".
   *
   * ONE CORRECTION, then the state is read again — never a loop that nudges
   * until something works. A pinned box holds one position while the page
   * moves under it, so one move clears it or nothing will, and "nothing will"
   * is a scenario asking for the impossible: it throws naming what is on top
   * and where the page already is, rather than leaving the page to be scrolled
   * somewhere nobody chose.
   */
  async intoReach(target: Locator, what?: string): Promise<void> {
    const first = await coverOf(target);
    // A control whose centre is off the screen has to be brought in before the
    // question can even be asked — and bringing it in is where it meets what
    // is pinned, so the answer that matters is the one from AFTERWARDS.
    const before = first.offscreen
      ? await this.intoView(target)
      : first;
    if (before.pressable || !before.pinned) return;
    await this.page.evaluate((by) => window.scrollBy(0, by), before.clearBy);
    await this.waitForFrame();
    const after = await coverOf(target);
    if (after.pressable) return;
    throw new Error(
      `${what ?? after.control} is under ${after.by}, which is pinned there, ` +
        `and the page will not come out from under it: it is at ${after.at}px ` +
        `of ${after.furthest}px. A press here is a press no reader could make ` +
        `— left alone, Playwright answers one by scrolling the page until it ` +
        `lands, which leaves the reader somewhere nobody chose.`,
    );
  }

  /** …the scroll that brings an off-screen control in, taken HERE and
   *  deliberately rather than left inside Playwright's retry — same call the
   *  press would make, one frame to settle, and then the cover is measured on
   *  a control that is actually on the screen. */
  private async intoView(target: Locator): Promise<Cover> {
    await target.scrollIntoViewIfNeeded({ timeout: POLL_TIMEOUT });
    await this.waitForFrame();
    return await coverOf(target);
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
    const view = this.viewport();
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
        .locator(`${selector}${attr(attribute, expected)}`)
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

  /** The link a day cell always is — every day goes to `/d/<date>`, empty
   *  or not. */
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
          `@scratch:${this.corpus} rather than @corpus:${this.corpus} — a shared ` +
          `corpus is one copy of a tracked fixture, served to every other ` +
          `scenario this worker runs`,
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
   * `_olai/Trash.olai` the first time anything is put away. A scenario polling
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

  /** One more LINE at the end of a served document, which is the same door
   *  {@link appendServed} is one file-kind over: a `.md` is a text, not a set
   *  of records, so it appends a line rather than a JSON object.
   *
   *  It exists for the same reason that one does — a rewrite would undo
   *  whatever else the scenario has done — and for a second: a scenario whose
   *  subject is a file CHANGING under an open page has to say what changed in
   *  one line, or the feature carries two copies of a long document that a
   *  future editor must keep identical by hand. */
  appendServedLine(file: string, line: string): void {
    const held = fs.readFileSync(path.join(this.scratch(), file), "utf8");
    this.writeServed(file, `${held}\n${line}\n`);
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

  /**
   * Somebody else's commit, landed on the remote — which is what a DIVERGENCE
   * is, and the only shape of conflict a single user with two machines ever
   * meets.
   *
   * A clone, a commit and a push, so what the served repository is up against
   * is a real non-fast-forward rather than a simulated refusal: the words the
   * app then shows are git's own, and those are the words being asserted.
   */
  advanceRemote(subject: string): void {
    const remote = this.remote;
    if (remote === undefined) {
      throw new Error("this scenario has no remote — say the repository has one first");
    }
    const work = fs.mkdtempSync(path.join(os.tmpdir(), "olai-e2e-other-"));
    const run = (...argv: ReadonlyArray<string>): void => {
      execFileSync("git", [...argv], { cwd: work, stdio: "ignore" });
    };
    execFileSync("git", ["clone", "--quiet", remote, work], { stdio: "ignore" });
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
    run("push", "--quiet");
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

  /** How big the WINDOW is — the other half of {@link box}, and the thing
   *  every "is it on screen" assertion is measured against.
   *
   *  Playwright answers `null` when a context was made with no viewport at
   *  all, which no context here is (`support/hooks.ts` gives every one of them
   *  an explicit size). So the null is not a case to carry — it is a fact
   *  about a suite that has been mis-set up, and the honest thing to do with
   *  it is fail saying so. Nine step files had each written that same two-line
   *  ask-and-assert for itself, which is well past the three or four that put
   *  a helper here rather than in a step file. */
  viewport(): { readonly width: number; readonly height: number } {
    const size = this.page.viewportSize();
    assert.ok(size !== null, "this scenario has no viewport size");
    return size;
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

  /** Where a `.html` preview's frame was pointed when a scenario looked, so a
   *  later step can claim the frame was NOT re-pointed by something that
   *  happened elsewhere. The address carries the component's own visit counter
   *  (`client/document/Hypertext.tsx`), so "the same address" is exactly "the
   *  frame was not navigated" and nothing weaker. */
  previewPointedAt?: string;

  /** The paper the page was painted in before a theme was picked. The only
   *  colour any scenario holds on to, and it is compared against itself: what
   *  a palette's paper IS is a design decision, and that it CHANGED is the
   *  claim. */
  paperBefore?: string;

  /** A box taken BEFORE something replaced what was inside it, for the
   *  scenarios that claim the swap changed nothing about it — the markdown
   *  renderer landing under a note, and under a tree row's title
   *  (`step_definitions/markdown_steps.ts`). Compared against itself, like the
   *  paper above: WHICH of its numbers is the claim belongs to the step that
   *  reads it, and no number in it is a fact about this app anybody wrote
   *  down. */
  blockBefore?: Box;

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
