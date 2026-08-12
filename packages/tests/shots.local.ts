/**
 * The evidence for the silent-errors PR: each fix, on screen, in a real browser
 * against the nix-built binary.
 *
 * Run from the worktree root inside the e2e shell:
 *
 *   OLAI_BIN=$(nix build .#olai --no-link --print-out-paths)/bin/olai \
 *     nix develop .#e2e -c bun ../silent-errors-out/shots.ts
 *
 * It is deliberately NOT part of the suite: the suite asserts, this one looks.
 * Everything it photographs has a scenario or a unit test of its own — the
 * pictures are for a person reviewing the PR, and a picture that can go stale
 * without failing anything does not belong in a lane.
 */

import { spawn } from "node:child_process"
import * as fs from "node:fs"
import * as os from "node:os"
import * as path from "node:path"

import { chromium } from "playwright"

const OUT = path.dirname(new URL(import.meta.url).pathname)
const ROOT = path.resolve(OUT, "..", "silent-errors")
const BIN = process.env["OLAI_BIN"]
if (BIN === undefined) throw new Error("set OLAI_BIN to the nix-built olai binary")

const PORT = 7799

/** A directory to serve: one outline whose note names a picture this app will
 *  not draw, which is the ordinary way of getting a picture wrong. */
const served = (): string => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "olai-shots-"))
  fs.writeFileSync(
    path.join(dir, "house.jsonl"),
    [
      JSON.stringify({ id: "kitchen", ord: "a0", title: "kitchen remodel #home" }),
      JSON.stringify({
        id: "counters",
        parent: "kitchen",
        ord: "a0",
        title: "pick the counter stone",
        desc: "the one from the showroom:\n\n![the slab](slab.pngg)\n",
      }),
      JSON.stringify({
        id: "order",
        parent: "kitchen",
        ord: "a1",
        title: "order the new cabinets",
      }),
    ].join("\n") + "\n",
  )
  return dir
}

const sleep = (ms: number) => new Promise((done) => setTimeout(done, ms))

const shot = async (page: import("playwright").Page, name: string): Promise<void> => {
  await page.screenshot({ path: path.join(OUT, `${name}.png`), fullPage: false })
  console.log(`  → ${name}.png`)
}

const dir = served()
const olai = spawn(
  BIN,
  ["web", dir, "--port", String(PORT), "--host", "127.0.0.1", "--no-commit"],
  {
    stdio: ["ignore", "pipe", "pipe"],
    env: {
      ...process.env,
      OLAI_ACP_AGENT: path.join(ROOT, "packages/tests/agent/fake-acp-agent.ts"),
      OLAI_LOG: "logfmt",
    },
  },
)
olai.stderr.setEncoding("utf8")

await new Promise<void>((ready) => {
  olai.stderr.on("data", (line: string) => {
    if (line.includes("serving")) ready()
  })
})

const browser = await chromium.launch()
const page = await browser.newPage({ viewport: { width: 1280, height: 860 } })

try {
  await page.goto(`http://127.0.0.1:${PORT}/o/house.jsonl`)
  await page.waitForSelector('[data-testid="outline-tree"]', { timeout: 30_000 })

  // 1. A picture this app will not draw says so, where the picture would have
  //    been — instead of the element being deleted and the page having a hole.
  await page.locator('[data-testid="node"][data-node-id="counters"] [data-testid="desc"]')
    .first()
    .click()
  await page.waitForSelector('[data-testid="undrawn-picture"]', { timeout: 10_000 })
  await shot(page, "1-undrawn-picture")

  // 2. A copy the browser refused. The clipboard is gated on a secure context,
  //    so every LAN reader on plain http is this case.
  await page.evaluate(() => {
    Object.defineProperty(navigator, "clipboard", {
      configurable: true,
      value: { writeText: () => Promise.reject(new Error("not available")) },
    })
  })
  await page.locator('[data-testid="node"][data-node-id="order"]').hover()
  await page.locator('[data-testid="node"][data-node-id="order"] [data-testid="node-menu"]')
    .click()
  await page.locator('[data-testid="node-menu-item"][data-action="copy-link"]').click()
  await page.waitForSelector('[data-testid="node-menu-said"]', { timeout: 10_000 })
  await shot(page, "2-clipboard-refused")

  // 3. A cancel that did not stop the turn. `deaf` is an agent that stops
  //    reading and goes on streaming — the write succeeds and nothing happens,
  //    which is what the human saw.
  await page.locator('[data-testid="chat-toggle"]').click()
  await page.waitForSelector('[data-testid="chat-input"]', { timeout: 30_000 })
  await page.locator('[data-testid="chat-input"]').fill("deaf")
  await page.locator('[data-testid="chat-send"]').click()
  await page.waitForSelector('[data-testid="chat-cancel"]', { timeout: 30_000 })
  await page.locator('[data-testid="chat-cancel"]').click()
  await page.waitForSelector('[data-testid="chat-trouble"]', { timeout: 30_000 })
  await shot(page, "3-cancel-not-obeyed")

  // 4. A picker that could not ask. `lose` makes the agent refuse every
  //    `session/list` from then on — which used to render as "no stored
  //    conversations", a claim about the agent's disk.
  await page.locator('[data-testid="chat-input"]').fill("lose")
  await page.locator('[data-testid="chat-send"]').click()
  await sleep(1500)
  await page.locator('[data-testid="chat-sessions"]').click()
  await page.waitForSelector('[data-testid="chat-sessions-refused"]', { timeout: 15_000 })
  await shot(page, "4-picker-refused")

  // 5. The directory goes away under the running server. The store's other
  //    kind of error — log-only until now — over the tree it left behind.
  fs.rmSync(dir, { recursive: true, force: true })
  await page.waitForSelector('[data-testid="stale-banner"]', { timeout: 90_000 })
  await shot(page, "5-unreadable-directory")

  // 6. The connection pill, which is now a claim about what REACHES the page:
  //    the transport's status AND the framework's subscription-health fact.
  //    Photographed healthy, because there is no way to kill one subscription
  //    from a browser while leaving its socket up — the degraded mapping is
  //    unit-tested (`connection/status.test.ts`).
  await page.locator('[data-testid="connection"]').scrollIntoViewIfNeeded()
  await shot(page, "6-connection-health")
  console.log(
    "  connection reads:",
    await page.locator('[data-testid="connection"]').getAttribute("data-connection"),
    "| stopped:",
    await page.locator('[data-testid="connection"]').getAttribute("data-stopped"),
  )
} finally {
  await browser.close()
  olai.kill("SIGKILL")
  fs.rmSync(dir, { recursive: true, force: true })
}
