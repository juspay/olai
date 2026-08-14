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
import { type Browser, chromium, type Locator, type Page } from "playwright"

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

const SECTIONS: Record<string, (page: Page) => Promise<void>> = {
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
    console.log(`  before: ${await picked(page) ?? "nothing picked"}`)
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
    console.log(`  room: ${await room(page)}`)
    console.log(`  at: ${await page.evaluate(() => window.scrollY)}`)
    await shot(page, "at-the-top")
    const box = await boxOf(page.locator(handle("demo")))
    await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2)
    await page.mouse.down()
    const view = page.viewportSize()
    await page.mouse.move(box.x + 40, (view?.height ?? 0) - 8, { steps: 10 })
    await page.waitForTimeout(900)
    console.log(`  held at the bottom edge, the page is at: ${
      await page.evaluate(() => window.scrollY)
    }`)
    console.log(`  the line promises: ${await promised(page)}`)
    await shot(page, "scrolled")
    await page.mouse.up()
    await page.waitForTimeout(SETTLE)
    console.log(`  order: ${await order(page)}`)
    await shot(page, "dropped")
  },

  "a-sweep-keeps-up": async (page) => {
    const from = await rail(page, "demo")
    const view = page.viewportSize()
    await page.mouse.move(from.x, from.y)
    await page.mouse.down()
    await page.mouse.move(from.x, (view?.height ?? 0) - 8, { steps: 10 })
    await page.waitForTimeout(1_000)
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

    // A flick FIRST, because it is the promise the rest of this rests on: the
    // page still scrolls under a finger that starts on the handle.
    console.log(`  room: ${await room(page)}`)
    const bullet = await boxOf(page.locator(handle("kitchen")))
    const from = { x: bullet.x + bullet.width / 2, y: bullet.y + bullet.height / 2 }
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
    await page.evaluate(() => window.scrollTo(0, 0))
    await page.waitForTimeout(400)

    // Now the gesture itself: hold, and the row lifts where it is.
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

/**
 * What SHAPE of browser a section wants, where the default is not it.
 *
 * Two of the gestures below are only themselves in a particular one: an
 * auto-scroll needs a window shorter than the outline (no corpus here is taller
 * than a laptop — they are outlines a person can read inside a scenario), and a
 * touch drag needs a context with a touchscreen and no mouse at all.
 */
const SHAPES: Record<string, Parameters<Browser["newPage"]>[0]> = {
  "the-page-keeps-up": { viewport: { width: 1100, height: 320 } },
  "a-sweep-keeps-up": { viewport: { width: 1100, height: 320 } },
  "a-finger-picks-a-row-up": {
    viewport: { width: 390, height: 720 },
    hasTouch: true,
    isMobile: true,
  },
}

const main = async () => {
  const section = SECTIONS[SECTION]
  if (section === undefined) {
    console.log(Object.keys(SECTIONS).join("\n"))
    return
  }
  const browser = await chromium.launch()
  const page = await browser.newPage(
    SHAPES[SECTION] ?? { viewport: { width: 1100, height: 720 } },
  )
  page.on("pageerror", (error) => console.error("PAGE ERROR", error))
  await page.goto(`${BASE}/o/house.jsonl`)
  await page.locator('[data-testid="outline-tree"]').first().waitFor()
  await page.waitForTimeout(600)
  await section(page)
  await browser.close()
}

await main()
