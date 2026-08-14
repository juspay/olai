/**
 * The evidence pass: drive the real app in a real browser, one gesture at a
 * time, and put a screenshot beside each. Not part of the suite — the promises
 * live in `features/dragdrop_multiselect.feature`; this is what a person looks
 * at.
 *
 * ONE SECTION PER RUN, against a directory the driver has just re-copied and a
 * server it has just started (`evidence.sh`). Restoring the fixture underneath
 * a running server is not the same thing: the store holds the snapshot it last
 * wrote, and a file put back with the same length is a change its watcher is
 * entitled not to notice — so a gesture made after one would be a gesture over
 * a frame nobody can reproduce.
 */
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

const at = async (locator: Locator) => {
  const box = await locator.boundingBox()
  if (box === null) throw new Error("nothing to aim at")
  return box
}

/** Press the bullet and travel to a point, without letting go. */
const carry = async (page: Page, from: string, x: number, y: number) => {
  const box = await at(page.locator(from))
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

const SECTIONS: Record<string, (page: Page) => Promise<void>> = {
  "drag-to-reorder": async (page) => {
    console.log(`  before: ${await order(page)}`)
    await shot(page, "outline")
    const above = await at(page.locator(title("handles")))
    await carry(page, handle("knobs"), above.x + 4, above.y - 2)
    console.log(`  the line promises: ${await promised(page)}`)
    await shot(page, "dragging")
    await page.mouse.up()
    await page.waitForTimeout(SETTLE)
    console.log(`  after:  ${await order(page)}`)
    await shot(page, "dropped")
  },

  "drag-into-a-branch": async (page) => {
    const under = await at(page.locator(title("order")))
    await carry(page, handle("install"), under.x + 40, under.y + under.height + 2)
    console.log(`  the line promises: ${await promised(page)}`)
    await shot(page, "dragging")
    await page.mouse.up()
    await page.waitForTimeout(SETTLE)
    console.log(`  install sits under ${await parentOf(page, "install")}, and took its children:`)
    console.log(`    handles under ${await parentOf(page, "handles")}`)
    await shot(page, "reparented")
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
    const front = await at(page.locator(title("handles")))
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
