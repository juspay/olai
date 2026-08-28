/**
 * The evidence pass: drive the real app in a real browser, one gesture at a
 * time, and put a screenshot beside each. Not part of the suite — the promises
 * live in the features (`dragdrop_multiselect`, `edge_editing`, `new_outline`);
 * this is what a person looks at.
 *
 * ONE SECTION PER RUN, against a directory the driver has just re-copied and a
 * server it has just started (`evidence.sh`). Restoring the fixture underneath
 * a running server is not the same thing: the store holds the snapshot it last
 * wrote, and a file put back with the same length is a change its watcher is
 * entitled not to notice — so a gesture made after one would be a gesture over
 * a frame nobody can reproduce.
 */
import { fileKind, shiftDay } from "@olai/format"
import { chunkUrl } from "@olai/surface"
import { isoDayOf, ROW_DIM } from "@olai/web/testlib"
import { mkdirSync, readdirSync, readFileSync, writeFileSync } from "node:fs"
import { dirname } from "node:path"
import { type Browser, chromium, type Locator, type Page } from "playwright"

import { BROWSER_ARGS } from "./support/browser.ts"

const BASE = process.env["BASE"] ?? "http://127.0.0.1:7788"
const OUT = process.env["SHOTS"] ?? "."
const SECTION = process.env["SECTION"] ?? ""
/** The COPY `evidence.sh` made and is serving — where a section reads a record
 *  back off the disk, and where the one section that provokes a refusal writes
 *  one. Absent when this file is run by hand against a server somebody else
 *  started, which the two helpers below answer for in their own ways. */
const VAULT = process.env["VAULT"]
/** A real Chrome to drive instead of Playwright's own — see {@link main}. */
const CHROME = process.env["CHROME"]
/** Open a real WINDOW rather than a headless one, for a run somebody is
 *  capturing off a display — see {@link main}. */
const HEADED = process.env["HEADED"] === "1"

let shots = 0
/**
 * A shot, numbered in the order the section takes them — and the two ways a
 * section asks for less or more of the page than the window gives it.
 *
 * `clip` is a WINDOW onto the shot rather than a second kind of shot: some
 * affordances are two pixels tall (the drop line), and a whole-page frame of
 * one is a frame of the page. The section that asks for it takes the wide one
 * as well, so the close-up is read beside what it is a close-up OF.
 *
 * `full` is the other direction, for the one section whose subject is taller
 * than a screen on purpose — the agenda's line of time, which is about how far
 * away the far end of it feels.
 */
const shot = async (
  page: Page,
  name: string,
  within?: { clip?: { x: number; y: number; width: number; height: number }; full?: boolean },
) => {
  shots += 1
  await page.screenshot({
    path: `${OUT}/${SECTION}-${shots}-${name}.png`,
    ...(within?.clip ? { clip: within.clip } : {}),
    ...(within?.full === true ? { fullPage: true } : {}),
  })
}

/** The caret, and the two lines a write leaves under it. Named rather than
 *  spelled per section, which is this file's rule for every other row it
 *  drives (`MOVE_PICKER`, `FILTER_REFUSAL`, `SEARCH_REFUSAL`). */
const TITLE_EDITOR = '[data-testid="title-editor"]'
const EDIT_REFUSAL = '[data-testid="edit-refusal"]'
const EDIT_NUDGE = '[data-testid="edit-nudge"]'

const row = (id: string) => `[data-node-id="${id}"]`
const handle = (id: string) => `${row(id)} [data-testid="drag-handle"] >> nth=0`
const title = (id: string) => `${row(id)} [data-testid="node-title"] >> nth=0`
/** The GLYPH in a row's gutter — where a mark is SAID, and the one place the
 *  two settling marks are told apart (a check against a cross).
 *
 *  Aimed at `data-face` rather than at a test id, because there are TWO of them
 *  on this control and which one a row wears is the very thing a section about
 *  blockedness is photographing: a row that can start carries the checkbox, and
 *  a row that cannot carries the blocked hourglass instead (`Glyph.tsx` — the
 *  hourglass REPLACES the box). One reading answers for both, so a section can
 *  print what a row is drawn as without first knowing the answer. */
const glyphAt = (id: string) => `${row(id)} [data-face] >> nth=0`

/** The same two, with a COLUMN named — the selectors above with one prefix. A
 *  node id is unique in a set and not on a screen: two panes showing one file
 *  draw every row of it twice, so a section about dragging between them has to
 *  say which one it means. */
const paneAt = (index: number) => `[data-testid="pane"][data-pane="${index}"]`
const handleIn = (index: number, id: string) => `${paneAt(index)} ${handle(id)}`
const titleIn = (index: number, id: string) => `${paneAt(index)} ${title(id)}`

/** The face a pane wears while a row is held over it that cannot land there —
 *  the drag's other answer, and never drawn beside the line. */
const DROP_REFUSED = '[data-testid="drop-refused"]'
/** What a bulk gesture — a key over a pick, or a drop — had to say afterwards. */
const SELECTION_SAID = '[data-testid="selection-said"]'

/** Open a split, and wait until both columns have drawn their tree. Waiting on
 *  the COUNT rather than on the first one is the whole of it: a section that
 *  photographed one pane while the other was still empty would be a section
 *  about the boot. */
const splitOn = async (page: Page, address: string): Promise<void> => {
  await page.goto(`${BASE}${address}`)
  await page.locator(OUTLINE_TREE).nth(1).waitFor()
  await page.waitForTimeout(600)
}

const order = async (page: Page) =>
  (await page.locator('[data-testid="node"]').evaluateAll((rows) =>
    rows.map((one) => one.getAttribute("data-node-id"))
  )).join(" ")

const parentOf = async (page: Page, id: string) =>
  await page.locator(row(id)).first().evaluate((el) =>
    el.parentElement?.closest("[data-node-id]")?.getAttribute("data-node-id") ?? "(top)"
  )

/** The box of something on screen, or a throw naming that it is not laid out. */
const boxOf = async (locator: Locator) => {
  const box = await locator.boundingBox()
  if (box === null) throw new Error("nothing to aim at")
  return box
}

/** Press the bullet and travel to a point, without letting go. */
const carry = async (page: Page, from: string, x: number, y: number) => {
  const box = await boxOf(page.locator(from))
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2)
  await page.mouse.down()
  await page.mouse.move(x, y, { steps: 12 })
  await page.waitForTimeout(150)
}

const promised = async (page: Page) => {
  const line = page.locator('[data-testid="drop-line"]')
  return `parent=${await line.getAttribute("data-parent") || "(top)"} after=${
    await line.getAttribute("data-after") || "(first)"
  } depth=${await line.getAttribute("data-depth")}`
}

const SELECTION_BAR = '[data-testid="selection-bar"]'
const picked = async (page: Page) =>
  await page.locator(SELECTION_BAR).getAttribute("data-rows")

/** The band a drag-across pulls, and how many rows it says it is crossing —
 *  the half of that gesture that is still a prediction while the pointer is
 *  down, exactly as the drop line is for a drag. */
const SWEEP_BAND = '[data-testid="sweep-band"]'
const band = async (page: Page) =>
  await page.locator(SWEEP_BAND).first().getAttribute("data-rows")

/** How much page there is to scroll, and how much window there is to see it in
 *  — printed rather than assumed, because a section about the page KEEPING UP
 *  proves nothing over a page that fits. */
const room = async (page: Page) =>
  await page.evaluate(() =>
    `${document.documentElement.scrollHeight}px of page in a ${window.innerHeight}px window`
  )

/** The empty strip beside a row — its enclosing list's own padding, which is
 *  scaffolding and holds no words, so a press there is a sweep rather than a
 *  text selection. Measured rather than named: it is not a control and has no
 *  testid, and what makes it pressable is that nothing else is there. */
const rail = async (page: Page, id: string) =>
  await page.locator(row(id)).first().evaluate((one) => {
    const list = one.parentElement?.closest("ul")
    const line = one.querySelector("[data-row-key]")
    if (!list || !line) throw new Error("no rail beside that row")
    const box = list.getBoundingClientRect()
    const on = line.getBoundingClientRect()
    return { x: box.x + 4, y: on.y + on.height / 2 }
  })

const pick = async (page: Page, first: string, last?: string) => {
  await page.locator(title(first)).click({ modifiers: ["Control"] })
  if (last !== undefined) await page.locator(title(last)).click({ modifiers: ["Shift"] })
  await page.waitForTimeout(300)
}

/**
 * A window shorter than the outline, so there is something to scroll.
 *
 * No corpus here is taller than a screen on its own — they are outlines a
 * person can read inside a scenario — so the WINDOW is what shrinks, which is a
 * real shape too (a short laptop, a handset with its keyboard up). The browser
 * tests make their room the same way and assert it (`support/world.ts`'s
 * `shrinkToScroll`).
 */
const short = async (page: Page, width: number, height: number): Promise<void> => {
  await page.setViewportSize({ width, height })
  await page.waitForTimeout(400)
}

/**
 * Hold the pointer at the bottom of the window, the way a hand does: it arrives
 * there and then keeps moving a little, because a hand at the edge of a screen
 * is a hand pushing rather than a hand parked.
 *
 * The nudges are not decoration. A gesture that has run out of screen keeps
 * reporting on its own (`client/autoscroll.ts` re-reads the pointer against a
 * page that has moved), but a headless browser's frame clock is not a hand's,
 * and a section that stood perfectly still for a fixed number of milliseconds
 * would be a section about the harness's timing.
 */
const atTheEdge = async (page: Page, x: number): Promise<void> => {
  const view = page.viewportSize()
  if (view === null) throw new Error("this page has no viewport size")
  await page.mouse.move(x, view.height - 8, { steps: 10 })
  for (let nudge = 0; nudge < 8; nudge++) {
    await page.waitForTimeout(120)
    await page.mouse.move(x + (nudge % 2), view.height - 8)
  }
  await page.waitForTimeout(200)
}

const SETTLE = 1800

/** How wide every section is photographed — the one number both the default
 *  window and {@link PANEL_FITS} are built from. */
const WIDE = 1100

// ── the chat panel, for the sections that talk to an agent ─────────────

/** The panel's own rows and controls, by the test ids the client draws them
 *  with. Spelled here rather than imported from `support/world.ts`: that module
 *  is the SUITE's world (it imports cucumber and a browser it did not open),
 *  and a driver reaching into it would drag the runner into a script that has
 *  no runner. The same reason `reads.ts` builds its own session rather than a
 *  scenario's. Shared by every chat section in this file. */
const CHAT_TOGGLE = '[data-testid="chat-toggle"]'
const CHAT_PANEL = '[data-testid="chat-panel"]'
const CHAT_INPUT = '[data-testid="chat-input"]'
const CHAT_SEND = '[data-testid="chat-send"]'
const CHAT_ARMED = '[data-testid="chat-armed"]'
const CHAT_ARMED_ENDED = '[data-testid="chat-armed-ended"]'
const CHAT_ARMED_STILL = '[data-testid="chat-armed-still"]'
const CHAT_TRANSCRIPT = '[data-testid="chat-transcript"]'
const TESTID_WATCHING = "chat-watching"
const CHAT_WATCHING = `[data-testid="${TESTID_WATCHING}"]`
const CHAT_TOOL_ELAPSED = '[data-testid="chat-tool-elapsed"]'
const CHAT_TOOL_PROGRESS = '[data-testid="chat-tool-progress"]'

/** Say something to the agent — the driver's half of the suite's own step. */
const ask = async (page: Page, text: string): Promise<void> => {
  const box = page.locator(CHAT_INPUT)
  await box.waitFor()
  await box.fill(text)
  await page.locator(CHAT_SEND).click()
}

// ── the edge panel, and what a record says afterwards ──────────────────

const EDGE_PANEL = '[data-testid="edge-panel"]'
const EDGE_SEARCH = '[data-testid="edge-search"]'
const EDGE_HIT = '[data-testid="edge-hit"]'
const EDGE_DROP = '[data-testid="edge-drop"]'
const EDGE_SAID = '[data-testid="edge-said"]'
const EDGE_VERB = '[data-testid="edge-verb"]'

/** What has the caret, by the name this suite names controls with — `"nothing"`
 *  for the body, which is where a control that is REPLACED sends the focus it
 *  was holding. The steps read it the same way (`support/caret.ts`). */
const focused = (page: Page): Promise<string> =>
  page.evaluate(() => {
    const element = document.activeElement
    if (element === null || element === document.body) return "nothing"
    return element.getAttribute("data-testid") ?? element.tagName.toLowerCase()
  })

/** The `•••` of a row, revealed and pressed — the gutter is `opacity-0` until
 *  the row is hovered, which a screenshot has to go through like anybody. */
const openMenu = async (page: Page, id: string) => {
  await page.locator(row(id)).first().hover()
  await page.locator(`${row(id)} [data-testid="node-menu"] >> nth=0`).click({ force: true })
  await page.locator('[data-testid="node-menu-panel"]').first().waitFor()
  await page.waitForTimeout(200)
}

// ── the move-to picker ────────────────────────────────────────────────

const MOVE_PICKER = '[data-testid="move-picker"]'
const MOVE_SEARCH = '[data-testid="move-search"]'
const MOVE_HIT = '[data-testid="move-hit"]'
/** WHY the destination under the cursor cannot take the row — drawn at the
 *  aim, which is what makes it photographable at all: a refusal that only
 *  appeared after `Enter` would be a picture of an answer nobody was still
 *  deciding with. */
const MOVE_REFUSED = '[data-testid="move-refused"]'

/** The picker, opened the way the item is about: the caret in a row, then the
 *  chord. The `•••`'s `Move to…` opens the identical panel and is a scenario
 *  rather than a shot. */
const pickerOn = async (page: Page, id: string) => {
  await page.locator(title(id)).first().click()
  await page.locator(TITLE_EDITOR).first().waitFor()
  await page.keyboard.press("ControlOrMeta+Shift+m")
  await page.locator(MOVE_PICKER).first().waitFor()
}

// ── the row editor's completions ───────────────────────────────────────

const COMPLETIONS = '[data-testid="completions"]'
const COMPLETION_ITEM = '[data-testid="completion-item"]'

/** The shortlist as a reader sees it, top to bottom — the LABELS alone, which
 *  for a tag is the name as it will be written. `innerText` and its first line,
 *  which is the same reading `step_definitions/completion_steps.ts` takes of
 *  the same row: the count beside a label is laid out inline and is a separate
 *  question ({@link rowSaying}). */
const labels = async (page: Page): Promise<string> =>
  (await page.locator(COMPLETION_ITEM).evaluateAll((rows) =>
    rows.map((one) => (one as HTMLElement).innerText.split("\n")[0]?.trim() ?? "")
  )).join(", ") || "(nothing)"

/** ...and ONE ROW WHOLE, label and the count beside it, which is what a reader
 *  of the shot sees on that line. Named for what it answers rather than for the
 *  half of it a caller happens to be about to quote. */
const rowSaying = async (page: Page, label: string): Promise<string> =>
  oneLine(
    await page.locator(COMPLETION_ITEM).filter({ hasText: label }).first().innerText(),
  )

/** One line out of however many the markup wrapped it over — what a console
 *  line can hold, spelled once for every reader here that prints something the
 *  page drew. */
const oneLine = (said: string): string => said.replace(/\s+/g, " ").trim()

const textOf = async (page: Page, locator: string) =>
  oneLine(await page.locator(locator).first().innerText())

/** WHICH MOOD a said-line claims to be in, off the markup rather than off its
 *  colour — `data-tone` is the fact `web/src/client/SaidLine.tsx` puts there
 *  precisely so a reader (a person, a scenario) can ask without asking about a
 *  class name. Printed beside the sentence in the sections below, because their
 *  whole subject is which component drew the row.
 *
 *  Through {@link attrOf}, with the three other facts those sections print, so
 *  "absent" has one spelling and a fifth fact is a call rather than a fourth
 *  clone of this function. */
const attrOf = async (page: Page, locator: string, attribute: string) =>
  (await page.locator(locator).first().getAttribute(attribute)) ?? "(none)"

const toneOf = async (page: Page, locator: string) => await attrOf(page, locator, "data-tone")

/** WHETHER A TITLE IS STRUCK THROUGH, off the computed style rather than off a
 *  class name — the one reading in this file that does, and it earns the
 *  exception for the reason the fourth-mark section is about: the strike is not
 *  a styling decision made downstream of a promise, it IS the promise (the
 *  human asked for a struck-through row, 2026-08-25). A class name would print
 *  the same word on a page where a later rule had turned the decoration off. */
const decorationOf = async (page: Page, locator: string) =>
  await page.locator(locator).first().evaluate((node) =>
    getComputedStyle(node).textDecorationLine
  )

/** WHICH refusal it is — the ops layer's own failure tag, carried by the
 *  sentences that were minted while the failure was still in hand. */
const kindOf = async (page: Page, locator: string) => await attrOf(page, locator, "data-kind")

/** HOW a said-line reaches a screen reader — the `role`/`aria-live` pair, read
 *  as one string because they are one decision. The only part of a said-line a
 *  screenshot cannot carry at all: two lines with the same words, one of which
 *  interrupts whatever was being read. */
const mannerOf = async (page: Page, locator: string) =>
  `role=${await attrOf(page, locator, "role")} ` +
  `aria-live=${await attrOf(page, locator, "aria-live")}`

/** The `•••` menu's archive verb, and the confirm it raises — ONE spelling,
 *  because the confirm answers with the same words on the same panel, and a
 *  section that photographs the question in between still presses this. */
const TRASH_VERB = '[data-testid="node-menu-panel"] >> text=Move to Trash'

/** The other write a `•••` menu offers about the LINE rather than about what
 *  it draws, and the one a mirror row is offered instead of the archive above
 *  (`client/menu/verbs.ts`). Spelled beside it because the pair is the claim:
 *  a placement is retired, a node is put away, and no row is offered both. */
const PLACEMENT_VERB = '[data-testid="node-menu-panel"] >> text=Remove this placement'

/** What the panel SAYS afterwards, in its two moods, and the question the one
 *  verb with a blast radius asks first — named here for the reason every other
 *  selector in this file is: a testid renamed in the client is one line to
 *  follow rather than six spellings to grep. */
const MENU_SAID = '[data-testid="node-menu-said"]'
const MENU_CONFIRM = '[data-testid="node-menu-confirm"]'

/** The `•••` menu's own COPY verb, beside the two above for their reason: the
 *  three writes a row offers about its whole subtree are one family, and a
 *  label renamed in the client is one line to follow here. */
const DUPLICATE_VERB = '[data-testid="node-menu-panel"] >> text=Duplicate'

// ── a filtered row, saying why it is drawn ─────────────────────────────

/** A stretch of a title — or of the note line under one — the query landed on
 *  (`client/filter/lit.ts`). */
const HIT = '[data-testid="hit"]'
/** The one clamped line of a note a filter found the row BY. */
const DESC_HIT = '[data-testid="desc-hit"]'

/** Which rows this page drew and what each of them SAYS about why it is there
 *  — printed, because the three cases are one `data-` fact and two pieces of
 *  markup, and a screenshot cannot be grepped. */
const whyDrawn = async (page: Page) =>
  (await page.locator('[data-testid="node"]').evaluateAll((rows, dimClass) =>
    rows.map((one) => {
      const id = one.getAttribute("data-node-id")
      const match = one.getAttribute("data-match")
      const line = one.querySelector("[data-row-key]")
      const own = (selector: string) => {
        const found = one.querySelector(selector)
        // A row's OWN, never a descendant's: rows nest, and the title is
        // rendered before the children.
        return found !== null && found.closest("[data-node-id]") === one
          ? (found.textContent ?? "")
          : ""
      }
      // The DIM is one utility with two reasons — a row that is only the
      // ancestry leading to a match, and a row that cannot be started yet
      // (`client/filter/why.ts`, `client/blocked.ts`) — so both are named,
      // or a blocked match would read here as a row this feature dimmed.
      const dim = line !== null && line.className.includes(dimClass)
      const waiting = one.getAttribute("data-blocked") !== null
      const lit = own('[data-testid="node-title"] [data-testid="hit"]')
      const note = own('[data-testid="desc-hit"]').replace(/\s+/g, " ").trim()
      return `${id}: ${match === "true" ? "match" : "context"}` +
        `${dim ? (waiting && match === "true" ? " (dim: waiting)" : " (dim)") : ""}` +
        `${lit === "" ? "" : ` lights “${lit}”`}` +
        `${note === "" ? "" : ` · note: ${note}`}`
    }), ROW_DIM)).join("\n              ")

/** The same page in the other half of the palette table. A theme is a PICK
 *  this browser keeps (`client/theme/state.ts`), so it is written where the
 *  page keeps it and the tab is reloaded — which is also the honest way to
 *  photograph it, since the boot script is what paints the first frame. */
const inTheDark = async (page: Page) => {
  await page.evaluate(() => localStorage.setItem("olai.theme", "aurora"))
  await page.reload()
  await page.locator(OUTLINE_TREE).first().waitFor()
  await page.waitForTimeout(DRAWN)
}

/** Every record of one outline, off the disk the driver is serving. */
const recordsIn = (file: string): ReadonlyArray<Record<string, unknown>> => {
  if (VAULT === undefined) throw new Error("no VAULT; run through evidence.sh")
  return readFileSync(`${VAULT}/${file}`, "utf8")
    .split("\n")
    .filter((line) => line.trim() !== "")
    .map((line) => JSON.parse(line) as Record<string, unknown>)
}

/** Every id one outline holds right now — what a section takes BEFORE a write
 *  so it can name what that write MADE afterwards. */
const idsIn = (file: string): ReadonlySet<string> =>
  new Set(recordsIn(file).map((record) => String(record["id"])))

// ── the run of chips under a title ────────────────────────────────────

/** One chip of one row's run, by KEY — never by position, so a line printed
 *  beside a shot says which fact it is about. */
const chip = (id: string, key: string) =>
  `${row(id)} [data-testid="prop"][data-key="${key}"]`

/** THE WHOLE RUN, as one line: `key value` per chip, in the order it is drawn.
 *  What a screenshot of a row says in text, so the order — which is the file's
 *  own and never alphabetical — is printed rather than left to the eye. */
const runOf = async (page: Page, id: string) =>
  (await page.locator(`${row(id)} [data-testid="prop"]`).evaluateAll((chips) =>
    // The key and the value are read as two ELEMENTS rather than as the chip's
    // text, because a chip's `textContent` runs them together — `agent` and
    // `claude-opus` are two boxes with no whitespace between them, and the line
    // this prints is meant to be read. Done in the browser because that is
    // where the elements are; the tidy-up is done outside it, because
    // `evaluateAll`'s callback is serialised into the page and nothing this
    // module declares exists there.
    chips.map((one) => [
      one.querySelector('[data-testid="prop-key"]')?.textContent ??
        one.firstElementChild?.textContent ?? "",
      one.querySelector('[data-testid="prop-value"]')?.textContent ?? "",
    ])
  )).map(([key, value]) => `${oneLine(key ?? "")} ${oneLine(value ?? "")}`).join(" · ") ||
  "(nothing)"

/** WHAT A VALUE TURNED OUT TO NAME, and where it goes — `data-door` and the
 *  href under it, or the sentence for the value that names nothing.
 *
 *  Printed rather than photographed, because the claim this feature rests on is
 *  a NEGATIVE: `claude-opus` is not a link, a sentence is not a link, and a
 *  value with a URL inside it is not a URL. A picture of text that is not
 *  underlined proves less than the absence stated. */
const doorOn = async (page: Page, id: string, key: string) => {
  const value = page.locator(`${chip(id, key)} [data-testid="prop-value"]`).first()
  const said = oneLine(await value.innerText())
  const door = value.locator("[data-door]").first()
  if (await door.count() === 0) return `${JSON.stringify(said)} — no door, drawn as text`
  const kind = await door.getAttribute("data-door")
  const link = door.locator("a").first()
  const target = await link.getAttribute("target")
  return `${JSON.stringify(said)} — ${kind} door to ${await link.getAttribute("href")}${
    target === null ? "" : ` (target=${target}, rel=${await link.getAttribute("rel")})`
  }`
}

/** One node's `custom` map, off the disk the driver is serving — the other half
 *  of every write this section makes, since a run that changed and a file that
 *  did not would be an echo rather than a write. */
const customOn = (file: string, id: string): Record<string, unknown> => {
  const found = recordsIn(file).find((record) => record["id"] === id)
  if (found === undefined) throw new Error(`${file} holds no node called ${id}`)
  return (found["custom"] ?? {}) as Record<string, unknown>
}

/**
 * The ROOT of the copy a duplicate just made, found the way the op's own
 * promise says to find it: the record this write brought into being that sits
 * among the ORIGINAL's siblings.
 *
 * Its id is MINTED by the write, so nothing here may spell one — which is also
 * the fact the shots are about. What the driver has instead is the set of ids
 * that existed a moment ago, which is exact where a title match is a guess: the
 * two branches say the same thing after a duplicate, so a section that found
 * the copy by its title would go on finding SOMETHING after a write that made
 * the wrong thing, or nothing at all. A throw when there is not exactly one is
 * the guard {@link shotSays} is: a section that photographed the wrong row
 * would be a picture that lies.
 */
const copyRootOf = (
  file: string,
  before: ReadonlySet<string>,
  id: string,
): Record<string, unknown> => {
  const records = recordsIn(file)
  const original = records.find((record) => record["id"] === id)
  if (original === undefined) throw new Error(`no record \`${id}\` in ${file}`)
  const made = records.filter((record) =>
    !before.has(String(record["id"])) && record["parent"] === original["parent"]
  )
  if (made.length !== 1) {
    throw new Error(
      `${made.length} records were made beside \`${id}\`, and a copy is one`,
    )
  }
  return made[0] as Record<string, unknown>
}

/**
 * WHERE THE PROMISE LIVES, printed at the top of a section's transcript.
 *
 * A reader of the screenshots alone sees pictures rather than proofs — the
 * point a reviewer of #234 made, and it is the file's opening line read from
 * the other end: the promises live in the features, so a section should say
 * WHICH ones rather than leave somebody to grep for them.
 *
 * AND THE CITATION IS CHECKED, which is the difference between this and a
 * comment: a scenario renamed in the suite makes the section that cites it
 * throw, naming what it could not find, rather than going on printing a
 * pointer at nothing. Read off `import.meta.dir` rather than the working
 * directory — `evidence.sh` runs from this package, and a driver that quietly
 * found no feature file would be back to citing whatever it liked.
 *
 * Only the sections that have been through this door carry one. The older ones
 * predate it and are not retrofitted with pins nobody checked.
 */
const pinnedBy = (feature: string, ...scenarios: ReadonlyArray<string>): void => {
  const text = readFileSync(`${import.meta.dir}/features/${feature}`, "utf8")
  console.log(`  pinned by: ${feature}`)
  for (const one of scenarios) {
    if (!text.includes(`Scenario: ${one}`)) {
      throw new Error(`${feature} holds no scenario called “${one}” — the pin has gone stale`)
    }
    console.log(`             “${one}”`)
  }
}

/** Every entry an open panel is offering, in the order it offers them — what a
 *  shot of a menu says in a line, so a section can print the pair above being
 *  exclusive rather than ask a reader to compare two images. */
const verbsOf = async (page: Page) =>
  (await page.locator('[data-testid="node-menu-item"]').allInnerTexts())
    .map(oneLine).join(" · ")

