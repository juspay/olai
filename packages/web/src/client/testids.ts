/**
 * The names the browser tests find things by.
 *
 * A `data-testid` is a contract between two packages that never import each
 * other, and the way that contract normally breaks is silent: someone renames
 * an attribute, the selector still compiles, and a scenario fails thirty
 * seconds later with a timeout that says nothing about why. Declaring them
 * here and importing them on both sides makes a rename a type error.
 *
 * ONE NAME OF THAT KIND IS NOT HERE, and it is worth saying where it went:
 * `KEYS_SETTLING` — the attribute the app shell counts keys down on — is
 * declared in `./quiescence.ts`, beside the counter that publishes it, because
 * a reader who finds the name needs the contract that goes with it (what holds
 * the count, and what deliberately does not) and that argument is a page long.
 * It is not a name for FINDING something either: a scenario waits on its
 * VALUE. Both ends import it, so it breaks the same way this table does.
 *
 * ## THIS TABLE IS THE APP'S, and it is no longer the only one
 *
 * The ids split by RENDERER, which is the only line that holds once a face
 * lives in another package: a scenario asserting on the terminal row is
 * asserting on `olai-plugin-kolu`'s own faces, and one asserting on the padi pill or
 * the CI chip is asserting on a PLUGIN's. Each of those owns its own
 * names-only door, and `@olai/plugin-api/testids` is where the plugins' tables
 * merge — an id it could only reach through here would be a suite reading one
 * package's DOM through another package's door.
 *
 * Two groups left this table for that reason and their absence is worth a line
 * each. The `padi*` five went to `olai-plugin-kolu` with the pill and its
 * drawer, and the `ci*` three to `olai-plugin-odu` with the chip and its
 * matrix. A third group was DELETED rather than moved: six `terminal*` ids
 * that duplicated that tenant's own, value for value, left behind when the
 * door became a package — nothing in this client or the suite ever read them,
 * and two spellings of one contract is the exact failure this file exists to
 * prevent.
 */

import type { PluginTestId } from "@olai/plugin-api/testids"

