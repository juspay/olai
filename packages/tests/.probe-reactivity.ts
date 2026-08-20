// Scratch probe (not part of the suite): which sidebar DOM nodes survive a
// sidebar click, and what the pane does meanwhile. Delete after use.
import { chromium } from "playwright"

const base = process.env.PROBE_URL ?? "http://127.0.0.1:47123"
const from = process.argv[2] ?? "/notes/palette.md"
const to = process.argv[3] ?? "/notes/second.md"

const browser = await chromium.launch()
const page = await browser.newPage({ viewport: { width: 1400, height: 900 } })
await page.goto(base + from)
await page.waitForSelector(`a[href="${to}"]`)
await page.waitForFunction(() => !document.querySelector("main")?.textContent?.includes("Reading…"))
await page.waitForTimeout(300)

await page.evaluate(() => {
  const side = document.querySelector('[data-testid="sidebar"]')!
  const pane = document.querySelector("main")!
  let i = 0
  side.querySelectorAll("*").forEach((el) => ((el as any).__tag = ++i))
  ;(window as any).__tagged = i
  const log: unknown[] = []
  ;(window as any).__log = log
  const desc = (n: Node): string =>
    n instanceof Element
      ? `${n.tagName.toLowerCase()}` +
        (n.getAttribute("data-testid") ? `[${n.getAttribute("data-testid")}]` : "") +
        (n.getAttribute("data-path") ? `(path=${n.getAttribute("data-path")})` : "") +
        (n.getAttribute("href") ? `(href=${n.getAttribute("href")})` : "") +
        ((n as any).__tag ? `#${(n as any).__tag}` : "#new")
      : `text(${JSON.stringify((n.textContent ?? "").slice(0, 30))})`
  const mo = new MutationObserver((recs) => {
    for (const r of recs) {
      if (r.type === "childList") {
        log.push({ where: "sidebar", t: "childList", target: desc(r.target), added: [...r.addedNodes].map(desc), removed: [...r.removedNodes].map(desc) })
      } else {
        const now = (r.target as Element).getAttribute(r.attributeName!)
        if (r.oldValue === now) continue
        log.push({ where: "sidebar", t: "attr", target: desc(r.target), attr: r.attributeName, old: r.oldValue, now })
      }
    }
  })
  mo.observe(side, { subtree: true, childList: true, attributes: true, attributeOldValue: true })
  const mp = new MutationObserver((recs) => {
    for (const r of recs) {
      if (r.type === "childList") {
        log.push({ where: "pane", t: "childList", target: desc(r.target), added: [...r.addedNodes].map(desc), removed: [...r.removedNodes].map(desc) })
      }
    }
  })
  mp.observe(pane, { subtree: true, childList: true })
})

await page.click(`a[href="${to}"]`)
await page.waitForFunction(
  (to) => location.pathname === to && !document.querySelector("main")?.textContent?.includes("Reading…"),
  to,
)
await page.waitForTimeout(600)

const result = await page.evaluate(() => {
  const side = document.querySelector('[data-testid="sidebar"]')!
  const still = new Set<number>()
  side.querySelectorAll("*").forEach((el) => {
    const t = (el as any).__tag
    if (t) still.add(t)
  })
  const total = (window as any).__tagged as number
  const gone: number[] = []
  for (let i = 1; i <= total; i++) if (!still.has(i)) gone.push(i)
  const fresh = [...side.querySelectorAll("*")].filter((el) => !(el as any).__tag).length
  return { total, gone: gone.length, fresh, log: (window as any).__log as unknown[] }
})

console.log(`sidebar elements before: ${result.total}; destroyed: ${result.gone}; newly created: ${result.fresh}`)
const log = result.log as Array<Record<string, unknown>>
const side = log.filter((l) => l.where === "sidebar")
const pane = log.filter((l) => l.where === "pane")
console.log(`sidebar mutations: ${side.length}; pane childList mutations: ${pane.length}`)
console.log("--- sidebar mutations ---")
for (const l of side) console.log(JSON.stringify(l))
console.log("--- pane mutations (first 12) ---")
for (const l of pane.slice(0, 12)) console.log(JSON.stringify(l))
await browser.close()
