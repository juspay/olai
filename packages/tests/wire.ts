import { chromium, type Page } from "playwright"
import { mkdirSync, writeFileSync } from "node:fs"
import * as path from "node:path"

import { BROWSER_ARGS } from "./support/browser.ts"
import { delayed } from "./delay.ts"

const BASE = process.env["BASE"] ?? "http://127.0.0.1:7788"
const VAULT = process.env["VAULT"] ?? ""
const LABEL = process.env["LABEL"] ?? "unlabelled"
const SESSION = process.env["SESSION"] ?? "preview"
const DELAY = Number(process.env["DELAY"] ?? "0")

const PAGE = "dashboard.html"
const NOTE = "manual.md"

const FILLER = "x".repeat(1_000_000)

const pageAt = (heading: string) =>
  `<h1>${heading}</h1>\n<!-- ${FILLER} -->\n`

const note = () => `# Manual\n\n${"a note about the cabinets. ".repeat(2_000)}\n`

interface Reading {
  readonly what: string
  readonly socket: number
  readonly media: number
  readonly asks: number
  readonly frames: number
}

const MATCHER = [
  `"tag":"surface/search/matching"`,
  `"tag":"surface/narrowing/get"`,
  `"tag":"surface/outlines/narrowing/get"`,
]

interface Size {
  readonly outlines: number
  readonly rows: number
  readonly documents: number
}
const READING: Size = { outlines: 40, rows: 200, documents: 60 }
const BIG: Size = { outlines: 300, rows: 300, documents: 200 }

const outlineFile = (file: number) =>
  `notes/outline-${String(file).padStart(3, "0")}.olai`

const outlineAt = (file: number, rows: number): string => {
  const lines: Array<string> = []
  for (let row = 0; row < rows; row += 1) {
    const id = `n${file}-${row}`
    const parent = row % 10 === 0 ? undefined : `n${file}-${row - (row % 10)}`
    const title = `row ${row} of outline ${file} — a title of the length people write`
    const fields: Array<string> = [
      `"id":"${id}"`,
      ...(parent === undefined ? [] : [`"parent":"${parent}"`]),
      `"ord":"a${String(row).padStart(4, "0")}"`,
      `"title":"${title}"`,
    ]
    if (row % 7 === 0) fields.push(`"done":"2026-08-0${(row % 9) + 1}"`)
    else if (row % 3 === 0) fields.push(`"todo":true`)
    if (row % 5 === 0) {
      fields.push(
        `"desc":"a note under this row, two sentences long, of the kind a person writes when they are thinking. It is here because a third of rows in a real vault carry one."`,
      )
    }
    if (row % 11 === 0) fields.push(`"date":"2026-08-${String((row % 28) + 1).padStart(2, "0")}"`)
    if (row % 13 === 0 && row > 0) fields.push(`"see":["n${file}-${row - 13}"]`)
    if (row % 17 === 0 && row > 0) fields.push(`"after":["n${file}-${row - 17}"]`)
    lines.push(`{${fields.join(",")}}`)
  }
  return `${lines.join("\n")}\n`
}

const corpus = (
  write: (file: string, text: string) => void,
  { outlines, rows, documents }: Size,
): void => {
  for (let file = 0; file < outlines; file += 1) {
    write(outlineFile(file), outlineAt(file, rows))
  }
  for (let doc = 0; doc < documents; doc += 1) {
    write(
      `notes/doc-${String(doc).padStart(2, "0")}.md`,
      `# Document ${doc}\n\n${"prose about the work. ".repeat(200)}\n`,
    )
  }
  write("notes/2026-08-11.md", "# The eleventh\n\nwhat happened.\n")
}