export const TESTID = {
  /** The app header: wordmark, and on desktop the connection, agent,
   *  preferences. Always drawn — it is chrome about the APP, and every shape
   *  of the app (including the error report) gets it. On a phone it is the
   *  wordmark, the burger and search; the pills live elsewhere. */
  appHeader: "app-header",
  /** Who is looking, last in the chrome row (top right). Always drawn:
   *  `data-who` is `asking` / `none` / `yes` / `error` — a closed set.
   *  `none` is anonymous, not a missing chip. A picture `<img>` is inside
   *  it only when `yes` AND the server resolved one — a person the ladder
   *  found no picture for wears the silhouette and is still `yes`. */
  identity: "identity",
  /** The row of controls inside it that are about the APP. On desktop: the
   *  connection, the Commit pill, the uptime chip, the agent toggle, the
   *  preferences trigger. On a phone: search alone. Its own name because the
   *  CONTENTS of that row are a claim: `one-git-indicator` was two chips
   *  answering one question, and the only way to hold that shut is to count
   *  what is in the row rather than to look for the chip that was removed. */
  appChrome: "app-chrome",
  /** The sidebar itself. Always drawn when the set loaded — which is what
   *  makes it, rather than anything inside it, the sign that the app has
   *  committed to a shape. On a phone the BODY starts collapsed behind the
   *  burger; the nav stays attached so a settle probe does not have to open it. */
  sidebar: "sidebar",
  /** The burger, below 48rem only: lives in the header, opens the directory
   *  drawer (calendar + file tree). */
  sidebarToggle: "sidebar-toggle",
  /** Everything the burger / open column reveals — the month and the file
   *  tree. On a phone the preferences sit below this, in the drawer footer. */
  sidebarBody: "sidebar-body",
  /** Mobile drawer scrim. Absent on desktop and when the drawer is shut. */
  sidebarScrim: "sidebar-scrim",
  /** Desktop: collapse the full sidebar to the icon rail. */
  sidebarCollapse: "sidebar-collapse",
  /** Desktop: expand the icon rail back to the full sidebar. */
  sidebarExpand: "sidebar-expand",
  /** Desktop icon rail — minimized-with-signal face of the sidebar. */
  sidebarRail: "sidebar-rail",
  /** Drag handle on the open sidebar's right edge. */
  sidebarResize: "sidebar-resize",
  // ── the shelf, above everything else in the column ───────────────────
  /** The PINNED shelf. Drawn only when the directory has a pin — an empty
   *  shelf is not an empty box, it is nothing at all — which is what makes
   *  its presence the fact a scenario asserts. */
  pinShelf: "pin-shelf",
  /** One pin. `data-pin` is the pin NODE's own id (what an unpin archives and
   *  a reorder moves), `data-at` is the address it opens — the two facts a
   *  scenario needs and neither of which is readable off the words drawn. */
  pin: "pin",
  /** The link inside a pin — the door itself. Its own name because the row
   *  also carries a control, and a click on "the pin" has to be able to mean
   *  the one that navigates. */
  pinLink: "pin-link",
  /** What an ADDRESS is called, wherever one is drawn as the page it names —
   *  a shelf row, and an outline row whose title is nothing but an address
   *  (`client/address/Face.tsx`). One name for one face, so a scenario asking
   *  "what does this resolve to" does not have to know which page it is on. */
  addressName: "address-name",
  /** The query an address carries, drawn as its own chip. Absent on an address
   *  to a whole page, which is what says the face keeps the filter rather than
   *  dropping it. */
  addressFilter: "address-filter",
  /** Take this pin off the shelf. */
  pinRemove: "pin-remove",
  /** Ask what this pin should be CALLED — the shelf's door onto the palette's
   *  naming question (`pins/naming.ts`). */
  pinRename: "pin-rename",
  /** The line that says where a dragged pin would land. */
  pinDropLine: "pin-drop-line",
  /** Rail icon: jump to today. */
  railCalendar: "rail-calendar",
  /** Rail icon: open outlines / home. */
  railOutlines: "rail-outlines",
  /** Rail icon: open the directory (documents). */
  railDocs: "rail-docs",
  /** The DIRECTORY region of the sidebar: the tree, and the two ways to add
   *  to it, under one label. Its own name because the column reads as REGIONS
   *  now — pinned, directory, trash — and a scenario asserting that has to be
   *  able to name one. */
  sidebarFiles: "sidebar-files",
  /** The sidebar's file tree: every outline and document under the folders
   *  they live in. Still named `outline-list` because that is the contract the
   *  browser tests already assert on for "the directory is listed", and a
   *  rename for its own sake would be a second spelling of the same fact. */
  outlineList: "outline-list",
  outlineLink: "outline-link",
  outlineTree: "outline-tree",
  node: "node",
  nodeTitle: "node-title",
  /** What the outline's LANDING said when the row the address named is drawn
   *  nowhere on the page it opened — one alarm line over the tree, in the
   *  voice every refused act in this client speaks (`./SaidLine.tsx`), so a
   *  scenario reads its `data-tone` rather than a colour. */
  landingSaid: "landing-said",
  tag: "tag",
  /** The date pill on a row, wherever one is drawn. `data-occasion` says which
   *  of the node's dates it is; `data-overdue` says whether the node is late on
   *  it — a `data-` fact in both directions, never the tone it is painted,
   *  because an OCCURRENCE never turning amber is as much of the promise as an
   *  overdue task doing so. `data-picks` says whether pressing it opens the
   *  picker, which it does only where the row is editable — a day page and the
   *  agenda draw the same pill over a query. */
  date: "date",

  // ── the date picker ──────────────────────────────────────────────────
  /** The picker, in place under the row it was opened on: from the pill above,
   *  or from the `•••` menu's `Set date…`. Present only while it is open, so a
   *  page carrying none has nobody picking a date. */
  datePicker: "date-picker",
  /** The day itself — a native `<input type="date">`, whose value is the ten
   *  characters the record will hold. */
  datePickerDay: "date-picker-day",
  /** The button that sends it. Its LABEL is the verb: `Set date`, or the
   *  menu's own `Clear date` once the box has been emptied — one spelling of
   *  taking a date off, however a reader arrived at it. Disabled when pressing
   *  it would ask for nothing. */
  datePickerSet: "date-picker-set",
  /** The way out that writes nothing. Escape is the other. */
  datePickerCancel: "date-picker-cancel",
  /** Said when the node stores a value a day box cannot hold — a datetime,
   *  quoted verbatim, with what picking a day would do to it. */
  datePickerNotice: "date-picker-notice",
  /** What the last press had to say, keeping the panel open to say it.
   *  `data-tone` is which mood — `alarm` for the ops layer's own refusal,
   *  `aside` for a remark on a write that landed. */
  datePickerSaid: "date-picker-said",

  // ── the repeat rule ──────────────────────────────────────────────────
  /** The pill beside a date saying how the node COMES BACK, in the format's
   *  own words. `data-picks` says whether it is a control — a tree row's is,
   *  a day page's and the agenda's are not, the same split the date pill has. */
  repeat: "repeat",
  /** The repeat picker, in place under the row it was opened on: from the pill
   *  above, or from the `•••` menu's `Set repeat…`. Present only while it is
   *  open. */
  repeatPicker: "repeat-picker",
  /** The rule itself — a `<select>` over the format's closed grammar, whose
   *  value is the text the record will hold. The empty option is "does not
   *  repeat". */
  repeatPickerRule: "repeat-picker-rule",
  /** The button that sends it. Its LABEL is the verb: `Set repeat`, or the
   *  menu's own `Stop repeating` once the empty option is chosen. Disabled
   *  when pressing it would ask for nothing. */
  repeatPickerSet: "repeat-picker-set",
  /** The way out that writes nothing. Escape is the other. */
  repeatPickerCancel: "repeat-picker-cancel",
  /** Said when the node stores a rule the list cannot show — quoted verbatim,
   *  with what choosing one would do to it. */
  repeatPickerNotice: "repeat-picker-notice",
  /** What the last press had to say, keeping the panel open to say it. */
  repeatPickerSaid: "repeat-picker-said",
  // ── the properties drawer ────────────────────────────────────────────
  /** The run of chips under a node's title — and under a document page's path:
   *  the node's own facts, then the custom properties somebody added. Drawn on
   *  a ROW whenever there is a custom one, open or not; always on the node's
   *  own page; on a document page when the file wrote frontmatter. */
  props: "props",
  /** One chip of it. `data-key` names the property; `data-system` is present on
   *  the read-only chips (`id`, `status`, `date`, the stamps), which is how a
   *  scenario tells a fact from a property without reading a colour. */
  prop: "prop",
  /** The value on that chip. `data-door` says what the value turned out to
   *  NAME, and is the one assertion a scenario makes about a door: `document`,
   *  `node`, `day` or `away` where the value names something, and ABSENT where
   *  it names nothing and stays text (`client/props/door.ts`). */
  propValue: "prop-value",
  /** A value so long it is drawn as its first words with the rest behind a
   *  disclosure — the mockup's Move 3, and the safety net rather than the goal
   *  (`client/props/PropsDrawer.tsx`). `open` is the element's own; the chip
   *  beside it carries no such testid, which is what makes this one's presence
   *  the assertion that a value folded. */
  propFold: "prop-fold",
  /** The KEY half of a chip, which is the handle: pressing it opens the value
   *  for editing, whatever the value is. Drawn as a button only where the
   *  surface offers writing — a day page and the agenda draw a node they do
   *  not offer to change, and there it is a plain span. */
  propKey: "prop-key",
  /** The box a value is being typed in, in place of the chip's value. `data-key`
   *  is the property it is on, absent while a new one is being named. */
  propEdit: "prop-edit",
  /** ...and the box the KEY of a NEW property is typed in, drawn only then: a
   *  rename is two ops, so an existing chip's key is not typeable. */
  propEditKey: "prop-edit-key",
  /** The `+` at the end of the run — the door onto adding a property wherever
   *  there IS a run. The `•••` carries the other case and only that one: a node
   *  with no chips has no end for a `+` to sit at, and is offered
   *  `Add property…` instead. Never both at once. */
  propAdd: "prop-add",
  /** What the last commit had to say, under the run — a refusal quoted
   *  verbatim, or a nudge that rode back on a write that landed. */
  propSaid: "prop-said",

  /** The rollup badge — `3/5` of the tasks under a node. An annotation beside
   *  the title, never the node's own mark, which is the glyph. */
  progress: "progress",
  /** The one PROPERTY a folded row may show beside its title (`client/hot.ts`)
   *  — `pr` on shipped work, and nothing else. `data-key` is which key it is;
   *  the rollup above is the other arm of the same slot and keeps its own
   *  name, because `3/5` was already assertable and a fact's testid should not
   *  move because a second fact learnt to sit beside it. */
  hotFact: "hot-fact",
  /** On a COLLAPSED row: how many finished rows the fold is holding back
   *  (`client/hidden.ts`). `data-done` is the count. Absent on an expanded row,
   *  on a fold hiding nothing finished (a zero is not drawn), and — the case
   *  worth knowing — on a fold whose ROLLUP already reports the same number,
   *  since two spellings of one fact is one of them written twice. */
  foldedDone: "folded-done",
  /** The ⏱ chip — how long the work TOOK on a settled row (an annotation
   *  drawn from the stored `started` and the settling instant), and how long
   *  it has been GOING on a doing one (ticking locally off that same
   *  `started`, the instant rather than a carried duration). `data-took` is
   *  the whole seconds when settled, `data-started` the instant it runs from
   *  when live. Absent on a bullet, on a jump-to-done, and on work nobody
   *  has ever started. */
  took: "took",
  desc: "desc",
  /** The one clamped line of a note a filter found the row BY, drawn under the
   *  title on a row whose only hit is behind its ¶ (`client/note/
   *  excerpt.ts`). Absent on every other row, filtered or not — the excerpt is
   *  the reason a row with nothing of the query in its title is in front of
   *  somebody, so drawing it anywhere else would say that of a row it is not
   *  true of. */
  descHit: "desc-hit",
  /** A stretch of a title or an excerpt the query LANDED on
   *  (`client/filter/lit.ts`). Drawn only where a filter put one, which is what
   *  makes its presence the assertion. */
  hit: "hit",
  /** The pilcrow beside a title: the door to the row's open state
   *  (`client/note/Mark.tsx`). `data-open` says which way it is; drawn only on
   *  a node that HAS an open state — a note, or a property somebody added. */
  noteMark: "note-mark",
  toggle: "toggle",
  /** The `•••` trigger left of the collapse triangle. Hover-reveal on a
   *  pointer device; always drawn on a phone. */
  nodeMenu: "node-menu",
  /** The open menu panel (portaled). */
  nodeMenuPanel: "node-menu-panel",
  /** One item inside that panel — including the two buttons the confirm below
   *  offers, which are menu items in the same box. `data-action` names the
   *  verb (`cancel`, for the way out of a confirm). */
  nodeMenuItem: "node-menu-item",
  /** The question the panel puts where its list was, before the one verb that
   *  takes a branch away. Its text names the row and how much goes with it. */
  nodeMenuConfirm: "node-menu-confirm",
  /** What the last-chosen action had to say, beside the `•••` for a few
   *  seconds. Two moods, and `data-tone` says which: `alarm` for a refusal —
   *  the ops layer's own words, or a clipboard the browser would not give (any
   *  LAN reader on plain http) — and `aside` for a nudge from a write that
   *  landed. */
  nodeMenuSaid: "node-menu-said",
  /** One folder in the sidebar's file tree. `data-path` is the root-relative
   *  path, `data-collapsed` says whether its children are hidden. */
  fileDir: "file-dir",
  /** The fold control on a folder. Its own name rather than the outline
   *  tree's `toggle`, so a scenario that folds a folder never has to say
   *  which of the two trees it meant. */
  fileDirToggle: "file-dir-toggle",
  /** The glyph that says what KIND of thing in the directory this is
   *  (`file/icons.tsx`) — a row of the tree, or the rail button standing for
   *  that kind while the column is collapsed. `data-glyph` is one of the
   *  format's kinds — `outline`, `document`, `hypertext` — or `folder`: the
   *  fact, never the ink it is drawn in, which is whatever the row already
   *  was. The full list is the registry's (`@olai/format`'s `kinds.ts`) and
   *  this comment is deliberately not a second copy of it. */
  fileGlyph: "file-glyph",
  /** One document entry in the file tree. There is no second list: documents
   *  sit under the same folders as outlines. */
  documentLink: "document-link",
  /** One `.html` entry in the file tree — its own name rather than the
   *  document's, so a step that says how many documents a directory has goes on
   *  meaning documents when a vault gains a saved page. */
  hypertextLink: "hypertext-link",
  /** One `.csv` entry in the file tree, one picture, one `.pdf` — each its own
   *  name for {@link hypertextLink}'s reason, said once for the three of them:
   *  a step that counts the documents of a directory has to go on meaning
   *  documents when somebody drops a spreadsheet export, a screenshot and a
   *  receipt into their vault. */
  csvLink: "csv-link",
  imageLink: "image-link",
  pdfLink: "pdf-link",
  /** One document, as a page. `data-file` is which. */
  documentPage: "document-page",
  /** The link inside a node's `doc` reference — the way from a node to its
   *  document's own page. Its own name rather than the sidebar's, so a
   *  selector never has to say which of the two it meant. */
  docLink: "doc-link",
  /** A node's `doc`, wherever the node is drawn: the reference, carrying the
   *  RESOLVED path as `data-doc`, and `data-inline` for the zoomed page that
   *  draws the whole document rather than a line of it. */
  docRef: "doc-ref",
  /** Why a body is not on screen — the `.html` page, a `doc` line, a day's
   *  note. One name, because it is one sentence (`BODY_REFUSED`) drawn in
   *  three places, and a scenario that asks for the sentence should not have
   *  to know which surface said it. */
  bodyRefused: "body-refused",
  /** A node held up by an `after` edge, wherever the node is drawn: the glyph
   *  column's waiting hourglass on a row or a day entry, the named row of
   *  blockers on the node's own page. Absent — not empty — on a node with
   *  nothing in its way. WHETHER a node is blocked, and by what, is
   *  `data-blocked` on the node itself; this is the affordance that says so on
   *  screen, and it carries the sentence as its `aria-label`. */
  blocked: "blocked",
  /** This app's own hover tip, which replaced the platform's `title` on the
   *  one control whose sentence is too long for it: what it says is also the
   *  control's `aria-label`, so nothing here is hover-only. */
  tip: "tip",
  /** A node's free cross-references (`see`), wherever the node is drawn. */
  seeRefs: "see-refs",
  /** What a node itself says it comes AFTER — its own `after` list, drawn on
   *  the node's page beside the derived `blocked` row above. The two are
   *  different claims: this one is the field a person and an agent may WRITE
   *  (`set_after`), and it is drawn whether or not the target is still in the
   *  way. */
  afterRefs: "after-refs",
  /** The `×` on one drawn reference: drop that target from the node's `see` /
   *  `after` list. `data-ref` is the target it would drop. */
  refDrop: "ref-drop",
  /** What refers to a ZOOMED node, read backwards — the `<details>` itself,
   *  absent on a node nothing refers to. `data-count` is how many RECORDS refer
   *  to it (a record that both points at it and names it in prose is one), and
   *  whether the section is open is the element's own `open`. */
  backlinks: "backlinks",
  /** Its summary line — the count in words, and the thing to press to open it. */
  backlinksSummary: "backlinks-summary",
  /** What points AT a document, under its heading — the `<details>` itself,
   *  absent on a document nothing points at. `data-count` is how many things
   *  do: a record that attaches or links it, or another document whose body
   *  links it. */
  documentReferrers: "document-referrers",
  /** Its summary line — the count in words, and the thing to press to open it. */
  documentReferrersSummary: "document-referrers-summary",
  /** One row of that list: the record or the document that points here. */
  documentReferrer: "document-referrer",
  /** The referrers whose `see` lands on this node, and the ones whose title or
   *  note writes its `@id`: two rows of the same shape every other relation
   *  draws, so a link inside either is a `nodeRef` with `data-ref` on it. Two
   *  names because they are two claims — an edge somebody wrote with a verb,
   *  and a word in a sentence — and a scenario about one must not pass on the
   *  other. */
  backlinkSeeRefs: "backlink-see-refs",
  backlinkMentionRefs: "backlink-mention-refs",

  // ── the edge panel ───────────────────────────────────────────────────
  /** One of the two edge verbs on a ZOOMED node's page — the door a heading
   *  has instead of a `•••`. `data-relation` says which; whether its panel is
   *  up is `aria-expanded`, which is the same fact said once. On a row the same
   *  two verbs are menu entries. */
  edgeVerb: "edge-verb",
  /** The panel that writes one relation of one node — in place under the row,
   *  or under a zoomed node's heading. `data-relation` says WHICH (`see` /
   *  `after`); present only while it is open. The shortlist INSIDE it carries
   *  `data-asked`, which says which query its hits ANSWER — absent while they
   *  answer one the reader has moved on from, and what makes "wait for the rows
   *  of this search" askable (`search/Shortlist.tsx`, whose attribute it is
   *  because the search is what it is about). */
  edgePanel: "edge-panel",
  /** What the node says right now, inside that panel — one chip per target. */
  edgeHeld: "edge-held",
  /** The `×` on one of those chips. `data-ref` is the target. */
  edgeDrop: "edge-drop",
  /** The panel's search box — the server's own node search, the same one ⌘K
   *  and the `((` widget call. */
  edgeSearch: "edge-search",
  /** One hit in it; `data-id` is the node it would name. */
  edgeHit: "edge-hit",
  /** Where that hit sits — the row's second line. */
  edgeHitPlace: "edge-hit-place",
  /** One `key value` pair on an edge-panel hit's third line. */
  edgeHitProp: "edge-hit-prop",
  /** A refused SEARCH, in the server's words. Never the same slot as a refused
   *  write: two unrelated async sources sharing one line is how a reader is
   *  shown the wrong sentence about the wrong thing. */
  edgeSearchFailed: "edge-search-failed",
  /** What the last WRITE from this panel said — a refusal verbatim (a loop an
   *  `after` would close, an id nothing declares), or a nudge from one that
   *  landed. Two moods, `data-tone` apart, like every other said line. */
  edgeSaid: "edge-said",
  /** The way out, for a pointer. Escape is the same door. */
  edgePanelClose: "edge-panel-close",

  // ── the move-to picker ───────────────────────────────────────────────
  /** The panel that carries one row to a new parent — in place under the row,
   *  opened by ⌘⇧M or the `•••` menu's `Move to…`. `data-row` is the RECORD
   *  being moved, which is what makes "the panel followed its row" askable
   *  after the write lands; the shortlist inside it carries `data-asked`, the
   *  same fact in the same place as the edge panel's. Present only while it is
   *  open. */
  movePicker: "move-picker",
  /** Its search box — the server's own node search, over the whole set. */
  moveSearch: "move-search",
  /** One destination in it; `data-id` is the node it would go under. Its own
   *  `<li>` carries `data-refused` when that node cannot take the row. */
  moveHit: "move-hit",
  /** Where that destination sits — the row's second line. */
  moveHitPlace: "move-hit-place",
  /** One `key value` pair on a destination's third line. */
  moveHitProp: "move-hit-prop",
  /** WHY the destination under the cursor cannot take this row — drawn as the
   *  cursor arrives rather than after `Enter`, which is the drop refusal's own
   *  shape (`drag/Refusal.tsx`). Absent whenever the aim is a legal one. */
  moveRefused: "move-refused",
  /** A refused SEARCH, in the server's words — never the same slot as the two
   *  lines above, for the reason the edge panel keeps them apart. */
  moveSearchFailed: "move-search-failed",
  /** What the last MOVE said: a refusal verbatim, or the nudge from one that
   *  landed — drawn under the row, which after a landed move is the row in its
   *  new home. Two moods, `data-tone` apart, like every other said line. */
  moveSaid: "move-said",
  /** The way out, for a pointer. Escape is the same door. */
  movePickerClose: "move-picker-close",
  /** One link from a node to another node, in any of those rows. Which
   *  RELATION it came from is the row it is in, so this name is the same for
   *  `see` and for `blocked by`; the target id rides `data-ref` on a child
   *  span (titles change under a live page; ids do not) — and the blocked pill
   *  carries that span too, being a link to the first blocker. */
  nodeRef: "node-ref",
  /** The document itself, rendered — on its own page, or inline under the node
   *  that attaches it. */
  documentBody: "document-body",
  /** A `.html` file's page: the sandboxed frame its markup is drawn in, and the
   *  only element of it this app owns. Everything a scenario asks ABOUT the
   *  file is asked inside the frame, which is the point — nothing in there can
   *  reach a testid out here. */
  hypertextPreview: "hypertext-preview",
  /** What the preview SAID about a click it could not answer — the line drawn
   *  when a link inside the frame names a file this directory does not serve.
   *  A refusal, in the same voice every other refused act in this client speaks
   *  (`./SaidLine.tsx`), so a scenario reads its `data-tone` rather than a
   *  colour. */
  hypertextSaid: "hypertext-said",
  /** A `.csv` file's page: the table its rows are drawn as. The header row is
   *  a `<th>` and the rest are `<td>`, which is the FACT a scenario reads —
   *  that the first row of the file is the header — rather than the weight it
   *  happens to be drawn at. */
  csvTable: "csv-table",
  /** What a `.csv` page is NOT SHOWING, and why — the clamp said out loud
   *  (`./document/clamped.ts`) when the file is bigger than a page draws,
   *  and "nothing in it" when the file has no rows at all. One id for the two,
   *  because a reader of this page asks one question. Drawn as an ASIDE through
   *  the one component that owns what a mood means (`./SaidLine.tsx`), so a
   *  scenario reads its `data-tone` rather than a colour. */
  csvClamp: "csv-clamp",
  /** A picture's page: the `<img>` it is drawn in, `src` on the media route.
   *  An `<img>` for every spelling the picture kind claims, an `.svg`
   *  included — which is the element that will not run one. */
  imageView: "image-view",
  /** A `.pdf` file's page: the embed the browser's own viewer is drawn in,
   *  pointed at the file on the media route. What is INSIDE it belongs to the
   *  browser and carries no testid of ours — the same boundary the `.html`
   *  frame draws, for the same reason. */
  pdfEmbed: "pdf-embed",
  /** The way into a document's editor: the quiet control on the page header
   *  that turns the rendered body into its source. */
  documentEdit: "document-edit",
  /** The editor itself — a textarea holding the document's SOURCE, verbatim.
   *  Present exactly while the page is in its edit mode. */
  documentEditor: "document-editor",
  /** Commit the editor's text: one write, at the same gate every other edit
   *  goes through. */
  documentSave: "document-save",
  /** Leave the editor without writing. The draft is abandoned, which is what
   *  Escape means everywhere else in this app. */
  documentCancel: "document-cancel",
  /** Why the last document write did not happen — the ops layer's own words,
   *  with the draft kept. One mood (`data-tone="alarm"`) and not the two a
   *  row's line has: a document write has no rollup to remark on. */
  documentSaid: "document-said",
  /** The one refusal with a second door: after a conflict refusal, the
   *  explicit "overwrite anyway" — a write with no `was`, chosen by a person
   *  who has read the warning. */
  documentOverwrite: "document-overwrite",
  /** The notice, while the editor is open, that the file has changed on disk
   *  underneath it — the live half of the conflict story, so the refusal at
   *  save time is never the first anyone hears of it. */
  documentDrifted: "document-drifted",
  /** The sidebar's way to a brand-new document: the affordance that opens the
   *  path box. */
  newDocument: "new-document",
  /** The path box itself — a relative `.md` path, committed with Enter. */
  newDocumentPath: "new-document-path",
  /** Why creating one did not happen — a refusal, verbatim, drawn by the same
   *  `Refused` line `documentSaid` and `dayMintSaid` are. */
  newDocumentSaid: "new-document-said",
  /** The sidebar's way to a brand-new OUTLINE — `create_outline`'s own door,
   *  beside the document's above (`parity-create-outline`). */
  newOutline: "new-outline",
  /** Its path box — a relative `.olai` path, committed with Enter. */
  newOutlinePath: "new-outline-path",
  /** Why minting one did not happen: the ops layer's own sentence about the
   *  path, verbatim. */
  newOutlineSaid: "new-outline-said",
  /** A document's table of contents, above its body. A `<details>`, so whether
   *  it is open is the element's own `open` property and not a second flag —
   *  and ABSENT on a document with fewer than two headings, which is what makes
   *  "a note never gets one" assertable. */
  toc: "toc",
  /** A `![](…)` this app will not draw — a remote host, a `data:`, an `.svg`,
   *  or the ordinary case, a filename with a typo in it. Drawn WHERE THE
   *  PICTURE WOULD HAVE BEEN and naming the `src` that was written, because
   *  the alternative (which this replaced) is a page with a hole in it that
   *  neither the person who wrote the typo nor the agent asked about it can
   *  see. The written `src` also rides `data-src`. */
  undrawnPicture: "undrawn-picture",
  /** One line of it: a link to a heading in the same page. Its `href` is the
   *  fragment, which is the whole claim — the id it names is the one the
   *  rendered heading carries. */
  tocLink: "toc-link",
  /** One chip of the theme strip, which lives in the preferences panel's Theme
   *  row. `data-value` is the theme it offers, `aria-pressed` says whether it
   *  is the one in force — never the colour it is painted, which is the whole
   *  subject here and so the last thing to assert on.
   *
   *  What the DEFAULT theme is and where a pick is stored are not attributes on
   *  anything: the browser tests import those from `theme/palettes.ts` the same
   *  way they import these names, which is a type error rather than a timeout
   *  when one is renamed — and markup that exists only to be read back by a
   *  test is markup every reader ships. */
  themeChip: "theme-chip",
  /** The Font row's select. `value` is the typeface in force. */
  fontSelect: "font-select",

  // ── preferences ──────────────────────────────────────────────────────
  /** The one way into the preferences, and the only door there is: the
   *  theme pill that used to sit beside it retired into the panel behind
   *  this, so a scenario reaching a theme chip comes through here. Header
   *  chip on desktop; a row at the foot of the phone drawer. */
  prefsTrigger: "prefs-trigger",
  /** The panel it opens (portalled out of the header). */
  prefsPanel: "prefs-panel",
  /** One preference on it; `data-pref` is which — `theme`, `font`, `size`,
   *  `density`, `done`, `git-commit`, `git-push`, and one `plugin-<name>` per
   *  plugin this build has ({@link pluginPref}, which is why that tail is open
   *  and this list is not). */
  prefsRow: "prefs-row",
  /** That row's hint: what the choice IN FORCE means, re-read whenever the
   *  control moves. Its own name because it is the half of a settings row that
   *  is easiest to let go stale, and a hint describing a state the app is not
   *  in is worse than no hint at all. */
  prefsHint: "prefs-hint",
  /** One segment of a two-or-three-way choice. `data-value` is what it picks,
   *  `aria-pressed` whether it is the one in force, `aria-disabled` whether
   *  the strip is frozen. The git rows always are. */
  prefsChoice: "prefs-choice",
  /** WHO set a row, on the rows that are the instance's — a given flag, or the
   *  built-in default, and that a browser cannot change it. Absent on every
   *  row this browser owns. */
  prefsSetBy: "prefs-set-by",
  /** Start Auto-commit again after git refused something, on the Git commit
   *  row. Drawn only while the loop is actually stopped — Resume is the one
   *  remaining git gesture on this panel. */
  prefsResume: "prefs-resume",
  /** What the server would not take from Resume — a dropped socket or a usage
   *  refusal. Absent while nothing has been refused, which is what makes its
   *  PRESENCE the fact. */
  prefsGitRefused: "prefs-git-refused",
  /** Ask this browser for permission to draw system notifications, on the
   *  Alerts row. Drawn only while alerts are on and the browser has not
   *  answered yet — a default-on preference has no "first enable" press to
   *  hang the prompt on, so this is the gesture that raises it
   *  (`notify.ts`). */
  prefsAllowNotify: "prefs-allow-notify",
  /** What every row on the panel has in common, said once: these belong to this
   *  browser and reach no server. */
  prefsScope: "prefs-scope",
  /** A row's own LINE: the controls in its gutter and the title beside them,
   *  and nothing belonging to a row nested under it. Rows nest, so "this
   *  node's checkbox" needs a handle on the line rather than on the subtree —
   *  without one, the absence of a box has to be asked of markup shape. */
  nodeGutter: "node-gutter",
  /** The glyph column on every row: what the node IS, and the link to that
   *  node's own page. One cell (`client/Glyph.tsx`); the two inner names below
   *  say which face it is wearing. */
  zoom: "zoom",
  /** The MARK inside that cell: checked for done, half for doing, EMPTY for
   *  todo — and NOTHING carrying this testid on a node with no mark (a bullet)
   *  or on one that cannot start yet (the waiting face below), which is how the
   *  three are told apart. Display-only — the mark is written from the row's
   *  editor — so the face is the assertion. */
  checkbox: "checkbox",
  // ── the row editor ───────────────────────────────────────────────────
  /** The caret in a row's title: an `<input>` standing exactly where the title
   *  span was. Present only while that row is being typed in — a page with no
   *  editor open carries none of these at all. */
  titleEditor: "title-editor",
  /** The same for a note: a plain textarea under the row, opened with
   *  `Shift+Enter`, whose rendering comes back when it closes. */
  descEditor: "desc-editor",
  /** A row that does not exist yet — the editor standing where `Enter` will
   *  put one. It becomes a node when it has a title and is committed, so a
   *  scenario that finds one has found a DRAFT and not a write. */
  newRow: "new-row",
  /** The shortlist under a caret: the `!` day picker, the `#`/`@` tag list, the
   *  `((` node search. `data-kind` says which of the three — `date`, `tag` or
   *  `mirror` — so a scenario names the widget rather than guessing from what
   *  is in it. Absent whenever nothing is armed, which includes a trigger whose
   *  query matches nothing at all. */
  completions: "completions",
  /** One row of it. `data-id` is the day, the tag as written, or the node's id;
   *  `data-active` is which one Enter would take. */
  completionItem: "completion-item",
  /** Where a `((` hit SITS — the second line of its row, nearest ancestor
   *  first, exactly as the palette writes one. */
  completionItemPlace: "completion-item-place",
  /** One `key value` pair on a `((` node row's third line. */
  completionItemProp: "completion-item-prop",
  /** A refused node search, quoted, in its own slot above the rows. */
  completionsError: "completions-error",
  /** What the last commit was refused with, under the row it was typed in.
   *  `data-kind` is the refusal's own tag. Its presence is the promise that a
   *  refused write is visible; the draft beside it is the promise that nothing
   *  typed was lost. Drawn by `./SaidLine.tsx` in the alarm mood, so it is
   *  `role="alert"` and interrupts a screen reader. */
  editRefusal: "edit-refusal",
  /** The opposite mood, in the same place: a write that LANDED, with something
   *  the rollup noticed — the last task under a parent going done, a branch
   *  ticked over unfinished ones. Advice, never a reason anything failed, and
   *  the next keystroke takes it away. The same component draws it in the quiet
   *  mood, which is `role="status"`: announced, because a remark only the
   *  sighted reader gets is half a remark, and politely, because it rides back
   *  on something that DID happen. */
  editNudge: "edit-nudge",
  /** What ⌘Z / ⌘⇧Z had to say — pinned under the header rather than under a
   *  row, because an undo is pressed with no draft open and the row it was
   *  about may be gone. `data-tone` is which mood: `alarm` for a refusal (the
   *  reason the key did nothing), `aside` for a remark about one that landed. */
  undoSaid: "undo-said",
  /** The way in on a page with no rows: an outline that holds nothing, a
   *  zoomed node with nothing under it. */
  startLine: "start-line",
  // ── picking rows, and moving them ────────────────────────────────────
  /** The bullet, wrapped as something to pick a row up by. Present on every
   *  editable row; a press that never travels is still the bullet's own link
   *  (`drag/Handle.tsx`). */
  dragHandle: "drag-handle",
  /** The line drawn where a dragged row would land, while it is being dragged
   *  and never otherwise. What it PROMISES rides as data rather than as a
   *  shape: `data-parent` is the record it would go under (`""` for the top
   *  level of the file), `data-after` the sibling it would follow (`""` for
   *  first among them), and `data-depth` how far in the line is drawn — the
   *  three facts that are still a prediction until the pointer is released. */
  dropLine: "drop-line",
  /** The face a PANE wears while a row is held over it that cannot land there
   *  — the other answer a drag has, and never drawn beside the line
   *  (`drag/Aiming.tsx`). `data-file` is the file that said no; the sentence
   *  inside is the one the selection bar says when the pointer is released, so
   *  a scenario can hold the promise and the outcome to one another. */
  dropRefused: "drop-refused",
  /** The sentence inside that face — `Refused.tsx`'s box, so a refusal reads
   *  and is toned the same here as everywhere else a write is turned down. */
  dropRefusedSaid: "drop-refused-said",
  /** The band a drag-across pulls, while it is being pulled and never
   *  otherwise. `data-rows` is how many rows it is crossing right now — the one
   *  thing about a sweep that is still a prediction while the pointer is down.
   *  A BAND rather than a rubber-band box, because a row is a line and the
   *  gesture reads only Y (`drag/sweep.ts`). */
  sweepBand: "sweep-band",
  /** The bar a multi-selection draws: how many rows are picked, the one verb
   *  that has no key, and what the last bulk write said. `data-rows` is the
   *  count the verbs are asked of — the picked rows nothing else picked
   *  contains — so a scenario can hold "a parent and its child are one row to a
   *  verb" without reading the sentence. */
  selectionBar: "selection-bar",
  selectionCount: "selection-count",
  /** Move the picked rows to the Trash. Pressed once it asks; pressed again in
   *  the question below, it goes. */
  selectionTrash: "selection-trash",
  /** That question, naming how many rows the write moves — the `•••` menu's own
   *  confirm at selection size. */
  selectionConfirm: "selection-confirm",
  selectionCancel: "selection-cancel",
  /** Said in the button's place when the pick holds a PLACEMENT: the node a
   *  mirror shows lives somewhere else, so this face will not put it away from
   *  here. A sentence rather than a silently smaller write. */
  selectionNote: "selection-note",
  /** What the last bulk gesture — a key over the pick, or a drop — had to say.
   *  `data-tone` is the two moods every write surface here has: `alarm` for the
   *  ops layer's refusal verbatim, `aside` for a remark on one that landed. */
  selectionSaid: "selection-said",

  /** The keyboard reference, opened from the palette: what every key this app
   *  answers does, drawn from the same table the matchers live beside. */
  shortcuts: "shortcuts",
  /** One line of it. */
  shortcut: "shortcut",

  /** Said on a zoomed page that has no rows to draw: a leaf, or a subtree
   *  Prefs has hidden. The sentence names Prefs when the cause is the
   *  preference — the only on-page mention of the setting, now the pill is
   *  gone. */
  emptyUnder: "empty-under",
  /** The heading of a zoomed page — carries the CANONICAL node's id, which is
   *  what makes "a mirror lands on the node itself" an assertion. */
  zoomTitle: "zoom-title",
  breadcrumbs: "breadcrumbs",
  crumb: "crumb",
  /** The month in the sidebar. Its `data-month` is the month on screen, which
   *  paging moves and nothing else does. */
  calendar: "calendar",
  /** One day of it. Everything the four marks say is a `data-` fact:
   *  `data-date`, `data-dated` (a node of the set is on it), `data-noted` (a
   *  document is named for it — the day's own note), `data-today`, `data-open`
   *  (this is the day being read) — never the colour it is painted, which is a
   *  styling decision a refactor may change. */
  calendarDay: "calendar-day",
  calendarPrev: "calendar-prev",
  calendarNext: "calendar-next",
  /** One day, as a page. `data-date` is the day it turned out to be, which
   *  `/today` does not spell. */
  dayPage: "day-page",
  /** The day page's way to a note that does not exist yet — shown on any day
   *  without a note, entries or not. The calendar cell never writes. */
  dayMint: "day-mint",
  /** Why minting one did not happen — the ops layer's words, beside the
   *  button. */
  dayMintSaid: "day-mint-said",
  /** The nodes of one outline dated that day; `data-file` is which. The same
   *  name on the agenda, which draws the same group under the same heading
   *  rule — one widget, so a scenario asks for it one way. */
  dayGroup: "day-group",
  /** THE day's note, drawn above those groups: a document named for the date
   *  itself. `data-file` is its path; its body carries `documentBody`, being
   *  the same pipeline drawn a third place. */
  dayNote: "day-note",
  /** The heading of that note — the way from the day to the document's own
   *  page. Its own name rather than the sidebar's or a node reference's, so a
   *  selector never has to say which of the three it meant. */
  dayNoteLink: "day-note-link",
  /** Said in place of the list when nothing is dated that day. */
  dayEmpty: "day-empty",
  /** The agenda, as a page: the same dates read forward. `data-date` is the
   *  day it was answered for, which `/agenda` does not spell. */
  agendaPage: "agenda-page",
  /** THE LINE, drawn exactly when something is owed — so its absence is the
   *  page's claim that there is nothing to draw one for, and never a layout
   *  accident. It replaced `agenda-section`: the page has no boxes on it
   *  (`agenda-spine`, 2026-08-18). */
  agendaSpine: "agenda-spine",
  /** ONE DAY on that line — every one of them now, where this used to name only
   *  a day inside Upcoming. `data-date` is which day, and `data-when` is which
   *  side of now it is on (`late`, `today`, `ahead`), which is a fact about the
   *  day where `data-section` was a heading it had been filed under. Its own
   *  heading is the link to that day's own page, where the note and the
   *  finished work the agenda leaves out are read.
   *
   *  A day is drawn exactly when it owes something — except TODAY, which is
   *  drawn whenever the line is, because now is a place on it. */
  agendaDay: "agenda-day",
  /** A SILENCE worth naming, beside the line: `data-days` is how long the wait
   *  was, and the words are how long it FELT ("two quiet weeks"). Absent
   *  wherever a gap is too short to be worth a word — the whitespace is still
   *  there and still grows with the wait. */
  agendaQuiet: "agenda-quiet",
  /** Said in place of the line when nothing is late, on today, or coming. */
  agendaEmpty: "agenda-empty",
  /** The way to the agenda from the directory column, above the month — the
   *  journal's two questions, side by side. */
  agendaLink: "agenda-link",
  /** What that entry has to REPORT, wrapped around the link the way a calendar
   *  cell wraps its day. Three facts, and none of them a colour: `data-owed` is
   *  which face it wears — `overdue` (something has slipped: the app's alarm,
   *  and the count on it is the late one), `today` (the quiet chip: a nudge,
   *  not an alarm) or `quiet` (nothing owed, nothing said) — while
   *  `data-overdue` and `data-today` are the two counts THEMSELVES, so a
   *  scenario can hold the number that is shown and the one that is only
   *  spoken. They are what the agenda page's own rows add up to (`owedNow`) —
   *  on the SERVER since `vault-in-browser`'s PR 4, over the same set the page
   *  reads, and off an index the patcher keeps since
   *  `perf-agenda-history-walk`, which is what makes them affordable per
   *  revision. Held to the page's own count by a differential rather than by
   *  being the same call (`@olai/format`'s `occasion.test.ts`, `@olai/ops`'
   *  `owed.index.test.ts`). */
  agendaOwed: "agenda-owed",
  /** The number ON that entry — the chip itself, so "the count is drawn" is a
   *  promise a scenario can hold rather than an attribute it infers. Absent
   *  entirely when nothing is owed: an agenda with nothing on it wears no
   *  chip, not a zero. */
  agendaCount: "agenda-count",
  /** Rail icon: the same way in when the column is collapsed, wearing the same
   *  `data-owed` faces as a dot — no room for a count in three rem. */
  railAgenda: "rail-agenda",
  /** The way to the trash, at the foot of the directory column — below the
   *  file tree because that is where a trash sits, and OUTSIDE it because an
   *  archive is not an outline you open and edit. Drawn whether or not
   *  anything has ever been archived: an empty trash is a fact, not a hidden
   *  control. */
  trashLink: "trash-link",
  /** The way to the INBOX, beside Agenda at the top of the directory column —
   *  the outline a `⌘K` `+` captures into, whichever file the directory's is.
   *  Drawn only when there IS one: a directory that has never captured has no
   *  inbox, and minting one is the capture's job. */
  inboxLink: "inbox-link",
  /** What that entry has to REPORT, wrapped around the link the way the
   *  agenda's mark wraps its own: `data-count` is how many rows of the inbox
   *  are marked `todo` or `doing`, at any depth, so a scenario asks the
   *  number rather than the colour the chip was painted. */
  inboxHeld: "inbox-held",
  /** The number ON that entry — the same count chip Agenda wears, so "the
   *  count is drawn" is a promise a scenario can hold. Absent entirely when
   *  the inbox is empty: an empty inbox wears no chip, not a zero. */
  inboxCount: "inbox-count",
  /** THE VAULT'S OWN FILES — the `_olai/` outlines' home at the foot of the
   *  directory column, nested under the `vaultGroup` parent beside the
   *  Trash door (`client/Sidebar.tsx`). Drawn only when the directory has
   *  one. `data-file` carries the path it opens, so a scenario names the
   *  row rather than the words on it. */
  vaultLink: "vault-link",
  /** THE FURNITURE'S PARENT, naming the house itself: the one special
   *  node the `_olai/` outlines and the Trash nest under (ruled
   *  2026-08-31: one mechanism, one parent, one door for the vault's own
   *  furniture). It is no page itself — the rows under it are the doors
   *  — and it is always drawn, the way the agenda is. */
  vaultGroup: "vault-group",
  /** The trash, as a page. Every archive the directory holds, read-only. */
  trashPage: "trash-page",
  /** One archive's worth of rows on it; `data-file` is which `_olai/Trash.olai`.
   *  Drawn per archive that holds anything; its heading appears only when the
   *  directory holds more than one, the way the day page groups by file. */
  trashGroup: "trash-group",
  /** One row of the trash: an archived node, drawn but not editable.
   *  `data-node-id` is which. */
  trashRow: "trash-row",
  /** The one verb a trash row offers: send the node and its subtree back where
   *  the archive's recorded chain says they came from. */
  trashPutBack: "trash-put-back",
  /** What the last put-back had to say, under the row it was pressed on —
   *  `data-tone` is the two moods every other verb line has: `alarm` for the
   *  ops layer's refusal verbatim, `aside` for a remark on a write that
   *  landed. */
  trashSaid: "trash-said",
  /** Said in the rows' place when nothing is in the trash — including when no
   *  archive file exists yet, which is the same fact. */
  trashEmpty: "trash-empty",
  /** The page's own verb, beside the heading: empty the Trash for good. Drawn
   *  only when the archives hold something — a control offering to delete
   *  nothing is a control that teaches a reader the wrong thing — and never
   *  taken away by a filter, which narrows what is DRAWN and not what is
   *  there. One id for the resting pill and for the alarm one the question
   *  puts in its place: it is one control in three states, and a suite reaching
   *  it should not have to know which one it is in. */
  trashEmptyVerb: "trash-empty-verb",
  /** The question that replaces that verb before anything is written: how many
   *  rows go, and that nothing puts them back (`trash/question.ts`). */
  trashEmptyConfirm: "trash-empty-confirm",
  /** The way out of it, which leaves the Trash exactly as it was. */
  trashEmptyCancel: "trash-empty-cancel",
  /** What the emptying had to say — the PAGE's line rather than a row's,
   *  because the write is about every archive at once and there is no row to
   *  put it under. Same two moods and the same `data-tone` as every other
   *  said-line in this app. */
  trashPageSaid: "trash-page-said",
  /** A file's own DELETE — the second verb that destroys, drawn where `Edit`
   *  lives on a document page and where `Start` lives on an emptied outline. One
   *  id for the resting ghost and the alarm one the question puts in its
   *  place, exactly as {@link trashEmptyVerb} argues: one control in three
   *  states. */
  fileDeleteVerb: "file-delete-verb",
  /** The question that replaces that verb before anything is written: the
   *  file's name, and that nothing puts it back (`file/delete.ts`). Same
   *  contract as {@link trashEmptyConfirm}'s. */
  fileDeleteConfirm: "file-delete-confirm",
  /** The way out of it, which leaves the file exactly as it was. */
  fileDeleteCancel: "file-delete-cancel",
  /** What the delete had to say, beside the verb — the ops layer's refusal
   *  verbatim when it refused (the named records, the broken set). A LANDED
   *  one draws nothing: the page the file was on goes with it, which is the
   *  said (`file/DeleteFile.tsx` argues it). */
  fileDeleteSaid: "file-delete-said",
  /** Said when the address names no file the directory holds — a missing
   *  `.md`, a missing outline, a missing saved page. The sentence names the
   *  kind and the path. Distinct from {@link notFound}, which is a `/#id`
   *  that names no node. Absent while the pane is still on its `Reading…`
   *  line: that beat is the first-paint wait, and this id is the answer. */
  nothing: "nothing",
  notFound: "not-found",
  errorView: "error-view",
  errorFileGroup: "error-file-group",
  error: "error",
  crossFileErrors: "cross-file-errors",
  stageNote: "stage-note",
  /** Over pages that are LIVE: which files of the directory are broken. It
   *  keeps the name it had when it meant "showing the last good version",
   *  which is now only what it says for a directory that could not be read at
   *  all — brokenness is per file, so nothing else takes a page off screen. */
  staleBanner: "stale-banner",
  /** ONE broken file's line in that banner — its path, its state and how many
   *  findings implicate it, drawn off the bounded face (`@olai/format`'s
   *  `summaryOf`). A row COUNT and never the rows: the banner is over somebody
   *  else's page (`last-good-banner-flood`). Its `data-file` is the path and
   *  its `data-state` is the word. */
  brokenFileLine: "broken-file-line",
  /** The door on that line, to the broken file's own page. Absent on the
   *  directory-went-away face, whose path is the served root. */
  brokenFileLink: "broken-file-link",
  /** …and the tail, when there are more broken files than the banner draws. */
  brokenFileMore: "broken-file-more",
  /** In one outline's place: that file is broken, the rest are live. */
  outlineFailure: "outline-failure",
  /** The connection readout. On desktop, the header pill, always on screen.
   *  On a phone, the degraded banner only — live is health and a dead wire
   *  is the freeze overlay. Its `data-connection` attribute carries the
   *  state itself — `connecting`, `live`, `degraded`, `reconnecting`,
   *  `retired` — so a scenario asserts on the state and never on the colour
   *  it is painted. */
  connection: "connection",
  /** THE FREEZE: over everything, and nothing under it is interactive — the
   *  wire cannot carry a question, so the app takes no gesture at all
   *  (`client/connection/Offline.tsx`). `data-connection` carries the state
   *  that froze it, the same spelling the pill publishes. */
  offline: "offline",
  /** The button in that surface — the whole of the recovery. Shared with the
   *  fault card below, which recovers the same way and for the same reason. */
  reload: "reload",
  /** In the whole page's place: the CLIENT ITSELF threw while drawing, and the
   *  boundary around the shell caught it. The three above are errors as data;
   *  this one is a bug in this app. */
  fault: "fault",
  /** What threw, verbatim. Its own name because the claim worth asserting is
   *  that the fault is ON the card rather than summarised away. */
  faultDetail: "fault-detail",
  /** The card's second way out: off the page that faulted. A reload alone is a
   *  loop when the fault is deterministic for the route, which is the usual
   *  case. */
  faultHome: "fault-home",

  // ── the Commit button ────────────────────────────────────────────────
  /** The pill in the desktop chrome, and the header's ONE answer to "what is
   *  git doing here" (`one-git-indicator` retired the `● git` readout that
   *  used to sit beside it). ALWAYS drawn on desktop — the feature is an
   *  audit trail, so "there is no audit trail here" is the most important
   *  thing it can say, and a control that disappeared is how nobody would
   *  ever find that out. On a phone the healthy faces are silent and the
   *  news faces are `gitNews`.
   *  `data-auto` says what Auto-commit is doing in this browser — `off`,
   *  `armed`, or `paused` — which is a fact about the READER rather than
   *  about the directory, and so is its own attribute rather than a ninth face.
   *  `data-state` carries which face this is — `off`, `no-repo`, `error`,
   *  `never`, `committed`, `waiting`, `blocked`, and `unknown` for a page that
   *  has not heard from the server yet — `data-uncommitted` the count, and
   *  `data-repo` the repository's own state. What git SAID rides the tip and
   *  the `aria-label`, never a colour. */
  commitPill: "commit-pill",
  /** How long the olai SERVER has been up — process start, not this tab's.
   *  Desktop only, furniture: `up 2h`, the exact start instant in a
   *  visually-hidden span (and on the tip). `data-started` is the ISO
   *  the wire sent, so a scenario asserts the instant rather than the
   *  ticking phrase. */
  uptime: "uptime",
  /** The panel it opens. One row per node, never a text diff. */
  commitPanel: "commit-panel",
  /** Phone git banner — only while there is news (uncommitted, blocked, a
   *  fault, unpushed). Absent on a healthy tree, and absent on desktop. */
  gitNews: "git-news",
  /** What olai last recorded here — message, writer, how long ago, short sha.
   *  Says so in words when there is nothing: "never committed here" is a fact a
   *  count of what is pending cannot express. */
  commitLast: "commit-last",
  /** One outline's worth of those rows; `data-file` is what the store calls it
   *  and `data-path` what the repository does — the second is what a tick
   *  names, because the two namespaces can collide. */
  commitGroup: "commit-group",
  /** One dirty file that is NOT a served outline: a document, a source file, an
   *  outline outside the served root. `data-path` is its repo-root-relative
   *  name and `data-how` what happened to it — `modified`, `untracked`,
   *  `deleted` — never the word it is rendered as. A path-level row and
   *  deliberately nothing more: there is no text diff here. */
  commitOther: "commit-other",
  /** The box that says whether a file is going into this commit. `data-path`
   *  is which file; ALL of them are ticked until somebody says otherwise. */
  commitTick: "commit-tick",
  /** What the list is a list OF — the whole repository, and which part of it
   *  olai serves. */
  commitScope: "commit-scope",
  /** What is committed here and nowhere else. `data-commits` is how many, and
   *  the line is absent when there is nothing to send or nowhere to send it. */
  commitUnpushed: "commit-unpushed",
  /** The Push button. One verb, current branch, no arguments. */
  commitPush: "commit-push",
  /** What a refused push said, in git's own words. */
  commitPushRefused: "commit-push-refused",
  /** One node that changed. `data-node-id` is which, and `data-sort` is what
   *  changed about it — `done`, `noted`, `archived` — never the word it is
   *  rendered as, which is the view's to reword. */
  commitChange: "commit-change",
  /** Dirty outlines whose working copy does not parse. */
  commitUnreadable: "commit-unreadable",
  /** Who has written since the last commit. Intent, not truth: empty after a
   *  restart, and blind to an edit made in an editor. */
  commitWriters: "commit-writers",
  /** Why the repository cannot take a commit right now. */
  commitBlocked: "commit-blocked",
  commitMessage: "commit-message",
  /** The button itself. */
  commitNow: "commit-now",
  /** What git said when it last refused a COMMIT here — the directory's, off
   *  the git cell, so it is the same words in every tab and after a reload. */
  commitRefused: "commit-refused",
  /** ... and what the SERVER would not take from this tab: a call the wire
   *  dropped, or a usage refusal. About this press rather than about the
   *  directory. */
  commitCallRefused: "commit-call-refused",
  /** Why the quiet-window loop stopped, when it has — and the one gesture that
   *  resumes it. Absent while the loop is running, and absent for a directory
   *  whose policy is not `auto`. */
  commitAutoPaused: "commit-auto-paused",
  /** What Auto-commit is about to do with what is waiting. Drawn only while
   *  the preference is on and the loop is running — a line that said so with
   *  the loop stopped would be a promise the app is not keeping. */
  commitAutoArmed: "commit-auto-armed",

  // ── the agent panel ──────────────────────────────────────────────────
  /** The header's agent toggle on desktop. Always on screen there;
   *  `aria-pressed` says whether the panel is open, `data-busy` whether a
   *  turn is running (including while open). Absent on a phone, where the
   *  thumb strip is the door. */
  chatToggle: "chat-toggle",
  /** The open panel (desktop dock or mobile sheet). Its `data-status` carries
   *  the cell's own state — `booting` / `idle` / `thinking` / `gone` — so a
   *  scenario waits on the state rather than on a spinner's styling.
   *  `data-layout` is `dock` or `sheet`; `data-snap` is the mobile snap. */
  chatPanel: "chat-panel",
  /** Desktop minimized chat: bottom-right pill with last agent message. */
  chatPill: "chat-pill",
  /** Mobile minimized chat: strip above the thumb. */
  chatStrip: "chat-strip",
  /** Truncated last-message text inside the pill or strip. */
  chatPillText: "chat-pill-text",
  /** Drag handle on the chat dock's left edge. */
  chatResize: "chat-resize",
  /** Mobile bottom-sheet host (scrim + sheet). */
  chatSheet: "chat-sheet",
  chatSheetScrim: "chat-sheet-scrim",
  chatSheetHandle: "chat-sheet-handle",
  // ── command palette (shell) ──────────────────────────────────────────
  palette: "palette",
  paletteScrim: "palette-scrim",
  paletteInput: "palette-input",
  /** The rows. `data-asked` is WHICH query they answer — absent while they
   *  answer one the reader has typed past — the same attribute the shortlist
   *  under every other search box publishes (`search/Shortlist.tsx`). */
  paletteList: "palette-list",
  paletteItem: "palette-item",
  paletteAsk: "palette-ask",
  /** The `+` prefix's preview: the line that is about to become a node. */
  paletteCapture: "palette-capture",
  /** The second line of a result row: where the node lives. */
  paletteItemPlace: "palette-item-place",
  /** One `key value` pair on a palette node row's third line. */
  paletteItemProp: "palette-item-prop",
  /** What a write the palette made had to say — a refusal in the ops layer's
   *  own words, or a remark about one that landed. `data-tone` says which,
   *  because the mood is a fact and the colour is a styling decision. */
  paletteSaid: "palette-said",
  /** The QUESTION the palette is asking, whichever of the two it is: the
   *  sentence the one verb with a blast radius asks before it runs (the `•••`
   *  menu's own words), or the one a pin's name is typed under. One slot,
   *  because "is the palette asking something" is one fact about this panel
   *  (`palette/Question.tsx`). */
  paletteConfirm: "palette-confirm",
  // ── the filter over the page, which is not the header's box ──────────
  /** The bar above a tree page: the box, the count, the refusals. Drawn on the
   *  two routes that may carry a filter and nowhere else.
   *
   *  `data-asked` is WHICH query the rows below it answer — absent while they
   *  answer one the reader has already moved on from, since the filter is a
   *  debounce and a round trip now (`client/filter/asking.ts`). The same
   *  attribute the shortlist under every other search box publishes, for the
   *  same fact. */
  filterBar: "filter-bar",
  filterInput: "filter-input",
  /** The page's own out-vote on done-visibility, beside the filter: a
   *  (filter/) two-segment strip, `data-own` while the page holds an entry
   *  against the panel's default. `data-file` is the outline it speaks for —
   *  the held previous page during a swap still wears its own. Outline pages
   *  only — a day, the agenda, the trash get the bar without it
   *  (settings/done.ts). */
  doneFlip: "done-flip",
  /** The release door of the flip — the `·` mark, a button while the page
   *  owns its say: the flip's two segments ask, the mark hands the pick
   *  back to the panel. */
  doneRelease: "done-release",
  /** "3 of 41", plus what the done-preference is holding back. */
  filterCount: "filter-count",
  filterClear: "filter-clear",
  /** A known operator with an unknown value, in the grammar's own words —
   *  never a query that quietly found nothing. */
  filterRefusal: "filter-refusal",
  /** The search itself refusing — the server could not answer, which is a
   *  different piece of news from a query it read and refused
   *  (`client/filter/asking.ts`). */
  filterFailure: "filter-failure",

  // ── split panes ──────────────────────────────────────────────────────
  /** One pane of a split workspace. `data-pane` is its index,
   *  `data-pane-focused` whether it is the one keyboard and the palette
   *  act on (not `data-focused` — that attribute is the ROW a chat
   *  reference is pointing at), `data-href` the route it is showing. A
   *  lone page is still a pane of one. */
  pane: "pane",
  /** The labelled rail a pane collapses to — present instead of the page,
   *  never as well as. Click expands. */
  paneRail: "pane-rail",
  /** The thin bar above a pane when more than one is open: drag to reorder,
   *  the close control, the label. Absent on a lone page. */
  paneHeader: "pane-header",
  /** Close this pane. Closing the second-to-last returns to a plain page. */
  paneClose: "pane-close",
  /** The drag divider between two expanded panes. */
  paneResize: "pane-resize",
  /** Narrow screens: the tab strip the pane list projects to. Same URL. */
  paneTabs: "pane-tabs",
  /** One tab of that strip. `data-pane` is which, `aria-current` the focused. */
  paneTab: "pane-tab",
  /** The SAME refusal, on the two doors that ask the server for it — the ⌘K
   *  palette and the header box. One name for both, because it is one sentence
   *  about one grammar; where it is drawn is each door's own business. */
  searchRefusal: "search-refusal",
  /** "8 of 90 matches" — what a shortlist drew of what it found, on the same
   *  two doors, and ABSENT when it drew the lot. One name for both for the
   *  refusal's reason above: one sentence about one answer
   *  (`client/search/count.ts`). A scenario reads it inside the door it means,
   *  since only one of the two is ever up. */
  searchCount: "search-count",
  // ── the header's search box, the other door to the same reading ──────
  headerSearch: "header-search",
  /** The phone's door: opens the palette, which is the same modal. */
  headerSearchOpen: "header-search-open",
  /** The results panel. `data-asked` is WHICH query the rows answer — the
   *  same attribute the palette list and the shortlist publish. */
  headerSearchResults: "header-search-results",
  headerSearchItem: "header-search-item",
  headerSearchItemPlace: "header-search-item-place",
  /** One `key value` pair on a header result row's third line. */
  headerSearchItemProp: "header-search-item-prop",
  headerSearchError: "header-search-error",
  /** Refusal from a `>` ask that the palette surfaces instead of swallowing. */
  paletteAskError: "palette-ask-error",
  /** Refusal from the NODE SEARCH — a different question from the ask, so a
   *  different row: two async sources sharing one slot would show a reader
   *  the wrong sentence about the wrong thing. */
  paletteSearchError: "palette-search-error",
  chatTitle: "chat-title",
  chatModel: "chat-model",
  /** WHO this conversation is with, beside the model — the agent's name, with
   *  its mark in front of it. `data-agent` is the id, so a scenario can say
   *  which agent without reading a brand name off the screen. */
  chatAgent: "chat-agent",
  /** The mark itself. Its own id because "the header shows the agent's ICON"
   *  is half the ruling, and a name with no mark passes an assertion about the
   *  name. `data-mark` says which one was drawn — the agent's own, or the
   *  generic one an agent olai has no mark for gets. */
  chatAgentMark: "chat-agent-mark",
  /** WHO IS TALKING, over the first row of their run in the transcript — a mark
   *  and a name ({@link ./chat/Speaker.tsx}). `data-speaker` is which of the
   *  three parties (`human`, `agent`, `plugin`) and `data-speaker-name` is what
   *  the panel called them, so a scenario can assert that a plugin's doorbell
   *  is not drawn as the person whose lane it travelled down without reading a
   *  picture or a glyph.
   *
   *  ONCE PER RUN, deliberately: a face is drawn where a speaker's stretch of
   *  rows BEGINS, so a scenario counting these is counting turns rather than
   *  messages ({@link ./chat/speakers.ts} holds the rule). Absent from the
   *  shelf that previews one agent's calls, where the head already names it. */
  chatSpeaker: "chat-speaker",
  /** A PLUGIN's mark, on such a face. Its own id beside `chatAgentMark` because
   *  the two come from different places and only one of them is olai's: this
   *  shape is contributed by the plugin's own manifest (`@olai/plugin-api`'s
   *  `PluginMark`). `data-mark` says which was drawn — the plugin's own, by
   *  name, or the `generic` a plugin that hangs none gets. */
  chatPluginMark: "chat-plugin-mark",
  /** The picker: which agent this conversation is with. Drawn in the
   *  transcript's place when the panel is asking, and over it when `+ new`
   *  does the asking. */
  chatChoose: "chat-choose",
  /** One agent to choose. `data-agent` is its id. */
  chatChooseAgent: "chat-choose-agent",
  /** The way out of the picker when a conversation is already open and `+ new`
   *  put it there. Absent when the panel is asking because it HAS no
   *  conversation: there is nothing to go back to. */
  chatChooseCancel: "chat-choose-cancel",
  /** How full the context is (`22k/1M`), beside the model. Absent until the
   *  agent has reported some — a conversation that has spent nothing says
   *  `0/…`, so an absent line means nothing was said rather than nothing spent. */
  chatUsage: "chat-usage",
  chatNew: "chat-new",
  /** Drawn beside the model while a turn is running. Beside, not instead:
   *  what it runs on and whether it is running are two facts. */
  chatWorking: "chat-working",
  /** The strip between the transcript and the box while the panel is busy —
   *  a turn running, or an agent starting. Its WORDS are the assertion: the
   *  header's `chatWorking` says the same fact in the chrome, and this says it
   *  where a person who has just pressed enter is looking. */
  chatBusy: "chat-busy",
  chatSessions: "chat-sessions",
  chatSessionList: "chat-session-list",
  chatSession: "chat-session",
  /** The line under a chats row that says WHICH conversation replaced this
   *  one — with a `data-successor` of its id, because the successor need not
   *  be on the screen (it is drawn only when it is), and the sentence alone
   *  would be a claim nothing could pick out of two sharing a title. */
  chatSessionSuperseded: "chat-session-superseded",
  /** The heading over one agent's rows in the chats list. Drawn only where
   *  more than one agent has conversations here — one agent is a heading over
   *  the whole list. */
  chatSessionAgent: "chat-session-agent",
  /** One agent in the chats list that could not be asked what it has stored,
   *  with its reason. Its OWN name and not the whole call's refusal
   *  (`chatSessionsRefused`): "the list could not be fetched" and "one of
   *  several agents is broken" are two states, and the second leaves every
   *  other agent's conversations on the screen. */
  chatSessionUnreachable: "chat-session-unreachable",
  /** The strip under the header: which MCP servers this conversation has, and
   *  how each one stands. Absent — not empty — only where there is no
   *  conversation to have any. One `chatServer` inside it per server. */
  chatRoster: "chat-roster",
  /** One server on that strip. `data-server` is its name and `data-standing`
   *  is how it stands (`connected`, `handed`, `unattached`, `missing`) — the
   *  state as DATA, because the mark beside the name is styling and a scenario
   *  that asserted a glyph would be asserting a decision about pixels. */
  chatServer: "chat-server",
  /** The line saying the list is not the whole of what the agent can reach.
   *  Its own id because it is the honesty of the whole strip: olai lists what
   *  it handed over, and an agent's own servers are configured where olai
   *  cannot see them. */
  chatRosterOwn: "chat-roster-own",
  /** The part of that strip that names the servers this conversation does NOT
   *  have, in sentences. Absent — not empty — on a conversation that got
   *  everything. One `chatMissingServer` inside it per server. */
  chatMissing: "chat-missing",
  /** One such server. `data-server` is its name; the reason is the
   *  `chatMissingWhy` inside it. */
  chatMissingServer: "chat-missing-server",
  /** Why it is not here, in the server's, the probe's or the agent's own
   *  words. Its own id because it is the half the whole feature exists for: a
   *  strip that named the server and not the reason would be the log line
   *  again, on screen. */
  chatMissingWhy: "chat-missing-why",
  chatTranscript: "chat-transcript",
  /** The panel saying a dragged file would land HERE: drawn over the
   *  transcript and the composer while a drag carrying files is over them,
   *  and gone the moment it is not. */
  chatDrop: "chat-drop",
  /** Drawn in the transcript's place when this machine has no agent at all —
   *  none installed, or chat switched off. The panel is NOT hidden in that
   *  state: this is what it says instead, and it says how to install one. */
  chatNoAgent: "chat-no-agent",
  /** One agent it tells you how to install. `data-agent` is its id. */
  chatInstall: "chat-install",
  /** Drawn in the transcript's place when the agent is RUNNING and would not
   *  open a conversation. The panel's third body, and the one that is about a
   *  live agent: `chatNoAgent` is a capability that is switched off, this is
   *  one that said no. */
  chatUnopened: "chat-unopened",
  /** The agent's own words for that refusal — its own id because it is the
   *  half the face exists for, the way `chatMissingWhy` is. */
  chatUnopenedWhy: "chat-unopened-why",
  /** ...and the one thing that can change it: try opening it again. */
  chatReopen: "chat-reopen",
  /** The agent's finished prose, rendered as markdown. Its own name rather
   *  than a node note's: they are two different things on the page. */
  chatSaid: "chat-said",
  /** What YOU typed, quoted verbatim. Its own name rather than the agent's
   *  `chatSaid`: they are two different things on the page, and a scenario
   *  that asks "did I say this" should not have to filter the agent's prose. */
  chatMine: "chat-mine",
  /** What a MACHINE said in the human's lane — a plugin's doorbell putting a
   *  sentence into the conversation (`@olai/plugin-api`'s `Deliveries`). It is a
   *  `user` row like `chatMine` and deliberately not drawn as one: full width
   *  and left-aligned, with `data-rang-by` naming which plugin rang. It carries
   *  no `chatResend`, ever — re-sending a derivation that has stopped being true
   *  is the one outcome the doorbell exists to prevent, and the thing that
   *  derived it rings again by itself. Absent on a replayed conversation, where
   *  the row comes back out of message chunks with no mark on it and the
   *  sentence's own opening line is the whole of the attribution. */
  chatRang: "chat-rang",
  /** The label a machine's row opens with: the attribution line the PLUGIN
   *  wrote, drawn as a byline rather than as the first line of the paragraph
   *  ({@link ./chat/byline.ts}). Its own id so a scenario can assert the face
   *  is there — a name over the words — without asserting the plugin's
   *  wording, which is the plugin's to change. Absent, deliberately, on a body
   *  that carries no such line: nothing here composes one. It is also the
   *  FOLDED FACE of the row — the one line drawn before anybody presses — and
   *  sits BESIDE `chatRangFold` rather than inside it: the line is a line, and
   *  the chevron at its head is the control. It may carry a pressable id of its
   *  own, which is why (ruled, human 2026-08-31). */
  chatRangByline: "chat-rang-byline",
  /** The control that opens a machine's row, and shuts it again — a disclosure
   *  chevron at the head of the essence line, carrying `aria-expanded` the way
   *  `chatToolFold` does ({@link ./chat/rang.ts} for why the row folds at all).
   *
   *  IT USED TO BE THE WHOLE LINE, and stopped being one when a plugin began
   *  naming the node it rang about in that line: a reference inside a button is
   *  a press with two meanings. So the id is pressable and the chevron is the
   *  fold, which is what a scenario now presses to open the row.
   *
   *  ABSENT on a body with no essence line to fold to: that row is one
   *  paragraph and already whole, and a control that hides words behind a label
   *  nobody wrote is the one thing this fold must not become. */
  chatRangFold: "chat-rang-fold",
  /** What the fold holds back: the account under the essence line — the
   *  terminal id, the derivation, the standing set, the how-to-stop line. Not
   *  in the page until the row is open, which is what lets a scenario assert
   *  the FOLD (gone, then there after the press) without asserting a single
   *  word the plugin wrote. Always present on a row that does not fold. */
  chatRangBody: "chat-rang-body",
  /** One row. `data-kind` is which of the six it is, and `data-entry-id` is
   *  its transcript key — which is what a lane names when it says which agent
   *  a call was made inside (`chatLane`), so it is a handle scenarios reach
   *  for rather than an internal. */
  chatEntry: "chat-entry",
  /** A question the agent asked, as a form. `data-asking` is whether it is
   *  still waiting, `data-how` how it ended once it is not. */
  chatAsk: "chat-ask",
  /** One field of that form; `data-field` is the schema property it answers. */
  chatAskField: "chat-ask-field",
  /** One tappable option; `data-value` is what travels back, `aria-pressed`
   *  whether it is picked. */
  chatAskChoice: "chat-ask-choice",
  /** A box to type in: a `text`/`number` field, or the "other" companion of a
   *  question that offers one. */
  chatAskText: "chat-ask-text",
  chatAskSubmit: "chat-ask-submit",
  chatAskDismiss: "chat-ask-dismiss",
  /** What became of a question, once it stopped waiting. */
  chatAskOutcome: "chat-ask-outcome",
  /** A tool call's row; `data-tool-status` is the agent's own status. */
  chatTool: "chat-tool",
  /** The line that opens a tool call. Named rather than found as "the button
   *  in the frame": the frame also draws what the call CHANGED, and the node
   *  an olai write was about is a control there too. */
  chatToolFold: "chat-tool-fold",
  chatToolDetail: "chat-tool-detail",
  /** What a call is SAYING as it runs — the protocol's incremental content,
   *  drawn above the arguments because it is the live half. */
  chatToolProgress: "chat-tool-progress",
  /** Where it is working: the follow-along file locations, on the line. */
  chatToolLocations: "chat-tool-locations",
  /** HOW LONG it has been running, on the same line — drawn only once a call
   *  the wire still calls running has outlasted the panel's quiet threshold,
   *  and only while the CONVERSATION is live, so a dead agent's sticky
   *  `pending` never keeps a clock counting.
   *
   *  It names the DURATION and not the readout around it: the separator that
   *  sets it off from the locations and the words a screen reader hears are
   *  outside, so what a scenario reads back is the number the rule decided.
   *  That number ticks, which is why a scenario asserts that a duration is
   *  drawn and that it GROWS, rather than which one it is. */
  chatToolElapsed: "chat-tool-elapsed",
  /** A row a SUBAGENT is responsible for, in the lane it is drawn in.
   *  `data-lane` is the transcript key of the `Agent` frame it belongs to —
   *  the same key the row itself carries as `data-entry-id` — so a scenario
   *  can assert WHICH agent, and find that agent's own frame to measure the
   *  indent against. */
  chatLane: "chat-lane",
  /** The lane naming itself — drawn once where a stretch of one agent's work
   *  opens, never on every call it makes. */
  chatLaneLabel: "chat-lane-label",
  /** WHO a call sent out, on the line of the call that sent them.
   *  `data-spawn-kind` is the agent's own word for the kind of agent it
   *  started, or the bare category when the spawn named none — which is what a
   *  scenario asserts, since the visible text is the same string and reading it
   *  off the attribute keeps the claim about the fact rather than about the
   *  layout. */
  chatSpawn: "chat-spawn",
  /** A spawned agent that has not stopped: what it is doing, on the rail that
   *  drops out of the frame which started it — drawn from the spawn itself
   *  rather than from the first call the agent makes. `data-lane` is that
   *  frame's transcript key, the same key `chatLane` uses, so a scenario can
   *  say WHICH agent is still going. It names the WORDS rather than the rail
   *  around them, because the words are what a reader sees inset and the
   *  rail's own box starts at the row's left edge. Absent the moment the call
   *  completes or fails. */
  chatSpawnWorking: "chat-spawn-working",
  /** THE DOOR onto a spawned agent's own calls, under the row that sent it —
   *  the durable half of reaching them, since the strip carries an agent only
   *  while it is out. Its text is how many calls are behind it
   *  (`web/src/client/chat/door.ts`), `data-lane` is the spawning frame's
   *  transcript key (the same key `chatLane` and `chatSpawnWorking` use) and
   *  `aria-expanded` says whether it is the open one. Absent on every row that
   *  spawned nobody, and on a spawn nobody has heard from yet. */
  chatLaneDoor: "chat-lane-door",
  /** THE SHELF one agent's calls are read in, between the strip above the
   *  scroll and the transcript — never over either, so the conversation is
   *  still readable underneath and the composer is never covered. `data-row` is
   *  the spawning frame's transcript key. Absent whenever nothing is open,
   *  which is nearly always. */
  chatPreview: "chat-preview",
  /** Its head: the agent it is about, by the name the spawning row carries.
   *  `data-spawn-kind` is the kind of agent, when the spawn named one. */
  chatPreviewOf: "chat-preview-of",
  /** ... and the notice at its head saying the turn is blocked on a QUESTION,
   *  which is the one thing in this box that is not about the agent. A form is
   *  never drawn in here — it stays in the conversation, where a decision
   *  belongs — so this is what keeps `docs/chat.md`'s promise that a form
   *  arrives where a reader is already looking: pressing it closes the shelf
   *  and raises the same ask the attention banner does. Absent whenever nothing
   *  is waiting. */
  chatPreviewAsked: "chat-preview-asked",
  /** ... and what it says when the agent has not called anything yet — which is
   *  the whole of the stretch a fan-out is watched through, and an honest thing
   *  to say rather than an empty box. */
  chatPreviewNothing: "chat-preview-nothing",
  /** WHAT a call left running in the background, on the line of the call that
   *  armed it: the description the task was armed with. `data-task` is the
   *  harness's own id for the task, so a scenario asserts the FACT rather than
   *  the sentence around it. Absent on every call that armed nothing, and on a
   *  task nobody described. */
  chatArmed: "chat-armed",
  /** THE STRIP under the header naming what is still running in the background,
   *  drawn only while something is. Above the scroll, so it is readable from
   *  wherever the reader is — which is the half a row at its birth position
   *  cannot serve. */
  chatWatching: "chat-watching",
  /** One thing on it. `data-row` is the transcript key of the call that armed
   *  the task or sent the agent — the same key that row carries as
   *  `data-entry-id` — so a scenario can say the strip and the record are one
   *  thing named twice. `data-kind` is which of the two it is (`agent` /
   *  `task`), because they are drawn on one strip and only one of them is a
   *  door: an agent entry is a BUTTON that opens that agent's own calls, and a
   *  task entry is not pressable, since a task's events are on no wire olai can
   *  reach. `aria-pressed` on an agent entry says whether its shelf is the one
   *  open. */
  chatWatchingTask: "chat-watching-task",
  /** ... and how long it has been out, in the same words the row's own readout
   *  uses. It names the DURATION alone, so what a scenario reads back is the
   *  number rather than the sentence around it. */
  chatWatchingFor: "chat-watching-for",
  /** THE STRIP under that one: what this conversation WAKES ON. One line per
   *  running plugin that declares a doorbell (`@olai/surface`'s `BuiltPlugin`'s
   *  `wake`), saying in that plugin's own words what the wake is on and which
   *  file a person pointed it at. Absent where there is no conversation to be
   *  scoped, which is the roster strip's own rule. */
  chatWake: "chat-wake",
  /** One plugin's control on it: the trigger that opens the file list, wearing
   *  the picked file's name or `off`. `data-plugin` is WHOSE doorbell and
   *  `data-file` is the file or `off` — the state as DATA, because the words
   *  around it are the plugin's sentence and a scenario asserting those would be
   *  asserting somebody else's vocabulary. `aria-expanded` says whether the list
   *  is up. */
  chatWakePicker: "chat-wake-picker",
  /** The list it opens, hung from the strip's own box. */
  chatWakeList: "chat-wake-list",
  /** Where a person types to narrow that list, which a vault of any size needs
   *  and the chats picker does not (an agent's conversations are tens; a
   *  directory's files are thousands). */
  chatWakeQuery: "chat-wake-query",
  /** One offered file in it; `data-file` is the path a press would scope this
   *  conversation to. */
  chatWakeFile: "chat-wake-file",
  /** ... and the way back OFF, which is the same verb with no file. Drawn only
   *  where there is something to clear, because a doorbell that is already off
   *  has nothing to turn off. */
  chatWakeClear: "chat-wake-clear",
  /** How many of that plugin's sentences this end is holding for this
   *  conversation and has not let in yet. Drawn only while it is holding
   *  something — the panel's rule is that the alternative to holding words out
   *  of sight is not dropping them, it is showing them. The NUMERAL is core's,
   *  in `data-waiting`; the noun beside it is the plugin's own word for what is
   *  waiting, so a scenario reads the count and not the sentence. */
  chatWakeWaiting: "chat-wake-waiting",
  /** THE FAULT: the file this doorbell was pointed at is not served any more,
   *  so the row draws this instead of a live picker. Its presence IS the fault
   *  — quiet-and-fine and quiet-because-broken are indistinguishable on every
   *  other channel, and a picker still naming a file nothing will ever read
   *  would be the control asserting something untrue. `data-file` is the path
   *  that went missing, so a scenario reads the state as data rather than out
   *  of the sentence beside it. The way to fix it — picking another file — is
   *  still on the row ({@link chatWakePicker}). */
  chatWakeGone: "chat-wake-gone",
  /** ... and how that task ENDED, in the harness's own word — `completed`,
   *  `failed`, `killed`, `stopped`, of which ACP's own status can spell only
   *  two. Drawn only once the task has ended, which is what makes its presence
   *  the death itself; `data-ended` carries the word. */
  chatArmedEnded: "chat-armed-ended",
  /** A background task that has not ended: the rail that drops out of the frame
   *  which armed it, saying it is still out there. The sibling of
   *  `chatSpawnWorking` and drawn as the same rail — `data-lane` is the armed
   *  frame's transcript key. Absent the moment the harness reports the task's
   *  end, and absent for an abandoned call whose agent died. */
  chatArmedStill: "chat-armed-still",
  /** One file the call REWROTE, drawn as a trimmed line diff. `data-path` is
   *  the file (root-relative when it is under the served directory) and
   *  `data-expanded` says whether the trim has been opened. */
  chatDiff: "chat-diff",
  /** One row of that diff. `data-kind` is `add` / `remove` / `same` / `gap` —
   *  the fact, never the colour it is painted in, which is the whole subject
   *  and so the last thing to assert on. */
  chatDiffLine: "chat-diff-line",
  /** The line-number column of that row. Its own name because a wrapped line
   *  must leave this column where it is — a continuation that slides under
   *  the numbers is a row that no longer reads as a diff. */
  chatDiffGutter: "chat-diff-gutter",
  /** The `+` / `−` / blank marker, the other column that must not wrap. */
  chatDiffMark: "chat-diff-mark",
  /** The line's text. This is the only part of the row that may wrap. */
  chatDiffText: "chat-diff-text",
  /** The control that opens a trimmed diff in place, and shuts it again. */
  chatDiffExpand: "chat-diff-expand",
  /** One OUTLINE the call rewrote — its own name, because the whole claim is
   *  that this is never the row above: a `.olai` is one line per node, so it
   *  is drawn as node changes and there is no text diff of one anywhere.
   *  `data-path` is the file, `data-expanded` whether the trim has been
   *  opened. */
  chatOutlineDiff: "chat-outline-diff",
  /** One node inside it, in the Commit panel's own words. `data-sort` is the
   *  format's classification, `data-node-id` which node. */
  chatOutlineChange: "chat-outline-change",
  /** ... or the sentence that replaces those rows when one side of the file
   *  does not parse. Still never a text diff — an outline nothing can read is
   *  news, not a reason to fall back to lines. */
  chatOutlineUnreadable: "chat-outline-unreadable",
  /** Said in a diff's header when the two texts were too far apart to line up
   *  line by line: every row below is a change, so a trimmed view shows the
   *  top of the old file rather than an edit. */
  chatDiffWholesale: "chat-diff-wholesale",
  /** What an olai WRITE did, in the commit panel's own words — never a diff.
   *  `data-sort` is the format's classification (`done`, `noted`, `moved`, …),
   *  or `unchanged` for a write that moved no record. */
  chatWrote: "chat-wrote",
  /** What the rollup noticed about that write. Advice on a write that LANDED,
   *  never a reason anything failed — the transcript's own copy of the aside a
   *  keystroke already gets under its row. */
  chatNudge: "chat-nudge",
  /** The composer PROMISING that what you send now waits its turn at the
   *  agent and is got to when the running turn is over — drawn while a turn is
   *  running, and only for an agent that advertised the queue it is a promise
   *  about. */
  chatQueues: "chat-queues",
  /** A refused write, with its structured detail drawn out. */
  chatRefusal: "chat-refusal",
  /** What the last VERB refused — an empty send, a turn already running. */
  chatRefused: "chat-refused",
  /** Why the picker has no conversations to offer. Its OWN answer rather than
   *  the panel's `chatRefused`, because the click that asked was here — and
   *  because a refusal that resolved to an empty list used to be drawn as "no
   *  stored conversations", which is a claim about the agent's disk. */
  chatSessionsRefused: "chat-sessions-refused",
  /** What went wrong where nobody was waiting: a boot, a dead agent. */
  chatTrouble: "chat-trouble",
  /** The message box. On a name `@`, `data-asked` is WHICH query the NODE
   *  half has answered — the list itself is not drawn when that answer is
   *  empty (`Composer.tsx`'s `open` is `rows().length > 0`), so the wait
   *  lives here. */
  chatInput: "chat-input",
  /** On a `user` row the agent has not started on: it went out while a turn
   *  was running and is waiting its turn there. Not a delivery — nothing has
   *  failed — so it is its own strip, and it goes away when the agent takes
   *  the message up. */
  chatQueued: "chat-queued",
  /** On a `user` row that did not land: the strip saying WHICH way it did not,
   *  in `data-delivery` — `refused`, which carries the button that tries
   *  again, or `unanswered`, which deliberately carries none. The words stay in
   *  the bubble above it either way. */
  chatDelivery: "chat-delivery",
  chatResend: "chat-resend",
  /** The composer saying the turn is stopped on YOU: the agent asked something
   *  and is waiting for the form above to be answered. */
  chatWaiting: "chat-waiting",
  chatSend: "chat-send",
  /** The other send: put these words INTO the turn the agent is running. Drawn
   *  only while there is a turn to interrupt and only for an agent that said it
   *  takes one — the visible door onto Alt+Enter, which is the same gesture. */
  chatInterrupt: "chat-interrupt",
  chatCancel: "chat-cancel",
  /** The pictures on a message — pending in the composer, or sent, on the row.
   *  Each one is a `chatAttachment` carrying its file name in `data-name`. */
  chatAttachments: "chat-attachments",
  chatAttachment: "chat-attachment",
  /** Drawn only in the tab that sent the picture, out of the Blob it still
   *  has. Every other tab has the name and nothing to draw. */
  chatAttachmentPreview: "chat-attachment-preview",
  /** How big a NON-picture attachment is, beside its name. A PDF has no
   *  thumbnail worth drawing, and the size is what a name does not carry.
   *  Drawn only by the tab that attached it, for the same reason the preview
   *  is: it is the only one holding the bytes. */
  chatAttachmentSize: "chat-attachment-size",
  chatAttachmentRemove: "chat-attachment-remove",
  /** The nodes a message is ABOUT — armed in the composer, or sent, on the row.
   *  Each one is a `chatContextChip` carrying its node id in `data-node`. */
  chatContext: "chat-context",
  chatContextChip: "chat-context-chip",
  /** Take an armed node back off before the message goes. */
  chatContextRemove: "chat-context-remove",
  /** A node NAMED in the panel and pressable: a context chip, or the node an
   *  olai write was about. Carries the id in `data-node-ref`, which is the same
   *  attribute the ids in the agent's own prose are marked with — one selector
   *  for every reference, however it got there (`chat/refs.ts`). */
  chatNodeRef: "chat-node-ref",
  /** The file picker beside the input — a phone has no Ctrl+V. */
  chatAttachButton: "chat-attach",
  /** The camera's door beside the `+` — the second entry a phone gets
   *  (`chat/camera.ts`). Its input carries `capture="environment"`, which is
   *  what makes a phone's browser open the camera itself. Drawn ONLY where
   *  the primary pointer is coarse: on a desktop the attribute is ignored
   *  and the button would open a file dialog, so it is ABSENT there —
   *  which is the fact a scenario on a desktop asserts. */
  chatCameraButton: "chat-camera",
  /** The button that opens the WHOLE command list. Drawn only when the agent
   *  offers commands. */
  chatCommands: "chat-commands",
  /** The shortlist over the message box: the agent's commands under a `/`, what
   *  the served directory holds under an `@`. `data-kind` says which of the two
   *  — `command` or `name` — so a scenario names the list rather than guessing
   *  from what is in it. On a name list, `data-asked` is WHICH query the NODE
   *  half answers (the files are local and up at once); absent while that half
   *  has not answered. The same attribute is on the box (`chatInput`), because
   *  a trigger whose query matches nothing draws no list. */
  chatCompletion: "chat-completion",
  /** One row of it. `data-value` is the command's name, the file's path or the
   *  node's id — what taking the row is about, and what it writes into the
   *  message; `data-active` is which one Enter would take. */
  chatCompletionRow: "chat-completion-row",
  /** The word over the first row of a block, when a list holds two kinds of row
   *  — `files` and `nodes` under an `@`, on `data-section`. A label rather than
   *  a row: the arrows never land on it. */
  chatCompletionSection: "chat-completion-section",
  /** The `@` list's node half saying it could not be asked — a failed call, not
   *  a word that named nothing. Its own line, never the send's refusal
   *  (`client/chat/Composer.tsx`). */
  chatNamingFailure: "chat-naming-failure",
  /** The transcript saying the ids in it could not be looked up — the same kind
   *  of line one door over, about the other call the panel makes. The words are
   *  still there; what is missing is which of the backticks are pressable. Once
   *  for the pane, because one call carries every message's ids
   *  (`client/chat/declared.ts`). */
  chatRefsFailure: "chat-refs-failure",
} as const

