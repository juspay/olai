import assert from "node:assert/strict"
import { Then, When } from "@olai/tests/harness/runner.ts"
import type { OlaiWorld } from "@olai/tests/harness/world.ts"
import { selector } from "@olai/ui-primitives/testids.ts"
import { TESTID as CHAT } from "olai-plugin-chat/testids"
import { TESTID as LAYOUT } from "olai-plugin-layout/testids"
import { attr } from "@olai/tests/harness/selectors.ts"
import { TAB } from "../selectors.ts"

When("I open every benchmark tool detail", { timeout: 120_000 }, async function (this: OlaiWorld) {
  const rows = this.chat(selector(CHAT.chatEntry))
  await this.waitUntil(async () => await rows.count() >= 300, "300 transcript rows")
  const folds = this.chat(selector(CHAT.chatToolFold))
  await this.waitUntil(async () => await folds.count() === 150, "all 150 benchmark tool rows")
  // Fixture preparation; measured switches below use real pointer events.
  await folds.evaluateAll(elements => elements.forEach(element => (element as HTMLElement).click()))
  await this.waitForFrame()
  assert.ok(await this.pane(1).locator("pre").count() >= 150, "code blocks are rendered")
})

Then("I measure both retained lane hiding strategies", { timeout: 120_000 }, async function (this: OlaiWorld) {
  const lane = selector(LAYOUT.lane)
  const box = await this.frontLane().boundingBox()
  assert.ok(box)
  const style = await this.page.addStyleTag({ content: `
    html[data-benchmark-hide="display"] ${lane}[data-lane-front="false"] { display: none !important; content-visibility: visible !important; }
    html[data-benchmark-hide="content"] ${lane}[data-lane-front="false"] {
      display: flex !important; content-visibility: hidden !important; visibility: hidden;
      position: fixed !important; pointer-events: none; overflow: hidden;
      left: ${box.x}px; top: ${box.y}px; width: ${box.width}px; height: ${box.height}px;
    }
  ` })
  const samples: Record<string, number[]> = { display: [], content: [] }
  try {
    // Warm both visited lanes before timing; no network or mount is measured.
    for (const mode of ["display", "content", "content", "display"] as const) {
      await this.page.evaluate(mode => { document.documentElement.dataset.benchmarkHide = mode }, mode)
      for (let turn = 0; turn < 12; turn++) {
        const target = this.page.locator(`${TAB}${attr("data-tab", String(turn % 2 === 0 ? 1 : 0))}`)
        const point = await target.boundingBox()
        assert.ok(point)
        await this.page.evaluate(() => {
          const state = window as unknown as { switchMeasurement: Promise<number> }
          state.switchMeasurement = new Promise(resolve => {
            document.addEventListener("pointerdown", () => {
              const start = performance.now()
              requestAnimationFrame(() => requestAnimationFrame(() => resolve(performance.now() - start)))
            }, { once: true, capture: true })
          })
        })
        await this.page.mouse.click(point.x + 12, point.y + point.height / 2)
        const elapsed = await this.page.evaluate(() => (window as unknown as { switchMeasurement: Promise<number> }).switchMeasurement)
        // Only the return to the large transcript; discard the first pair.
        if (turn >= 2 && turn % 2 === 1) samples[mode]!.push(elapsed)
      }
    }
    for (const [mode, values] of Object.entries(samples)) {
      values.sort((a, b) => a - b)
      assert.equal(values.length, 10)
      console.log(`lane-switch-benchmark ${JSON.stringify({ mode, rows: 300, samples: values, medianMs: values[5], p95Ms: values[9] })}`)
    }
  } finally {
    await style.evaluate(element => element.parentNode?.removeChild(element))
    await this.page.evaluate(() => { delete document.documentElement.dataset.benchmarkHide })
  }
})