const main = async () => {
  if (VAULT === "") throw new Error("VAULT must name the directory being served")

  let socket = 0
  let media = 0
  let asks = 0
  let frames = 0
  const readings: Array<Reading> = []
  const write = (file: string, text: string) => {
    const full = path.join(VAULT, file)
    mkdirSync(path.dirname(full), { recursive: true })
    writeFileSync(full, text)
  }

  const session = SESSIONS[SESSION as keyof typeof SESSIONS] ?? SESSIONS.preview
  await session.seed(write)

  const served = new URL(BASE)
  const link = DELAY === 0 ? null : await delayed(
    { host: served.hostname, port: Number(served.port) },
    DELAY,
  )
  const base = link === null ? BASE : `http://127.0.0.1:${link.port}`

  const browser = await chromium.launch({ args: [...BROWSER_ARGS] })
  const context = await browser.newContext({ viewport: { width: 1280, height: 900 } })
  const page = await context.newPage()

  page.on("websocket", (socketed) => {
    socketed.on("framereceived", (frame) => {
      socket += typeof frame.payload === "string"
        ? Buffer.byteLength(frame.payload)
        : frame.payload.byteLength
      frames += 1
    })
    socketed.on("framesent", (frame) => {
      const text = typeof frame.payload === "string"
        ? frame.payload
        : frame.payload.toString("utf8")
      if (MATCHER.some((tag) => text.includes(tag))) asks += 1
    })
  })
  page.on("response", (response) => {
    if (!response.url().includes("/media/")) return
    void response
      .body()
      .then((body) => {
        media += body.byteLength
      })
      .catch(() => {})
  })

  const mark = async (what: string) => {
    await page.waitForTimeout(500)
    readings.push({ what, socket, media, asks, frames })
  }

  await session.drive({ page, base, mark, write, asks: () => asks })

  await browser.close()
  link?.close()
  report(LABEL, readings)
}

const preview = async (
  page: Page,
  base: string,
  mark: (what: string) => Promise<void>,
  write: (file: string, text: string) => void,
): Promise<void> => {
  const heading = async (text: string) => {
    await page
      .frameLocator('[data-testid="hypertext-preview"]')
      .locator("h1")
      .filter({ hasText: text })
      .waitFor({ timeout: 15_000 })
  }

  await page.goto(base)
  await page.locator('[data-testid="outline-link"]').first().waitFor()
  await mark("the app opens")

  await page.locator(`[data-testid="hypertext-link"][data-file="${PAGE}"]`).click()
  await heading("Before")
  await mark(`the preview opens (${PAGE}, ${(FILLER.length / 1e6).toFixed(1)} MB)`)

  for (const at of ["First edit", "Second edit", "Third edit"]) {
    write(PAGE, pageAt(at))
    await heading(at)
    await mark(`the file is rewritten (${at.toLowerCase()})`)
  }

  await page.locator(`[data-testid="document-link"][data-file="${NOTE}"]`).click()
  await page.locator('[data-testid="document-body"]').waitFor()
  await mark(`a note is opened (${NOTE}, ${(note().length / 1e3).toFixed(0)} kB)`)
}