export type TestId = (typeof TESTID)[keyof typeof TESTID]

/** `[data-testid="…"]`, for the side that writes selectors rather than
 *  attributes.
 *
 *  It takes an id from EITHER table — this app's or a plugin's — and the union
 *  is what keeps the guard: a closed set means a typo is a type error here
 *  rather than a selector that quietly matches nothing for thirty seconds. It
 *  is not widened to `string`, which was the shorter edit and would have thrown
 *  that away; a plugin's ids are a closed set too, so there is nothing to give
 *  up. */
export const selector = (id: TestId | PluginTestId): string => `[data-testid="${id}"]`

/**
 * WHICH PREFERENCE ROW A PLUGIN'S IS — its `data-pref`, and the one spelling of
 * it.
 *
 * The plugin roster is the one part of this panel whose rows are not known when
 * this file is written: there is a row per plugin the BUILD has, walked off the
 * `plugins` cell, and neither the panel nor the suite may spell a plugin's name
 * (`@olai/plugin-api`'s `fence.test.ts` holds that as an equality per package). So
 * the row's handle is a GRAMMAR rather than a name — `{@link PLUGIN_PREF}`
 * followed by whatever the server said — and a scenario finds the rows with the
 * prefix and reads the names off the DOM, which is the only way to assert on a
 * set it is not allowed to enumerate.
 *
 * The prefix is what keeps the rest of the `data-pref` vocabulary a closed set:
 * a plugin called `done` gets `plugin-done` and cannot be mistaken for the Done
 * row.
 */
export const PLUGIN_PREF = "plugin-"

/** ... and one row's, spelled. */
export const pluginPref = (name: string): string => `${PLUGIN_PREF}${name}`
