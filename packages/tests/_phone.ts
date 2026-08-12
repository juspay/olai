import { execFileSync, spawn } from "node:child_process"
import * as fs from "node:fs"
import * as os from "node:os"
import * as path from "node:path"
import { chromium } from "playwright"

const REPO = "/home/srid/code/olai/.worktrees/one-git-indicator"
const OUT = "/home/srid/code/olai/.worktrees/one-git-indicator-out"
const TAG = process.env.SHOT_TAG ?? "6-phone"
const CORPUS = path.join(REPO, "packages/tests/fixtures/good")

const root = fs.mkdtempSync(path.join(os.tmpdir(), "olai-phone-"))
fs.cpSync(CORPUS, root, { recursive: true })
const git = (args: string[], env: NodeJS.ProcessEnv = {}) =>
  execFileSync("git", args, { cwd: root, env: { ...process.env, ...env } })
git(["init", "--quiet", "--initial-branch=main"])
git(["config", "user.email", "notes@example.com"])
git(["config", "user.name", "A Person"])
git(["add", "."])
git(["commit", "--quiet", "-m", "the notes as they were"])
fs.appendFileSync(
  path.join(root, "garden.jsonl"),
  `{"id":"compost","parent":"garden","ord":"a2","title":"turn the compost","done":"2026-08-11"}\n`,
)
const when = new Date(Date.now() - 3 * 60_000).toISOString()
git(["add", "."])
git([
  "commit",
  "--quiet",
  "-m",
  "olai: 1 change in garden.jsonl — compost created\n\nX-Olai-Writer: web",
], { GIT_AUTHOR_DATE: when, GIT_COMMITTER_DATE: when })

const port = 9700 + Math.floor(Math.random() * 100)
const child = spawn("bun", [path.join(REPO, "packages/server/src/main.ts"), "web", root, "--port", String(port), "--host", "127.0.0.1"], {
  stdio: ["ignore", "pipe", "pipe"],
  env: {
    ...process.env,
    OLAI_ACP_AGENT: "",
    OLAI_LOG: "logfmt",
    OLAI_DIST_DIR: path.join(REPO, "packages/web/dist"),
  },
})
let out = ""
child.stdout?.setEncoding("utf8")
child.stdout?.on("data", (c: string) => (out += c))
child.stderr?.setEncoding("utf8")
child.stderr?.on("data", (c: string) => (out += c))
const deadline = Date.now() + 30_000
while (Date.now() < deadline && !out.includes(String(port))) {
  await new Promise((r) => setTimeout(r, 200))
}
if (!out.includes(String(port))) throw new Error(`no server:\n${out}`)

const browser = await chromium.launch({ args: ["--no-sandbox", "--disable-gpu"] })
for (const theme of [{ name: "chalk", scheme: "light" }, { name: "one-dark", scheme: "dark" }]) {
  const page = await browser.newPage({
    viewport: { width: 390, height: 844 },
    isMobile: true,
    hasTouch: true,
    deviceScaleFactor: 2,
  })
  await page.addInitScript(
    ([key, value]) => localStorage.setItem(key as string, value as string),
    ["olai.theme", theme.name],
  )
  await page.goto(`http://127.0.0.1:${port}/`)
  await page.waitForSelector('[data-testid="app-header"]')
  await page.waitForFunction(
    () =>
      document.querySelector('[data-testid="commit-pill"]')?.getAttribute("data-state") !==
        "unknown",
  )
  await page.screenshot({
    path: `${OUT}/${TAG}-${theme.scheme}-${theme.name}-header.png`,
    clip: { x: 0, y: 0, width: 390, height: 56 },
  })
  await page.close()
}
await browser.close()
child.kill("SIGTERM")
fs.rmSync(root, { recursive: true, force: true })
console.log(`${TAG} shots written`)
