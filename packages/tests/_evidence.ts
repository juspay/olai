/**
 * Evidence for `one-git-indicator`: one shot per face of the one pill.
 *
 * Each case starts a REAL olai against a real temp directory in the state it is
 * about, and photographs the header in a light and a dark theme, at desktop and
 * at 390pt — reporting, per shot, whether anything in the bar is drawn narrower
 * than it wants to be. That last part is the claim the header's stated order
 * makes, measured rather than eyeballed.
 */

import { execFileSync, spawn } from "node:child_process"
import * as fs from "node:fs"
import * as os from "node:os"
import * as path from "node:path"
import { chromium } from "playwright"

const REPO = "/home/srid/code/olai/.worktrees/one-git-indicator"
const OUT = "/home/srid/code/olai/.worktrees/one-git-indicator-out"
const BIN = process.env.OLAI_BIN ?? ""
const CORPUS = path.join(REPO, "packages/tests/fixtures/good")
const BROKEN_GIT = path.join(REPO, "packages/tests/bin/broken-git")

const MINT_DOING =
  '{"id":"mint","parent":"herbs","ord":"a1","title":"split the mint","doing":true}'
const MINT_DONE =
  '{"id":"mint","parent":"herbs","ord":"a1","title":"split the mint","done":"2026-08-11"}'

interface Case {
  readonly id: string
  readonly git: "repo" | "none" | "broken" | "off"
  readonly committedMinutesAgo?: number
  readonly dirty?: boolean
  readonly busy?: boolean
  readonly hover?: boolean
}

const CASES: ReadonlyArray<Case> = [
  { id: "1-healthy", git: "repo", committedMinutesAgo: 3 },
  { id: "2-uncommitted", git: "repo", dirty: true },
  { id: "3-blocked", git: "repo", dirty: true, busy: true },
  { id: "4-no-repo", git: "none" },
  { id: "5-git-error", git: "broken", hover: true },
  { id: "6-commits-off", git: "off" },
]

const THEMES = [
  { name: "chalk", scheme: "light" },
  { name: "one-dark", scheme: "dark" },
]

const makeRepo = (root: string, kase: Case): void => {
  const git = (args: string[], env: NodeJS.ProcessEnv = {}) =>
    execFileSync("git", args, { cwd: root, env: { ...process.env, ...env } })
  git(["init", "--quiet", "--initial-branch=main"])
  git(["config", "user.email", "notes@example.com"])
  git(["config", "user.name", "A Person"])
  git(["add", "."])
  git(["commit", "--quiet", "-m", "the notes as they were"])
  if (kase.committedMinutesAgo !== undefined) {
    const when = new Date(Date.now() - kase.committedMinutesAgo * 60_000).toISOString()
    fs.appendFileSync(
      path.join(root, "garden.jsonl"),
      `{"id":"compost","parent":"garden","ord":"a2","title":"turn the compost","done":"2026-08-11"}\n`,
    )
    git(["add", "."])
    git([
      "commit",
      "--quiet",
      "-m",
      "olai: 1 change in garden.jsonl — compost created\n\nX-Olai-Writer: web",
    ], { GIT_AUTHOR_DATE: when, GIT_COMMITTER_DATE: when })
  }
  if (kase.busy === true) git(["checkout", "--quiet", "--detach", "HEAD"])
  if (kase.dirty === true) {
    const file = path.join(root, "garden.jsonl")
    const was = fs.readFileSync(file, "utf8")
    if (!was.includes(MINT_DOING)) throw new Error("the fixture moved: no doing mint")
    fs.writeFileSync(file, was.replace(MINT_DOING, MINT_DONE))
  }
}

