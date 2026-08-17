/**
 * What an edit-while-previewing session costs the wire, measured rather than
 * argued.
 *
 * Not part of the suite and not a gate — the promises live in the features.
 * This is the instrument that produced the numbers in the PR that closed
 * `preview-body-not-shipped`, and it is kept so the next person can re-run it
 * rather than believe them.
 *
 * WHAT IT MEASURES is the two ways a previewed `.html` can reach a reader:
 * every byte the WEBSOCKET delivered to the tab, and every byte the frame
 * fetched over HTTP off `/media/`. The defect was that a preview paid both —
 * the collection streamed the whole body to a page that draws none of it, and
 * the frame then fetched the same file for itself — so the interesting number
 * is the first one, and the second is what it is supposed to be beside.
 *
 * The session is the ordinary one: open the app, open a saved page, then edit
 * that page three times while it is on screen, waiting each time for the
 * preview to show what the file now says. A `.md` is opened at the end, because
 * the fix must not have cost the reader who genuinely needs a body.
 *
 * It is VERSION-INDEPENDENT on purpose — Playwright, a URL, and this package's
 * own browser argv, with no `@olai/*` import anywhere — so the same driver
 * measures a server built from this branch and one built from master, and the
 * two numbers are of the same session. `wire.sh` is what stands each of those
 * up.
 */
import { chromium } from "playwright"
import { writeFileSync } from "node:fs"
import * as path from "node:path"

import { BROWSER_ARGS } from "./support/browser.ts"

const BASE = process.env["BASE"] ?? "http://127.0.0.1:7788"
const VAULT = process.env["VAULT"] ?? ""
const LABEL = process.env["LABEL"] ?? "unlabelled"

/** The saved page under test, and the note beside it. Both are written by this
 *  driver rather than taken from a fixture corpus, so the two runs measure the
 *  same bytes whatever either branch's fixtures happen to hold. */
const PAGE = "dashboard.html"
const NOTE = "manual.md"

/** How big a saved page is, in the case this is about. A dashboard exported
 *  with its data inlined is megabytes; a megabyte is the conservative end of
 *  that and it keeps the run quick. */
const FILLER = "x".repeat(1_000_000)

const pageAt = (heading: string) =>
  `<h1>${heading}</h1>\n<!-- ${FILLER} -->\n`

/** A note with a body worth seeing in the numbers — this is the reader the fix
 *  must not have broken, so its body had better still be on the wire. */
const note = () => `# Manual\n\n${"a note about the cabinets. ".repeat(2_000)}\n`

interface Reading {
  readonly what: string
  /** Bytes the websocket delivered to this tab, cumulative. */
  readonly socket: number
  /** Bytes fetched off `/media/`, cumulative. */
  readonly media: number
}

const main = async () => {
  if (VAULT === "") throw new Error("VAULT must name the directory being served")

  let socket = 0
  let media = 0
  const readings: Array<Reading> = []
  const write = (file: string, text: string) =>
    writeFileSync(path.join(VAULT, file), text)

  write(PAGE, pageAt("Before"))
  write(NOTE, note())

  const browser = await chromium.launch({ args: [...BROWSER_ARGS] })
  const context = await browser.newContext({ viewport: { width: 1280, height: 900 } })
  const page = await context.newPage()

  // EVERY frame the tab was delivered, counted as bytes. `framereceived` is the
  // browser's own accounting of what arrived, which is the number this is
  // about: what the server chose to send this reader.
  page.on("websocket", (socketed) => {
    socketed.on("framereceived", (frame) => {
      socket += typeof frame.payload === "string"
        ? Buffer.byteLength(frame.payload)
        : frame.payload.byteLength
    })
  })
  // …and the other leg: what the preview frame fetched for itself. Counted off
  // the response rather than off the file's size, so a 304 or an empty answer
  // counts as what it was.
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
    // One beat for the last frames and the last fetch to be accounted.
    await page.waitForTimeout(500)
    readings.push({ what, socket, media })
  }

  const heading = async (text: string) => {
    await page
      .frameLocator('[data-testid="hypertext-preview"]')
      .locator("h1")
      .filter({ hasText: text })
      .waitFor({ timeout: 15_000 })
  }

  await page.goto(BASE)
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

  await browser.close()
  report(LABEL, readings)
}

const kb = (bytes: number) => `${(bytes / 1024).toFixed(1)} kB`

const report = (label: string, readings: ReadonlyArray<Reading>) => {
  console.log(`\n── ${label} ─────────────────────────────────────`)
  console.log(
    ["step", "socket (total)", "media (total)"].join("\t"),
  )
  for (const reading of readings) {
    console.log([reading.what, kb(reading.socket), kb(reading.media)].join("\t"))
  }
  const last = readings[readings.length - 1]
  console.log(`TOTAL\t${kb(last?.socket ?? 0)}\t${kb(last?.media ?? 0)}`)
}

await main()

// A driver, not a step: nothing above throws for a wrong number, and there is
// nothing here for a runner to collect.
export {}
