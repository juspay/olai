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
import { fileKind } from "@olai/format"
import { readdirSync, readFileSync, writeFileSync } from "node:fs"
import { type Browser, chromium, type Locator, type Page } from "playwright"

import { BROWSER_ARGS } from "./support/browser.ts"

const BASE = process.env["BASE"] ?? "http://127.0.0.1:7788"
const OUT = process.env["SHOTS"] ?? "."
const SECTION = process.env["SECTION"] ?? ""

let shots = 0
const shot = async (page: Page, name: string) => {
  shots += 1
  await page.screenshot({ path: `${OUT}/${SECTION}-${shots}-${name}.png` })
}

const row = (id: string) => `[data-node-id="${id}"]`
const handle = (id: string) => `${row(id)} [data-testid="drag-handle"] >> nth=0`
const title = (id: string) => `${row(id)} [data-testid="node-title"] >> nth=0`

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

// ── the edge panel, and what a record says afterwards ──────────────────

const EDGE_PANEL = '[data-testid="edge-panel"]'
const EDGE_SEARCH = '[data-testid="edge-search"]'
const EDGE_HIT = '[data-testid="edge-hit"]'
const EDGE_DROP = '[data-testid="edge-drop"]'
const EDGE_SAID = '[data-testid="edge-said"]'
const EDGE_VERB = '[data-testid="edge-verb"]'

/** The `•••` of a row, revealed and pressed — the gutter is `opacity-0` until
 *  the row is hovered, which a screenshot has to go through like anybody. */
const openMenu = async (page: Page, id: string) => {
  await page.locator(row(id)).first().hover()
  await page.locator(`${row(id)} [data-testid="node-menu"] >> nth=0`).click({ force: true })
  await page.locator('[data-testid="node-menu-panel"]').first().waitFor()
  await page.waitForTimeout(200)
}

/** One line out of however many the markup wrapped it over — what a console
 *  line can hold, spelled once for every reader here that prints something the
 *  page drew. */
const oneLine = (said: string): string => said.replace(/\s+/g, " ").trim()

const textOf = async (page: Page, locator: string) =>
  oneLine(await page.locator(locator).first().innerText())

/** The `•••` menu's archive verb, and the confirm it raises — ONE spelling,
 *  because the confirm answers with the same words on the same panel, and a
 *  section that photographs the question in between still presses this. */
const TRASH_VERB = '[data-testid="node-menu-panel"] >> text=Move to Trash'

/** The other write a `•••` menu offers about the LINE rather than about what
 *  it draws, and the one a mirror row is offered instead of the archive above
 *  (`client/menu/verbs.ts`). Spelled beside it because the pair is the claim:
 *  a placement is retired, a node is put away, and no row is offered both. */
const PLACEMENT_VERB = '[data-testid="node-menu-panel"] >> text=Remove this placement'

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

/**
 * What the FILE says about one node — the record, off the disk the driver is
 * serving, because that is the whole claim a pointer's gesture makes here.
 *
 * `VAULT` is `evidence.sh`'s copy; without one this prints why rather than a
 * guess, since a shot beside an invented line is worse than a shot alone.
 */
const recordOf = (id: string): string => {
  const vault = process.env["VAULT"]
  if (vault === undefined) return "(no VAULT; run through evidence.sh)"
  for (const file of readdirSync(vault)) {
    // Which files hold records is the format's answer, not a suffix retyped
    // here — the same arrangement `step_definitions/` has with `MARKS`, and for
    // the same reason: this package and `@olai/format` never otherwise meet, so
    // a disagreement between them is silent.
    if (fileKind(file) !== "outline") continue
    for (const line of readFileSync(`${vault}/${file}`, "utf8").split("\n")) {
      if (line.includes(`"id":"${id}"`)) return `${file} — ${line}`
    }
  }
  return `(no record for \`${id}\`)`
}

/**
 * ANOTHER HAND writing the directory while the page is open — the same gesture
 * `menu_verbs.feature` makes with its `I rewrite`, and the reason one section
 * needs it: the placement's fence is about the set as it IS, so the thing that
 * still names a line has to be written by somebody other than this tab.
 *
 * Throws without a `VAULT` rather than writing nothing, which is {@link
 * recordOf}'s rule read the other way: a shot of a gesture that never reached
 * a file is worse than no shot.
 */