/**
 * Move a row and everything under it to the Trash, through that menu and that
 * confirm — the gesture a person makes, twice over, because the second press
 * answers the question the first one raises.
 *
 * Beside {@link openMenu} rather than inside a section: two sections need
 * something in the archive before they can photograph anything, and a verb
 * renamed in one copy would leave the other clicking nothing.
 */
const putAway = async (page: Page, id: string) => {
  await openMenu(page, id)
  await page.locator(TRASH_VERB).first().click()
  await page.locator(TRASH_VERB).first().click()
  await page.waitForTimeout(SETTLE)
}

/** The `•••` verb that opens the repeat picker, and the picker's three parts.
 *  NAMED for {@link putAway}'s reason: two sections drive them, and a test id
 *  or a verb renamed in one copy would leave the other clicking nothing. */
const REPEAT_VERB = '[data-testid="node-menu-panel"] >> text=Set repeat…'
const REPEAT_PICKER = '[data-testid="repeat-picker"]'
const REPEAT_RULE = '[data-testid="repeat-picker-rule"]'
const REPEAT_SET = '[data-testid="repeat-picker-set"]'

/** Put a repeat rule on a row, through the menu and the picker — for the
 *  section whose subject is what a rule makes possible AFTERWARDS. The section
 *  about the picker ITSELF drives the same four locators one at a time,
 *  because what it photographs is what sits between them. */
const repeatsEvery = async (page: Page, id: string, rule: string) => {
  await openMenu(page, id)
  await page.locator(REPEAT_VERB).first().click()
  await page.locator(REPEAT_PICKER).first().waitFor()
  await page.locator(REPEAT_RULE).first().selectOption(rule)
  await page.locator(REPEAT_SET).first().click()
  await page.waitForTimeout(SETTLE)
}

/** How long a freshly opened page is given to draw before it is read or
 *  photographed — a render and a subscription's first frame, not a write
 *  ({@link SETTLE} is that one). */
const DRAWN = 400

/** A page, opened cold and left to settle — the trio every section starts a
 *  leg with, so the wait that makes a screenshot reproducible has one name and
 *  one value rather than a bare number per call. */
const opened = async (page: Page, path: string, marker: string) => {
  await page.goto(`${BASE}${path}`)
  await page.locator(marker).first().waitFor()
  await page.waitForTimeout(DRAWN)
}

/** What a served outline holds NOW, line by line — {@link rewrite}'s read half,
 *  for the section that adds a record rather than replacing a file, and with
 *  the same refusal: without a `VAULT` the path would be the string
 *  `undefined/…`, and an ENOENT naming that is a worse thing to debug than the
 *  sentence. */
const servedLines = (file: string): ReadonlyArray<string> => {
  if (VAULT === undefined) throw new Error("no VAULT; run through evidence.sh")
  return readFileSync(`${VAULT}/${file}`, "utf8").split("\n").filter((line) => line !== "")
}

/**
 * What the FILE says about one node — the record, off the disk the driver is
 * serving, because that is the whole claim a pointer's gesture makes here.
 *
 * `VAULT` is `evidence.sh`'s copy; without one this prints why rather than a
 * guess, since a shot beside an invented line is worse than a shot alone.
 */
const findRecord = (id: string): { file: string; line: string } | undefined => {
  if (VAULT === undefined) return undefined
  for (const file of readdirSync(VAULT)) {
    // Which files hold records is the format's answer, not a suffix retyped
    // here — the same arrangement `step_definitions/` has with `MARKS`, and for
    // the same reason: this package and `@olai/format` never otherwise meet, so
    // a disagreement between them is silent.
    if (fileKind(file) !== "outline") continue
    for (const line of servedLines(file)) {
      if (line.includes(`"id":"${id}"`)) return { file, line }
    }
  }
  return undefined
}

const recordOf = (id: string): string => {
  if (VAULT === undefined) return "(no VAULT; run through evidence.sh)"
  const found = findRecord(id)
  return found === undefined ? `(no record for \`${id}\`)` : `${found.file} — ${found.line}`
}

/**
 * WHERE THE NEXT SHOT SAYS THIS RECORD IS — checked against the disk, and a
 * throw when the disk disagrees. `undefined` is "in no outline at all", which
 * is what a retired placement is.
 *
 * NOT a promise. Promises live in the features (this file's opening line), and
 * a write that lands in the wrong place is `menu_verbs.feature`'s to fail on.
 * This is a guard on the PICTURE, in the same category as {@link boxOf}
 * refusing to aim at nothing: a gesture whose write silently did not land
 * draws a page that looks exactly like one where it did — the row is gone from
 * the tab either way — so a screenshot is the one lie this driver is able to
 * tell all by itself. Both reviewers of #234 arrived at that hole from
 * different directions; this is what closes it.
 *
 * Skipped without a `VAULT`, where the answer is unknown rather than false.
 */
const shotSays = (id: string, file: string | undefined): void => {
  if (VAULT === undefined) return
  const at = findRecord(id)?.file
  if (at === file) return
  throw new Error(
    `the shot about to be taken says \`${id}\` is ${
      file === undefined ? "in no outline" : `in ${file}`
    }, and the files say it is ${at === undefined ? "in none" : `in ${at}`}`,
  )
}

/**
 * ANOTHER HAND writing the directory while the page is open — the same gesture
 * `menu_verbs.feature` makes with its `I rewrite`, and the reason one section
 * needs it: the placement's fence is about the set as it IS, so the thing that
 * still names a line has to be written by somebody other than this tab.
 *
 * Throws without a `VAULT` rather than writing nothing, which is {@link
 * recordOf}'s rule read the other way: a shot of a gesture that never reached
 * a file is worse than no shot. And it ENDS THE FILE, exactly as the suite's
 * own `writeServed` does, rather than leaving that to whoever writes the next
 * section: a records file whose last line has no newline is a footgun this
 * helper can simply not have.
 */
const rewrite = (file: string, records: ReadonlyArray<string>): void => {
  if (VAULT === undefined) throw new Error("no VAULT; run through evidence.sh")
  // The directory it goes in may not exist yet — `_olai/` is minted by the app
  // and a section that writes a shelf outright is standing in for that write.
  mkdirSync(dirname(`${VAULT}/${file}`), { recursive: true })
  writeFileSync(`${VAULT}/${file}`, records.map((one) => `${one}\n`).join(""))
}


// ── the filter over the page ───────────────────────────────────────────

const FILTER_INPUT = '[data-testid="filter-input"]'
const FILTER_COUNT = '[data-testid="filter-count"]'
const FILTER_REFUSAL = '[data-testid="filter-refusal"]'

/**
 * A tree as a reader sees it: one line per row, indented by depth, with a `*`
 * on the rows the query actually SELECTED — the rest is the ancestry (or, in
 * the trash, the scaffold) that leads to one, which is the whole of what
 * "filter in place" means.
 *
 * ONE reader for both trees this file drives, because it is one question
 * wherever it is asked. What differs is which rows are the tree's and where a
 * row keeps its title, so both are arguments.
 */
const branching = async (page: Page, rows: string, title: string) =>
  (await page.locator(rows).evaluateAll((all, [rows, title]) =>
    all.map((one) => {
      let depth = 0
      for (let up = one.parentElement; up !== null; up = up.parentElement) {
        if (up.matches(rows)) depth += 1
      }
      const hit = one.getAttribute("data-match") === "true" ? "*" : " "
      const said = one.querySelector(title)?.textContent ?? ""
      return `${hit} ${"  ".repeat(depth)}${said.trim()}`
    }), [rows, title] as const)).join("\n")

/** The outline on screen. */
const drawn = async (page: Page) =>
  branching(
    page,
    '[data-testid="outline-tree"] [data-testid="node"]',
    '[data-testid="node-title"]',
  )

/** Type a query and let the tree settle. Filtering is local — no round trip and
 *  no debounce — so this is a render rather than a fetch. */
const narrow = async (page: Page, query: string) => {
  await page.locator(FILTER_INPUT).fill(query)
  await page.waitForTimeout(300)
}

const said = async (page: Page, locator: string) =>
  (await page.locator(locator).first().textContent().catch(() => null)) ?? "(nothing)"

// ── the conversation ───────────────────────────────────────────────────

/** Faces this section photographs that the panel block above does not:
 *  cancel, interrupt, the queued row, the composer's queue promise. */
const CHAT_CANCEL = '[data-testid="chat-cancel"]'
/** The other send: into the turn the agent is running. */
const CHAT_INTERRUPT = '[data-testid="chat-interrupt"]'
/** On a `user` row the agent has not started on. */
const CHAT_QUEUED = '[data-testid="chat-queued"]'
/** The composer's promise, while a turn runs, that a send waits its turn. */
const CHAT_QUEUES = '[data-testid="chat-queues"]'

/** How long a section waits on a LANGUAGE MODEL, where every other wait in
 *  this file is on a local frame. An essay is thirty seconds and a `/compact`
 *  was thirty-five on the day this was written; the number is a ceiling that
 *  fails a wedged run rather than a duration anything is timed against. */
const AGENT_PATIENCE = 180_000

/** Open the panel and wait until it has an agent to talk to.
 *
 *  It REFUSES an `off` panel by timing out here rather than further down: a
 *  section about what an agent does with a message has nothing to photograph
 *  against no agent, and the honest place to say so is the first wait.
 *  `AGENT=` on `evidence.sh` is what gives it one. Both chat sections need
 *  that wait — the background-task one included. */
const openChatForAgent = async (page: Page): Promise<void> => {
  if (!(await page.locator(CHAT_PANEL).isVisible())) {
    await page.locator(CHAT_TOGGLE).click()
    await page.locator(CHAT_PANEL).waitFor()
  }
  await chatIdle(page)
}

/** The panel is IDLE — no turn of ours in flight. Read off the state the panel
 *  publishes for exactly this (`data-status`), which is the wire's own word
 *  rather than a guess made out of what is on screen. */
const chatIdle = (page: Page) =>
  page.locator(`${CHAT_PANEL}[data-status="idle"]`).waitFor({ timeout: AGENT_PATIENCE })

/** ... and it is WORKING, which is the window every one of these faces lives
 *  in: a message sent now is a message sent while the agent is busy. */
const chatWorking = (page: Page) =>
  page.locator(`${CHAT_PANEL}[data-status="thinking"]`).waitFor({ timeout: AGENT_PATIENCE })

/** Type and press the ordinary send — the gesture, not a call: what is being
 *  photographed is a person using the composer. */
const chatSend = async (page: Page, text: string): Promise<void> => {
  await page.locator(CHAT_INPUT).fill(text)
  await page.locator(CHAT_SEND).click()
}

/**
 * Put the newest rows in frame, and settle.
 *
 * The panel follows its own newest line, but every claim this section makes is
 * about the LAST few rows of a transcript with several essays in it — and a
 * shot taken while a long paragraph is still growing catches the follow
 * mid-stride. Scrolling before the shutter is the driver saying what it is
 * photographing rather than hoping.
 */
const chatBottom = async (page: Page): Promise<void> => {
  await page.locator(CHAT_TRANSCRIPT).evaluate((pane) => {
    pane.scrollTop = pane.scrollHeight
  })
  await page.waitForTimeout(DRAWN)
}

/**
 * Wait until the AGENT has said these words. The one thing worth waiting on
 * where a model is involved — a turn's own end says nothing about what came of
 * it, and a queued message is proved by its ANSWER arriving.
 *
 * The agent's OWN rows and never the whole transcript, which is the difference
 * between a wait and a tautology: every one of these words was typed into the
 * composer a moment earlier, so a transcript-wide search matches the question
 * the instant it is asked and photographs a turn that has not started.
 */
const chatSaid = (page: Page, text: string) =>
  page.waitForFunction(
    (want: string) =>
      [...document.querySelectorAll('[data-testid="chat-said"]')].some((row) =>
        (row as HTMLElement).innerText.includes(want)
      ),
    text,
    { timeout: AGENT_PATIENCE },
  )

// ── the same filter over the pages that are a query already ────────────

const OUTLINE_TREE = '[data-testid="outline-tree"]'
/** A zoomed node's heading — what a `/#<id>` page is waited on by. */
const ZOOM_TITLE = '[data-testid="zoom-title"]'
/** What refers to that node, read backwards: the `<details>`, its summary, and
 *  the two rows inside it (`client/backlinks/`). */
const BACKLINKS = '[data-testid="backlinks"]'
const BACKLINKS_SUMMARY = '[data-testid="backlinks-summary"]'
const BACKLINK_SEE_REFS = '[data-testid="backlink-see-refs"]'
const BACKLINK_MENTION_REFS = '[data-testid="backlink-mention-refs"]'
const DAY_PAGE = '[data-testid="day-page"]'
const AGENDA_PAGE = '[data-testid="agenda-page"]'
const TRASH_PAGE = '[data-testid="trash-page"]'
/** The Trash page's OWN verb, its question, and the way out of it — the app's
 *  only delete, and the one control here that is not about a row. */
const EMPTY_TRASH_VERB = '[data-testid="trash-empty-verb"]'
const EMPTY_TRASH_CONFIRM = '[data-testid="trash-empty-confirm"]'
const EMPTY_TRASH_CANCEL = '[data-testid="trash-empty-cancel"]'
/** What the page says in the rows' place once there is nothing left. */
const TRASH_EMPTY_LINE = '[data-testid="trash-empty"]'

/** The ⌘K box, and the rows of it that are NODES — a shell item that happens to
 *  share a word is not an answer to a query, which is what `data-id` tells
 *  apart (the browser tests read the same pair). */
const PALETTE_INPUT = '[data-testid="palette-input"]'
/** A row's id is its printed ADDRESS behind `hit-` (`palette/items.ts`), and a
 *  record's address is a bare fragment — so `hit-#` is what tells a node hit
 *  from a document row and from a shell item that shares a word, exactly as
 *  the browser tests grip it. It read `node-` until 2026-08-20, which is a
 *  prefix nothing has ever carried: the one section using it printed
 *  "(nothing)" where its hits should have been. */
const PALETTE_HIT = '[data-testid="palette-item"][data-id^="hit-#"]'
/** The header box itself — the other door, and the one surface here that was
 *  spelled as a literal at each of its three call sites while every other one
 *  in this file is a named const. */
const HEADER_SEARCH = '[data-testid="header-search"]'
/** What a shortlist says it drew of what it found — the same line on both
 *  doors, absent when the answer fit (`web/src/client/search/count.ts`). */
const SEARCH_COUNT = '[data-testid="search-count"]'
/** WHY a door drew nothing: the operator the grammar could not read, in the
 *  grammar's own words. ONE testid at both doors because it is one sentence
 *  about one grammar (`web/src/client/refusals.tsx`); the bar's own row is
 *  {@link FILTER_REFUSAL}, which is a different slot on a different surface. */
const SEARCH_REFUSAL = '[data-testid="search-refusal"]'
/** WHAT THE RUN OF CHIPS SAID about a write — a refusal quoted verbatim, or a
 *  nudge that rode back on one that landed (`web/src/client/props/PropsDrawer.tsx`).
 *  Named here because the typed-properties section's whole subject is that this
 *  line carries the ops layer's own sentence rather than a silent revert. */
const PROP_SAID = '[data-testid="prop-said"]'
/** …and the rows of it that are DOCUMENTS, told apart the same way: a served
 *  file's row carries its whole path in `data-id`, so a shot can print WHICH
 *  file it matched rather than the name a folder may repeat. The header's box
 *  draws the identical row (`web/src/client/search/row.ts`), which is
 *  why the pair is spelled here together. */
const PALETTE_DOC = '[data-testid="palette-item"][data-id^="doc-"]'
const HEADER_DOC = '[data-testid="header-search-item"][data-id^="doc-"]'
/** One SEARCH HIT row of the header box, by the address it stands for — the
 *  `hit-<address>` id `palette/items.ts` mints, which for a document is its
 *  path. Distinct from {@link HEADER_DOC}, which is the palette's own file-row
 *  family (`doc-<path>`): the header box answers with hits and nothing else. */
const headerHit = (at: string) =>
  `[data-testid="header-search-item"][data-id="hit-${at}"]`
const DOCUMENT_PAGE = '[data-testid="document-page"]'
const DOCUMENT_BODY = '[data-testid="document-body"]'
/** One line of a document's contents — the survey the frontmatter section
 *  reads to say whether a phantom heading reached it. */
const TOC_LINK = '[data-testid="toc-link"]'

/** The rows of a day or of the agenda, under the file each was found in — flat
 *  rows that carry their own ancestry, which is why a filtered one keeps
 *  nothing as context. */
const listed = async (page: Page, within: string) =>
  (await page.locator(`${within} [data-testid="day-group"]`).evaluateAll((groups) =>
    groups.flatMap((group) => [
      `  ${group.getAttribute("data-file")}`,
      ...[...group.querySelectorAll('[data-testid="node"]')].map((one) =>
        `    ${one.querySelector('[data-testid="node-title"]')?.textContent?.trim() ?? ""}`
      ),
    ])
  )).join("\n") || "  (nothing)"

/** What the directory column says is owed — the sentence the entry announces,
 *  read off the mark rather than off the page, because the whole claim is that
 *  the two are answering different questions. */
const owed = async (page: Page) =>
  (await page.locator('[data-testid="agenda-link"]').first().getAttribute("title")) ??
    "(nothing owed)"

/** The pile in the trash: the same reading, over the rows a pile is made of
 *  and the title each of them draws. */
const piled = async (page: Page) =>
  (await branching(
    page,
    `${TRASH_PAGE} [data-testid="trash-row"]`,
    '[data-testid="node-title"]',
  )) || "  (nothing)"

/** The day the run started — read ONCE, so every date in a section is counted
 *  from the same day even if the run crosses midnight. The client's own reading
 *  of the local day, like the browser tests', rather than a second one. */
const TAKEN = isoDayOf(new Date())

/** A day this many days from today, as the ISO text a record holds. The
 *  agenda's section writes its whole outline relative to the day it runs on:
 *  a spine drawn from fixed dates would say "seven years ago" in a shot meant
 *  to show what next month looks like. */
const away = (days: number): string => shiftDay(TAKEN, days)

/** The preferences panel, and a theme picked in it — the only way a palette is
 *  chosen in this app (`theme/Chips.tsx`). Left OPEN by `pick`, exactly as the
 *  browser tests leave it, so this closes it before the shot. */
const wearTheme = async (page: Page, theme: string): Promise<void> => {
  const panel = page.locator('[data-testid="prefs-panel"]')
  if (!(await panel.isVisible().catch(() => false))) {
    await page.locator('[data-testid="prefs-trigger"]').first().click()
    await panel.waitFor()
  }
  await page.locator(`[data-testid="theme-chip"][data-value="${theme}"]`).first().click()
  await page.waitForFunction(
    (name) => document.documentElement.dataset["theme"] === name,
    theme,
  )
  await page.keyboard.press("Escape")
  await page.waitForTimeout(250)
}

// ── the pinned shelf ──────────────────────────────────────────────────

/** The pinned shelf, and one row of it. */
const SHELF = '[data-testid="pin-shelf"]'
const PIN = '[data-testid="pin"]'

/** What the shelf says, row by row: where each door GOES (its stored address),
 *  the name it is drawing for that address RIGHT NOW — which for a node pin is
 *  the node's own title, read off the set on this frame — and the query it
 *  keeps, when it keeps one. */
const shelved = async (page: Page) =>
  (await page.locator(PIN).evaluateAll((rows) =>
    rows.map((one) => {
      const chip = one.querySelector('[data-testid="address-filter"]')
      const name = one.querySelector('[data-testid="address-name"]')?.textContent?.trim() ?? ""
      return `${one.getAttribute("data-at")} → “${name}”${
        chip === null ? "" : ` [${chip.textContent?.trim()}]`
      }`
    })
  )).join(" · ")

// ── the directory column's own rows ───────────────────────────────────

/** What a write the palette made had to say — the remark that NAMES the file a
 *  capture landed in, which is the only place the mint's path is visible to a
 *  reader (the browser tests read the same slot). */
const PALETTE_SAID = '[data-testid="palette-said"]'
/** The door onto the inbox, beside Agenda. Drawn only when the directory HAS
 *  an inbox, which is a claim a shot of a column makes by not having one in
 *  it. */
const INBOX_LINK = '[data-testid="inbox-link"]'
const INBOX_COUNT = '[data-testid="inbox-count"]'
const AGENDA_COUNT = '[data-testid="agenda-count"]'

/** The file tree as a reader sees it: every folder it drew and every file
 *  under them, by the path each stands for.
 *
 *  Printed beside the shots because the claim is an ABSENCE — `_olai/` is not
 *  drawn — and a picture of a column proves an absence only to somebody who
 *  knows what was supposed to be in it. This line says what the tree actually
 *  held on that frame. */
const treeRows = async (page: Page) =>
  (await page.locator(
    '[data-testid="file-dir"], [data-testid="outline-link"], ' +
      '[data-testid="document-link"], [data-testid="hypertext-link"]',
  ).evaluateAll((all) =>
    all.map((one) =>
      one.getAttribute("data-path") ?? one.getAttribute("data-file") ?? "?"
    )
  )).join(" · ") || "(nothing)"

/** Every row's title as the page DRAWS it — which for a row whose title is an
 *  address is the page it names, not the address. */
const titles = async (page: Page) =>
  (await page.locator('[data-testid="node-title"]').allInnerTexts())
    .map((one) => one.replace(/\s+/g, " ").trim())
    .filter((one) => one !== "")

/** One record of an outline on disk, rewritten — the write an agent's
 *  `set_title` makes, spelled as the file it produces, so what the shelf is
 *  following is a CHANGED DIRECTORY rather than a gesture in this tab. */
const retitle = (file: string, id: string, title: string): void =>
  rewrite(
    file,
    recordsIn(file).map((record) =>
      JSON.stringify(record["id"] === id ? { ...record, title } : record)
    ),
  )