const pages = async (
  page: Page,
  base: string,
  mark: (what: string) => Promise<void>,
): Promise<void> => {
  const FIRST = outlineFile(0)
  const SECOND = outlineFile(1)
  const rows = page.locator("[data-row-key]")

  await page.goto(`${base}/${FIRST}`)
  await page.locator('[data-testid="outline-link"]').first().waitFor({ timeout: 30_000 })
  await rows.first().waitFor({ timeout: 30_000 })
  await mark(
    `the app opens (${READING.outlines} outlines × ${READING.rows} rows, ${READING.documents} documents)`,
  )

  await page.locator(`[data-testid="outline-link"][data-file="${SECOND}"]`).click()
  await page.locator(`[data-node-id="n1-0"]`).first().waitFor({ timeout: 30_000 })
  await mark("a second outline is opened")

  await page.locator('[data-testid="zoom"]').first().click()
  await page.locator('[data-testid="zoom-title"]').waitFor({ timeout: 30_000 })
  await mark("a node is zoomed")

  await page.locator(`[data-testid="outline-link"][data-file="${FIRST}"]`).click()
  await page.locator(`[data-node-id="n0-0"]`).first().waitFor({ timeout: 30_000 })
  await mark("back to the first outline")

  await page.locator('[data-testid="document-link"]').first().click()
  await page.locator('[data-testid="document-body"]').waitFor({ timeout: 30_000 })
  await mark("a document is opened")

  const toggle = page.locator('[data-testid="calendar-toggle"]')
  if ((await toggle.getAttribute("aria-expanded")) !== "true") await toggle.click()
  await page.locator('[data-testid="calendar-day"][data-date="2026-08-12"] a').click()
  await page.locator('[data-testid="day-page"]').waitFor({ timeout: 30_000 })
  await mark("a day page is opened")

  await page.locator('[data-testid="agenda-link"]').click()
  await page.locator('[data-testid="agenda-page"]').waitFor({ timeout: 30_000 })
  await mark("the agenda is opened")

  await page.locator('[data-testid="trash-link"]').click()
  await page.locator('[data-testid="trash-page"]').waitFor({ timeout: 30_000 })
  await mark("the trash is opened")
}

const PICKED = 30

const filtered = async (
  page: Page,
  base: string,
  mark: (what: string) => Promise<void>,
  counted: () => number,
): Promise<void> => {
  const title = (id: string) =>
    page.locator(`[data-testid="node"][data-node-id="${id}"]`)
      .locator('[data-testid="node-title"]').first()

  await page.goto(`${base}/${outlineFile(0)}?q=title`)
  await page.locator('[data-testid="outline-link"]').first().waitFor({ timeout: 30_000 })
  await page.locator('[data-testid="filter-bar"]').waitFor({ timeout: 30_000 })
  await title("n0-1").waitFor({ timeout: 30_000 })
  await mark(
    `a filtered outline is opened (${BIG.rows} rows of ${BIG.outlines} outlines — ` +
      `${(BIG.outlines * BIG.rows).toLocaleString("en")} nodes)`,
  )
  if (counted() === 0) {
    throw new Error(
      `a filtered page was opened and none of ${MATCHER.join(" / ")} was seen ` +
        "on the wire — the request tags this driver counts have moved, so every " +
        "number below would be a zero that means nothing",
    )
  }

  await title("n0-1").click({ modifiers: ["ControlOrMeta"] })
  await title(`n0-${PICKED}`).click({ modifiers: ["Shift"] })
  await page.locator('[data-testid="selection-bar"]').waitFor({ timeout: 30_000 })
  await mark(`${PICKED} rows are picked`)

  await page.keyboard.press("ControlOrMeta+Enter")
  await page.waitForTimeout(5_000)
  await mark(`the pick is ticked off (${PICKED} writes, one gesture)`)
}