const start = async (kase: Case) => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), `olai-shot-${kase.id}-`))
  fs.cpSync(CORPUS, root, { recursive: true })
  if (kase.git === "repo") makeRepo(root, kase)

  const port = 9000 + Math.floor(Math.random() * 900)
  const argv = ["web", root, "--port", String(port), "--host", "127.0.0.1"]
  if (kase.git === "off") argv.push("--no-commit")
  const child = spawn(BIN, argv, {
    stdio: ["ignore", "pipe", "pipe"],
    env: {
      ...process.env,
      OLAI_ACP_AGENT: "",
      OLAI_LOG: "logfmt",
      PATH: [
        ...(kase.git === "broken" ? [BROKEN_GIT] : []),
        process.env.PATH ?? "",
      ].join(path.delimiter),
    },
  })
  let out = ""
  child.stdout?.setEncoding("utf8")
  child.stderr?.setEncoding("utf8")
  child.stdout?.on("data", (chunk: string) => (out += chunk))
  child.stderr?.on("data", (chunk: string) => (out += chunk))

  const deadline = Date.now() + 30_000
  while (Date.now() < deadline && !out.includes(String(port))) {
    await new Promise((r) => setTimeout(r, 200))
  }
  if (!out.includes(String(port))) {
    child.kill("SIGKILL")
    throw new Error(`server for ${kase.id} did not start:\n${out}`)
  }
  return {
    url: `http://127.0.0.1:${port}/`,
    stop: () => {
      child.kill("SIGTERM")
      fs.rmSync(root, { recursive: true, force: true })
    },
  }
}

fs.mkdirSync(OUT, { recursive: true })
const browser = await chromium.launch({ args: ["--no-sandbox", "--disable-gpu"] })

const shoot = async (
  url: string,
  kase: Case,
  theme: { name: string; scheme: string },
  phone: boolean,
) => {
  const page = await browser.newPage(
    phone
      ? {
        viewport: { width: 390, height: 844 },
        isMobile: true,
        hasTouch: true,
        deviceScaleFactor: 2,
      }
      : { viewport: { width: 1280, height: 800 } },
  )
  await page.addInitScript(
    ([key, value]) => localStorage.setItem(key as string, value as string),
    ["olai.theme", theme.name],
  )
  await page.goto(url)
  await page.waitForSelector('[data-testid="app-header"]')
  await page.waitForFunction(
    () =>
      document.querySelector('[data-testid="commit-pill"]')?.getAttribute("data-state") !==
        "unknown",
  )
  if (kase.hover === true && !phone) {
    await page.locator('[data-testid="commit-pill"]').hover()
    await page.waitForSelector('[data-testid="tip"]')
  }
  const state = await page.locator('[data-testid="commit-pill"]').getAttribute("data-state")
  const label = (await page.locator('[data-testid="commit-pill"]').innerText())
    .replace(/\s+/g, " ").trim()
  const squeezed = await page.evaluate(() => {
    const named: Array<[string, string]> = [
      ["connection", '[data-testid="connection"]'],
      ["commit", '[data-testid="commit-pill"]'],
      ["agent", '[data-testid="chat-toggle"]'],
      ["theme", '[data-testid="theme-trigger"]'],
    ]
    return named.flatMap(([name, sel]) => {
      const el = document.querySelector(sel) as HTMLElement | null
      if (el === null) return []
      const drawn = el.getBoundingClientRect().width
      const was = el.style.cssText
      el.style.flexShrink = "0"
      el.style.maxWidth = "none"
      const wanted = el.getBoundingClientRect().width
      el.style.cssText = was
      return wanted - drawn > 0.5 ? [`${name} −${Math.round(wanted - drawn)}px`] : []
    })
  })
  const where = phone ? "390pt" : "desktop"
  console.log(
    `${kase.id} ${theme.name} ${where}: state=${state} reads=${JSON.stringify(label)}` +
      (squeezed.length === 0 ? " · nothing squeezed" : ` · SQUEEZED: ${squeezed.join(", ")}`),
  )
  const stem = `${OUT}/${kase.id}-${phone ? "390pt" : "desktop"}-${theme.scheme}-${theme.name}`
  if (!phone) await page.screenshot({ path: `${stem}.png` })
  await page.screenshot({
    path: `${stem}-header.png`,
    clip: phone
      ? { x: 0, y: 0, width: 390, height: 56 }
      : { x: 640, y: 0, width: 640, height: kase.hover === true ? 140 : 56 },
  })
  await page.close()
}

try {
  for (const kase of CASES) {
    const server = await start(kase)
    try {
      for (const theme of THEMES) {
        await shoot(server.url, kase, theme, false)
        await shoot(server.url, kase, theme, true)
      }
    } finally {
      server.stop()
    }
  }
  console.log(`\nwrote ${fs.readdirSync(OUT).length} files to ${OUT}`)
} catch (e) {
  console.error("FAILED:", e)
} finally {
  await browser.close()
  process.exit(0)
}