const SECTIONS = {
  /**
   * THE FOURTH MARK, end to end: "not happening" as a stored fact.
   *
   * There were three marks, and "this is not happening" was said by taking one
   * OFF — which leaves a bullet, a line indistinguishable from one nobody ever
   * called work, with no instant and no day. `cancelled` is the mark that says
   * it and says when (the human, 2026-08-25), and it SETTLES: nobody is
   * waiting on a node carrying it.
   *
   * The claims, in the order the shots take them:
   *
   *   0. the outline as it stands, and the `•••` of an UNTOUCHED row offering
   *      `Cancel` beside the other three — taken first, because every other leg
   *      writes and by the end there is no unmarked task left to offer all four
   *      to;
   *   1. a row called off FROM THE UI — `⌥Enter` in the row's own editor —
   *      wearing the two halves of the face: a CROSSED box where a finished
   *      row has a check, and the same struck-through title, because what the
   *      strike says is "nobody is waiting on this line" and the box is where
   *      the two settling marks are told apart. The record is printed off the
   *      disk beside it, since a picture of a row cannot say what a file holds;
   *   2. IT SETTLES, at the arrow: `pick the hinges` comes after that row and
   *      is drawn waiting, and the dim and the hourglass come off the moment
   *      the target is called off. Nobody can finish work somebody has decided
   *      against, so a mark that went on blocking would be an obstacle with no
   *      way past it;
   *   3. IT SETTLES, at the branch: `install the cabinets` refuses `Complete`
   *      over the unfinished task it still holds — one, because shot 2 already
   *      called the other off, which is the ruling showing in the sentence
   *      itself — and names the way past. With that one called off too, the
   *      parent goes done over two cancelled children;
   *   4. IT IS AN EVENT ON A DAY: today's journal page draws the row it was
   *      called off on, struck through, with the badge printing the occasion's
   *      own word. The address bar is in frame for this one, because `/today`
   *      is the claim;
   *   5. and `is:cancelled` selects it, which is the query door's half of the
   *      same claim the menu made in shot 0.
   */
  "the-fourth-mark": async (page) => {
    pinnedBy(
      "cancelled_mark.feature",
      "⌥Enter calls a row off, and says so three ways",
      "Anything after a cancelled target stops waiting",
      "A parent goes done over a cancelled child",
      "Cancelling a branch refuses nothing, and names what it left standing",
      "A cancelled row is on today's journal page, struck through",
    )

    // 1. THE OUTLINE AS IT STANDS, and the menu OF AN UNTOUCHED ROW — taken
    // first because every other leg of this section writes: by the end the
    // fixture holds no unmarked task to offer all four verbs to, and a menu
    // photographed then would be missing the two a marked row does not get.
    await opened(page, "/house.olai", OUTLINE_TREE)
    await shot(page, "before-anybody-pressed-anything")
    await openMenu(page, "handles")
    console.log(`  the menu offers: ${await verbsOf(page)}`)
    await shot(page, "cancel-is-offered-with-the-other-three")
    await page.keyboard.press("Escape")

    // 2. CALLED OFF, from the row. `⌥Enter` is the third member of the
    // `Enter` family — Ctrl finishes, Ctrl+Shift walks, Alt calls off.
    await opened(page, "/house.olai", OUTLINE_TREE)
    await page.locator(title("knobs")).first().click()
    await page.locator(TITLE_EDITOR).first().waitFor()
    await page.keyboard.press("Alt+Enter")
    await page.waitForTimeout(SETTLE)
    await page.keyboard.press("Escape")
    await page.waitForTimeout(DRAWN)
    console.log(`  the box says:   ${await attrOf(page, glyphAt("knobs"), "data-face")}`)
    console.log(`  the row says:   ${await attrOf(page, row("knobs"), "data-status")}`)
    console.log(`  the title is:   ${await decorationOf(page, title("knobs"))}`)
    console.log(`  and the file:   ${recordOf("knobs")}`)
    await shot(page, "a-crossed-box-and-a-struck-through-title")
    await inTheDark(page)
    await shot(page, "a-crossed-box-and-a-struck-through-title-dark")
    await page.evaluate(() => localStorage.setItem("olai.theme", "chalk"))

    // 2. IT SETTLES, AT THE ARROW. `pick the hinges` waits on `order the new
    // cabinets`; calling that off clears the way.
    await opened(page, "/house.olai", OUTLINE_TREE)
    console.log(`  hinges waits on: ${await attrOf(page, glyphAt("hinges"), "data-face")}`)
    await shot(page, "hinges-is-waiting-on-order")
    await page.locator(title("order")).first().click()
    await page.locator(TITLE_EDITOR).first().waitFor()
    await page.keyboard.press("Alt+Enter")
    await page.waitForTimeout(SETTLE)
    await page.keyboard.press("Escape")
    await page.waitForTimeout(DRAWN)
    console.log(`  order is now:    ${await attrOf(page, row("order"), "data-status")}`)
    console.log(`  hinges now:      ${await attrOf(page, glyphAt("hinges"), "data-face")}`)
    await shot(page, "the-arrow-unblocks-when-the-target-is-called-off")

    // 3. IT SETTLES, AT THE BRANCH. The refusal first, so the shot beside it
    // is the state the fourth mark is the way out of.
    await opened(page, "/house.olai", OUTLINE_TREE)
    await page.locator(title("install")).first().click()
    await page.locator(TITLE_EDITOR).first().waitFor()
    await page.keyboard.press("ControlOrMeta+Enter")
    await page.waitForTimeout(SETTLE)
    console.log(`  Complete says:  ${await textOf(page, EDIT_REFUSAL)}`)
    await shot(page, "complete-is-refused-and-names-the-way-past")
    await page.keyboard.press("Escape")
    // ONE row, and the refusal above says which: `pick the knobs` was called
    // off two legs up, so it is already settled and already out of the way —
    // which is why that sentence names one task where the fixture has two.
    // `⌥Enter` is a TOGGLE, so pressing it at that row again would take the
    // mark back off rather than re-applying it.
    await page.locator(title("hinges")).first().click()
    await page.locator(TITLE_EDITOR).first().waitFor()
    await page.keyboard.press("Alt+Enter")
    await page.waitForTimeout(SETTLE)
    await page.keyboard.press("Escape")
    await page.waitForTimeout(DRAWN)
    await page.locator(title("install")).first().click()
    await page.locator(TITLE_EDITOR).first().waitFor()
    await page.keyboard.press("ControlOrMeta+Enter")
    await page.waitForTimeout(SETTLE)
    await page.keyboard.press("Escape")
    await page.waitForTimeout(DRAWN)
    console.log(`  install is now: ${await attrOf(page, row("install"), "data-status")}`)
    console.log(`  and the file:   ${recordOf("install")}`)
    await shot(page, "the-parent-goes-done-over-two-cancelled-children")

    // 4. IT IS AN EVENT ON A DAY. Nothing in this fixture is dated today, so
    // every row `/today` draws is a row this section's own gestures put there.
    await opened(page, "/house.olai", OUTLINE_TREE)
    await page.locator(title("handles")).first().click()
    await page.locator(TITLE_EDITOR).first().waitFor()
    await page.keyboard.press("Alt+Enter")
    await page.waitForTimeout(SETTLE)
    await page.keyboard.press("Escape")
    await opened(page, "/today", '[data-testid="day-page"]')
    console.log(`  the day open is: ${await page.evaluate(() => location.pathname)}`)
    console.log(`  the badge says:  ${
      await attrOf(page, `${row("handles")} [data-testid="date"]`, "data-occasion")
    }`)
    console.log(`  the title is:    ${await decorationOf(page, title("handles"))}`)
    await shot(page, "the-day-page-draws-what-was-called-off-on-it")

    // 5. AND IT IS A MARK LIKE THE OTHER THREE at the query door too — the
    // menu's half of this claim was taken first, while a row was still
    // unmarked.
    await opened(page, "/house.olai", OUTLINE_TREE)
    await narrow(page, "is:cancelled")
    console.log(`  is:cancelled selects:\n${await drawn(page)}`)
    await shot(page, "is-cancelled-selects-what-was-called-off")
  },
  /**
   * A BACKGROUND TASK THE AGENT ARMED (`chat-background-tasks-visible`): the
   * row it gets, the fact that a turn ending does not take it away, and the
   * death that lands in no turn at all.
   *
   * The claim no `✔` can show is the LAST one: a call that outlives its turn.
   * Every other running call in this panel is marked as abandoned the moment
   * its turn ends — deliberately, since nothing will ever report on it again —
   * and this is the one kind that is not, because the harness is still going to
   * say how it ended. What that looks like is three frames apart in time and is
   * exactly what a screenshot can carry: armed and ticking, still ticking a
   * turn later, and then the ending with the exit code on it.
   *
   * THE MIDDLE SHOT is the one no ✔ can carry and the reason the section sends
   * a second turn at all: the arming row is off the top of the pane by then —
   * which is where a monitor armed at the start of a session lives for the rest
   * of it — and the strip above the scroll is still answering.
   *
   * IT NEEDS AN AGENT, which is the one thing about this section a reader has
   * to know: `evidence.sh` names the scripted one for this section only. Its
   * `watch` verb arms a task the way the patched adapter reports one
   * (`acp/patches/README.md`) and holds the death until a marker file appears,
   * so the three shots are a sequence a person can reproduce rather than a race
   * against a real monitor's clock.
   */
  "a-background-task-the-agent-armed": async (page) => {
    await openChatForAgent(page)
    await ask(page, "watch")
    // THE ROW, once the clock has something to say. The readout is quiet for
    // its first seconds on purpose (the reads that land instantly must not
    // flash one), so waiting for it is waiting for the face this shot is of.
    await page.locator(CHAT_ARMED).first().waitFor()
    await page.locator(CHAT_ARMED_STILL).first().waitFor()
    await page.locator(CHAT_WATCHING).waitFor()
    await page.locator(CHAT_TOOL_ELAPSED).first().waitFor({ timeout: 15_000 })
    await shot(page, "armed-and-ticking")

    // A TURN THAT BURIES IT, which is what every long session does to an
    // arming row. Two claims in one picture: the row is not marked abandoned
    // (a call that armed a task is the one call whose point is to outlive its
    // turn), and the STRIP goes on answering from where the reader now is —
    // the arming row is off the top of the pane in this shot.
    await ask(page, "flood")
    await page.locator(CHAT_TRANSCRIPT).getByText("line 39").first().waitFor()
    await shot(page, "still-out-with-the-row-scrolled-away")

    // ... AND THE DEATH, in no turn at all: the marker is this driver standing
    // in for a monitor's own stream ending. It lands at the BOTTOM, where the
    // reader is looking, and the strip clears with it.
    writeFileSync(`${VAULT}/.agent-release`, "")
    await page.locator(CHAT_ARMED_ENDED).first().waitFor()
    await page.waitForFunction(
      (selector) => document.querySelector(selector) === null,
      `[data-testid="${TESTID_WATCHING}"]`,
    )
    await shot(page, "the-death-lands-at-the-bottom")
  },

  /**
   * THE THREE KINDS OLAI ONLY SHOWS (`pdf-csv-and-pictures`): a `.csv` drawn
   * as a table, a picture drawn in an `<img>`, a `.pdf` drawn by the
   * browser's own viewer — and the sidebar that lists all three among the
   * outlines and documents.
   *
   * THE BIG FILE IS WRITTEN HERE rather than kept in the corpus, exactly as
   * the suite's own scenario writes one: the subject is the relationship
   * between a bound and a file past it, and a thousand lines of nothing in the
   * fixtures is a corpus nobody can read (`fixtures/README.md`).
   *
   * IT WANTS A REAL CHROME, and that is the one thing about this section a
   * reader has to know. Playwright's Chromium ships no PDF viewer (nor does
   * its Firefox, which disables pdf.js by preference), so the `.pdf` page
   * draws its FALLBACK there — the honest sentence and the link `Pdf.tsx`
   * puts under an `<object>` for exactly that case. That is a true screenshot
   * of a browser nobody uses. Run this one with `CHROME=$(command -v
   * google-chrome-stable)` and every shot is of the browser a person has;
   * every other section is identical either way.
   */
  "pdf-csv-and-pictures": async (page) => {
    // THE COLUMN FIRST: the three kinds listed among the outlines and the
    // documents, under the folders they live in. The folders start collapsed,
    // so this opens the three that hold them — which is also what a reader
    // does.
    await opened(page, "/house.olai", OUTLINE_TREE)
    for (const folder of ["art", "data", "reports"]) {
      // The fold button of ONE folder, which is a direct child of its `<li>`
      // rather than a descendant's: nested folders nest their `li`s, so an
      // unscoped toggle under a parent matches every toggle inside it (the
      // suite's own `folderToggle` draws the same distinction).
      await page.locator(`[data-testid="file-dir"][data-path="${folder}"] > button`).click()
    }
    await page.waitForTimeout(DRAWN)
    await shot(page, "the-sidebar-lists-them")

    // THE TABLE. The fixture is small on purpose — the whole file is on the
    // screen — so the clamp has nothing to say, which is what an unclamped
    // page has to look like.
    await opened(page, "/data/sales.csv", '[data-testid="csv-table"]')
    console.log(`  ${"the header reads:".padEnd(24)}${
      await textOf(page, '[data-testid="csv-table"] thead')
    }`)
    await shot(page, "a-csv-is-a-table")

    // …AND THE CLAMP SAID. Seven hundred rows against a five-hundred-row
    // bound, and the sentence under the table is the whole point of the shot.
    const rows = ["row,squared"]
    for (let at = 1; at <= 700; at++) rows.push(`${at},${at * at}`)
    rewrite("data/big.csv", rows)
    await opened(page, "/data/big.csv", '[data-testid="csv-clamp"]')
    console.log(`  ${"the page says:".padEnd(24)}${
      await textOf(page, '[data-testid="csv-clamp"]')
    }`)
    // The table is five hundred rows tall, so the sentence is at the FOOT of
    // it: the shot that matters is the one with the clamp in frame.
    await page.locator('[data-testid="csv-clamp"]').scrollIntoViewIfNeeded()
    await page.waitForTimeout(DRAWN)
    await shot(page, "a-big-csv-says-what-it-left-out")

    // A RASTER PICTURE, then a VECTOR one. `tall.png` rather than
    // `handle.png`, which is four pixels square: a shot of that is a true
    // picture of the rule — a small file is drawn at its own size rather than
    // blown up to fill the column — and an unreadable piece of evidence.
    //
    // The svg is the fixture with teeth: it carries a script that tries to
    // rename this document and mark it, and an `<img>` runs neither.
    await opened(page, "/art/tall.png", '[data-testid="image-view"]')
    await shot(page, "a-picture-is-a-page")
    await opened(page, "/art/diagram.svg", '[data-testid="image-view"]')
    console.log(`  ${"the svg ran:".padEnd(24)}${
      String(await page.evaluate(() => "__olai_svg_ran" in globalThis))
    }`)
    await shot(page, "an-svg-is-drawn-and-does-not-run")

    // THE PDF, in whatever viewer this browser has — see the header.
    await opened(page, "/reports/q3.pdf", '[data-testid="pdf-embed"]')
    await page.waitForTimeout(SETTLE)
    await shot(page, "a-pdf-is-the-browser-s-own-viewer")

    // …AND THE ADDRESS ALONE. A reload rather than a click: the whole point of
    // a prefix-free address is that it is a real URL somebody can paste.
    await page.goto(`${BASE}/data/sales.csv`)
    await page.locator('[data-testid="csv-table"]').first().waitFor()
    await page.waitForTimeout(DRAWN)
    await shot(page, "the-address-alone-opens-it")
  },

  /**
   * WHO YOU ARE (`who-you-are`): the header's identity icon under a
   * simulated Tailscale-User-Login, and the anonymous icon when the
   * header is absent. Reef (the default) and pitch, because the chip
   * sits on ink and the two invert it.
   */
  "who-you-are": async (page) => {
    const headerShot = async (target: Page, name: string) => {
      const header = target.locator('[data-testid="app-header"]')
      await header.waitFor()
      const box = await header.boundingBox()
      if (box === null) throw new Error("the app header has no box")
      await shot(target, name, { clip: box })
    }

    const none = page.locator('[data-testid="identity"][data-who="none"]')
    await none.waitFor({ state: "attached" })
    await headerShot(page, "absent-reef")
    await wearTheme(page, "pitch")
    await none.waitFor({ state: "attached" })
    await headerShot(page, "absent-pitch")

    const browser = page.context().browser()
    if (browser === null) throw new Error("the page has no browser")
    // extraHTTPHeaders does not ride the websocket upgrade; a reverse
    // proxy does. Same door the e2e identity scenarios use.
    const { listenHeaderProxy } = await import("./support/headerProxy.ts")
    const proxy = await listenHeaderProxy(BASE, () => ({
      "Tailscale-User-Login": "ada@example.com",
    }))
    const signed = await browser.newContext({
      viewport: { width: WIDE, height: 720 },
    })
    const tab = await signed.newPage()
    await tab.goto(`${proxy.url}/house.olai`)
    await tab.locator('[data-testid="identity"][data-who="yes"]').waitFor()
    const picture = tab.locator('[data-testid="identity"] img')
    await picture.waitFor()
    await tab.waitForFunction(() => {
      const img = document.querySelector('[data-testid="identity"] img')
      return img instanceof HTMLImageElement && img.complete && img.naturalWidth > 0
    })
    await headerShot(tab, "signed-in-reef")
    await wearTheme(tab, "pitch")
    await tab.locator('[data-testid="identity"][data-who="yes"]').waitFor()
    await picture.waitFor()
    await headerShot(tab, "signed-in-pitch")
    await signed.close()
    await proxy.close()
  },

  /**
   * DURATIONS (`duration-values`): `created:1h` answered by the header's box,
   * and the refusal that teaches the four units when a reader reaches for a
   * fifth.
   *
   * THE CLOCK IS REAL HERE, which is the whole reason this is a section rather
   * than a unit test. Every boundary the suite pins is pinned against a fixed
   * `now` handed in; what nothing below the browser can show is that the clock
   * a DOOR counts from is the one a capture is stamped with — so the node this
   * section finds is one it captured a moment earlier, through the palette,
   * with a `created` the server minted while the section was running.
   *
   * THE OLDER NODE IS WRITTEN, for the same reason the pins above are: a
   * stamp is an ordinary field, so a record carrying one from last month is a
   * line in a file rather than a gesture nobody can make. The pair is the
   * evidence — the same box, the same query, one row present and one absent,
   * and the only difference between them is when olai wrote them.
   *
   * `has:created` is photographed BESIDE it, because a query that finds one row
   * proves less than a query that finds both: it is what says the older node is
   * there to be missed rather than missing.
   */
  durations: async (page) => {
    // Two stamped records the app did not write, one of them last month and
    // one of them years back — the rows `created:1h` must NOT return.
    rewrite("stamps.olai", [
      `{"id":"lastmonth","ord":"a0","title":"the older job, captured last month","created":"${
        shiftDay(isoDayOf(new Date()), -32)
      }T09:12:44-04:00"}`,
      `{"id":"antique","ord":"a1","title":"the ancient job, captured in 2019","created":"2019-03-04T14:30:00-04:00"}`,
    ])
    await opened(page, "/stamps.olai", OUTLINE_TREE)
    console.log(`  the file holds:       ${(await titles(page)).join(" · ")}`)

    // THE CAPTURE, which is where the real clock enters: the ops layer stamps
    // `created` with the same `now` a `done` is stamped with, and it is that
    // stamp the query below counts back from.
    await page.keyboard.press("ControlOrMeta+k")
    await page.locator(PALETTE_INPUT).waitFor()
    await page.locator(PALETTE_INPUT).fill("+ sand the walnut edge")
    await page.locator(PALETTE_INPUT).press("Enter")
    await page.locator(PALETTE_SAID).waitFor()
    await page.waitForTimeout(DRAWN)
    console.log(`  captured just now:    ${
      (await page.locator(PALETTE_SAID).innerText()).replace(/\s+/g, " ").trim()
    }`)
    await page.keyboard.press("Escape")
    await page.waitForTimeout(DRAWN)

    /** One query put to the header's box, with what it answered — the door the
     *  human was refused at when they typed `created:1h`, which is why the
     *  evidence is taken here rather than at the filter bar. */
    const asks = async (query: string, name: string) => {
      const box = page.locator(HEADER_SEARCH)
      await box.click()
      await box.fill(query)
      await page.waitForTimeout(SETTLE)
      const rows = await page.locator('[data-testid="header-search-item"]').allInnerTexts()
      console.log(`  ${query.padEnd(22)}${
        rows.length === 0
          ? "(no rows)"
          : rows.map((one) => one.replace(/\s+/g, " ").trim()).join(" · ")
      }`)
      const refused = await page.locator(SEARCH_REFUSAL).first().textContent().catch(() =>
        null
      )
      if (refused !== null) console.log(`  ${"...and refuses:".padEnd(22)}${refused.trim()}`)
      await shot(page, name)
      await page.keyboard.press("Escape")
      await page.waitForTimeout(DRAWN)
    }

    // WITHIN THE LAST HOUR — the bare form, which is sugar for `created:1h..`.
    // The captured row is there; neither written one is.
    await asks("created:1h", "within-the-last-hour")
    // ...and the same three nodes under a question about the STAMP rather than
    // about the hour, which is what says the other two were there to be missed.
    await asks("has:created", "the-same-file-unbounded")
    // OLDER THAN AN HOUR, the point reading of the same moment: the two the
    // query above left out, and not the one it found.
    await asks("created:..1h", "older-than-an-hour")

    // THE REFUSAL, and it is the sentence this feature owes a reader most: the
    // month unit is a RULING rather than a gap, so the box has to say which
    // four units there are and that months and years are deliberately not
    // among them.
    await asks("created:1mo", "the-refusal-teaches-the-units")
  },

  /**
   * PIN TO SIDEBAR (`pin-to-sidebar`): the shelf holding one of each of the
   * three things worth a door — a NODE, a DOCUMENT, and a page WITH the query
   * it was narrowed by — and the two promises a still frame cannot make on its
   * own.
   *
   * The three pins are WRITTEN INTO `Pins.olai` as the records they are,
   * rather than clicked up, and that is the section's first claim: a shelf is
   * stored in the directory as ordinary nodes, so an agent writes one with
   * `add_node` and the sidebar draws whatever the file says. The gestures
   * follow — a click that lands on the filtered page with its `?q=` intact, a
   * rename made in the FILE that the shelf follows on the next frame, and the
   * `•••` verb that puts a fourth door up.
   *
   * Two palettes, because every ink on the row is a theme token: the light one
   * (the default, `chalk`) and the dark one (`pitch`).
   */
  "pin-to-sidebar": async (page) => {
    rewrite("_olai/Pins.olai", [
      `{"id":"p-kitchen","ord":"a0","title":"/#kitchen"}`,
      `{"id":"p-finishes","ord":"a1","title":"/finishes.md"}`,
      // …and one written as a LINK, which is how a pin carries a name somebody
      // chose: the label is drawn, the query beside it, and pressing it opens
      // the address (human, 2026-08-19).
      `{"id":"p-todo","ord":"a2","title":"[What is left to do](/house.olai?q=is%3Atodo)"}`,
    ])
    await page.goto(`${BASE}/house.olai`)
    await page.locator(SHELF).waitFor()
    await page.waitForTimeout(DRAWN)
    console.log(`  the shelf reads:      ${await shelved(page)}`)
    await shot(page, "the-shelf-chalk")

    // The FILTERED pin, followed. What it has to land on is the page AND the
    // query — a door that dropped the `?q=` would open a different page from
    // the one that was pinned.
    await page.locator(`${PIN}[data-at="/house.olai?q=is%3Atodo"]`).first().click()
    await page.locator('[data-testid="filter-bar"]').first().waitFor()
    await page.waitForTimeout(DRAWN)
    const landed = new URL(page.url())
    console.log(`  the click landed on:  ${landed.pathname}${landed.search}`)
    console.log(`  with the filter box:  ${
      await page.locator('[data-testid="filter-input"]').first().inputValue()
    }`)
    console.log(`  and the rows it kept: ${(await order(page)) || "(none)"}`)
    await shot(page, "the-filter-came-with-it-chalk")

    // A RENAME made somewhere else entirely — the record rewritten on disk,
    // which is what an agent's `set_title` produces. The shelf holds no copy
    // of the title, so what it draws is simply the node's new name.
    retitle("house.olai", "kitchen", "the kitchen, rebuilt #home")
    await page.waitForFunction(
      (name) =>
        document.querySelector('[data-testid="pin"][data-at="/#kitchen"]')
          ?.textContent?.includes(name) === true,
      "the kitchen, rebuilt",
    )
    console.log(`  after the rename:     ${await shelved(page)}`)
    await shot(page, "a-rename-arrives-chalk")

    // And the `•••`, which is where a NODE is pinned from.
    await page.goto(`${BASE}/garden.olai`)
    await page.locator(OUTLINE_TREE).first().waitFor()
    await page.waitForTimeout(DRAWN)
    await openMenu(page, "herbs")
    await shot(page, "the-verb-on-a-row-chalk")
    await page.locator('[data-testid="node-menu-panel"] >> text=Pin to sidebar').first().click()
    await page.locator(`${PIN}[data-at="/#herbs"]`).waitFor()
    await page.waitForTimeout(DRAWN)
    console.log(`  after the verb:       ${await shelved(page)}`)
    console.log(`  and Pins.olai says:   ${
      recordsIn("_olai/Pins.olai").map((one) => String(one["title"])).join(" · ")
    }`)
    await shot(page, "a-fourth-door-chalk")

    // AND THE SHELF'S OWN FILE, opened as the ordinary outline it is — the
    // maintainer's gesture, and the one that found the leak: the rows are
    // titles that are addresses, and a page that drew them raw showed the
    // plumbing. Each is drawn as the page it names, by the same resolver the
    // shelf reads (`web/src/client/address/`).
    await page.goto(`${BASE}/_olai/Pins.olai`)
    await page.locator(OUTLINE_TREE).first().waitFor()
    await page.waitForTimeout(DRAWN)
    console.log(`  Pins.olai draws:      ${(await titles(page)).join(" · ")}`)
    console.log(`  …over the titles:     ${
      recordsIn("_olai/Pins.olai").map((one) => String(one["title"])).join(" · ")
    }`)
    await shot(page, "the-shelf-as-an-outline-chalk")

    // THE WHOLE COLUMN, in a window tall enough to hold it — which is the shot
    // the grouping is actually about: the complaint was that the pins, the
    // tree, the two ways to make a file and the Trash ran together into one
    // undifferentiated list, and every one of those is below the fold at the
    // window the other shots use.
    await page.setViewportSize({ width: WIDE, height: 1000 })
    await page.goto(`${BASE}/garden.olai`)
    await page.locator(OUTLINE_TREE).first().waitFor()
    await page.waitForTimeout(DRAWN)
    console.log(`  the column's regions: ${
      (await page.locator('[data-testid="sidebar-body"] h2').allInnerTexts()).join(" · ")
    }`)
    await shot(page, "the-whole-column-chalk", {
      clip: { x: 0, y: 0, width: 260, height: 1000 },
    })

    await wearTheme(page, "pitch")
    await shot(page, "the-whole-column-pitch-dark", {
      clip: { x: 0, y: 0, width: 260, height: 1000 },
    })
    await page.setViewportSize({ width: WIDE, height: 720 })
    await page.goto(`${BASE}/_olai/Pins.olai`)
    await page.locator(OUTLINE_TREE).first().waitFor()
    await page.waitForTimeout(DRAWN)
    await shot(page, "the-shelf-as-an-outline-pitch-dark")
    await page.goto(`${BASE}/garden.olai`)
    await page.locator(OUTLINE_TREE).first().waitFor()
    await page.waitForTimeout(DRAWN)
    await shot(page, "a-fourth-door-pitch-dark")
    await page.goto(`${BASE}/house.olai?q=is%3Atodo`)
    await page.locator(SHELF).waitFor()
    await page.waitForTimeout(DRAWN)
    await shot(page, "the-filter-came-with-it-pitch-dark")
  },

  /**
   * INBOX SITS BY AGENDA AND WEARS ITS COUNT (`inbox-count-placement`): the
   * door up with the primary destinations, Agenda's own badge on it, a
   * capture moving the number, the empty-inbox quiet, and the same column
   * in the dark palette — colour consistency is half the ruling.
   */
  "inbox-count-placement": async (page) => {
    await page.goto(`${BASE}/house.olai`)
    await page.locator(OUTLINE_TREE).first().waitFor()
    await page.waitForTimeout(DRAWN)

    await page.keyboard.press("ControlOrMeta+k")
    await page.locator(PALETTE_INPUT).waitFor()
    await page.locator(PALETTE_INPUT).fill("+ buy the walnut stain")
    await page.locator(PALETTE_INPUT).press("Enter")
    await page.locator(PALETTE_SAID).waitFor()
    await page.keyboard.press("Escape")
    await page.locator(INBOX_LINK).waitFor()
    await page.locator(INBOX_COUNT).waitFor()
    await page.waitForTimeout(DRAWN)
    console.log(`  agenda count:         ${
      (await page.locator(AGENDA_COUNT).first().innerText().catch(() => "")).trim() || "(none)"
    }`)
    console.log(`  inbox count:          ${
      (await page.locator(INBOX_COUNT).first().innerText().catch(() => "")).trim() || "(none)"
    }`)
    await shot(page, "inbox-beside-agenda-wearing-1", {
      clip: { x: 0, y: 0, width: 300, height: COLUMN_FITS },
    })

    await page.keyboard.press("ControlOrMeta+k")
    await page.locator(PALETTE_INPUT).waitFor()
    await page.locator(PALETTE_INPUT).fill("+ and a tin of oil")
    await page.locator(PALETTE_INPUT).press("Enter")
    await page.locator(PALETTE_SAID).waitFor()
    await page.keyboard.press("Escape")
    await page.waitForFunction(
      (sel) => document.querySelector(sel)?.textContent?.trim() === "2",
      INBOX_COUNT,
    )
    await page.waitForTimeout(DRAWN)
    console.log(`  inbox count after 2:  ${
      (await page.locator(INBOX_COUNT).first().innerText()).trim()
    }`)
    await shot(page, "a-second-capture-makes-2", {
      clip: { x: 0, y: 0, width: 300, height: COLUMN_FITS },
    })

    await wearTheme(page, "pitch")
    await shot(page, "inbox-beside-agenda-pitch-dark", {
      clip: { x: 0, y: 0, width: 300, height: COLUMN_FITS },
    })

    rewrite("_olai/Inbox.olai", [])
    await page.waitForFunction(
      (sel) => document.querySelector(sel) === null,
      INBOX_COUNT,
    )
    await page.waitForTimeout(DRAWN)
    console.log(`  inbox door still:     ${await page.locator(INBOX_LINK).count()}`)
    console.log(`  inbox chips:          ${await page.locator(INBOX_COUNT).count()}`)
    await shot(page, "empty-inbox-wears-no-count", {
      clip: { x: 0, y: 0, width: 300, height: COLUMN_FITS },
    })
  },

  /**
   * THE FILES OLAI NAMES FOR ITSELF (`olai-names-its-own-files`, human
   * 2026-08-20): `_olai/` out of the file tree, the two doors that replace
   * those rows at the foot of the column, and the Prefs switch that puts the
   * rows back.
   *
   * The shelf is WRITTEN into `_olai/Pins.olai` rather than clicked up, which
   * is the same standing-in this file's pin section does: what the shot is
   * about is what the column DRAWS for a directory that has one, not the
   * gesture that made it. The inbox, on the other hand, is minted by the
   * capture — because WHERE it lands is half of what this section is evidence
   * for, and the palette's own remark names the file it wrote.
   *
   * Read the five in order and they are the whole rule: a column with olai's
   * files kept out of the reader's list; the capture that mints one, saying
   * where it went; the door that appears for it; the outline behind that door;
   * and the switch that draws `_olai/` again for somebody who wants it.
   */
  "olai-names-its-own-files": async (page) => {
    rewrite("_olai/Pins.olai", [
      `{"id":"p-kitchen","ord":"a0","title":"/#kitchen"}`,
    ])
    await page.goto(`${BASE}/house.olai`)
    await page.locator(SHELF).waitFor()
    await page.waitForTimeout(DRAWN)
    console.log(`  the tree draws:       ${await treeRows(page)}`)
    console.log(`  the shelf reads:      ${await shelved(page)}`)
    // No Inbox entry yet: this directory has never captured, and minting one
    // is the capture's job rather than a door's.
    console.log(`  inbox entries drawn:  ${await page.locator(INBOX_LINK).count()}`)
    await shot(page, "the-column-is-the-readers-files", {
      clip: { x: 0, y: 0, width: 300, height: COLUMN_FITS },
    })

    // THE CAPTURE, and the sentence it comes back with — which is where the
    // mint's new path is visible to a reader rather than inferred: only the
    // server knows which file the inbox is, so the palette prints what the
    // answer said.
    await page.keyboard.press("ControlOrMeta+k")
    await page.locator(PALETTE_INPUT).waitFor()
    await page.locator(PALETTE_INPUT).fill("+ buy the walnut stain")
    await page.locator(PALETTE_INPUT).press("Enter")
    await page.locator(PALETTE_SAID).waitFor()
    await page.waitForTimeout(DRAWN)
    console.log(`  the palette said:     ${
      (await page.locator(PALETTE_SAID).innerText()).replace(/\s+/g, " ").trim()
    }`)
    await shot(page, "the-capture-says-where-it-landed")

    await page.keyboard.press("Escape")
    await page.waitForTimeout(DRAWN)
    console.log(`  the tree now draws:   ${await treeRows(page)}`)
    await shot(page, "and-now-there-is-an-inbox-door", {
      clip: { x: 0, y: 0, width: 300, height: COLUMN_FITS },
    })

    // The door opens the OUTLINE — an ordinary file page, editable, unlike the
    // Trash beneath it.
    await page.locator(INBOX_LINK).first().click()
    await page.locator(OUTLINE_TREE).first().waitFor()
    await page.waitForTimeout(DRAWN)
    console.log(`  the door landed on:   ${new URL(page.url()).pathname}`)
    console.log(`  holding:              ${(await titles(page)).join(" · ")}`)
    await shot(page, "the-inbox-entry-opens-the-inbox")

    // …and the switch that draws them again, photographed with the panel open
    // over the column it is about.
    await page.locator('[data-testid="prefs-trigger"]').first().click()
    await page.locator('[data-testid="prefs-panel"]').waitFor()
    await page.locator(
      '[data-testid="prefs-row"][data-pref="hidden-outlines"] ' +
        '[data-testid="prefs-choice"][data-value="shown"]',
    ).click()
    await page.waitForTimeout(DRAWN)
    console.log(`  with the switch on:   ${await treeRows(page)}`)
    await shot(page, "the-prefs-switch-draws-them-again")
  },

  /**
   * THE AGENDA AS A SPINE OF TIME (`agenda-spine`, ruled 2026-08-18): one
   * continuous line with now marked on it, what has slipped above it and the
   * future receding below.
   *
   * The outline is WRITTEN HERE, relative to the day the run happens on,
   * because that is the only way a shot can hold all five things the ruling is
   * about at once — something late, something on today, something near,
   * something far enough to have faded, and two silences long enough to be
   * named. The dates are the design canvas's own offsets (a day late, six days
   * out, nineteen, twenty-one at two o'clock, seventy-three), so the page in
   * the shot is the artboard in the brief.
   *
   * Two palettes, because the whole line is drawn in theme tokens: a light one
   * (the default, `chalk`) and a dark one (`pitch`). A gradient written in hex
   * would look right in exactly one of them.
   */
  "the-agenda-is-a-spine": async (page) => {
    rewrite("agenda.olai", [
      `{"id":"admin","ord":"a0","title":"Admin"}`,
      `{"id":"parking","parent":"admin","ord":"a0","title":"Renew the parking permit","todo":true,"date":"${away(-9)}"}`,
      `{"id":"lease","parent":"admin","ord":"a1","title":"Sign the rental agreement","todo":true,"date":"${away(-1)}"}`,
      `{"id":"survey","parent":"admin","ord":"a2","title":"Call the surveyor about the boundary","todo":true,"date":"${away(0)}"}`,
      `{"id":"health","ord":"a1","title":"Health"}`,
      `{"id":"leg","parent":"health","ord":"a0","title":"Leg pain"}`,
      `{"id":"clinic","parent":"leg","ord":"a0","title":"Call Ste-Foy clinic — chart + cancellations","todo":true,"date":"${away(6)}"}`,
      `{"id":"confirm","parent":"leg","ord":"a1","title":"Confirm rheumatology appointment","todo":true,"date":"${away(19)}"}`,
      `{"id":"rheum","parent":"leg","ord":"a2","title":"Rheumatology appointment — Dre Leclerc, Ste-Foy","todo":true,"date":"${away(21)}T14:00"}`,
      `{"id":"bell","ord":"a2","title":"Call Bell about Option 2 (lump-sum deferred payment)","todo":true,"date":"${away(73)}"}`,
    ])
    await page.goto(`${BASE}/agenda`)
    await page.locator('[data-testid="agenda-spine"]').first().waitFor()
    await page.waitForTimeout(400)
    console.log(`  days on the line:   ${await page.locator('[data-testid="agenda-day"]').count()}`)
    console.log(`  and their standing: ${
      (await page.locator('[data-testid="agenda-day"]').evaluateAll((days) =>
        days.map((one) => one.getAttribute("data-when"))
      )).join(" ")
    }`)
    console.log(`  the silences it names: ${
      (await page.locator('[data-testid="agenda-quiet"]').allInnerTexts()).join(" · ")
    }`)
    console.log(`  file headings on it:  ${await page.locator('[data-testid="day-group"]').count()}`)
    await shot(page, "chalk-light", { full: true })

    await wearTheme(page, "pitch")
    await shot(page, "pitch-dark", { full: true })
  },

  /**
   * `set_doing` refusing what the order forbids, on the web's two mark-walking
   * surfaces — the shot being the half a transcript cannot show: the DRAFT is
   * still open with the reason sitting beside it.
   *
   * `hinges` is `todo` and comes after `handles` and `order`. `handles` is a
   * plain bullet, so it stands in nobody's way and is not named; `order` is
   * `doing`, so it is. `install` is the other shape — an unmarked row, drawn
   * blocked by nothing because a bullet is not work, and refused all the same
   * because `Mark doing` is about to make it work.
   */
  "doing-refuses-blocked": async (page) => {
    await page.locator(title("hinges")).click()
    await page.locator(TITLE_EDITOR).first().waitFor()
    await page.keyboard.press("Control+Shift+Enter")
    await page.locator(EDIT_REFUSAL).first().waitFor()
    await page.waitForTimeout(200)
    console.log(`  the walk onto \`doing\` says: ${await textOf(page, EDIT_REFUSAL)}`)
    console.log(`  the draft is still open: ${await page.locator(TITLE_EDITOR).first().isVisible()}`)
    console.log(`  and the file still says:  ${recordOf("hinges")}`)
    await shot(page, "walk-refused-draft-kept")

    await page.keyboard.press("Escape")
    await page.waitForTimeout(200)
    await openMenu(page, "install")
    await page.locator('[data-testid="node-menu-panel"] >> text=Mark doing').first().click()
    await page.locator(MENU_SAID).first().waitFor()
    await page.waitForTimeout(200)
    console.log(`  the ••• menu says:        ${await textOf(page, MENU_SAID)}`)
    console.log(`  and the file still says:  ${recordOf("install")}`)
    await shot(page, "menu-refused")
  },

  /**
   * A dated node that COMES BACK, end to end and in the order a person does
   * it: choose the rule, complete the row, and find the occurrence the
   * completion made — first under the row it came from, then on the agenda,
   * where nothing knows it is an occurrence at all.
   *
   * The dates are the feature's own decision rather than the driver's: the row
   * is put on a Monday in 2019 first, so the occurrence lands on the Monday
   * after it and is overdue on every day this will ever be run. A shot of an
   * agenda that depended on the week it was taken in would be a shot nobody
   * could re-take.
   */
  "a-node-that-comes-back": async (page) => {
    // A day in the past to repeat from, so the occurrence is owed whenever
    // this runs. Through the pill, which is the control on a dated row.
    await page.locator(`${row("order")} [data-testid="date"]`).first().click()
    await page.locator('[data-testid="date-picker-day"]').first().waitFor()
    await page.locator('[data-testid="date-picker-day"]').first().fill("2019-03-04")
    await page.locator('[data-testid="date-picker-set"]').first().click()
    await page.waitForTimeout(SETTLE)

    // THE RULE, from the `•••` — the only door on a row that does not repeat
    // yet, since there is no pill to press.
    await openMenu(page, "order")
    await page.locator(REPEAT_VERB).first().click()
    await page.locator(REPEAT_PICKER).first().waitFor()
    await page.waitForTimeout(200)
    console.log(`  the rules it offers: ${
      (await page.locator(`${REPEAT_RULE} option`).allInnerTexts()).join(" · ")
    }`)
    await shot(page, "picker-open")

    await page.locator(REPEAT_RULE).first().selectOption("every week on monday")
    await page.waitForTimeout(200)
    await shot(page, "rule-chosen")
    await page.locator(REPEAT_SET).first().click()
    await page.waitForTimeout(SETTLE)
    console.log(`  the row now says:    ${await textOf(page, `${row("order")} [data-testid="repeat"]`)}`)
    console.log(`  and the file says:   ${recordOf("order")}`)
    await shot(page, "rule-on-the-row")

    // COMPLETING it, which is what makes the next one.
    await page.locator(title("order")).click()
    await page.keyboard.press("Control+Enter")
    await page.waitForTimeout(SETTLE)
    // Out of the draft before the shot: a row being typed in draws an input
    // where its title is, and the whole subject here is the two TITLES — the
    // one that was finished, and the one the finishing made.
    await page.keyboard.press("Escape")
    await page.waitForTimeout(300)
    console.log(`  after Ctrl+Enter, the outline reads:\n${await drawn(page)}`)
    console.log(`  the completed record: ${recordOf("order")}`)
    await shot(page, "completed-and-spawned")

    // …and the occurrence on the AGENDA, which knows nothing about
    // recurrence: it is a dated `todo` on a day that has gone.
    await opened(page, "/agenda", AGENDA_PAGE)
    console.log(`  the agenda draws:\n${await listed(page, AGENDA_PAGE)}`)
    await shot(page, "agenda-shows-the-occurrence")
  },

  /**
   * FINDING WHAT COMES BACK — `has:repeat`, over a page that mixes the two
   * kinds of row, in both halves of the palette table.
   *
   * The rule is a field the record carries, so the facet is spelled, parsed
   * and evaluated exactly where `has:desc` is and there is no new machinery to
   * photograph. What a picture adds is the PAGE it makes: one row that comes
   * back, drawn with the ancestry that says what it is about — and the same
   * query negated, which is every row that is dated once or not at all.
   *
   * The rule is put on first, because nothing in the served fixture repeats:
   * a shot of this facet over a directory with no rule in it would be a shot
   * of the empty answer.
   */
  "finding-what-comes-back": async (page) => {
    pinnedBy(
      "recurring_dates.feature",
      "`has:repeat` narrows the page to the rows that come back",
    )
    await repeatsEvery(page, "order", "every week on monday")
    console.log(`  the record now says: ${recordOf("order")}`)
    // The MIX, before anything is asked of it: ten rows, one of which wears a
    // rule. What the facet does is only legible against this.
    await shot(page, "the-page-that-mixes-both")

    // BOTH QUERIES in one palette, then both again in the other — rather than
    // a theme flipped per query. The filter is in the address and the theme is
    // a reload, so the second order pays two page loads for the picture the
    // first gets in one.
    const both = async (dark: boolean) => {
      const half = dark ? "-dark" : "-light"
      await narrow(page, "has:repeat")
      console.log(`  has:repeat${half.padEnd(7)} ${await said(page, FILTER_COUNT)}`)
      console.log(`  the rows say: ${await whyDrawn(page)}`)
      await shot(page, `has-repeat${half}`)
      // ...and the same facet with the dash every other token takes, which is
      // the whole of this grammar's negation story.
      await narrow(page, "-has:repeat")
      console.log(`  -has:repeat${half.padEnd(6)} ${await said(page, FILTER_COUNT)}`)
      console.log(`  the rows say: ${await whyDrawn(page)}`)
      await shot(page, `not-has-repeat${half}`)
    }
    await both(false)
    await inTheDark(page)
    await both(true)
  },

  "filter-keeps-ancestors": async (page) => {
    console.log(`  the whole outline:\n${await drawn(page)}`)
    await shot(page, "unfiltered")
    await narrow(page, "hinges")
    console.log(`  filtered by "hinges" — * is a match, the rest is context:`)
    console.log(await drawn(page))
    console.log(`  the bar says: ${await said(page, FILTER_COUNT)}`)
    console.log(`  the address:  ${new URL(page.url()).pathname}${new URL(page.url()).search}`)
    await shot(page, "with-ancestors")
  },

  "filter-operators": async (page) => {
    for (
      const query of [
        "is:done",
        "is:todo",
        // The one DERIVED value: `hinges` waits on `order`, which is still
        // `doing` — the same reading that dims the row on the unfiltered page.
        "is:blocked",
        "has:desc",
        "date:2026-08-10",
        "date:2026-08-01..2026-08-31",
        // A relative word, counted from the day this runs — the fixture's
        // dates are all in the past, so what it draws is stable rather than a
        // screenshot of the week it was taken in.
        "date:..today",
        "cabinets -is:doing",
        // A quoted PHRASE: one substring where the same words unquoted are
        // several, which is how the ORDER of the words gets into a query —
        // the third of these is the first with its words shuffled, and it is
        // the one that finds nothing.
        `"pick the hinges"`,
        "hinges the pick",
        `"hinges the pick"`,
        // `OR` joins the tokens on either side of it...
        "handles OR knobs",
        // ...and binds TIGHTER than the space between two tokens, so this is
        // `install` AND one of the other two rather than every `handles` in
        // the directory.
        "install cabinets OR handles",
      ]
    ) {
      await narrow(page, query)
      console.log(`  ${query.padEnd(30)} ${await said(page, FILTER_COUNT)}`)
      console.log((await drawn(page)).replace(/^/gm, "    "))
      await shot(page, `op-${query.replace(/[^a-z0-9]+/gi, "-")}`)
    }
  },

  "an-operator-it-cannot-read": async (page) => {
    // The silent-error rule, in the one place a query language invites one: a
    // filter that searched for the TEXT `is:open` would draw an empty page
    // and give no reason.
    for (
      const [query, why] of [
        ["is:open", "a value the operator does not take"],
        // Shape-clean and impossible — and the worst kind to swallow, since
        // `2026-13` sorts between December and January and so reads as a
        // window rather than as nonsense.
        ["date:2026-13", "a date no calendar could hold"],
        // A relative word the vocabulary does not hold, held to the same
        // contract: the twelve are named rather than the text searched for.
        ["date:tomorrowish", "a relative word the grammar does not know"],
        // Matched folded, quoted as typed: telling somebody who wrote
        // `is:OPEN` that they wrote `is:open` is the refusal misquoting
        // the reader.
        ["is:OPEN", "the same refusal, quoting the reader"],
        // A space after the colon is not "date: takes a day" — the reader
        // wrote a day; the tokenizer split one word into two.
        ["date: 2026", "an operator given no value at all"],
        // Not closed at the end of the line on the reader's behalf: `"pick
        // the` and `"pick the"` are two different queries.
        [`"pick the`, "a quote nothing closes"],
        // A joiner with one of its two sides missing.
        ["hinges OR", "an `OR` with nothing after it"],
      ] as const
    ) {
      await narrow(page, query)
      console.log(`  ${query.padEnd(14)} — ${why}`)
      console.log(`    the bar says: ${await said(page, FILTER_COUNT)}`)
      console.log(`    and refuses:  ${await said(page, FILTER_REFUSAL)}`)
      console.log(
        `    rows drawn:   ${(await drawn(page)).length === 0 ? "none" : "some"}`,
      )
      await shot(page, `refused-${query.replace(/[^a-z0-9]+/gi, "-")}`)
    }
  },

  "a-tag-is-a-filter": async (page) => {
    await shot(page, "before")
    await page.locator('[data-testid="tag"]').filter({ hasText: "#home" }).first().click()
    await page.waitForTimeout(400)
    console.log(`  the address:  ${new URL(page.url()).search}`)
    console.log(`  the box holds: ${await page.locator(FILTER_INPUT).inputValue()}`)
    console.log(`  the bar says: ${await said(page, FILTER_COUNT)}`)
    console.log(await drawn(page))
    await shot(page, "filtered-by-the-tag")
  },

  /**
   * The same box on the three pages that ignored it until `search-everywhere`:
   * a day, the agenda, and the trash.
   *
   * The shots are the half a transcript cannot show — that these are the SAME
   * bar over pages made of different things — and the listings are the half a
   * screenshot cannot: which rows the query selected, and on the trash which
   * ones are the scaffold that leads to one.
   */
  "filter-every-page": async (page) => {
    await page.goto(`${BASE}/d/2026-08-10`)
    await page.locator(DAY_PAGE).first().waitFor()
    await page.waitForTimeout(400)
    console.log(`  the day whole:\n${await listed(page, DAY_PAGE)}`)
    await shot(page, "day-unfiltered")
    await narrow(page, "cabinets")
    // A day's rows are flat and already carry their ancestry, so there is
    // nothing to keep as context: what is left is exactly what matched — and
    // the other outline's heading goes with its row.
    console.log(`  filtered by "cabinets":\n${await listed(page, DAY_PAGE)}`)
    console.log(`  the bar says: ${await said(page, FILTER_COUNT)}`)
    console.log(`  the address:  ${new URL(page.url()).pathname}${new URL(page.url()).search}`)
    await shot(page, "day-filtered")

    await page.goto(`${BASE}/agenda`)
    await page.locator(AGENDA_PAGE).first().waitFor()
    await page.waitForTimeout(400)
    console.log(`  the agenda whole:\n${await listed(page, AGENDA_PAGE)}`)
    await shot(page, "agenda-unfiltered")
    console.log(`  the entry beside it: ${await owed(page)}`)
    // A query nothing on the page answers: the sections go, the page does NOT
    // say "Nothing is due." (that is a claim about the agenda, where "no
    // matches" is a claim about the query) — and the mark in the column does
    // not move, because a filter is a question about the open page and what is
    // late is a fact about the directory.
    await narrow(page, "bathroom")
    console.log(`  filtered by "bathroom":\n${await listed(page, AGENDA_PAGE)}`)
    console.log(`  the bar says: ${await said(page, FILTER_COUNT)}`)
    console.log(`  the page says: ${await said(page, '[data-testid="agenda-empty"]')}`)
    console.log(`  the entry still: ${await owed(page)}`)
    await shot(page, "agenda-filtered")

    // The trash needs something in it first — and it is the page the archive
    // rule had to except: a query normally leaves what was put away alone.
    await opened(page, "/house.olai", OUTLINE_TREE)
    await putAway(page, "install")
    await opened(page, "/trash", TRASH_PAGE)
    console.log(`  what was put away:\n${await piled(page)}`)
    await shot(page, "trash-unfiltered")
    await narrow(page, "hinges")
    console.log(`  filtered by "hinges" — * is a match, the rest is the scaffold:`)
    console.log(await piled(page))
    console.log(`  the bar says: ${await said(page, FILTER_COUNT)}`)
    await shot(page, "trash-filtered")
  },

  /**
   * The 2026-08-17 ruling, page by page: what is put away is drawn on the
   * TRASH and nowhere else.
   *
   * `order the new cabinets` is `doing`, dated the 10th, and the one late thing
   * in this vault — so one Move to Trash is enough to empty the agenda, take
   * the row off its day, and quieten the mark in the directory column. The
   * shots are the half a transcript cannot show (an agenda that says "Nothing
   * is due." where a row was, with the entry beside it no longer on fire); the
   * listings are the half a screenshot cannot (that the record is in the
   * archive, with its date and its mark still on it, and that `is:trashed`
   * still finds it from a page drawing none of the archive).
   */
  "archived-only-in-trash": async (page) => {
    await opened(page, "/agenda", AGENDA_PAGE)
    console.log(`  what is owed:\n${await listed(page, AGENDA_PAGE)}`)
    console.log(`  the entry beside it: ${await owed(page)}`)
    await shot(page, "agenda-before")

    await opened(page, "/d/2026-08-10", DAY_PAGE)
    console.log(`  the 10th:\n${await listed(page, DAY_PAGE)}`)
    await shot(page, "day-before")

    // The gesture a person makes: the row's own menu, and the confirm that
    // names how many rows go with it. Spelled out rather than through
    // `putAway`, for the one thing that helper cannot do — photograph the
    // question between the two presses.
    await opened(page, "/house.olai", OUTLINE_TREE)
    await openMenu(page, "order")
    await page.locator(TRASH_VERB).first().click()
    await shot(page, "the-confirm-names-what-goes")
    await page.locator(TRASH_VERB).first().click()
    await page.waitForTimeout(SETTLE)
    console.log(`  the record now reads: ${recordOf("order")}`)

    await opened(page, "/agenda", AGENDA_PAGE)
    console.log(`  what is owed now:\n${await listed(page, AGENDA_PAGE)}`)
    console.log(`  the page says: ${await said(page, '[data-testid="agenda-empty"]')}`)
    console.log(`  the entry beside it: ${await owed(page)}`)
    await shot(page, "agenda-after")

    await opened(page, "/d/2026-08-10", DAY_PAGE)
    console.log(`  the 10th now:\n${await listed(page, DAY_PAGE)}`)
    // Nothing archived is on this page for a query to find, which is the rule
    // said from the filter's side: the box narrows the page rather than
    // re-asking its question.
    await narrow(page, "is:trashed")
    console.log(`  filtered by "is:trashed": ${await said(page, FILTER_COUNT)}`)
    await shot(page, "day-after")

    await opened(page, "/trash", TRASH_PAGE)
    console.log(`  and the one page that draws it:\n${await piled(page)}`)
    await shot(page, "trash-holds-it")

    // The other half of the ruling: what went is the DEFAULT presence, never
    // the way to ask. The header's box is the same matcher, from any page.
    await page.keyboard.press("Control+k")
    await page.locator(PALETTE_INPUT).first().waitFor()
    await page.locator(PALETTE_INPUT).first().fill("is:trashed")
    await page.waitForTimeout(SETTLE)
    console.log(`  \`is:trashed\` still answers with:`)
    const hits = await page.locator(PALETTE_HIT).allInnerTexts()
    console.log(hits.map((one) => `    ${oneLine(one)}`).join("\n") || "    (nothing)")
    await shot(page, "is-archived-still-finds-it")
  },

  "a-fold-does-not-hide-a-match": async (page) => {
    // Folds are SUSPENDED while a filter is on: a collapse is a claim about the
    // tree the reader was reading, and honouring it inside a filtered tree would
    // hide the match the filter was typed to find. Nothing is written — clearing
    // the filter brings the fold back.
    await page.locator(`${row("install")} [data-testid="toggle"]`).first().click()
    await page.waitForTimeout(400)
    console.log(`  collapsed \`install\`:\n${await drawn(page)}`)
    await shot(page, "collapsed")
    await narrow(page, "hinges")
    console.log(`  filtered by "hinges", with that fold still remembered:`)
    console.log(await drawn(page))
    await shot(page, "match-is-drawn")
    await narrow(page, "")
    console.log(`  filter cleared — the fold is exactly where it was:`)
    console.log(await drawn(page))
    await shot(page, "fold-came-back")
  },

  "drag-to-reorder": async (page) => {
    console.log(`  before: ${await order(page)}`)
    await shot(page, "outline")
    const above = await boxOf(page.locator(title("handles")))
    await carry(page, handle("knobs"), above.x + 4, above.y - 2)
    console.log(`  the line promises: ${await promised(page)}`)
    await shot(page, "dragging")
    await page.mouse.up()
    await page.waitForTimeout(SETTLE)
    console.log(`  after:  ${await order(page)}`)
    await shot(page, "dropped")
  },

  "drag-into-a-branch": async (page) => {
    const under = await boxOf(page.locator(title("order")))
    await carry(page, handle("install"), under.x + 40, under.y + under.height + 2)
    console.log(`  the line promises: ${await promised(page)}`)
    await shot(page, "dragging")
    await page.mouse.up()
    await page.waitForTimeout(SETTLE)
    console.log(`  install sits under ${await parentOf(page, "install")}, and took its children:`)
    console.log(`    handles under ${await parentOf(page, "handles")}`)
    await shot(page, "reparented")
  },

  "a-mirror-is-not-a-parent": async (page) => {
    // The drawn tree is not the placement tree: a placement has no children of
    // its own, so it is a line to drop BESIDE and never one to drop INTO.
    const box = await boxOf(page.locator(title("kitchen-herbs")))
    await carry(page, handle("knobs"), box.x + box.width, box.y + box.height + 2)
    console.log(`  held as far in as it goes: ${await promised(page)}`)
    await shot(page, "far-inside-a-mirror")
    await page.mouse.up()
    await page.waitForTimeout(SETTLE)
    console.log(`  knobs sits under ${await parentOf(page, "knobs")}`)
    await shot(page, "beside-it")
  },

  "pick-a-run": async (page) => {
    await pick(page, "handles", "knobs")
    console.log(`  picked: ${await picked(page)}`)
    await shot(page, "picked")
    await page.keyboard.press("Control+Enter")
    await page.waitForTimeout(SETTLE)
    for (const id of ["handles", "hinges", "knobs"]) {
      console.log(`  ${id}: ${await page.locator(row(id)).first().getAttribute("data-status")}`)
    }
    await shot(page, "bulk-complete")
  },

  "bulk-indent": async (page) => {
    await pick(page, "hinges", "knobs")
    await page.keyboard.press("Tab")
    await page.waitForTimeout(SETTLE)
    console.log(`  hinges under ${await parentOf(page, "hinges")}, knobs under ${
      await parentOf(page, "knobs")
    }`)
    await shot(page, "indented")
    await page.keyboard.press("Shift+Tab")
    await page.waitForTimeout(SETTLE)
    console.log(`  and out again: hinges under ${await parentOf(page, "hinges")}, knobs under ${
      await parentOf(page, "knobs")
    }`)
    console.log(`  order: ${await order(page)}`)
    await shot(page, "outdented")
  },

  "bulk-move": async (page) => {
    await pick(page, "hinges", "knobs")
    console.log(`  before: ${await order(page)}`)
    await page.keyboard.press("Alt+Shift+ArrowUp")
    await page.waitForTimeout(SETTLE)
    console.log(`  after:  ${await order(page)}`)
    await shot(page, "moved")
  },

  "drag-a-pick": async (page) => {
    await pick(page, "hinges", "knobs")
    console.log(`  picked: ${await picked(page)}`)
    const front = await boxOf(page.locator(title("handles")))
    await carry(page, handle("knobs"), front.x + 4, front.y - 2)
    console.log(`  in the air: ${await page.locator('[data-carried="true"]').count()}`)
    console.log(`  the line promises: ${await promised(page)}`)
    await shot(page, "dragging")
    await page.mouse.up()
    await page.waitForTimeout(SETTLE)
    console.log(`  order: ${await order(page)}`)
    await shot(page, "dropped")
  },

  /**
   * A ROW PICKED UP IN ONE PANE AND PUT DOWN IN THE OTHER, with both panes
   * showing the same file — so the drop is watched from both ends at once.
   *
   * The gap above `demo` is chosen because it is the one gap in this outline
   * whose depth the pointer cannot get wrong: the row above is `kitchen` and
   * the row below is its first child, so "one inside the row above" and "level
   * with the row below" are the same answer. What the shot is about is that
   * the line is drawn over the OTHER column, promising a landing there.
   */
  "drag-across-panes": async (page) => {
    await splitOn(page, "/s/house.olai/house.olai")
    console.log(`  two panes, one file. before: ${await order(page)}`)
    await shot(page, "two-panes-on-one-file")

    const above = await boxOf(page.locator(titleIn(1, "demo")))
    await carry(page, handleIn(0, "knobs"), above.x + 4, above.y - 2)
    console.log(`  picked up in pane 0, held in pane 1 — the line promises: ${await promised(page)}`)
    await shot(page, "carried-into-the-other-pane")
    // ...and a close-up of the two panes at the gap, because the line is two
    // pixels tall and the row it left is a fade: both are lost in a shot of a
    // whole workspace, and they are the whole of what this section is about.
    const line = await boxOf(page.locator('[data-testid="drop-line"]'))
    await shot(page, "the-line-over-the-other-pane", {
      clip: { x: 260, y: Math.max(0, line.y - 120), width: 840, height: 260 },
    })

    await page.mouse.up()
    await page.waitForTimeout(SETTLE)
    console.log(`  knobs now sits under ${await parentOf(page, "knobs")} — in both panes, off one write`)
    console.log(`  and the file says:     ${recordOf("knobs")}`)
    await shot(page, "landed-and-both-panes-agree")
  },

  /**
   * THE SAME GESTURE AIMED AT ANOTHER FILE, which is the drag's other answer.
   *
   * Every outline is an independent tree, so a parent is always in the same
   * file — there is no `place` that expresses this and no `move_node` that
   * would take it. The shot is the half a transcript cannot show: the pane
   * under the pointer says so while the hand is still holding the row, and
   * there is no drop line beside it offering a landing it could not keep.
   */
  "a-drop-into-another-file-is-refused": async (page) => {
    await splitOn(page, "/s/house.olai/garden.olai")
    await shot(page, "two-panes-two-files")

    const over = await boxOf(page.locator(titleIn(1, "mint")))
    await carry(page, handleIn(0, "knobs"), over.x + over.width / 2, over.y + over.height / 2)
    console.log(`  the pane says:      ${await textOf(page, DROP_REFUSED)}`)
    console.log(`  drop lines drawn:   ${await page.locator('[data-testid="drop-line"]').count()}`)
    await shot(page, "refused-under-the-pointer")

    await page.mouse.up()
    await page.waitForTimeout(SETTLE)
    console.log(`  after letting go, the bar says: ${await textOf(page, SELECTION_SAID)}`)
    console.log(`  and the file is untouched:     ${recordOf("knobs")}`)
    await shot(page, "refused-and-nothing-moved")
  },

  "trash": async (page) => {
    await pick(page, "install")
    await page.locator('[data-testid="selection-trash"]').click()
    await page.waitForTimeout(300)
    console.log(
      `  it asks: ${await page.locator('[data-testid="selection-confirm"]').textContent()}`,
    )
    await shot(page, "asks")
    await page.locator('[data-testid="selection-trash"]').click()
    await page.waitForTimeout(SETTLE)
    console.log(`  order: ${await order(page)}`)
    await shot(page, "trashed")
    await page.goto(`${BASE}/trash`)
    await page.locator('[data-testid="trash-page"]').waitFor()
    await page.waitForTimeout(600)
    await shot(page, "in-the-trash")
  },

  "from-the-caret": async (page) => {
    await page.locator(title("handles")).click()
    await page.waitForTimeout(300)
    await page.keyboard.press("Shift+ArrowDown")
    await page.waitForTimeout(400)
    console.log(`  after Shift+ArrowDown: ${await picked(page)} picked`)
    await shot(page, "shift-arrow")
    await page.keyboard.press("Control+a")
    await page.waitForTimeout(400)
    console.log(`  after Ctrl+A: ${await picked(page)} picked`)
    await shot(page, "ctrl-a")
    await page.keyboard.press("Escape")
    await page.waitForTimeout(300)
    console.log(`  after Escape: bar drawn ${await page.locator('[data-testid="selection-bar"]').count()} times`)
  },

  "refused": async (page) => {
    await pick(page, "handles")
    await page.keyboard.press("Tab")
    await page.waitForTimeout(SETTLE)
    console.log(`  it says: ${await page.locator('[data-testid="selection-said"]').textContent()}`)
    console.log(`  order is untouched: ${await order(page)}`)
    await shot(page, "refused")
  },

  // ── the three deferrals #159 named ───────────────────────────────────
  //
  // Drag-across, the page keeping up with a gesture, and a finger picking a row
  // up. Each section drives ONE of them end to end and prints what the page
  // says at the moment it is still a prediction.

  "drag-across": async (page) => {
    // The rail beside a branch: scaffolding, holding no words, so a press there
    // is about the rows rather than about the text.
    const from = await rail(page, "demo")
    const to = await boxOf(page.locator(title("install")))
    // The BAR, not what it says: a page with nothing picked draws none at all,
    // so this is "how many bars" rather than "how many rows".
    console.log(`  before: ${await page.locator(SELECTION_BAR).count()} bars drawn`)
    await page.mouse.move(from.x, from.y)
    await page.mouse.down()
    await page.mouse.move(from.x, to.y + to.height / 2, { steps: 14 })
    await page.waitForTimeout(200)
    console.log(`  the band is crossing: ${await band(page)} rows`)
    console.log(`  picked while pulling: ${await picked(page)}`)
    await shot(page, "sweeping")
    await page.mouse.up()
    await page.waitForTimeout(400)
    console.log(`  picked after letting go: ${await picked(page)}`)
    await shot(page, "picked")

    // The other half of the rule, and the thing that would have been LOST: a
    // pull begun IN the words is still the browser's own text selection.
    await page.keyboard.press("Escape")
    const words = await boxOf(page.locator(title("order")))
    await page.mouse.move(words.x + 4, words.y + words.height / 2)
    await page.mouse.down()
    await page.mouse.move(words.x + words.width - 4, words.y + words.height * 3, { steps: 12 })
    await page.waitForTimeout(200)
    console.log(
      `  a pull in the words selects: "${
        await page.evaluate(() => window.getSelection()?.toString() ?? "")
      }"`,
    )
    console.log(`  ...and draws no band: ${await page.locator(SWEEP_BAND).count()}`)
    await shot(page, "text-not-rows")
    await page.mouse.up()
  },

  "the-page-keeps-up": async (page) => {
    await short(page, 1_100, 320)
    console.log(`  room: ${await room(page)}`)
    console.log(`  at: ${await page.evaluate(() => window.scrollY)}`)
    await shot(page, "at-the-top")
    const box = await boxOf(page.locator(handle("demo")))
    await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2)
    await page.mouse.down()
    await atTheEdge(page, box.x + 40)
    console.log(`  held at the bottom edge, the page is at: ${
      await page.evaluate(() => window.scrollY)
    }`)
    // The last row of the file, which was below the fold when the press
    // landed: the gesture reaches it only because the page came to it.
    console.log(`  the line promises: ${await promised(page)}`)
    await shot(page, "scrolled")
    await page.mouse.up()
    await page.waitForTimeout(SETTLE)
    console.log(`  order: ${await order(page)}`)
    await shot(page, "dropped")
  },

  "a-sweep-keeps-up": async (page) => {
    await short(page, 1_100, 320)
    console.log(`  room: ${await room(page)}`)
    const from = await rail(page, "demo")
    await page.mouse.move(from.x, from.y)
    await page.mouse.down()
    await atTheEdge(page, from.x)
    console.log(`  the page is at: ${await page.evaluate(() => window.scrollY)}`)
    console.log(`  the band is crossing: ${await band(page)} rows`)
    console.log(`  picked: ${await picked(page)}`)
    await shot(page, "swept-past-the-fold")
    await page.mouse.up()
  },

  "a-finger-picks-a-row-up": async (page) => {
    const touch = await page.context().newCDPSession(page)
    const finger = (type: string, at?: { x: number; y: number }) =>
      touch.send("Input.dispatchTouchEvent" as never, {
        type,
        touchPoints: at === undefined ? [] : [at],
      } as never)

    console.log(`  room: ${await room(page)}`)

    // The gesture itself: hold, and the row lifts where it is.
    const knobs = await boxOf(page.locator(handle("knobs")))
    const at = { x: knobs.x + knobs.width / 2, y: knobs.y + knobs.height / 2 }
    await finger("touchStart", at)
    await page.waitForTimeout(800)
    console.log(`  after holding it: in the air ${
      await page.locator('[data-carried="true"]').count()
    }, menu panels ${await page.locator('[data-testid="node-menu-panel"]').count()}`)
    await shot(page, "lifted")
    const above = await boxOf(page.locator(title("handles")))
    for (let step = 1; step <= 8; step++) {
      await finger("touchMove", {
        x: at.x + ((above.x + 4 - at.x) * step) / 8,
        y: at.y + ((above.y - 2 - at.y) * step) / 8,
      })
      await page.waitForTimeout(30)
    }
    await page.waitForTimeout(200)
    console.log(`  the line promises: ${await promised(page)}`)
    await shot(page, "dragging")
    await finger("touchEnd")
    await page.waitForTimeout(SETTLE)
    console.log(`  order: ${await order(page)}`)
    console.log(`  the address is still: ${new URL(page.url()).pathname}`)
    await shot(page, "dropped")

    // And the menu still has its door: hold the ROW rather than the bullet.
    await page.locator(`${row("kitchen")} [data-testid="node-gutter"]`).first()
      .waitFor()
    const line = await boxOf(
      page.locator(`${row("kitchen")} [data-testid="node-gutter"]`).first(),
    )
    await finger("touchStart", { x: line.x + line.width / 2, y: line.y + line.height / 2 })
    await page.waitForTimeout(800)
    await finger("touchEnd")
    await page.waitForTimeout(400)
    console.log(`  holding the ROW still opens the menu: ${
      await page.locator('[data-testid="node-menu-panel"]').count()
    }`)
    await shot(page, "the-menu-still-opens")

    // And the promise the whole design rests on, LAST because it is the one
    // gesture that leaves the page somewhere else: a flick that STARTS on the
    // handle still scrolls, and lifts nothing. Claiming the cell with
    // `touch-action: none` would have passed everything above and left a 28px
    // dead strip down the left of every outline.
    await page.keyboard.press("Escape")
    // A screen with somewhere to scroll TO, which this outline does not give a
    // 620pt handset: the same shape a phone with its keyboard up has, and the
    // one the suite's own scroll fence uses.
    await short(page, 390, 400)
    await page.evaluate(() => window.scrollTo(0, 0))
    await page.waitForTimeout(400)
    console.log(`  room for a flick: ${await room(page)}`)
    const flick = await boxOf(page.locator(handle("kitchen")))
    const from = { x: flick.x + flick.width / 2, y: flick.y + flick.height / 2 }
    await finger("touchStart", from)
    for (let step = 1; step <= 10; step++) {
      await page.waitForTimeout(50)
      await finger("touchMove", { x: from.x, y: from.y - 24 * step })
    }
    await finger("touchEnd")
    await page.waitForTimeout(300)
    console.log(`  a flick that STARTS on the bullet scrolls to: ${
      await page.evaluate(() => window.scrollY)
    }`)
    console.log(`  ...and lifts nothing: ${await page.locator('[data-carried="true"]').count()}`)
    await shot(page, "a-flick-still-scrolls")
  },

  // ── writing a node's edges, and starting an outline ──────────────────
  //
  // `editor-op-parity`'s last three children. Each section drives ONE of the
  // affordances end to end and prints the RECORD afterwards, because what these
  // gestures claim is that they reached a file through the ops layer.

  "see-from-the-menu": async (page) => {
    await openMenu(page, "handles")
    await shot(page, "menu")
    await page.locator('[data-testid="node-menu-item"]')
      .filter({ hasText: "Link to a node…" }).first().click()
    await page.locator(EDGE_PANEL).first().waitFor()
    await shot(page, "panel")
    await page.locator(EDGE_SEARCH).fill("compost")
    await page.locator(EDGE_HIT).first().waitFor()
    await page.waitForTimeout(300)
    await shot(page, "search")
    await page.locator(EDGE_HIT).first().click()
    await page.waitForTimeout(SETTLE)
    console.log(`  the record: ${recordOf("handles")}`)
    await shot(page, "linked")
    // …and the panel now lists it, with the `×` that takes it off again.
    await page.locator(`${EDGE_DROP}[data-ref="compost"]`).first().click()
    await page.waitForTimeout(SETTLE)
    console.log(`  after the ×: ${recordOf("handles")}`)
    await shot(page, "unlinked")
  },

  /**
   * WHAT A REBUILT LIST COSTS (`the-caret-holds-the-cross`): the caret on an
   * edge panel's `×` while somebody else writes to the same file.
   *
   * The whole of `reactivity-for-by-reference` is invisible in a still frame by
   * construction — a list torn down and drawn again is drawn with the same tags
   * and the same words as one that was patched. This is the one place the cost
   * surfaces as something a person can see: the panel's chips ride on the
   * page's reading, so a frame arriving replaced them, and a reader who had
   * tabbed onto an `×` to take a link off lost the caret to the document body
   * for a write they did not make.
   *
   * So the section prints `document.activeElement` on either side of a write
   * made ON DISK, which is the same door `pin-to-sidebar`'s rename uses and for
   * its reason: an agent's `set_title`, a `git pull`, another tab — anything at
   * all, which is the point.
   */
  "the-caret-holds-the-cross": async (page) => {
    await openMenu(page, "order")
    await page.locator('[data-testid="node-menu-item"]')
      .filter({ hasText: "Link to a node…" }).first().click()
    await page.locator(EDGE_PANEL).first().waitFor()
    await page.locator(`${EDGE_DROP}[data-ref="herbs"]`).first().focus()
    await page.waitForTimeout(DRAWN)
    console.log(`  the caret is on:      ${await focused(page)}`)
    await shot(page, "the-caret-on-the-cross")

    // Somebody else, writing — another row of the same file, retitled.
    retitle("house.olai", "handles", "choose the handles today")
    await page.waitForFunction(
      () => document.body.textContent?.includes("choose the handles today") === true,
    )
    await page.waitForTimeout(SETTLE)
    console.log(`  after somebody wrote: ${await focused(page)}`)
    await shot(page, "and-it-is-still-there")
  },

  "after-and-the-loop": async (page) => {
    await openMenu(page, "knobs")
    await page.locator('[data-testid="node-menu-item"]')
      .filter({ hasText: "Wait for a node…" }).first().click()
    await page.locator(EDGE_PANEL).first().waitFor()
    await page.locator(EDGE_SEARCH).fill("order the new cabinets")
    await page.locator(EDGE_HIT).first().waitFor()
    await page.waitForTimeout(300)
    await shot(page, "search")
    await page.locator(EDGE_HIT).first().click()
    await page.waitForTimeout(SETTLE)
    console.log(`  the record: ${recordOf("knobs")}`)
    console.log(
      `  the row is blocked by: ${
        await page.locator(row("knobs")).first().getAttribute("data-blocked")
      }`,
    )
    await shot(page, "declared")

    // The refusal, verbatim: `order` already comes after `install`.
    await page.goto(`${BASE}/#order`)
    await page.locator('[data-testid="zoom-title"]').waitFor()
    await page.locator(`${EDGE_VERB}[data-relation="after"]`).click()
    await page.locator(EDGE_SEARCH).fill("install the cabinets")
    await page.locator(EDGE_HIT).first().waitFor()
    await page.waitForTimeout(300)
    await page.locator(EDGE_HIT).first().click()
    await page.locator(EDGE_SAID).waitFor()
    console.log(`  it says: ${await page.locator(EDGE_SAID).textContent()}`)
    console.log(`  untouched: ${recordOf("order")}`)
    await shot(page, "loop-refused")
  },

  "edges-on-a-zoomed-node": async (page) => {
    // `hinges` DECLARES two and is IN THE WAY of one — `handles` carries no
    // mark, so it is not work and never blocks. Two rows, two claims, and only
    // the declared one carries an `×`.
    await page.goto(`${BASE}/#hinges`)
    await page.locator('[data-testid="zoom-title"]').waitFor()
    await page.waitForTimeout(600)
    console.log(`  blocked by: ${await textOf(page, '[data-testid="blocked"]')}`)
    console.log(`  after:      ${await textOf(page, '[data-testid="after-refs"]')}`)
    await shot(page, "declared-and-derived")
    await page.locator('[data-testid="after-refs"] [data-testid="ref-drop"][data-ref="order"]')
      .first().click()
    await page.waitForTimeout(SETTLE)
    console.log(`  after the ×: ${recordOf("hinges")}`)
    await shot(page, "dropped")
  },

  /**
   * THE MOVE-TO PICKER (`move-to-picker`): the move no key could make — a
   * destination searched for across the whole set, and the row carried under
   * it with everything beneath it.
   *
   * Three pictures, which are the three things the item asked to be shown: the
   * picker open on fuzzy results, the row in its new home, and the cross-file
   * REFUSAL — said at the aim, before Enter, so what the shot holds is a
   * sentence a person reads while deciding rather than one they get afterwards.
   *
   * The caret's door is the one photographed (⌘⇧M in the row's own editor),
   * because that is the gesture the item is about; the `•••`'s `Move to…` opens
   * the identical panel and is a scenario rather than a shot.
   */
  "move-to-picker": async (page) => {
    /** The three pictures, made once per palette — every one of them is drawn
     *  in theme tokens, and the refusal's alarm ink most of all. A ROW per
     *  pass, because the middle one is a WRITE and a row that has already
     *  moved cannot move there again. */
    const pass = async (dark: boolean, moving: string, to: string) => {
      const suffix = dark ? "-dark" : ""
      // ONE BROAD QUERY for all three, because the whole list is the claim:
      // `the` is in six titles across two outlines, so what is drawn is legal
      // destinations and refused ones together — the refused ones dimmed where
      // a reader can see them rather than dropped where nobody can.
      await pickerOn(page, moving)
      await page.locator(MOVE_SEARCH).fill("the")
      await page.locator(MOVE_HIT).first().waitFor()
      await page.waitForTimeout(400)
      console.log(`  open on:            ${await page.locator(MOVE_PICKER).getAttribute("data-row")}`)
      console.log(`  destinations drawn: ${await page.locator(MOVE_HIT).count()}`)
      console.log(
        `  …of which refused:  ${await page.locator(`${MOVE_PICKER} li[data-refused]`).count()}`,
      )
      console.log(`  ${moving} sits at: ${recordOf(moving)}`)
      await shot(page, `open-on-a-row${suffix}`)

      // THE CROSS-FILE REFUSAL, at the AIM: the cursor is walked onto a row of
      // the other outline and the reason is on screen before anything is
      // pressed — the shape a drop over the wrong pane already has (#238).
      await page.locator(MOVE_HIT).filter({ hasText: "the compost heap" }).first().hover()
      await page.waitForTimeout(200)
      console.log(`  it refuses:         ${await textOf(page, MOVE_REFUSED)}`)
      await shot(page, `another-outline-refused${suffix}`)

      // …and one that CAN take it, found by narrowing the same box — which is
      // what a person does with a list of eight and is the only way to reach a
      // hit the cap left out (`../web/src/client/search/nodes.ts` asks for
      // eight: this is a modal over a page, not a report).
      await page.locator(MOVE_SEARCH).fill(to)
      await page.locator(MOVE_HIT).filter({ hasText: to }).first().waitFor()
      await page.waitForTimeout(300)
      await page.locator(MOVE_HIT).filter({ hasText: to }).first().click()
      await page.waitForTimeout(SETTLE)
      console.log(`  after the press:    ${recordOf(moving)}`)
      console.log(`  the panel is gone:  ${(await page.locator(MOVE_SEARCH).count()) === 0}`)
      // The guard, so this shot cannot be a picture of a write that did not
      // land: the row is still in `house.olai` — what moved is where it SITS,
      // which the record line above says.
      shotSays(moving, "house.olai")
      await shot(page, `moved-into-its-new-home${suffix}`)
    }

    await pass(false, "hinges", "order the new cabinets")
    await wearTheme(page, "pitch")
    await pass(true, "handles", "take out the old counters")

    // THE REFUSAL THAT NAMES A CHAIN, which is the one worth looking at rather
    // than only asserting: a Now section is mirrors of live work, so `Now`
    // DRAWS the item its placement points at — and a destination three
    // branches away on screen is "inside" this row for a reason no other
    // sentence in the panel has to explain. Written by another hand, because
    // the fixture has no same-file placement of its own (found by review of
    // this PR; `move_to_picker.feature` pins the words).
    rewrite("house.olai", [
      `{"id":"now","ord":"a0","title":"Now"}`,
      `{"id":"now-install","parent":"now","ord":"a0","mirror":"install"}`,
      `{"id":"kitchen","ord":"a1","title":"kitchen remodel #home","doing":"2026-08-01"}`,
      `{"id":"install","parent":"kitchen","ord":"a0","title":"install the cabinets"}`,
      `{"id":"handles","parent":"install","ord":"a0","title":"choose the handles"}`,
    ])
    await opened(page, "/house.olai", OUTLINE_TREE)
    await pickerOn(page, "now")
    await page.locator(MOVE_SEARCH).fill("install the cabinets")
    await page.locator(MOVE_HIT).first().waitFor()
    await page.waitForTimeout(300)
    console.log(`  drawn-inside says:  ${await textOf(page, MOVE_REFUSED)}`)
    console.log(`  and it is untouched:  ${recordOf("now")}`)
    await shot(page, "drawn-inside-refused-dark")
    await wearTheme(page, "chalk")
    await pickerOn(page, "now")
    await page.locator(MOVE_SEARCH).fill("install the cabinets")
    await page.locator(MOVE_HIT).first().waitFor()
    await page.waitForTimeout(300)
    await shot(page, "drawn-inside-refused")
  },

  /**
   * A DOCUMENT IS A ROW IN THE BOX — the ⌘K row of the `.olai`/`.md` parity
   * table, which said "zero document rows: no open, no create, no capture".
   *
   * Photographed at BOTH DOORS, because that is the claim: the ⌘K palette and
   * the header's box are one reading, and a file found in one and not the
   * other would be the drift they are one reading against. And in BOTH
   * PALETTES, light and dark, because the row draws a glyph in the theme's own
   * ink beside a place line in its muted one — a face that reads in exactly one
   * of them is a face nobody checked.
   *
   * What is NOT here is as much of the point: no create row (the palette has
   * never had one, for an outline either), and nothing matched out of a body —
   * the query is `pal`, which is what the FILE is called.
   */
  "documents-in-the-palette": async (page) => {
    pinnedBy(
      "documents.feature",
      "The ⌘K palette opens a document by name",
      "The header's box finds the same document, drawn the same way",
    )
    const pass = async (dark: boolean) => {
      const suffix = dark ? "-dark" : ""
      await opened(page, "/house.olai", OUTLINE_TREE)

      // THE PALETTE, on a query that is the start of a file's NAME rather than
      // of its path: `notes/palette.md` is what `pal` means to a person.
      await page.keyboard.press("ControlOrMeta+k")
      await page.locator(PALETTE_INPUT).waitFor()
      await page.locator(PALETTE_INPUT).fill("pal")
      await page.locator(PALETTE_DOC).first().waitFor()
      await page.waitForTimeout(400)
      console.log(`  documents drawn:    ${await page.locator(PALETTE_DOC).count()}`)
      console.log(
        `  the first one:      ${await page.locator(PALETTE_DOC).first().getAttribute("data-id")}`,
      )
      await shot(page, `the-palette-matches-a-document${suffix}`)

      // …and the row OPENS it: the same page the sidebar's row opens, at the
      // address the router has served all along.
      await page.locator(PALETTE_DOC).first().click()
      await page.locator(DOCUMENT_PAGE).first().waitFor()
      await page.waitForTimeout(SETTLE)
      console.log(`  the address:        ${new URL(page.url()).pathname}`)
      await shot(page, `the-document-opens${suffix}`)

      // THE OTHER DOOR, over the same query and drawing the same row.
      const box = page.locator(HEADER_SEARCH)
      await box.click()
      await box.fill("pal")
      await page.locator(HEADER_DOC).first().waitFor()
      await page.waitForTimeout(400)
      console.log(
        `  the header box too: ${await page.locator(HEADER_DOC).first().getAttribute("data-id")}`,
      )
      await shot(page, `the-header-box-matches${suffix}`)
    }

    await pass(false)

    // BOTH BODIED KINDS in one list, which is the row set being the registry's
    // answer rather than a suffix somebody typed: `a` is inside `palette.md`
    // and inside `quarter.html`, and the two are drawn with the two glyphs the
    // sidebar gives them. Once, in the light pass — the pair above is what has
    // to be checked in either palette; this is a fact about the SET.
    await opened(page, "/house.olai", OUTLINE_TREE)
    await page.keyboard.press("ControlOrMeta+k")
    await page.locator(PALETTE_INPUT).waitFor()
    await page.locator(PALETTE_INPUT).fill("a")
    await page.locator(PALETTE_DOC).first().waitFor()
    // `a` is a broad query, so the commands it also matches fill the box above
    // them — which is the block ORDER working, and means the shot has to be
    // taken where the block is. The list scrolls under a fixed input, so this
    // is a picture of the same palette a little further down.
    await page.locator(PALETTE_DOC).last().scrollIntoViewIfNeeded()
    await page.waitForTimeout(400)
    const matched = await page.locator(PALETTE_DOC).evaluateAll((rows) =>
      rows.map((row) => row.getAttribute("data-id"))
    )
    console.log(`  “a” matches:        ${matched.join(", ")}`)
    await shot(page, "a-document-and-a-saved-page")
    await page.keyboard.press("Escape")

    await wearTheme(page, "pitch")
    await pass(true)
    await wearTheme(page, "chalk")
  },

  /**
   * FRONTMATTER IS A RECORD (`frontmatter-is-a-record`): the `---` block at the
   * top of a `.md`, off the page and answering `prop:`.
   *
   * The two documents it writes are THREE IDENTICAL LINES, and the only
   * difference between them is which line the first `---` sits on. That is the
   * whole boundary rule, and it is also the before/after: `almost.md`'s block
   * is not frontmatter — it opens on line two — so the app draws it exactly as
   * every frontmatter'd document was drawn before this section existed, a
   * thematic break and a phantom `<h2>` with an anchor and a row in the
   * contents. `plan.md` is the same three lines one line up.
   *
   * WRITTEN HERE rather than taken from `fixtures/good`, so this section runs
   * unchanged against a checkout that has none of this — which is what makes
   * the pair of runs a before and an after rather than two pictures.
   */
  "frontmatter-is-a-record": async (page) => {
    pinnedBy(
      "documents.feature",
      "A document's frontmatter is the page's run, not its prose",
      "A document is found by a property its frontmatter writes",
    )
    const BLOCK = [
      "---",
      "agent: claude-opus",
      "owners: [alice, bob]",
      "date: 2026-09-01",
      "tags: '#draft'",
      "---",
    ]
    const PROSE = [
      "",
      "# The kitchen plan",
      "",
      "Oak counters, matte doors. Talk to @alice before ordering.",
      "",
      "## Next steps",
      "",
      "Measure the alcove.",
    ]
    rewrite("notes/plan.md", [...BLOCK, ...PROSE])
    // The SAME three lines, one line down — so the first `---` is a thematic
    // break and the second underlines `agent: claude-opus` into a setext
    // heading. Which is what every one of these looked like before.
    rewrite("notes/almost.md", ["", ...BLOCK, ...PROSE])

    /** What the page is CARRYING: the headings it drew, and the contents made
     *  of them. A phantom heading shows up in both. */
    const surveyed = async (): Promise<string> => {
      const drawn = await page.locator(`${DOCUMENT_BODY} h1, ${DOCUMENT_BODY} h2`)
        .allInnerTexts()
      const listed = await page.locator(TOC_LINK).allInnerTexts()
      return `headings [${drawn.map(oneLine).join(" | ")}] contents [${
        listed.map(oneLine).join(" | ")
      }]`
    }

    const pass = async (dark: boolean) => {
      const suffix = dark ? "-dark" : ""

      // THE BLOCK ON LINE TWO — not frontmatter, and drawn as markdown has
      // always drawn it. This is the "before" picture, taken by the same
      // script that takes the one under it.
      await opened(page, "/notes/almost.md", DOCUMENT_PAGE)
      console.log(`  a block on line 2:  ${await surveyed()}`)
      await shot(page, `a-block-that-is-not-frontmatter${suffix}`)

      // …AND ON LINE ONE. Same three lines, and now there is no rule, no
      // phantom heading, no anchor and no contents row: the page opens on the
      // document's own first heading.
      await opened(page, "/notes/plan.md", DOCUMENT_PAGE)
      console.log(`  the same on line 1: ${await surveyed()}`)
      await shot(page, `frontmatter-is-off-the-page${suffix}`)

      // WHAT THE DOCUMENT IS CALLED, in the door that draws a face's title:
      // the body's first real line, not the fence and not the first YAML key.
      const box = page.locator(HEADER_SEARCH)
      await box.click()
      await box.fill("plan")
      const row = page.locator(headerHit("notes/plan.md"))
      await row.waitFor()
      await page.waitForTimeout(400)
      console.log(`  the row is called:  ${oneLine(await row.innerText())}`)
      await shot(page, `the-title-is-the-first-real-line${suffix}`)

      // …AND THE DOOR THIS ITEM IS: a property query, selecting a `.md`. The
      // key it matched leads the row's third line, exactly as it does on a
      // node's.
      await box.fill("prop:agent=claude-opus")
      await page.locator(headerHit("notes/plan.md")).waitFor()
      await page.waitForTimeout(400)
      const rows = await page.locator('[data-testid="header-search-item"]')
        .evaluateAll((all) => all.map((one) => one.getAttribute("data-id")))
      console.log(`  prop: selects:      ${rows.join(", ")}`)
      console.log(
        `  its property line:  ${
          (await page.locator('[data-testid="header-search-item-prop"]').allInnerTexts())
            .map(oneLine).join(" · ")
        }`,
      )
      await shot(page, `a-property-selects-a-document${suffix}`)
      await page.keyboard.press("Escape")
    }

    await pass(false)
    await wearTheme(page, "pitch")
    await pass(true)
    await wearTheme(page, "chalk")
  },

  /**
   * THE DOCUMENT PAGE DRAWS ITS RECORD (`doc-page-props`): the same dim
   * `key value` run a node's own page draws, under the path heading — and
   * the honest absence when the file wrote none.
   *
   * Two files from the good fixture, differing only in whether they open
   * with a `---` block. `notes/palette.md` has one; `finishes.md` does not.
   */
  "doc-page-props": async (page) => {
    pinnedBy(
      "documents.feature",
      "A document's frontmatter is the page's run, not its prose",
      "A document with no frontmatter shows no properties",
    )
    const PROPS = '[data-testid="props"]'
    const pass = async (dark: boolean) => {
      const suffix = dark ? "-dark" : ""

      await opened(page, "/notes/palette.md", DOCUMENT_PAGE)
      await page.locator(PROPS).waitFor()
      console.log(`  with a block:  ${oneLine(await page.locator(PROPS).innerText())}`)
      await shot(page, `the-page-draws-its-properties${suffix}`)

      await opened(page, "/finishes.md", DOCUMENT_PAGE)
      const count = await page.locator(`${DOCUMENT_PAGE} ${PROPS}`).count()
      console.log(`  with none:     ${count} run(s)`)
      await shot(page, `a-page-with-no-properties${suffix}`)
    }

    await pass(false)
    await wearTheme(page, "pitch")
    await pass(true)
    await wearTheme(page, "chalk")
  },

  "new-outline": async (page) => {
    await page.locator('[data-testid="new-outline"]').click()
    const box = page.locator('[data-testid="new-outline-path"]')
    await box.waitFor()
    await shot(page, "box")
    await box.fill("house.olai")
    await box.press("Enter")
    await page.locator('[data-testid="new-outline-said"]').waitFor()
    console.log(
      `  it says: ${await page.locator('[data-testid="new-outline-said"]').textContent()}`,
    )
    await shot(page, "refused")
    await box.fill("plans/next.olai")
    await box.press("Enter")
    await page.waitForTimeout(SETTLE)
    console.log(`  the address: ${new URL(page.url()).pathname}`)
    await shot(page, "minted")
    // …and the first row, typed where the empty outline offers one.
    await page.locator('[data-testid="start-line"]').first().click()
    await page.keyboard.type("buy the tickets")
    await page.keyboard.press("Enter")
    await page.waitForTimeout(SETTLE)
    await shot(page, "first-row")
  },

  /**
   * The `•••` menu's own put-away — `trash_node` from the mouse, which is
   * the half the bulk bar's section above does not show: one row, its own
   * menu, and the question that names how much goes with it.
   *
   * Photographed because the two halves are what a person actually meets: the
   * ENTRY (`Move to Trash`, in the writing half of the menu) and the CONFIRM
   * that replaces the list before anything is written. The count in it is
   * taken from the SET rather than from the rows on screen, which is the one
   * claim about this verb a screenshot can carry — `install the cabinets` has
   * three rows under it here and the sentence says three.
   */
  "move-to-trash-from-the-menu": async (page) => {
    pinnedBy(
      "menu_verbs.feature",
      "Moving to the Trash asks first, and names how much goes with it",
      "The confirm counts what the write moves, not what is on screen",
      "Confirming moves the subtree to the Trash, ids and all",
    )
    // The file BEFORE anything is pressed, so the claim the last two shots make
    // is a move rather than a coincidence.
    shotSays("install", "house.olai")
    await openMenu(page, "install")
    // Printed on BOTH sections, because the claim is a pair and half of it is
    // an ABSENCE: a node's own row is offered the put-away and not the retire,
    // and a mirror row the other way about (`retire-a-placement`). One reader,
    // two transcripts, and neither of them asks anybody to compare two images.
    console.log(`  the menu offers: ${await verbsOf(page)}`)
    await shot(page, "the-entry")
    await page.locator(TRASH_VERB).first().click()
    await page.locator(MENU_CONFIRM).first().waitFor()
    console.log(`  it asks: ${await textOf(page, MENU_CONFIRM)}`)
    await shot(page, "asks")
    await page.locator(TRASH_VERB).first().click()
    await page.waitForTimeout(SETTLE)
    console.log(`  order: ${await order(page)}`)
    console.log(`  the record: ${recordOf("install")}`)
    // The whole claim of the shot below: the row left the page BECAUSE the
    // subtree moved, not because a click found the label and wrote nothing.
    shotSays("install", "_olai/Trash.olai")
    shotSays("knobs", "_olai/Trash.olai")
    await shot(page, "gone-from-the-page")
    await opened(page, "/trash", TRASH_PAGE)
    const pile = await piled(page)
    console.log(`  the pile:\n${pile}`)
    // …and the Trash DRAWS it. The file having moved and the page having drawn
    // it are two claims, and this shot is the second one.
    if (pile.includes("(nothing)")) {
      throw new Error("the Trash drew nothing, and the shot after this says it drew the pile")
    }
    await shot(page, "in-the-trash")
  },

  /**
   * Retiring ONE PLACEMENT — `remove_mirror` from the row it is about, which
   * is the distinction this whole section exists to photograph: the menu on a
   * mirror offers `Remove this placement` and does NOT offer `Move to Trash`,
   * because what a reader is looking at is a line standing for a node that
   * lives somewhere else.
   *
   * Then the op's own fence, quoted where the click happened: `order` is made
   * to name the placement by another hand while the page is open — which is
   * also what makes the refusal about the set as it IS rather than as this tab
   * last drew it — and the retire is refused naming what still points at it.
   * Re-pointing that `see` at the node the placement shows is the way through,
   * and the last two shots are the line going while `herbs` stays exactly
   * where it lives.
   */
  /**
   * A SUBTREE AND ITS COPY, side by side — and then the copy proved to be a
   * node of its own by being written to while the original does not move.
   *
   * The shot a reviewer actually needs is the third one. The first two show
   * what happened; only the third shows what it MEANS, because two identical
   * branches are exactly what a broken duplicate would draw too — a second
   * placement of the same node, or a copy that shared its ids, would sit there
   * looking the same. Retitling one row of the copy is the cheapest gesture
   * that separates them on screen, and the transcript prints both records so
   * the ids are readable beside the picture.
   */
  /**
   * EMPTYING THE TRASH — the app's only delete, photographed in both halves of
   * the palette table because the confirm is the whole feature and the confirm
   * is drawn in theme tokens.
   *
   * FIVE SHOTS PER PASS, and the middle three are the point. A trash with a
   * pile in it, then the QUESTION — which names how many rows go, counted over
   * what the archives hold rather than over what the page is drawing — then the
   * pile still standing after **Cancel**, then the emptied page. The cancel shot
   * is the one a reviewer cannot get anywhere else: a confirm that writes on
   * either button looks exactly like a correct one until somebody presses the
   * wrong half, and the transcript prints the file beside each picture so the
   * claim is the disk's rather than the pixels'.
   *
   * A DIFFERENT ROW PER PASS, which is `move-to-picker`'s arrangement and for
   * its reason: this is a WRITE, and a trash that has already been emptied
   * cannot be emptied again. The theme is set before the pass rather than
   * between shots, so every frame in a pass is painted by the boot script the
   * way a person's browser paints it.
   */
  "empty-the-trash": async (page) => {
    pinnedBy(
      "trash.feature",
      "Emptying asks first, and the question names how many rows go",
      "The count is the SET's, not the rows a filter left on screen",
      "Cancel writes nothing, and leaves the Trash exactly as it stood",
      "Confirming empties it for good, and the archive on disk holds nothing",
    )

    const pass = async (dark: boolean, id: string) => {
      const suffix = dark ? "-dark" : ""
      await opened(page, "/house.olai", OUTLINE_TREE)
      await putAway(page, id)
      // The pile is real before anything is photographed — the guard every
      // section that writes carries ({@link shotSays}).
      shotSays(id, "_olai/Trash.olai")

      await opened(page, "/trash", TRASH_PAGE)
      const pile = await piled(page)
      console.log(`  the pile:\n${pile}`)
      if (pile.includes("(nothing)")) {
        throw new Error("the Trash drew nothing, and the shot after this says it drew a pile")
      }
      await shot(page, `the-trash-with-items${suffix}`)

      await page.locator(EMPTY_TRASH_VERB).first().click()
      await page.waitForTimeout(DRAWN)
      console.log(`  it asks: ${await textOf(page, EMPTY_TRASH_CONFIRM)}`)
      // The count in that sentence, against the file it is a claim about.
      console.log(
        `  _olai/Trash.olai holds: ${servedLines("_olai/Trash.olai").length} records`,
      )
      await shot(page, `asks${suffix}`)

      // CANCEL, and the pile still there afterwards — the half of a confirm
      // that is invisible until it is wrong.
      await page.locator(EMPTY_TRASH_CANCEL).first().click()
      await page.waitForTimeout(DRAWN)
      shotSays(id, "_olai/Trash.olai")
      console.log(`  after Cancel, _olai/Trash.olai still holds: ${
        servedLines("_olai/Trash.olai").length
      } records`)
      await shot(page, `cancelled${suffix}`)

      await page.locator(EMPTY_TRASH_VERB).first().click()
      await page.waitForTimeout(DRAWN)
      await page.locator(EMPTY_TRASH_VERB).first().click()
      await page.waitForTimeout(SETTLE)
      // …and the row is in NO outline now, which is the one thing this app
      // could not say before.
      shotSays(id, undefined)
      console.log(`  emptied, _olai/Trash.olai holds: ${
        servedLines("_olai/Trash.olai").length
      } records`)
      console.log(`  and the page says: ${await textOf(page, TRASH_EMPTY_LINE)}`)
      await shot(page, `emptied${suffix}`)
    }

    await pass(false, "install")
    // The other half of the palette table. Set before the pass, so the frames
    // that follow are painted by the boot script rather than by a swap
    // ({@link inTheDark} does the same for a section with nothing left to do).
    await page.evaluate(() => localStorage.setItem("olai.theme", "aurora"))
    await pass(true, "order")
  },

  "a-subtree-and-its-copy": async (page) => {
    pinnedBy(
      "duplicate_subtree.feature",
      "The menu copies the row and everything under it",
      "An edge inside the copy follows the copy; one that leaves it does not",
    )
    // `install the cabinets` is three rows deep with a `doc`, two `todo`
    // children and an `after` edge leaving the subtree — most of what a record
    // can carry, which is the point of copying this one.
    const before = idsIn("house.olai")
    console.log(`  before:    ${recordOf("install")}`)
    await shot(page, "before")

    await openMenu(page, "install")
    console.log(`  the menu offers: ${await verbsOf(page)}`)
    await shot(page, "the-verb")

    await page.locator(DUPLICATE_VERB).first().click()
    await page.waitForTimeout(SETTLE)
    const id = String(copyRootOf("house.olai", before, "install")["id"])
    console.log(`  the copy:  ${recordOf(id)}`)
    // The FRESH-ID guarantee, printed where a picture cannot show it: the copy
    // of the row that waits on two things waits on the COPY of the one inside
    // the subtree and on the same `order` outside it.
    for (const child of recordsIn("house.olai").filter((one) => one["parent"] === id)) {
      console.log(`             ${recordOf(String(child["id"]))}`)
    }
    shotSays("install", "house.olai")
    shotSays(id, "house.olai")
    await shot(page, "after")

    // …and the claim the two shots above cannot make on their own. Writing to
    // the copy leaves the original exactly as it was, which is what "its own
    // identity" means on a page rather than in a record.
    await page.locator(title(id)).click()
    await page.locator(TITLE_EDITOR).first().waitFor()
    await page.keyboard.press("ControlOrMeta+a")
    await page.keyboard.type("install the cabinets — the spare bathroom")
    await page.keyboard.press("Enter")
    await page.keyboard.press("Escape")
    await page.waitForTimeout(SETTLE)
    console.log(`  the copy:  ${recordOf(id)}`)
    console.log(`  untouched: ${recordOf("install")}`)
    await shot(page, "the-copy-is-its-own-node")
  },

  "retire-a-placement": async (page) => {
    pinnedBy(
      "menu_verbs.feature",
      "Retiring a placement takes the line and leaves the node",
      "A placement something else still names is refused, naming what",
    )
    await openMenu(page, "kitchen-herbs")
    console.log(`  the menu offers: ${await verbsOf(page)}`)
    await shot(page, "on-the-placement")

    // ANOTHER HAND points a `see` at the PLACEMENT rather than at the node it
    // shows — the one shape the op refuses, and the same three lines
    // `menu_verbs.feature` writes for the same scenario. Whole file rather
    // than one patched record, for that reason and one more: the sentence
    // below names two rows, and a shot of exactly those two rows is a better
    // reading of it than the same sentence under twenty.
    //
    // Escape, then `install` GOING, is what says the write arrived at this
    // tab: the panel from the shot above is still up (a second press of a
    // `•••` shuts one rather than opening it), and the row that leaves is the
    // frame the menu below can be opened on.
    rewrite("house.olai", [
      `{"id":"kitchen","ord":"a0","title":"kitchen remodel #home","doing":"2026-08-01"}`,
      `{"id":"order","parent":"kitchen","ord":"a1","title":"order the new cabinets","see":["kitchen-herbs"]}`,
      `{"id":"kitchen-herbs","parent":"kitchen","ord":"a3","mirror":"herbs"}`,
    ])
    await page.keyboard.press("Escape")
    await page.locator(row("install")).first().waitFor({ state: "detached" })
    await page.waitForTimeout(DRAWN)

    await openMenu(page, "kitchen-herbs")
    await page.locator(PLACEMENT_VERB).first().click()
    await page.locator(MENU_SAID).first().waitFor()
    console.log(`  it says: ${await textOf(page, MENU_SAID)}`)
    console.log(`  untouched: ${recordOf("kitchen-herbs")}`)
    // A refusal is a write that did NOT happen, so this shot claims the line is
    // exactly where it was — the one claim a picture of a sentence cannot make.
    shotSays("kitchen-herbs", "house.olai")
    await shot(page, "refused")

    // The way through: that `see` re-pointed at `herbs`, the node the
    // placement shows — through the panel, which is the same door the refusal
    // named.
    await opened(page, "/#order", '[data-testid="zoom-title"]')
    await page.locator(`${EDGE_VERB}[data-relation="see"]`).click()
    await page.locator(EDGE_PANEL).first().waitFor()
    await page.locator(`${EDGE_DROP}[data-ref="kitchen-herbs"]`).first().click()
    await page.waitForTimeout(SETTLE)
    console.log(`  re-pointed: ${recordOf("order")}`)

    await opened(page, "/house.olai", OUTLINE_TREE)
    await openMenu(page, "kitchen-herbs")
    await page.locator(PLACEMENT_VERB).first().click()
    await page.waitForTimeout(SETTLE)
    console.log(`  the line:  ${recordOf("kitchen-herbs")}`)
    console.log(`  the node:  ${recordOf("herbs")}`)
    // Both halves of what the verb means, and neither is legible in the pixels:
    // the placement is in no outline at all, and the node it drew never moved.
    shotSays("kitchen-herbs", undefined)
    shotSays("herbs", "garden.olai")
    await shot(page, "retired")
    // …and the other half of what "retire a placement" means, which the shot
    // above cannot carry on its own: the node the line was drawing is exactly
    // where it lives, with its mark, its children and its own outline intact.
    await opened(page, "/garden.olai", OUTLINE_TREE)
    await shot(page, "the-node-stays")
  },

  /**
   * WHAT REFERS TO THIS NODE, and what happens to it when somebody adds a
   * reference from somewhere else.
   *
   * `herbs` is the one node in this corpus anything points at: `order`
   * (house.olai) sees it. So the section opens holding one entry — and the
   * second shot is the whole claim the pixels have to carry, because it is
   * taken after a file THIS TAB NEVER TOUCHED gained a note naming `@herbs`.
   * Nothing was reloaded and nothing was clicked between them: the section a
   * reader had already opened grew a row.
   *
   * The write goes through {@link rewrite} — another hand, the same door
   * `menu_verbs.feature`'s `I rewrite` uses — precisely because a reference
   * added by the tab under the camera would prove the forward half over again
   * rather than the reverse one.
   */
  /**
   * A FILTERED ROW SAYS WHY IT IS DRAWN — the three cases, on one page, in
   * both halves of the palette table.
   *
   * The ruling came from one screenshot of a `#deferral` tag-click over this
   * repository's own roadmap: every number was correct, every row belonged, and
   * the page was still confusing, because nothing said why any given row was in
   * front of the reader. `alcove OR hinges` puts all three cases on this
   * fixture at once — a title hit, two kept ancestors, and a row whose only
   * reason is behind its ¶.
   *
   * The tag case gets its own leg on `garden.olai`, because it is the gesture
   * the whole thing was ruled from: a pill, pressed, lighting up on the rows
   * that carry it.
   */
  /**
   * EVERY TAG ITS OWN COLOUR — one page, several marks; the same tag the
   * same hue on a second face; light and dark on the same document; and the
   * tag-completion popup, the one face whose tags used to be plain charcoal
   * text in a font-mono list.
   *
   * An OUTLINE stands for all four claims: the tree is the first face, the
   * palette the second, the row editor's popover the third — and the whole
   * page is legible enough in both halves of the table to say the fourth.
   */
  "tags-wear-their-own-colours": async (page) => {
    rewrite("house.olai", [
      `{"id":"kitchen","ord":"a0","title":"kitchen remodel #home #renovation","doing":"2026-08-01"}`,
      `{"id":"paint","parent":"kitchen","ord":"a0","title":"paint the alcove"}`,
      `{"id":"counter","parent":"kitchen","ord":"a1","title":"price the counter #errand #review"}`,
      `{"id":"send","parent":"kitchen","ord":"a2","title":"send the brochure @alice @bob"}`,
      `{"id":"doors","parent":"kitchen","ord":"a3","title":"choose the doors #idea #someday #bug"}`,
      `{"id":"weekend","ord":"a1","title":"weekend list #now #garden #reading #work"}`,
    ])
    await opened(page, "/house.olai", OUTLINE_TREE)
    await shot(page, "several-tags-one-page")

    // THE SAME TAG, the same hue, two faces in one frame: the tree reads
    // `kitchen remodel #home #renovation` and the ⌘K answer to `paint`
    // names its row in the label and its parent — with the same two tags —
    // in the place line. The palette is a popover: row and tree read
    // together in one shot.
    await page.keyboard.press("ControlOrMeta+k")
    await page.locator('[data-testid="palette-input"]').waitFor()
    await page.locator('[data-testid="palette-input"]').fill("paint")
    await page.waitForTimeout(600)
    await shot(page, "the-same-hue-on-two-faces")
    await page.keyboard.press("Escape")

    // The WHY, in one frame: every tag the set holds, in its own hue. Open
    // the row and type the trigger — the popup above the caret is the one
    // face the tags were always plain grey text on.
    await page.locator(title("kitchen")).first().click()
    await page.locator(TITLE_EDITOR).first().waitFor()
    await page.keyboard.press("End")
    await page.keyboard.type(" #")
    await page.waitForTimeout(400)
    await shot(page, "completion-tags-wear-their-colours")
    // The typed ` #` is the probe's, not the title's: put the title back to
    // what the stand wrote before the dark half photographs it.
    await page.keyboard.press("ControlOrMeta+a")
    await page.keyboard.type("kitchen remodel #home #renovation")
    await page.keyboard.press("Enter")
    await page.waitForTimeout(300)

    // ...AND THE OTHER HALF OF THE TABLE: the hue is the tag's, the palette
    // owns the reading floor — the same page in the dark says the same words
    // in the same hues, legible both ways (`tagInk.test.ts` measures every
    // hue against every palette; this frame is what it looks like).
    await page.evaluate(() => localStorage.setItem("olai.theme", "aurora"))
    await opened(page, "/house.olai", OUTLINE_TREE)
    await shot(page, "the-same-hues-in-the-dark")
  },

  "a-filtered-row-says-why": async (page) => {
    pinnedBy(
      "filter_in_place.feature",
      "A filtered page says WHY each row is drawn",
      "A row found by its title needs no second line saying so",
      "A pressed tag lights up on the rows that carry it",
    )
    await opened(page, "/house.olai", OUTLINE_TREE)
    await shot(page, "before-the-query")

    await narrow(page, "alcove OR hinges")
    console.log(`  the bar says: ${await textOf(page, FILTER_COUNT)}`)
    console.log(`  the rows say: ${await whyDrawn(page)}`)
    console.log(`  lit stretches: ${
      (await page.locator(HIT).allInnerTexts()).map(oneLine).join(" · ")
    }`)
    console.log(`  the note-only row reads: ${await textOf(page, DESC_HIT)}`)
    await shot(page, "three-cases-light")

    await inTheDark(page)
    await shot(page, "three-cases-dark")

    // ...and the tag, pressed rather than typed, on the outline that wears one.
    await page.evaluate(() => localStorage.setItem("olai.theme", "chalk"))
    await opened(page, "/garden.olai", OUTLINE_TREE)
    await page.locator('[data-testid="tag"]').first().click()
    await page.waitForTimeout(DRAWN)
    console.log(`  the address is now: ${await page.evaluate(() => location.search)}`)
    console.log(`  the rows say: ${await whyDrawn(page)}`)
    await shot(page, "a-pressed-tag-lights-up")

    await inTheDark(page)
    await shot(page, "a-pressed-tag-lights-up-dark")
  },

  /**
   * A PHRASE ACROSS RENDERED PIECES — code-span and bold boundaries, both
   * sides lit, on the filtered page and in a search row. The quoted phrase
   * is not a substring of the CODE source (a backtick sits between the
   * words), so desc also holds it: matching is the source, the highlight
   * is the visible title.
   */
  "cross-piece-highlight": async (page) => {
    pinnedBy(
      "title_markdown.feature",
      "A filter lights a phrase that spans code and bold",
      "A search row lights a phrase across rendered pieces",
    )
    rewrite("house.olai", [
      `{"id":"kitchen","ord":"a0","title":"kitchen remodel #home"}`,
      `{"id":"demo","parent":"kitchen","ord":"a0","title":"run \`just check\` before pushing","desc":"check before"}`,
      `{"id":"bold","parent":"kitchen","ord":"a1","title":"check **before** pushing","desc":"check before"}`,
    ])
    await opened(page, "/house.olai", OUTLINE_TREE)
    await narrow(page, '"check before"')
    console.log(`  the bar says: ${await said(page, FILTER_COUNT)}`)
    console.log(`  the rows say: ${await whyDrawn(page)}`)
    console.log(`  lit stretches: ${
      (await page.locator(HIT).allInnerTexts()).map(oneLine).join(" · ")
    }`)
    await shot(page, "filtered-code-and-bold")

    await inTheDark(page)
    console.log(`  dark, the rows say: ${await whyDrawn(page)}`)
    await shot(page, "filtered-code-and-bold-dark")

    await page.evaluate(() => localStorage.setItem("olai.theme", "chalk"))
    await opened(page, "/house.olai", OUTLINE_TREE)
    await page.keyboard.press("ControlOrMeta+k")
    await page.locator('[data-testid="palette-input"]').waitFor()
    await page.locator('[data-testid="palette-input"]').fill('"check before"')
    await page.locator('[data-testid="palette-item"][data-id="hit-#demo"]').waitFor()
    await page.locator('[data-testid="palette-item"][data-id="hit-#bold"]').waitFor()
    const paletteHits = async (id: string) =>
      (await page.locator(
        `[data-testid="palette-item"][data-id="hit-#${id}"] [data-testid="hit"]`,
      ).allInnerTexts()).join(" ")
    console.log(`  palette demo lights: ${JSON.stringify(await paletteHits("demo"))}`)
    console.log(`  palette bold lights: ${JSON.stringify(await paletteHits("bold"))}`)
    await shot(page, "palette-code-and-bold")

    await page.evaluate(() => localStorage.setItem("olai.theme", "aurora"))
    await page.reload()
    await page.locator(OUTLINE_TREE).first().waitFor()
    await page.waitForTimeout(DRAWN)
    await page.keyboard.press("ControlOrMeta+k")
    await page.locator('[data-testid="palette-input"]').waitFor()
    await page.locator('[data-testid="palette-input"]').fill('"check before"')
    await page.locator('[data-testid="palette-item"][data-id="hit-#demo"]').waitFor()
    await page.locator('[data-testid="palette-item"][data-id="hit-#bold"]').waitFor()
    console.log(`  dark palette demo lights: ${JSON.stringify(await paletteHits("demo"))}`)
    console.log(`  dark palette bold lights: ${JSON.stringify(await paletteHits("bold"))}`)
    await shot(page, "palette-code-and-bold-dark")
  },

  "what-refers-to-this-node": async (page) => {
    pinnedBy(
      "backlinks.feature",
      "A node that is pointed at says so, and starts shut",
      "A reference written elsewhere arrives while the section is open",
      "A placement is not a reference",
    )
    await opened(page, "/#herbs", ZOOM_TITLE)
    console.log(`  shut, it says:      ${await textOf(page, BACKLINKS_SUMMARY)}`)
    await shot(page, "collapsed")

    await page.locator(BACKLINKS_SUMMARY).first().click()
    await page.waitForTimeout(DRAWN)
    // The count is RECORDS and the row is what they say — printed because a
    // screenshot cannot show that `kitchen-herbs`, a mirror of this very node,
    // is deliberately not among them.
    console.log(`  open, it draws:     ${await textOf(page, BACKLINK_SEE_REFS)}`)
    console.log(`  and the mirror of it (\`kitchen-herbs\`) is not: ${
      await page.locator(`${BACKLINKS} [data-ref="kitchen-herbs"]`).count()
    } entries`)
    await shot(page, "open-one-referrer")

    // ANOTHER HAND, in a file this page has no editor open on: garden.olai
    // gains a note that names the herb bed by its `@id`.
    rewrite("garden.olai", [
      ...servedLines("garden.olai"),
      `{"id":"cuttings","ord":"z0","title":"take cuttings from @herbs before the frost"}`,
    ])
    await page.waitForTimeout(SETTLE)
    console.log(`  after the write:    ${await textOf(page, BACKLINKS_SUMMARY)}`)
    console.log(`  the new row says:   ${await textOf(page, BACKLINK_MENTION_REFS)}`)
    console.log(`  still open:         ${
      await page.locator(BACKLINKS).first().evaluate((el) => (el as HTMLDetailsElement).open)
    }`)
    shotSays("cuttings", "garden.olai")
    await shot(page, "a-reference-arrives")
  },

  /**
   * THE TAG COMPLETION, READ OFF THE INDEX (`mentions-index-one-sigil`): what
   * `#` offers, where those names come from and what the number beside each
   * one now counts.
   *
   * The set is written here so the shot holds the three things at once — a tag
   * on two rows, a tag on one, and a tag written ONLY IN A NOTE, which is the
   * behaviour that changed: the list is `Derived.taggedBy`'s keys, and that
   * index files a record under every tag its title or its note writes. The old
   * walk looked at titles alone, so `#hob` was a word this set used and never
   * offered back.
   *
   * `#home` is written TWICE by one row on purpose. The count says how many
   * NODES carry a name — which is what the widget always claimed — so the row
   * saying it twice must still be one vote, and a picture is the only place a
   * reader sees the claim and the number together.
   */
  "a-tag-completion-reads-the-index": async (page) => {
    pinnedBy(
      "input_widgets.feature",
      "A tag written in a NOTE is vocabulary too",
      "A tag is counted once per node, however often that node writes it",
    )
    rewrite("house.olai", [
      `{"id":"kitchen","ord":"a0","title":"kitchen remodel #home #home","doing":"2026-08-01"}`,
      `{"id":"order","parent":"kitchen","ord":"a1","title":"order the new cabinets #home","desc":"ask the #hob people about the cut-out first"}`,
      `{"id":"install","parent":"kitchen","ord":"a2","title":"install the cabinets #handover"}`,
      `{"id":"knobs","parent":"install","ord":"a0","title":"pick the knobs"}`,
    ])
    await opened(page, "/house.olai", OUTLINE_TREE)
    await page.locator(title("knobs")).first().click()
    await page.locator(TITLE_EDITOR).first().waitFor()
    await page.keyboard.type(" #")
    await page.locator(COMPLETIONS).first().waitFor()
    await page.waitForTimeout(DRAWN)
    // Printed rather than only photographed: that `#hob` is on the list at all
    // is the whole claim, and it is a row in a shot like any other.
    console.log(`  a bare \`#\` offers: ${await labels(page)}`)
    console.log(`  and \`#home\`, which one row writes twice, says: ${
      await rowSaying(page, "#home")
    }`)
    await shot(page, "a-bare-hash")

    await page.keyboard.type("ho")
    await page.waitForTimeout(DRAWN)
    console.log(`  narrowed to \`#ho\`:  ${await labels(page)}`)
    await shot(page, "narrowed")
  },

  /**
   * THE COUNT LINE ADDS UP — the plain page, and the one the sentence exists
   * for, in both halves of the palette table.
   *
   * The line used to put two numbers out of two different sets beside each
   * other: "1 of 8 — 2 more matches hidden as done" counted the rows LEFT
   * after finished work was taken off, next to matches that had been taken off
   * with it. The denominator is now what the page HOLDS, so the parts are parts
   * of one whole — which is a claim about arithmetic, and therefore the one
   * kind of claim a screenshot can carry: the same page, one preference apart,
   * with the second number unmoved.
   *
   * `hinges OR is:done` is the query that draws all three truths at once on
   * this fixture: one open match drawn, and two finished ones (`demo`, and
   * `basil` under the MIRROR of the herb bed) held back.
   */
  "the-count-line-adds-up": async (page) => {
    pinnedBy(
      "filter_in_place.feature",
      "The count line is measured against what the page holds, not what a preference left",
      "Matches held back by the done preference are counted, and the reason is named",
    )
    // THE PLAIN CASE first, and what it is here to show is an ABSENCE: nothing
    // is being held back, so nothing is said about holding anything back.
    await opened(page, "/house.olai", OUTLINE_TREE)
    await narrow(page, "cabinets")
    console.log(`  nothing hidden, the bar says: ${await textOf(page, FILTER_COUNT)}`)
    await shot(page, "plain-light")

    await inTheDark(page)
    await shot(page, "plain-dark")

    // ...and the same page under a reader who hides finished work. The stored
    // value rather than the Prefs panel, exactly as the theme above is set:
    // the panel is portalled over the page this section is photographing, and
    // that switch has its own scenarios (`preferences.feature`).
    await page.evaluate(() => {
      localStorage.setItem("olai.theme", "chalk")
      localStorage.setItem("olai.done.hidden", "true")
    })
    await opened(page, "/house.olai", OUTLINE_TREE)
    console.log(`  hiding finished work, the page draws ${
      await page.locator(`${OUTLINE_TREE} [data-testid="node"]`).count()
    } rows`)
    await narrow(page, "hinges OR is:done")
    console.log(`  and the bar says: ${await textOf(page, FILTER_COUNT)}`)
    await shot(page, "hidden-light")

    await inTheDark(page)
    await shot(page, "hidden-dark")
  },

  /**
   * A SHORTLIST SAYS ITS TOTAL (`a-shortlist-says-its-total`): both doors onto
   * the one search reading, over a directory big enough for the cap to bite —
   * and the same doors over an answer that fits, saying nothing.
   *
   * The pair is what a still frame can carry here, because the claim is about
   * a SILENCE as much as a sentence: eight rows with `8 of 44 matches` under
   * them and eight rows' worth of query with no line at all are the same
   * picture apart from the one element this PR draws.
   *
   * THE VAULT IS WRITTEN rather than taken from `fixtures/good`, for the
   * frontmatter section's reason: the fixture is a five-node house and the cap
   * never bites in it, so a shot taken against it would be a shot of the
   * absence twice. Forty rows that answer one word is the smallest directory
   * in which the two doors have something to say.
   */
  "a-shortlist-says-its-total": async (page) => {
    pinnedBy(
      "a_shortlist_says_its_total.feature",
      "The palette drew eight of what it found, and says which",
      "The header's box says the same thing about the same answer",
      "A palette answer that fits says nothing about a total",
    )
    rewrite("stock.olai", [
      `{"id":"stock","ord":"a0","title":"the supplier's catalogue"}`,
      ...Array.from(
        { length: 40 },
        (_unused, index) =>
          `{"id":"h${index + 1}","parent":"stock","ord":"a${
            String(index + 1).padStart(2, "0")
          }","title":"brass handle no. ${index + 1}"}`,
      ),
    ])

    // THE PALETTE, over a word forty rows answer to. The line sits under the
    // list rather than in it, so it is in frame whether or not a reader has
    // scrolled the eight.
    await opened(page, "/house.olai", OUTLINE_TREE)
    await page.keyboard.press("ControlOrMeta+k")
    await page.locator(PALETTE_INPUT).waitFor()
    await page.locator(PALETTE_INPUT).fill("handle")
    await page.locator(PALETTE_HIT).first().waitFor()
    await page.waitForTimeout(SETTLE)
    console.log(`  hits drawn:         ${await page.locator(PALETTE_HIT).count()}`)
    console.log(`  and it says:        ${await textOf(page, SEARCH_COUNT)}`)
    await shot(page, "the-palette-says-its-total")

    // …and the same palette over a query the vault answers eight-or-fewer
    // times: the rows are there, and there is no line under them.
    await page.locator(PALETTE_INPUT).fill("cabinets")
    await page.locator(PALETTE_HIT).first().waitFor()
    await page.waitForTimeout(SETTLE)
    console.log(
      `  an answer that fits: ${await page.locator(PALETTE_HIT).count()} hits, and the line is ${
        (await page.locator(SEARCH_COUNT).count()) === 0 ? "absent" : "STILL THERE"
      }`,
    )
    await shot(page, "an-answer-that-fits-says-nothing")
    await page.keyboard.press("Escape")

    // THE OTHER DOOR, over the same word and the same answer — one reading,
    // one sentence, two places it is drawn.
    const box = page.locator(HEADER_SEARCH)
    await box.click()
    await box.fill("handle")
    await page.locator(headerHit("#h1")).first().waitFor()
    await page.waitForTimeout(SETTLE)
    console.log(`  the header box too: ${await textOf(page, SEARCH_COUNT)}`)
    await shot(page, "the-header-box-says-it-too")
  },

  /**
   * ONE MARKUP FOR THE REFUSAL ROW (`one-alert-row`): the same refused
   * operator at all three doors onto the one query language, drawn by one
   * component.
   *
   * The sentence has been one since #287 and the MARKUP was three — the bar's
   * line through `client/SaidLine.tsx`, and a hand-rolled `role="alert"` band at
   * each of the two search doors. What a still frame shows that a `✔` cannot
   * is that they now READ as one thing: the same alarm ink, the same rule under
   * the row, the same band across whatever the door's own padding is. The
   * differences that survive are the ones that should — a bar's line is a line
   * under a box, a palette's is a band the width of the modal, the header's is
   * the same band narrower, because WHERE it sits was never the thing being
   * unified.
   *
   * The transcript carries the half a picture cannot: `data-tone` beside each
   * sentence. Before this PR the bar answered `alarm` and the two doors
   * answered `(none)` — same colour on screen, no fact in the markup.
   *
   * Both halves of the palette table, because every ink here is a theme token
   * and an alarm that reads as alarm on chalk and as decoration on pitch is the
   * failure this row exists against.
   */
  "one-alert-row": async (page) => {
    pinnedBy(
      "an_answer_leaves_the_rows_standing.feature",
      "The palette's refusal is not read out a second time for the next keystroke",
      "The header box's refusal is not read out a second time for the next keystroke",
    )
    const pass = async (dark: boolean) => {
      const suffix = dark ? "-dark" : "-light"
      /** One door read out and photographed — the sentence, the mood beside it,
       *  and the frame. Three doors saying the same thing is exactly the claim,
       *  so it is said once here rather than copied per door. */
      const reads = async (who: string, row: string, name: string) => {
        console.log(`  ${who.padEnd(18)}${await textOf(page, row)}`)
        console.log(`  ${"...in the mood:".padEnd(18)}${await toneOf(page, row)}`)
        await shot(page, `${name}${suffix}`)
      }

      // THE BAR, which parses in this tab: the row is up before any wire is
      // touched, and it is the one that already went through the component.
      await opened(page, "/house.olai", OUTLINE_TREE)
      await narrow(page, "is:open")
      await reads("the bar refuses:", FILTER_REFUSAL, "the-filter-bar")

      // THE PALETTE, which had to ASK for the same refusal and hand-rolled
      // three bands of its own to draw it and its two neighbours. `DRAWN` and
      // not `SETTLE`: nothing was written, and the row above is already up.
      await page.keyboard.press("ControlOrMeta+k")
      await page.locator(PALETTE_INPUT).waitFor()
      await page.locator(PALETTE_INPUT).fill("is:open")
      await page.locator(SEARCH_REFUSAL).first().waitFor()
      await page.waitForTimeout(DRAWN)
      await reads("the palette:", SEARCH_REFUSAL, "the-palette")
      await page.keyboard.press("Escape")

      // THE HEADER BOX, the third door and the second that hand-rolled one.
      const box = page.locator(HEADER_SEARCH)
      await box.click()
      await box.fill("is:open")
      await page.locator(SEARCH_REFUSAL).first().waitFor()
      await page.waitForTimeout(DRAWN)
      await reads("the header box:", SEARCH_REFUSAL, "the-header-box")
      await page.keyboard.press("Escape")
    }

    await pass(false)
    // The theme is WRITTEN and the next pass's own `goto` is what picks it up
    // — one navigation rather than `inTheDark`'s three. That helper reloads
    // and then waits on the tree, and the address still carries `is:open`,
    // which selects nothing: it would come back to an empty tree and wait out
    // its timeout. Written where the page keeps it (`client/theme/state.ts`),
    // so the boot script paints the first dark frame rather than a light one
    // flashing first.
    await page.evaluate(() => localStorage.setItem("olai.theme", "aurora"))
    await pass(true)
  },

  /**
   * SAIDLINE'S HOME, AND THE EDITOR'S NUDGE (`said-home-and-nudge`): the last
   * two hand-rolled said-lines in the client, drawn by the component every
   * other line has gone through since #310.
   *
   * The two moods under one editor, in one frame each. What a picture shows is
   * that they read as the client's other said-lines do — the refusal in alarm
   * ink under the row whose text is still unsaved, the nudge in the quiet face
   * a note wears — and that neither moved: same place, same size, same gutter
   * as before the swap.
   *
   * What a picture CANNOT show is the whole reason this was a behaviour ruling
   * rather than a refactor, so the transcript carries it: `role` and
   * `aria-live` beside each sentence. Before this PR the refusal had
   * `role="alert"` and NO `aria-live`, and the nudge had neither — a remark
   * the ops layer makes about a write that landed reached only the reader who
   * could see it. `data-kind` is printed for the same reason: it is the fact
   * that made `SaidLine` unable to draw this row until it had a passthrough
   * for it.
   *
   * Both halves of the palette table, because alarm and muted are theme tokens
   * and a mood that reads as a mood on chalk and as decoration on pitch is the
   * failure the component exists against.
   */
  "said-home-and-nudge": async (page) => {
    pinnedBy(
      "keyboard_editing.feature",
      "A write that lands can have something to say",
      "A refused write keeps the draft and says why",
    )
    /** The garden BEFORE either pass. The nudge leg is a real write — `mint`
     *  goes done on disk — and the second pass presses the same key on the same
     *  row, which would untick it and have nothing to remark on. Read once and
     *  put back between the passes, so both frames are of the same gesture
     *  rather than of two different ones. */
    const garden = servedLines("garden.olai")
    const pass = async (theme: string) => {
      const suffix = `-${theme}`
      /** One line read out and photographed — the sentence, the two facts in
       *  the markup, and the pair a screen reader actually reads. Said once
       *  here because the claim IS that the two moods are one row. */
      const reads = async (who: string, line: string, name: string) => {
        console.log(`  ${who.padEnd(20)}${await textOf(page, line)}`)
        console.log(`  ${"...in the mood:".padEnd(20)}${await toneOf(page, line)}`)
        console.log(`  ${"...of the kind:".padEnd(20)}${await kindOf(page, line)}`)
        console.log(`  ${"...announced:".padEnd(20)}${await mannerOf(page, line)}`)
        await shot(page, `${name}${suffix}`)
      }

      // THE REFUSAL. An empty title is refused by the ops layer, and the
      // commit is the IDLE one — the third of the three commit moments — so
      // the row is still the row being typed in when the reason arrives, with
      // no second gesture to photograph around.
      await opened(page, "/house.olai", OUTLINE_TREE)
      await wearTheme(page, theme)
      await page.locator(title("handles")).click()
      await page.locator(TITLE_EDITOR).first().waitFor()
      await page.keyboard.press("ControlOrMeta+a")
      await page.keyboard.press("Delete")
      await page.locator(EDIT_REFUSAL).first().waitFor()
      await page.waitForTimeout(DRAWN)
      await reads("the editor refuses:", EDIT_REFUSAL, "the-refusal")
      await page.keyboard.press("Escape")

      // THE NUDGE, which is the opposite mood at the same place: `mint` is the
      // last unfinished task under `herbs`, so ticking it off is the moment
      // the rollup has something a person usually wants noticed.
      await opened(page, "/garden.olai", OUTLINE_TREE)
      await page.locator(title("mint")).click()
      await page.locator(TITLE_EDITOR).first().waitFor()
      await page.keyboard.press("Control+Enter")
      await page.locator(EDIT_NUDGE).first().waitFor()
      await page.waitForTimeout(DRAWN)
      await reads("the write nudges:", EDIT_NUDGE, "the-nudge")
      await page.keyboard.press("Escape")
    }

    await pass("chalk")
    rewrite("garden.olai", garden)
    await pass("pitch")
  },

  /**
   * THE FOUR FACES of `compact-lost-to-steer`, in ONE conversation with a REAL
   * agent — because three of them are claims about a real adapter's queue and
   * the fourth is a claim about a real `/compact`, and a scripted agent can
   * only ever restate what this repo already believes.
   *
   * It is the one section that needs `AGENT` set to a real one:
   *
   *   AGENT=$(sh scripts/acp-agent.sh) bash evidence.sh chat-sends-queue
   *
   * Without it the panel comes up with no agent at all and the first wait fails
   * naming that, which is the honest failure: a section about what an agent does
   * with a message cannot be run against no agent.
   *
   * ONE CONVERSATION, in this order, and the order is load-bearing: the
   * `/compact` face needs a context worth compacting, and the three faces above
   * it are what builds one. Every wait is on a STATE the panel publishes or on
   * words that arrived — never on a clock — because the subject is a language
   * model and there is no duration to assume (`e2e-localhost-load-flakes`, the
   * same rule the suite lives by).
   */
  "chat-sends-queue": async (page) => {
    pinnedBy(
      "the_agent.feature",
      "A message sent mid-turn WAITS ITS TURN, and the row says so",
      "The interrupting gesture puts a message INTO the running turn",
      "Cancel stops the turn, and the message waiting behind it still runs",
    )
    /** Long enough that a person can send a second message into it, and dull
     *  enough that what the model says is not the point. Different subjects so
     *  two turns cannot be confused in a shot. */
    const ESSAY = (about: string) =>
      `Write an 800-word essay about ${about}. Output only the essay, no preamble.`
    /** One word, so "did the queued message run" is a thing a reader can see at
     *  a glance in a transcript full of prose. */
    const WORD = (word: string) => `Say the word ${word} and nothing else.`

    await openChatForAgent(page)
    await shot(page, "an-idle-conversation")

    // ── ONE: the interrupting gesture ────────────────────────────────
    // FIRST, and the order is not narrative — it is the shape of the guard.
    // The pinned adapter (0.66.0) leaves a turn's `session/prompt` unanswered
    // forever if a `_session/steering` is injected into any turn of a session
    // that has once held a QUEUED one (the steered words run and stream; only
    // `session/cancel` ends it — reproduced with no olai involved, filed as
    // claude-agent-acp#1039). So the panel withdraws the gesture from any
    // conversation that has queued, and the only place left to photograph it
    // working is a conversation that has not.
    //
    // The withdrawal itself is the shot after face TWO's, which is where the
    // guard becomes true.
    //
    // This one goes INTO the turn in flight, which is why it is a gesture
    // somebody has to make on purpose.
    await chatSend(page, ESSAY("the sea floor"))
    await chatWorking(page)
    await page.locator(CHAT_INPUT).fill(WORD("PINEAPPLE"))
    await page.locator(CHAT_INTERRUPT).click()
    await chatSaid(page, "PINEAPPLE")
    await chatBottom(page)
    await shot(page, "the-interruption-lands-in-the-running-turn")
    await chatIdle(page)

    // ── TWO: a plain send while the agent is busy ─────────────────────
    // It lands in the transcript at once, wearing *queued*, and the running
    // turn is untouched — which is the whole ruling in one frame.
    await chatSend(page, ESSAY("the tides"))
    await chatWorking(page)
    await chatSend(page, WORD("BANANA"))
    await page.locator(CHAT_QUEUED).first().waitFor()
    console.log(`  the composer promises: ${await textOf(page, CHAT_QUEUES)}`)
    await chatBottom(page)
    await shot(page, "a-send-while-busy-waits-its-turn")

    // ... AND THE INTERRUPTION IS GONE FROM THIS CONVERSATION, from this
    // moment on. The guard the human ruled in: a session that has queued is one
    // where steering never settles, so the panel stops offering the gesture
    // rather than handing somebody a control that hangs their conversation. The
    // same frame as the shot above — the control is drawn only while a turn is
    // running, so its absence is only worth photographing here.
    if ((await page.locator(CHAT_INTERRUPT).count()) !== 0) {
      throw new Error("the interruption is still offered after a message queued")
    }
    console.log("  the interruption is withdrawn: no control while this turn runs")
    await shot(page, "the-interruption-is-withdrawn")

    // ... and the agent takes it up when the essay is over: the hint goes and
    // the answer arrives, in order, with nothing re-sent by anybody.
    await chatSaid(page, "BANANA")
    await chatIdle(page)
    await chatBottom(page)
    await shot(page, "the-agent-takes-it-up-in-order")

    // ── THREE: cancel with a message waiting behind the turn ─────────
    // Cancel stops the turn and touches nothing else: the words behind it are
    // at the agent, and the agent runs them next.
    await chatSend(page, ESSAY("the trade winds"))
    await chatWorking(page)
    await chatSend(page, WORD("MANGO"))
    await page.locator(CHAT_QUEUED).first().waitFor()
    await chatBottom(page)
    await shot(page, "one-waiting-behind-a-running-turn")
    await page.locator(CHAT_CANCEL).click()
    await chatSaid(page, "MANGO")
    await chatIdle(page)
    await chatBottom(page)
    await shot(page, "the-turn-stops-and-the-queued-words-survive")

    // ── FOUR: the symptom, retired ───────────────────────────────────
    // `/compact` and then a plain send while it runs. The screenshot this bug
    // was filed off says *Compacting failed: API Error: Request was aborted.
    // Compaction canceled.* — which was a steer tearing the compaction down.
    // Nothing steers now unless it is asked to, so the compaction finishes and
    // the message runs after it.
    await chatSend(page, "/compact")
    await chatSaid(page, "Compacting")
    await chatSend(page, WORD("PAPAYA"))
    await page.locator(CHAT_QUEUED).first().waitFor()
    await chatBottom(page)
    await shot(page, "a-send-during-compaction-waits")
    await chatSaid(page, "Compacting completed")
    await chatBottom(page)
    await shot(page, "the-compaction-completes")
    await chatSaid(page, "PAPAYA")
    await chatIdle(page)
    // The exact sentence from the human's screenshot, asked for by name: a
    // section that only photographed a good outcome would not have looked.
    const said = await page.locator(CHAT_TRANSCRIPT).innerText()
    if (said.includes("Request was aborted") || said.includes("Compacting failed")) {
      throw new Error("the compaction was aborted — the symptom is not retired")
    }
    console.log("  no abort anywhere in the transcript")
    await chatBottom(page)
    await shot(page, "the-message-runs-after-the-compaction")
  },

  /**
   * PROPS ON THE ROW, THE DOORS IN THEM, AND WHERE ONE IS WRITTEN
   * (`props-doors-autoshow`): the whole of what changed about a node's facts,
   * on a LANE NODE of the shape the live board writes — `agent`, `brief`,
   * `dispatched`, `merge`, `reviewer`, `worktree`, `pr`, and a `verdict` that
   * broke the props-are-short-facts rule.
   *
   * THE RECORD IS WRITTEN HERE rather than kept in the corpus, exactly as the
   * suite's own scenarios write theirs: the subject is a shape the ORCHESTRATOR
   * produces (`orchestrator/lanes.olai`, in the orchestrator's own vault —
   * https://github.com/juspay/oss.olai — and out of version control there as
   * it was here), and a lane node in the fixtures
   * would be a corpus about this repository's own workflow
   * (`fixtures/README.md`). What it points AT is the corpus's own: `finishes.md`
   * is a document the directory serves, `basil` is a node `garden.olai`
   * declares, and neither is a coincidence — those are what make the two doors
   * doors rather than guesses.
   *
   * The claims, in the order the shots take them:
   *
   *   1. the run is on the row with NO gesture at all — no ¶ pressed, no row
   *      opened, and no pilcrow on a node whose only body is its facts;
   *   2. a vault-path chip lands on that document, and a node-id chip on that
   *      node — the address bar is in frame for both;
   *   3. a URL chip carries the tab-of-its-own pair, and `agent`, `merge` and a
   *      `pr` with a URL *inside* it carry no door at all. The last is the
   *      refusal the whole rule rests on, and it is printed rather than
   *      photographed because "no link" is not a thing a picture shows;
   *   4. the node's own page wears the same run, system facts and all;
   *   5. the ¶ adds the NOTE and nothing the row was already showing;
   *   6. a chip is edited in place, added from the `+`, and removed by clearing
   *      it — and the `•••` no longer carries one entry per property.
   */
  "props-on-the-row": async (page) => {
    pinnedBy(
      "properties.feature",
      "The first one is added from the menu, and the row says so with no gesture at all",
      "A node that HAS one adds the next from the `+`, and the menu offers nothing",
      "A chip is edited in place — press its key, type, press Enter",
      "Clearing the value removes the property — the op's own reading",
      "A value that names a document in this directory opens that document",
      "A value that IS a node's id opens that node — assignment becomes navigation",
      "A URL is a link out of the tab, and everything else stays text",
      "A value too long to be a fact is drawn as its first words",
      "What the pilcrow adds is the note, and never what the row already shows",
    )
    rewrite("house.olai", [
      `{"id":"kitchen","ord":"a0","title":"kitchen remodel #home"}`,
      `{"id":"handles","parent":"kitchen","ord":"a0","title":"choose the handles"}`,
      `{"id":"lane","parent":"kitchen","ord":"a1",` +
        `"title":"markdown flashes as RAW SOURCE for a moment before it renders",` +
        `"doing":true,` +
        `"desc":"Filed by the human 2026-08-22 ~07:40 — saw a \`.md\` page arrive as raw text, then become HTML a split second later.",` +
        `"custom":{"agent":"claude-opus","brief":"finishes.md","dispatched":"2026-08-24 16:20",` +
        `"merge":"the human approves","reviewer":"basil",` +
        `"worktree":".worktrees/markdown-raw-flash",` +
        `"records":"https://github.com/juspay/olai/pull/369",` +
        `"verdict":"DO-NOT-OBJECT at c2704bc6 — the owner map verified against the diff, and the wait discipline holds"}}`,
    ])

    // 1. THE RUN, drawn without anybody pressing anything.
    await opened(page, "/house.olai", OUTLINE_TREE)
    console.log(`  the run reads: ${await runOf(page, "lane")}`)
    console.log(`  pilcrows on the run-only row: ${
      await page.locator(`${row("handles")} [data-testid="note-mark"]`).count()
    }`)
    await shot(page, "the-run-is-on-the-row")
    await inTheDark(page)
    await shot(page, "the-run-is-on-the-row-dark")
    await page.evaluate(() => localStorage.setItem("olai.theme", "chalk"))

    // 2. TWO DOORS, followed. The address bar is what says they landed.
    await opened(page, "/house.olai", OUTLINE_TREE)
    await page.locator(chip("lane", "brief")).locator("a").click()
    await page.waitForTimeout(DRAWN)
    console.log(`  the brief chip landed at: ${await page.evaluate(() => location.pathname)}`)
    await shot(page, "a-vault-path-chip-opens-the-document")

    await opened(page, "/house.olai", OUTLINE_TREE)
    await page.locator(chip("lane", "reviewer")).locator("a").click()
    await page.waitForTimeout(DRAWN)
    console.log(`  the reviewer chip landed at: ${await page.evaluate(() => location.hash)}`)
    console.log(`  the page is about: ${await textOf(page, '[data-testid="zoom-title"]')}`)
    await shot(page, "a-node-id-chip-opens-that-node")

    // 3. WHAT IS A DOOR AND WHAT IS NOT — printed, because an absence is not a
    // thing a screenshot shows.
    await opened(page, "/house.olai", OUTLINE_TREE)
    for (const key of ["brief", "reviewer", "dispatched", "pr", "agent", "merge", "worktree"]) {
      console.log(`  ${key}: ${await doorOn(page, "lane", key)}`)
    }
    await shot(page, "which-values-are-doors")

    // 4. THE NODE'S OWN PAGE, wearing the same run with the system half in
    // front of it — and the id, which is a fact and never a link to itself.
    await opened(page, "/#lane", '[data-testid="zoom-title"]')
    console.log(`  the page's run reads: ${await runOf(page, "lane")}`)
    await shot(page, "the-node-page-wears-the-same-run")

    // 5. WHAT THE ¶ ADDS, which is the note and nothing that was on the row.
    await opened(page, "/house.olai", OUTLINE_TREE)
    console.log(`  shut, the row draws: ${await runOf(page, "lane")}`)
    await page.locator(`${row("lane")} [data-testid="note-mark"]`).first().click()
    await page.waitForTimeout(DRAWN)
    console.log(`  open, the row draws: ${await runOf(page, "lane")}`)
    console.log(`  ...and adds the note: ${await textOf(page, `${row("lane")} [data-testid="desc"]`)}`)
    await shot(page, "opening-the-row-adds-the-note-and-nothing-else")

    // 6. WRITING ONE, in the chip that draws it.
    await opened(page, "/house.olai", OUTLINE_TREE)
    await page.locator(chip("lane", "merge")).locator('[data-testid="prop-key"]').click()
    await page.waitForTimeout(DRAWN)
    await shot(page, "a-chip-opens-for-editing-where-it-is-drawn")
    await page.locator(`${row("lane")} [data-testid="prop-edit"]`).fill("the human approves personally")
    await page.keyboard.press("Enter")
    await page.waitForTimeout(DRAWN)
    console.log(`  after the edit: ${await runOf(page, "lane")}`)
    console.log(`  on disk: ${JSON.stringify(customOn("house.olai", "lane")["merge"])}`)
    await shot(page, "the-edit-landed-on-the-row")

    // ...adding one from the `+` at the end of the run.
    await page.locator(`${row("lane")} [data-testid="prop-add"]`).first().click()
    await page.waitForTimeout(DRAWN)
    await shot(page, "the-plus-opens-a-chip-with-two-boxes")
    await page.locator(`${row("lane")} [data-testid="prop-edit-key"]`).fill("soak-until")
    await page.locator(`${row("lane")} [data-testid="prop-edit"]`).fill("2026-08-31")
    await page.keyboard.press("Enter")
    await page.waitForTimeout(DRAWN)
    console.log(`  after the add: ${await runOf(page, "lane")}`)
    console.log(`  the new chip is a: ${await doorOn(page, "lane", "soak-until")}`)
    await shot(page, "a-new-property-added-from-the-run")

    // ...and removing one by clearing it, which is the op's own reading of an
    // empty value rather than a second verb.
    await page.locator(chip("lane", "worktree")).locator('[data-testid="prop-key"]').click()
    await page.waitForTimeout(DRAWN)
    await page.locator(`${row("lane")} [data-testid="prop-edit"]`).fill("")
    await page.keyboard.press("Enter")
    await page.waitForTimeout(DRAWN)
    console.log(`  after clearing \`worktree\`: ${await runOf(page, "lane")}`)
    console.log(`  on disk: ${JSON.stringify(customOn("house.olai", "lane")["worktree"] ?? null)}`)
    await shot(page, "clearing-a-value-removes-the-property")

    // ...and the MENU, which no longer grows with the data. Two nodes side by
    // side: the one carrying facts is offered nothing about them, and the one
    // carrying none is offered the single entry the `+` cannot reach.
    await openMenu(page, "lane")
    console.log(`  the menu on a node WITH properties: ${await verbsOf(page)}`)
    await shot(page, "the-menu-no-longer-carries-a-verb-per-property")
    await page.keyboard.press("Escape")
    await page.waitForTimeout(DRAWN)
    await openMenu(page, "handles")
    console.log(`  the menu on a node with NONE: ${await verbsOf(page)}`)
    await shot(page, "one-entry-survives-where-there-is-no-run")
  },

  /**
   * THE CONDITION A CHIP COMMITS WITH (`prop-op-was`), in one frame: a box
   * typed against what the run was READ as, another hand (the vault written
   * under the open box — which is what an agent's `set_prop` on the same key
   * is, to the gate) moving that key mid-edit, and the commit refused in the
   * ops layer's own words while the word the other hand wrote holds the row
   * — and the disk.
   *
   * The claims, in the order the shots take them:
   *
   *   1. the chip the box is about to open on — the value the write will be
   *      CONDITIONAL on, in frame before the gesture starts;
   *   2. the box, typed over and still standing on the agent's rewrite — the
   *      editor not the frame's business;
   *   3. the refusal under the run, naming what is now there — and the row
   *      holding `audit`, because keeping it was the point.
   *
   * The guardrail this is the photograph OF is the planner: `plan.ts`'s
   * `propStale`, and the mid-edit scenario of `properties.feature` is the
   * promise this only shows. The DARK half is left to
   * `typed-properties` — a refusal is white-on-dark in exactly the same
   * shape the typed gate's is, and this section has one frame to be about.
   */
  "prop-was": async (page) => {
    pinnedBy(
      "properties.feature",
      "A typed commit meets an agent's write mid-edit — refused, naming what it found — and even a reopen re-reads the premise",
    )

    // THE VAULT, to the shape the feature's scenario reads from: `handles`
    // with a `stage` the box will open on, and nothing else to distract the
    // frame.
    rewrite("house.olai", [
      `{"id":"kitchen","ord":"a0","title":"kitchen remodel #home"}`,
      `{"id":"handles","parent":"kitchen","ord":"a0","title":"choose the handles","custom":{"stage":"review","agent":"basil"}}`,
    ])

    // 1. THE WRITE'S PREMISE, in frame: the chip says `review`, which is
    // what the commit below will claim to replace.
    await opened(page, "/house.olai", OUTLINE_TREE)
    console.log(`  the run reads:      ${await runOf(page, "handles")}`)
    console.log(`  on disk:            ${JSON.stringify(customOn("house.olai", "handles")["stage"])}`)
    await shot(page, "the-chip-the-write-opens-on")

    // 2. THE BOX, TYPED — and then the other hand, which is the VAULT being
    // written: to the gate, the same thing an agent's `set_prop` is.
    await page.locator(chip("handles", "stage")).locator('[data-testid="prop-key"]').click()
    await page.waitForTimeout(DRAWN)
    await page.locator(`${row("handles")} [data-testid="prop-edit"]`).fill("submitted")
    console.log(`  typed into the box: ${
      JSON.stringify(await page.locator(`${row("handles")} [data-testid="prop-edit"]`).inputValue())
    }`)
    await shot(page, "the-box-typed-against-the-read")
    rewrite("house.olai", [
      // The marker on `kitchen` is the ordering the commit owes the gate:
      // the one republish that puts `checking` on ITS row is the parse that
      // moved `stage`, so when the chip appears the gate reads `audit`.
      `{"id":"kitchen","ord":"a0","title":"kitchen remodel #home","custom":{"checking":"2026-08-11"}}`,
      `{"id":"handles","parent":"kitchen","ord":"a0","title":"choose the handles","custom":{"stage":"audit","agent":"basil"}}`,
    ])
    await page.locator(chip("kitchen", "checking")).waitFor()
    console.log(`  the box still holds: ${
      JSON.stringify(await page.locator(`${row("handles")} [data-testid="prop-edit"]`).inputValue())
    }`)

    // 3. THE REFUSAL: the typed word went nowhere, the agent's word holds the
    // row AND the disk, and the run says so in the ops layer's own sentence —
    // the one named for what the key says NOW, so its caller can read again.
    await page.keyboard.press("Enter")
    const said = page.locator(`${row("handles")} ${PROP_SAID}`).first()
    await said.waitFor()
    console.log(`  the run says:       ${oneLine(await said.innerText())}`)
    await page.waitForTimeout(DRAWN)
    console.log(`  the run NOW reads:  ${await runOf(page, "handles")}`)
    console.log(`  on disk:            ${JSON.stringify(customOn("house.olai", "handles")["stage"])}`)
    await shot(page, "the-condition-refused-in-the-ops-layers-own-words")
    // …and the close-up the wide one is the context OF: the filed sentence
    // sits two pixels under the row that kept its word.
    const bounds = await page.locator(row("handles")).boundingBox()
    if (bounds !== null) await shot(page, "the-condition-refused-close-up", { clip: bounds })
  },

  /**
   * WHAT EVERY MARKDOWN SURFACE HOLDS WHILE THE RENDERER IS COMING
   * (`markdown-raw-flash`), face by face: the source it already has, blurred
   * out of legibility and swept, and then the same element with the rendering
   * in it.
   *
   * The subject is a pair of frames, so every face is photographed TWICE and
   * the two shots are meant to be read together: `-waiting` is the skeleton,
   * `-arrived` is a de-blur of the same block in the same place. Nothing in
   * between is a layout change — the box was always the size the real
   * characters make, which is the whole argument for drawing the source rather
   * than inventing gray bars.
   *
   * THE WAIT IS MANUFACTURED, and it has to be said out loud: the chunk is
   * held for {@link HELD} per navigation by a route in front of it, because
   * the thing being photographed is a frame and a real one is gone before a
   * shutter can open. What that stands in for is a first visit on a slow link;
   * what it is NOT is the ordinary case, which is the last pair — the chunk
   * warm in the cache, the shell having preloaded it, and the skeleton lasting
   * about a frame.
   *
   * IT NEEDS AN AGENT for one of the five faces (the chat panel's), which
   * `evidence.sh` names for this section as it does for the background task's.
   */
  "markdown-waits-illegibly": async (page) => {
    /** How long the pipeline is held per navigation. Long enough for a
     *  screenshot of a frame; short enough that the section is not a wait. */
    const HELD = 6_000
    const PIPELINE = chunkUrl("pipeline")
    await page.route(PIPELINE, async (route) => {
      await new Promise((done) => setTimeout(done, HELD))
      await route.continue()
    })

    const WAITING = '[data-markdown="waiting"]'
    const DOC_BODY = '[data-testid="document-body"]'
    /** Wait until nothing under `scope` is waiting on the renderer any more —
     *  the de-blur, as a thing the driver can stand after rather than sleep
     *  through. */
    const arrived = async (scope: string): Promise<void> => {
      await page.locator(`${scope} ${WAITING}, ${scope}${WAITING}`).first()
        .waitFor({ state: "detached", timeout: 30_000 })
      await page.waitForTimeout(DRAWN)
    }

    // A title with markdown in it, because this fixture has none: the titles
    // are plain (`markdown/plain.ts` answers those with no parser at all and
    // no waiting face, which is the fast path working). Written to the file
    // the way an agent's `set_title` writes one.
    retitle("house.olai", "order", "order the **new** cabinets")

    // ── ONE: a document, on its own page ─────────────────────────────
    await page.goto(`${BASE}/finishes.md`)
    await page.locator(`${DOC_BODY}${WAITING}`).waitFor()
    await page.waitForTimeout(700)
    await shot(page, "a-document-waiting")
    await arrived(DOC_BODY)
    await shot(page, "a-document-arrived")

    // ── TWO: a `¶` note under a tree row, and the row's own title ────
    await page.goto(`${BASE}/house.olai`)
    await page.locator(`${row("order")} [data-testid="note-mark"]`).first().click()
    await page.locator(`${row("order")} ${WAITING}`).first().waitFor()
    await page.waitForTimeout(500)
    await shot(page, "a-note-and-a-title-waiting")
    await arrived(row("order"))
    await shot(page, "a-note-and-a-title-arrived")

    // ── THREE: a search row, which draws that same title ─────────────
    await page.goto(`${BASE}/house.olai`)
    await page.keyboard.press("ControlOrMeta+k")
    await page.locator('[data-testid="palette-input"]').fill("cabinets")
    await page.locator(`[data-testid="palette-item"] ${WAITING}`).first().waitFor()
    await page.waitForTimeout(DRAWN)
    await shot(page, "a-palette-row-waiting")
    await arrived('[data-testid="palette-item"]')
    await shot(page, "a-palette-row-arrived")
    await page.keyboard.press("Escape")

    // ── FOUR: what the agent said ────────────────────────────────────
    await page.goto(`${BASE}/house.olai`)
    await openChatForAgent(page)
    await ask(page, "stream")
    await page.locator(`[data-testid="chat-transcript"] ${WAITING}`).first().waitFor()
    await page.waitForTimeout(600)
    await shot(page, "an-agent-reply-waiting")
    await arrived('[data-testid="chat-transcript"]')
    await shot(page, "an-agent-reply-arrived")

    // ── FIVE: and the ordinary case ──────────────────────────────────
    // Nothing held any more, and the chunk already in this browser's cache:
    // the shell preloaded it with the entry, so what a reader meets is the
    // rendering. The shot is of a page that never looked unfinished.
    await page.unroute(PIPELINE)
    await page.goto(`${BASE}/finishes.md`)
    await arrived(DOC_BODY)
    await shot(page, "the-cached-case-is-a-blink")
  },

  /**
   * TYPED PROPERTIES (`typed-properties`): a key that declares what its values
   * are, the refusal a value that does not fit earns at the chip, and the span
   * a declared number makes honest.
   *
   * THE ONLY SECTION SERVED A CORPUS OTHER THAN `good/`, and that is the
   * feature's own shape rather than a convenience: a declaration fences a key
   * across the WHOLE vault, so typing `pr` in `good/` would have made its
   * `pr: https://…/179` a broken file and taken a dozen shots about the chip
   * run down with it. `fixtures/typed/` is that second vault, and
   * `fixtures/README.md` says why there are two.
   *
   * The claims, in the order the shots take them:
   *
   *   1. the board as it stands — four lanes carrying typed facts, and one
   *      UNDECLARED key holding prose beside them, because "typing is opt-in
   *      per key" is only visible where both are on one screen;
   *   2. THE REFUSAL AT THE CHIP, which is the one product change here: a value
   *      that does not fit is turned away with the ops layer's own sentence
   *      under the run — and the row and the file both still say what they
   *      said, which is what makes it a refusal rather than a revert;
   *   3. the same refusal offering the variant a near miss was a typo of;
   *   4. a value that FITS, stored as the ONE spelling — `2026-8-30` typed,
   *      `2026-08-30` on disk;
   *   5. `prop:records=190..200` ANSWERING, with the lane at 1000 left out, which is
   *      the whole of what comparing as a number bought;
   *   6. a range on a key nobody declared, refused with the reason rather than
   *      answered with an empty list and no sentence;
   *   7. and `_olai/Properties.olai` READ AS AN OUTLINE — the vocabulary is a
   *      page somebody can open, with the variants as the children they are.
   */
  "typed-properties": async (page) => {
    pinnedBy(
      "typed_properties.feature",
      "A typed refusal lands in the chip run, in the ops layer's own words",
      "The refusal offers the variant a value is a typo of",
      "A value that FITS lands, and lands as the one stored spelling",
      "A span on an int key answers, and compares as a number",
      "A range on a key nobody declared is refused, with the reason",
      "The Properties file reads as an ordinary outline",
    )

    // 1. THE BOARD, as the fixture declares it.
    await opened(page, "/lanes.olai", OUTLINE_TREE)
    for (const id of ["backlinks", "props", "chips", "far"]) {
      console.log(`  ${id.padEnd(10)}${await runOf(page, id)}`)
    }
    await shot(page, "a-board-whose-keys-declare-their-types")

    /** One value typed into one chip, with whatever the run said about it —
     *  the gesture all three write legs make, so the wait that makes a shot
     *  reproducible has one spelling rather than three. */
    const typed = async (id: string, key: string, value: string, name: string) => {
      await opened(page, "/lanes.olai", OUTLINE_TREE)
      await page.locator(chip(id, key)).locator('[data-testid="prop-key"]').click()
      await page.waitForTimeout(DRAWN)
      await page.locator(`${row(id)} [data-testid="prop-edit"]`).fill(value)
      await page.keyboard.press("Enter")
      await page.waitForTimeout(SETTLE)
      const said = await page.locator(`${row(id)} ${PROP_SAID}`).first().textContent()
        .catch(() => null)
      console.log(`  typed ${JSON.stringify(value)} into \`${key}\``)
      console.log(`  the run says:  ${said === null ? "(nothing)" : said.replace(/\s+/g, " ").trim()}`)
      console.log(`  on disk:       ${JSON.stringify(customOn("lanes.olai", id)[key] ?? null)}`)
      await shot(page, name)
    }

    // 2. THE REFUSAL, at the chip, in the ops layer's own words.
    await typed(
      "chips",
      "merge",
      "AUTO: grok review folded + CI green",
      "a-typed-refusal-under-the-run",
    )
    await inTheDark(page)
    await shot(page, "a-typed-refusal-under-the-run-dark")
    await page.evaluate(() => localStorage.setItem("olai.theme", "chalk"))

    // 3. ...and it offers the variant a near miss was a typo of.
    await typed("chips", "agent", "clade", "the-refusal-offers-the-nearest-variant")

    // 4. A VALUE THAT FITS, stored as the one spelling.
    await typed("chips", "dispatched", "2026-8-30", "an-accepted-spelling-stored-as-one")

    /** One query put to the header box, with the rows it answered — the door
     *  the span is asked at, and the door the refusal is drawn at. */
    const asks = async (query: string, name: string) => {
      await opened(page, "/lanes.olai", OUTLINE_TREE)
      const box = page.locator(HEADER_SEARCH)
      await box.click()
      await box.fill(query)
      await page.waitForTimeout(SETTLE)
      const rows = await page.locator('[data-testid="header-search-item"]').allInnerTexts()
      console.log(`  ${query.padEnd(26)}${
        rows.length === 0
          ? "(no rows)"
          : rows.map((one) => one.replace(/\s+/g, " ").trim()).join(" · ")
      }`)
      const refused = await page.locator(SEARCH_REFUSAL).first().textContent().catch(() => null)
      if (refused !== null) console.log(`  ${"...and refuses:".padEnd(26)}${refused.trim()}`)
      await shot(page, name)
      await page.keyboard.press("Escape")
      await page.waitForTimeout(DRAWN)
    }

    // 5. THE SPAN ANSWERING. `far` carries 1000, which a string comparison puts
    // inside `190..200` — so its absence from the rows is the claim.
    await asks("prop:records=190..200", "a-span-on-a-declared-int")
    // 6. ...and a range on a key nobody declared, refused with the reason.
    await asks("prop:terminal=190..200", "a-range-on-an-untyped-key-is-refused")

    // 7. THE DECLARATIONS, read as the outline they are.
    await opened(page, "/_olai/Properties.olai", OUTLINE_TREE)
    console.log(`  the declarations page draws: ${await runOf(page, "prop-merge")}`)
    console.log(`  and the roster one:          ${await runOf(page, "prop-agent")}`)
    await shot(page, "the-declarations-read-as-an-outline")
  },
} satisfies Record<string, (page: Page) => Promise<void>>