const chat = async (
  page: Page,
  base: string,
  mark: (what: string) => Promise<void>,
): Promise<void> => {
  const panel = page.locator('[data-testid="chat-panel"]')
  await page.goto(base)
  await page.locator('[data-testid="outline-link"]').first().waitFor({ timeout: 30_000 })
  await page.locator('[data-testid="chat-new"]').click()
  await page.locator('[data-testid="palette-item"]').first().click()
  await page.locator('[data-testid="palette-input"]').fill("Hello")
  await page.locator('[data-testid="palette-input"]').press("Enter")
  await panel.waitFor({ state: "visible", timeout: 30_000 })
  await page.waitForFunction(
    () => {
      const status = document
        .querySelector('[data-testid="chat-panel"]')
        ?.getAttribute("data-status")
      return status === "idle" || status === "off" || status === "gone"
    },
    undefined,
    { timeout: 60_000 },
  )
  const status = await panel.getAttribute("data-status")
  if (status !== "idle") {
    throw new Error(
      `the chat session needs an agent and this panel has none (data-status=${status}). ` +
        "Pass AGENT=<path to an ACP agent> — e.g. " +
        "AGENT=$PWD/../plugins/claude/e2e/fake/claude-agent-acp SESSION=chat bash wire.sh",
    )
  }
  await mark("the app opens and a new chat is opened")

  const turn = async (prompt: string, what: string) => {
    const answers = page.locator('[data-testid="chat-entry"][data-kind="agent"]')
    const before = await answers.count()
    const asked = Date.now()
    await page.locator('[data-testid="chat-input"]').fill(prompt)
    await page.locator('[data-testid="chat-send"]').click()
    await page.waitForFunction(
      () =>
        document.querySelector('[data-testid="chat-panel"]')?.getAttribute("data-status") ===
          "thinking",
      undefined,
      { timeout: 60_000 },
    )
    await page.waitForFunction(
      () =>
        document.querySelector('[data-testid="chat-panel"]')?.getAttribute("data-status") ===
          "idle",
      undefined,
      { timeout: 300_000 },
    )
    const finished = Date.now()
    const answer = answers.nth(before)
    await page.waitForFunction(
      (nth) =>
        document.querySelectorAll('[data-testid="chat-entry"][data-kind="agent"]')[nth]
          ?.getAttribute("data-streaming") !== "true",
      before,
      { timeout: 300_000 },
    )
    const arrived = Date.now()
    const said = await answer.locator('[data-testid="chat-said"]').innerText()
    const seconds = (millis: number) => `${(millis / 1000).toFixed(1)}s`
    await mark(
      `${what} — ${said.length} chars; agent done ${seconds(finished - asked)}, ` +
        `answer done ${seconds(arrived - asked)}, panel ${seconds(arrived - finished)} behind`,
    )
  }

  await turn("stream slow", "an answer streams in at a model's pace")
  await turn("stream", "...and one arrives as fast as the pipe will take it")
}

type Write = (file: string, text: string) => void
type Mark = (what: string) => Promise<void>

interface Session {
  readonly seed: (write: Write) => Promise<void>
  readonly drive: (
    at: {
      readonly page: Page
      readonly base: string
      readonly mark: Mark
      readonly write: Write
      readonly asks: () => number
    },
  ) => Promise<void>
}

const seedCorpus = (size: Size) => async (write: Write): Promise<void> => {
  corpus(write, size)
  await new Promise((ready) => setTimeout(ready, 5_000))
}

const SESSIONS = {
  preview: {
    seed: async (write: Write): Promise<void> => {
      write(PAGE, pageAt("Before"))
      write(NOTE, note())
    },
    drive: ({ page, base, mark, write }) => preview(page, base, mark, write),
  },
  pages: {
    seed: seedCorpus(READING),
    drive: ({ page, base, mark }) => pages(page, base, mark),
  },
  filter: {
    seed: seedCorpus(BIG),
    drive: ({ page, base, mark, asks }) => filtered(page, base, mark, asks),
  },
  chat: {
    seed: async (): Promise<void> => {},
    drive: ({ page, base, mark }) => chat(page, base, mark),
  },
} satisfies Record<string, Session>

const kb = (bytes: number) => `${(bytes / 1024).toFixed(1)} kB`

const report = (label: string, readings: ReadonlyArray<Reading>) => {
  console.log(`\n── ${label} ─────────────────────────────────────`)
  console.log(
    ["step", "socket (total)", "frames (total)", "media (total)", "matcher asks (total)"]
      .join("\t"),
  )
  for (const reading of readings) {
    console.log(
      [
        reading.what,
        kb(reading.socket),
        String(reading.frames),
        kb(reading.media),
        String(reading.asks),
      ].join("\t"),
    )
  }
  const last = readings[readings.length - 1]
  console.log(
    `TOTAL\t${kb(last?.socket ?? 0)}\t${last?.frames ?? 0}\t${kb(last?.media ?? 0)}\t${last?.asks ?? 0}`,
  )
}

await main()

export {}
