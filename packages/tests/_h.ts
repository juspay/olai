import { spawn } from "node:child_process"
import * as fs from "node:fs"
import * as os from "node:os"
import * as path from "node:path"
import { chromium } from "playwright"
const REPO = "/home/srid/code/olai/.worktrees/one-git-indicator"
const root = fs.mkdtempSync(path.join(os.tmpdir(), "olai-h-"))
fs.cpSync(path.join(REPO, "packages/tests/fixtures/good"), root, { recursive: true })
const port = 9550
const child = spawn(process.env.OLAI_BIN ?? "", ["web", root, "--port", String(port), "--host", "127.0.0.1"], {
  stdio: ["ignore", "pipe", "pipe"],
  env: { ...process.env, OLAI_ACP_AGENT: "", OLAI_LOG: "logfmt" },
})
let out = ""
child.stdout?.setEncoding("utf8"); child.stdout?.on("data", (c: string) => (out += c))
const deadline = Date.now() + 30_000
while (Date.now() < deadline && !out.includes(String(port))) await new Promise((r) => setTimeout(r, 200))
const b = await chromium.launch({ args: ["--no-sandbox", "--disable-gpu"] })
const p = await b.newPage({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true })
await p.goto(`http://127.0.0.1:${port}/`)
await p.waitForSelector('[data-testid="app-header"]')
console.log(await p.evaluate(() => [
  ["burger", '[data-testid="sidebar-toggle"]'],
  ["connection", '[data-testid="connection"]'],
  ["commit", '[data-testid="commit-pill"]'],
  ["agent", '[data-testid="chat-toggle"]'],
  ["theme", '[data-testid="theme-trigger"]'],
].map(([n, s]) => {
  const el = document.querySelector(s as string)
  if (el === null) return `${n}: absent`
  const r = el.getBoundingClientRect()
  return `${n}: ${Math.round(r.width)}×${Math.round(r.height)}`
}).join("\n")))
await b.close(); child.kill("SIGTERM"); fs.rmSync(root, { recursive: true, force: true }); process.exit(0)