/**
 * The name of one — a `string` narrowed to a KEY of the table above, which is
 * what makes {@link SHAPES} below unable to name a section that is not there.
 *
 * `satisfies` rather than an annotation on the table is what leaves the key
 * type as the section NAMES rather than `string`, and this is the
 * price: the one place a name arrives as data (the environment) has to ask.
 */
type Section = keyof typeof SECTIONS
const sectionNamed = (name: string): Section | undefined =>
  name in SECTIONS ? name as Section : undefined

/** A window tall enough for the whole `•••` panel: sixteen entries opened off a
 *  row partway down the page is more than the default leaves room for, and a
 *  shot that clips the verb it is about says nothing. The WIDTH is the
 *  default's, so the two sections that ask for this differ from every other one
 *  in exactly the dimension the panel needs. */
const PANEL_FITS = { viewport: { width: WIDE, height: 1000 } }

/** …and the height the whole DIRECTORY COLUMN fits in — the agenda, the month,
 *  the shelf, the tree, the two ways to add to it and the two doors under it.
 *  Its own number rather than {@link PANEL_FITS}'s, because it is a fact about
 *  that column and not about a panel. */
const COLUMN_FITS = 1200

/**
 * What SHAPE of browser a section wants, where the default is not it.
 *
 * Two kinds of entry. The first is the thing that can ONLY be set at creation:
 * a context with a touchscreen and no mouse, which is the whole point of the
 * finger's section. The second is a TALLER WINDOW, and it is asked for here
 * rather than inside the section for the same reason — a resize after load
 * leaves this page reporting the new `innerHeight` while `100dvh` still
 * resolves against the old one (below). What wants one is a section whose
 * subject is the `•••` panel itself: sixteen entries is taller than the
 * default window, and a shot that clips the verb it is about says nothing.
 *
 * THERE IS NO SECTION FOR AUTO-SCROLL, deliberately. That gesture is only
 * itself in a window SHORTER than the outline, and this driver cannot reliably
 * make one: the app's panes are sized in `dvh`, and an emulated viewport — set
 * at creation or resized after load — leaves this page reporting the new
 * `innerHeight` while `100dvh` still resolves against the old one, so the pane
 * stays a screen taller than the window and the gesture is measured against a
 * page that does not exist. The browser tests do not have the problem (their
 * own `shrinkToScroll` asserts the room it makes, and two scenarios in
 * `dragdrop_multiselect.feature` hold the gesture end to end), which is the
 * division this file's opening line already draws: the promises live in the
 * features, and this is what a person looks at.
 */
