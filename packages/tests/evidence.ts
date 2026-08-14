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
import { readdirSync, readFileSync } from "node:fs"
import { chromium, type Locator, type Page } from "playwright"

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

const picked = async (page: Page) =>
  await page.locator('[data-testid="selection-bar"]').getAttribute("data-rows")

const pick = async (page: Page, first: string, last?: string) => {
  await page.locator(title(first)).click({ modifiers: ["Control"] })
  if (last !== undefined) await page.locator(title(last)).click({ modifiers: ["Shift"] })
  await page.waitForTimeout(300)
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

const textOf = async (page: Page, locator: string) =>
  (await page.locator(locator).first().innerText()).replace(/\s+/g, " ").trim()

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
    if (!file.endsWith(".jsonl")) continue
    for (const line of readFileSync(`${vault}/${file}`, "utf8").split("\n")) {
      if (line.includes(`"id":"${id}"`)) return `${file} — ${line}`
    }
  }
  return `(no record for \`${id}\`)`
}

// ── the filter over the page ───────────────────────────────────────────

const FILTER_INPUT = '[data-testid="filter-input"]'
const FILTER_COUNT = '[data-testid="filter-count"]'
const FILTER_REFUSAL = '[data-testid="filter-refusal"]'

/** The tree as a reader sees it: one line per row, indented by depth, with a
 *  `*` on the rows the query actually SELECTED — the rest are the ancestry that
 *  leads to one, which is the whole of what "filter in place" means. */
const drawn = async (page: Page) =>
  (await page.locator('[data-testid="outline-tree"] [data-testid="node"]')
    .evaluateAll((rows) =>
      rows.map((one) => {
        let depth = 0
        for (let up = one.parentElement; up !== null; up = up.parentElement) {
          if (up.matches("[data-testid='node']")) depth += 1
        }
        const hit = one.getAttribute("data-match") === "true" ? "*" : " "
        const title = one.querySelector("[data-testid='node-title']")?.textContent ?? ""
        return `${hit} ${"  ".repeat(depth)}${title.trim()}`
      })
    )).join("\n")

/** Type a query and let the tree settle. Filtering is local — no round trip and
 *  no debounce — so this is a render rather than a fetch. */
const narrow = async (page: Page, query: string) => {
  await page.locator(FILTER_INPUT).fill(query)
  await page.waitForTimeout(300)
}

const said = async (page: Page, locator: string) =>
  (await page.locator(locator).first().textContent().catch(() => null)) ?? "(nothing)"

const SECTIONS: Record<string, (page: Page) => Promise<void>> = {
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
        "has:desc",
        "date:2026-08-10",
        "date:2026-08-01..2026-08-31",
        "cabinets -is:doing",
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
    // filter that searched for the TEXT `is:blocked` would draw an empty page
    // and give no reason.
    for (
      const [query, why] of [
        ["is:blocked", "a value the operator does not take"],
        // Shape-clean and impossible — and the worst kind to swallow, since
        // `2026-13` sorts between December and January and so reads as a
        // window rather than as nonsense.
        ["date:2026-13", "a date no calendar could hold"],
        // Matched folded, quoted as typed: telling somebody who wrote
        // `is:BLOCKED` that they wrote `is:blocked` is the refusal misquoting
        // the reader.
        ["is:BLOCKED", "the same refusal, quoting the reader"],
        // A space after the colon is not "date: takes a day" — the reader
        // wrote a day; the tokenizer split one word into two.
        ["date: 2026", "an operator given no value at all"],
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
    await box.fill("house.jsonl")
    await box.press("Enter")
    await page.locator('[data-testid="new-outline-said"]').waitFor()
    console.log(
      `  it says: ${await page.locator('[data-testid="new-outline-said"]').textContent()}`,
    )
    await shot(page, "refused")
    await box.fill("plans/next.jsonl")
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
}

const main = async () => {
  const section = SECTIONS[SECTION]
  if (section === undefined) {
    console.log(Object.keys(SECTIONS).join("\n"))
    return
  }
  const browser = await chromium.launch()
  const page = await browser.newPage({ viewport: { width: 1100, height: 720 } })
  page.on("pageerror", (error) => console.error("PAGE ERROR", error))
  await page.goto(`${BASE}/o/house.jsonl`)
  await page.locator('[data-testid="outline-tree"]').first().waitFor()
  await page.waitForTimeout(600)
  await section(page)
  await browser.close()
}

await main()