const rewrite = (file: string, text: string): void => {
  const vault = process.env["VAULT"]
  if (vault === undefined) throw new Error("no VAULT; run through evidence.sh")
  writeFileSync(`${vault}/${file}`, text)
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

// ── the same filter over the pages that are a query already ────────────

const OUTLINE_TREE = '[data-testid="outline-tree"]'
const DAY_PAGE = '[data-testid="day-page"]'
const AGENDA_PAGE = '[data-testid="agenda-page"]'
const TRASH_PAGE = '[data-testid="trash-page"]'

/** The ⌘K box, and the rows of it that are NODES — a shell item that happens to
 *  share a word is not an answer to a query, which is what `data-id` tells
 *  apart (the browser tests read the same pair). */
const PALETTE_INPUT = '[data-testid="palette-input"]'
const PALETTE_HIT = '[data-testid="palette-item"][data-id^="node-"]'

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

const SECTIONS: Record<string, (page: Page) => Promise<void>> = {
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
    await page.locator('[data-testid="title-editor"]').first().waitFor()
    await page.keyboard.press("Control+Shift+Enter")
    await page.locator('[data-testid="edit-refusal"]').first().waitFor()
    await page.waitForTimeout(200)
    console.log(`  the walk onto \`doing\` says: ${await textOf(page, '[data-testid="edit-refusal"]')}`)
    console.log(`  the draft is still open: ${await page.locator('[data-testid="title-editor"]').first().isVisible()}`)
    console.log(`  and the file still says:  ${recordOf("hinges")}`)
    await shot(page, "walk-refused-draft-kept")

    await page.keyboard.press("Escape")
    await page.waitForTimeout(200)
    await openMenu(page, "install")
    await page.locator('[data-testid="node-menu-panel"] >> text=Mark doing').first().click()
    await page.locator('[data-testid="node-menu-said"]').first().waitFor()
    await page.waitForTimeout(200)
    console.log(`  the ••• menu says:        ${await textOf(page, '[data-testid="node-menu-said"]')}`)
    console.log(`  and the file still says:  ${recordOf("install")}`)
    await shot(page, "menu-refused")
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
    await opened(page, "/o/house.olai", OUTLINE_TREE)
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
   * archive, with its date and its mark still on it, and that `is:archived`
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
    await opened(page, "/o/house.olai", OUTLINE_TREE)
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
    await narrow(page, "is:archived")
    console.log(`  filtered by "is:archived": ${await said(page, FILTER_COUNT)}`)
    await shot(page, "day-after")

    await opened(page, "/trash", TRASH_PAGE)
    console.log(`  and the one page that draws it:\n${await piled(page)}`)
    await shot(page, "trash-holds-it")

    // The other half of the ruling: what went is the DEFAULT presence, never
    // the way to ask. The header's box is the same matcher, from any page.
    await page.keyboard.press("Control+k")
    await page.locator(PALETTE_INPUT).first().waitFor()
    await page.locator(PALETTE_INPUT).first().fill("is:archived")
    await page.waitForTimeout(SETTLE)
    console.log(`  \`is:archived\` still answers with:`)
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
    await page.goto(`${BASE}/n/order`)
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
    await page.goto(`${BASE}/n/hinges`)
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
   * The `•••` menu's own put-away — `archive_node` from the mouse, which is
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
    await openMenu(page, "install")
    await shot(page, "the-entry")
    await page.locator(TRASH_VERB).first().click()
    await page.locator('[data-testid="node-menu-confirm"]').first().waitFor()
    console.log(`  it asks: ${await textOf(page, '[data-testid="node-menu-confirm"]')}`)
    await shot(page, "asks")
    await page.locator(TRASH_VERB).first().click()
    await page.waitForTimeout(SETTLE)
    console.log(`  order: ${await order(page)}`)
    console.log(`  the record: ${recordOf("install")}`)
    await shot(page, "gone-from-the-page")
    await opened(page, "/trash", TRASH_PAGE)
    console.log(`  the pile:\n${await piled(page)}`)
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
  "retire-a-placement": async (page) => {
    await openMenu(page, "kitchen-herbs")
    console.log(`  the menu offers: ${await verbsOf(page)}`)
    await shot(page, "on-the-placement")

    // Another hand points a `see` at the PLACEMENT rather than at the node it
    // shows — the one shape the op refuses. `install` going is the frame that
    // says the write ARRIVED at this tab, which is the half a reload would
    // hide; the reload after it is the driver's own hygiene, not a claim —
    // this row is holding an open menu, and re-pressing the `•••` of a row
    // whose panel is up is the gesture that SHUTS one.
    rewrite(
      "house.olai",
      [
        `{"id":"kitchen","ord":"a0","title":"kitchen remodel #home","doing":"2026-08-01"}`,
        `{"id":"order","parent":"kitchen","ord":"a1","title":"order the new cabinets","see":["kitchen-herbs"]}`,
        `{"id":"kitchen-herbs","parent":"kitchen","ord":"a3","mirror":"herbs"}`,
      ].join("\n") + "\n",
    )
    await page.locator(row("install")).first().waitFor({ state: "detached" })
    await opened(page, "/o/house.olai", OUTLINE_TREE)

    await openMenu(page, "kitchen-herbs")
    await page.locator(PLACEMENT_VERB).first().click()
    await page.locator('[data-testid="node-menu-said"]').first().waitFor()
    console.log(`  it says: ${await textOf(page, '[data-testid="node-menu-said"]')}`)
    console.log(`  untouched: ${recordOf("kitchen-herbs")}`)
    await shot(page, "refused")

    // The way through: that `see` re-pointed at `herbs`, the node the
    // placement shows — through the panel, which is the same door the refusal
    // named.
    await opened(page, "/n/order", '[data-testid="zoom-title"]')
    await page.locator(`${EDGE_VERB}[data-relation="see"]`).click()
    await page.locator(EDGE_PANEL).first().waitFor()
    await page.locator(`${EDGE_DROP}[data-ref="kitchen-herbs"]`).first().click()
    await page.waitForTimeout(SETTLE)
    console.log(`  re-pointed: ${recordOf("order")}`)

    await opened(page, "/o/house.olai", OUTLINE_TREE)
    await openMenu(page, "kitchen-herbs")
    await page.locator(PLACEMENT_VERB).first().click()
    await page.waitForTimeout(SETTLE)
    console.log(`  the line:  ${recordOf("kitchen-herbs")}`)
    console.log(`  the node:  ${recordOf("herbs")}`)
    await shot(page, "retired")
    // …and the other half of what "retire a placement" means, which the shot
    // above cannot carry on its own: the node the line was drawing is exactly
    // where it lives, with its mark, its children and its own outline intact.
    await opened(page, "/o/garden.olai", OUTLINE_TREE)
    await shot(page, "the-node-stays")
  },
}

/**
 * What SHAPE of browser a section wants, where the default is not it.
 *
 * Two kinds of entry. The first is the thing that can ONLY be set at creation:
 * a context with a touchscreen and no mouse, which is the whole point of the
 * finger's section. The second is a TALLER WINDOW, and it is asked for here
 * rather than inside the section for the same reason — a resize after load
 * leaves this page reporting the new `innerHeight` while `100dvh` still
 * resolves against the old one (below). What wants one is a section whose
 * subject is the `•••` panel itself: fifteen entries is taller than the
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
const SHAPES: Record<string, Parameters<Browser["newContext"]>[0]> = {
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
  // The two sections ABOUT the menu, in a window the whole panel fits in.
  "move-to-trash-from-the-menu": { viewport: { width: 1100, height: 1000 } },
  "retire-a-placement": { viewport: { width: 1100, height: 1000 } },
}

const main = async () => {
  const section = SECTIONS[SECTION]
  if (section === undefined) {
    console.log(Object.keys(SECTIONS).join("\n"))
    return
  }
  // The browser tests' own argv (`support/hooks.ts`), and not for their
  // reasons: what matters here is `--headless=new`, which is a different
  // browser from the old headless shell — the shell does not turn a dispatched
  // touch into the pointer events a long press is made of, so a section about a
  // finger silently held nothing. The rest are the flags that make Chromium
  // survive a container with a small `/dev/shm`, harmless on a laptop.
  const browser = await chromium.launch({ args: [...BROWSER_ARGS] })
  // A CONTEXT of its own rather than `browser.newPage(options)`, which is the
  // same thing with an implicit one — except that a touchscreen is a property
  // of the context, and the DevTools session the finger's section opens has to
  // be against a context that has one. The browser tests take the same route
  // (`support/hooks.ts`).
  const context = await browser.newContext(
    SHAPES[SECTION] ?? { viewport: { width: 1100, height: 720 } },
  )
  const page = await context.newPage()
  page.on("pageerror", (error) => console.error("PAGE ERROR", error))
  await page.goto(`${BASE}/o/house.olai`)
  await page.locator('[data-testid="outline-tree"]').first().waitFor()
  await page.waitForTimeout(600)
  await section(page)
  await browser.close()
}

await main()