/**
 * WHICH PAGE a section is warmed up on, for the one served a corpus that has
 * no `house.olai` in it.
 *
 * The warm-up is a page that draws a TREE — it is what makes the first real
 * shot a shot of a settled app rather than of a first paint — so it has to name
 * an outline the corpus actually holds. `good/`'s is `house.olai` and that is
 * the default; `typed/`'s is `lanes.olai` (`evidence.sh` chooses the corpus,
 * and `fixtures/README.md` says why there are two).
 *
 * A TABLE beside {@link SHAPES} rather than a branch inside `main`, for that
 * table's reason: one entry per section that differs, and every other section
 * says nothing.
 */
const WARMS_UP_AT: Partial<Record<Section, string>> = {
  "typed-properties": "/lanes.olai",
}

const SHAPES: Partial<Record<Section, Parameters<Browser["newContext"]>[0]>> = {
  // The browser tests' own handset, to the pixel and the scale factor
  // (`support/hooks.ts`'s `PHONE`): an iPhone 13's 390×844, a touch screen and
  // no mouse. `isMobile` is what makes Chromium honour the shell's viewport
  // meta at all, and the scale factor is what makes a dispatched touch land
  // where the CSS pixel is.
  "a-finger-picks-a-row-up": {
    viewport: { width: 390, height: 620 },
    hasTouch: true,
    isMobile: true,
  },
  // The sections ABOUT the menu, in a window the whole panel fits in — one
  // name for it, so the next one does not copy another literal.
  "a-subtree-and-its-copy": PANEL_FITS,
  "move-to-trash-from-the-menu": PANEL_FITS,
  // …and the section that STARTS by making one: it drives the same `•••`
  // confirm twice before it ever reaches the Trash page.
  "empty-the-trash": PANEL_FITS,
  "retire-a-placement": PANEL_FITS,
  // …and the section about a panel of the same kind, for the same reason: a
  // list of eight destinations with a refusal under it is taller than the
  // default window leaves below a row, and a shot that clips the sentence it
  // is about says nothing.
  "move-to-picker": PANEL_FITS,
  // The section whose subject is the WHOLE directory column, from the agenda
  // and Inbox at the top to the Trash door at its foot. The column is exactly
  // one screen tall and scrolls inside itself, so a shorter window would put
  // the rows this section is about below its own fold.
  "olai-names-its-own-files": { viewport: { width: WIDE, height: COLUMN_FITS } },
  "inbox-count-placement": { viewport: { width: WIDE, height: COLUMN_FITS } },
}

const main = async () => {
  const name = sectionNamed(SECTION)
  if (name === undefined) {
    console.log(Object.keys(SECTIONS).join("\n"))
    return
  }
  // The browser tests' own argv (`support/hooks.ts`), and not for their
  // reasons: what matters here is `--headless=new`, which is a different
  // browser from the old headless shell — the shell does not turn a dispatched
  // touch into the pointer events a long press is made of, so a section about a
  // finger silently held nothing. The rest are the flags that make Chromium
  // survive a container with a small `/dev/shm`, harmless on a laptop.
  //
  // `CHROME`, when it is set, is a real Chrome to drive INSTEAD of the one
  // Playwright ships — because the one Playwright ships has no PDF viewer, and
  // a section whose subject is a `.pdf` would photograph a fallback nobody
  // sees. It is an env knob rather than a per-section field for the same
  // reason `BASE` is one: which BROWSER is being driven is a property of the
  // run, and every other section is identical in either.
  //
  // `HEADED=1` drops `--headless=new` and opens a real window, which is only
  // useful under a display somebody is capturing: it is how a section becomes a
  // VIDEO with the address bar in frame, since a browser's own chrome is the
  // one thing no page-level recorder can see. A run with no display fails at
  // launch naming that, which is the right failure — an evidence run that
  // silently fell back to headless would produce a file that proves less than
  // it claims to. Shots are identical either way.
  const browser = await chromium.launch({
    args: HEADED ? BROWSER_ARGS.filter((flag) => !flag.startsWith("--headless")) : [
      ...BROWSER_ARGS,
    ],
    ...(HEADED ? { headless: false } : {}),
    ...(CHROME === undefined ? {} : { executablePath: CHROME }),
  })
  // A CONTEXT of its own rather than `browser.newPage(options)`, which is the
  // same thing with an implicit one — except that a touchscreen is a property
  // of the context, and the DevTools session the finger's section opens has to
  // be against a context that has one. The browser tests take the same route
  // (`support/hooks.ts`).
  const context = await browser.newContext(
    SHAPES[name] ?? { viewport: { width: WIDE, height: 720 } },
  )
  const page = await context.newPage()
  page.on("pageerror", (error) => console.error("PAGE ERROR", error))
  await page.goto(`${BASE}${WARMS_UP_AT[name] ?? "/house.olai"}`)
  await page.locator(OUTLINE_TREE).first().waitFor()
  await page.waitForTimeout(600)
  await SECTIONS[name](page)
  await browser.close()
}

await main()
