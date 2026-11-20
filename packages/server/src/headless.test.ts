import { expect, test } from "bun:test"
import * as fs from "node:fs"
import * as os from "node:os"
import * as path from "node:path"

import { QUIET_MS } from "@olai/format"
import { gitIn, repoAt, writerOf } from "olai-plugin-git/testlib"

import { startWeb } from "./child.testlib.ts"

const AFTER_THE_WINDOW = QUIET_MS + 30_000

const until = async (
  look: () => string,
  wanted: (said: string) => boolean,
  ms: number,
): Promise<string> => {
  const deadline = Date.now() + ms
  let last = ""
  while (Date.now() < deadline) {
    last = look()
    if (wanted(last)) return last
    await Bun.sleep(250)
  }
  return last
}

test("a headless serve commits a quiet directory and pushes it, with no tab open", async () => {
  const state = fs.mkdtempSync(path.join(os.tmpdir(), "olai-headless-state-"))
  const root = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), "olai-headless-")))
  const bare = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), "olai-headless-remote-")))
  const here = gitIn(root)
  const there = gitIn(bare)

  fs.writeFileSync(
    path.join(root, "garden.olai"),
    `{"id":"garden","ord":"a0","title":"garden"}\n`,
  )
  repoAt(root)
  there("init", "--quiet", "--bare", "--initial-branch", "main")
  here("remote", "add", "origin", bare)
  here("push", "--quiet", "--set-upstream", "origin", "main")

  const web = startWeb({
    root,
    policy: {"commit": "auto", "push": "auto"}, extra: [],
    env: { XDG_STATE_HOME: state },
  })
  try {
    await web.address()

    fs.writeFileSync(path.join(root, "notes.md"), "the herb bed needs splitting\n")

    const remote = await until(
      () => there("log", "--format=%s").trim(),
      (said) => said.startsWith("olai:"),
      AFTER_THE_WINDOW,
    )
    expect(remote.split("\n")[0]).toStartWith("olai:")
    expect(here("status", "--porcelain").trim()).toBe("")
    expect(writerOf(root)).toBe("auto")
    expect(here("log", "--format=%s", "--grep", "^olai").trim().split("\n"))
      .toHaveLength(1)
  } finally {
    web.kill()
    await web.exited()
    for (const at of [root, bare, state]) fs.rmSync(at, { recursive: true, force: true })
  }
}, AFTER_THE_WINDOW + 15_000)

const diverged = (dirs: { readonly root: string; readonly bare: string }, conflict = ""): void => {
  const theirs = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), "olai-theirs-")))
  gitIn(theirs)("clone", "--quiet", dirs.bare, ".")
  gitIn(theirs)("config", "user.email", "them@example.com")
  gitIn(theirs)("config", "user.name", "them")
  fs.writeFileSync(path.join(theirs, "theirs.md"), "somebody else's work\n")
  if (conflict !== "") {
    fs.writeFileSync(path.join(theirs, "garden.olai"), conflict)
  }
  gitIn(theirs)("add", "-A")
  gitIn(theirs)("commit", "--quiet", "-m", "theirs")
  gitIn(theirs)("push", "--quiet")
  fs.rmSync(theirs, { recursive: true, force: true })
  if (conflict !== "") {
    fs.writeFileSync(path.join(dirs.root, "garden.olai"), "the herb bed needs splitting\n")
  } else {
    fs.writeFileSync(path.join(dirs.root, "notes.md"), "the herb bed needs splitting\n")
  }
  gitIn(dirs.root)("add", "-A")
  gitIn(dirs.root)("commit", "--quiet", "-m", "olai: earlier")
}

const served = (): { readonly root: string; readonly bare: string; readonly state: string } => {
  const state = fs.mkdtempSync(path.join(os.tmpdir(), "olai-boot-state-"))
  const root = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), "olai-boot-")))
  const bare = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), "olai-boot-remote-")))
  fs.writeFileSync(
    path.join(root, "garden.olai"),
    `{"id":"garden","ord":"a0","title":"garden"}\n`,
  )
  repoAt(root)
  gitIn(bare)("init", "--quiet", "--bare", "--initial-branch", "main")
  gitIn(root)("remote", "add", "origin", bare)
  gitIn(root)("push", "--quiet", "--set-upstream", "origin", "main")
  return { root, bare, state }
}

const AFTER_BOOT = 15_000

const CONFLICT = "theirs own the garden\n"
test("a boot under push: auto re-earns git's words about a branch it cannot send", async () => {
  const dirs = served()
  diverged(dirs, CONFLICT)
  const web = startWeb({
    root: dirs.root,
    policy: {"commit": "manual", "push": "auto"}, extra: [],
    env: { XDG_STATE_HOME: dirs.state },
  })
  try {
    await web.address()
    const said = await until(
      () => web.said(),
      (all) => all.includes("the take-in conflicted"),
      AFTER_BOOT,
    )
    expect(said).toContain("the take-in conflicted")
    expect(said).toContain("CONFLICT")
    expect(gitIn(dirs.bare)("log", "--format=%s", "-1").trim()).toBe("theirs")
    expect(gitIn(dirs.root)("log", "--format=%s", "-1").trim()).toBe("olai: earlier")
    expect(fs.readFileSync(path.join(dirs.root, "garden.olai"), "utf8"))
      .toBe("the herb bed needs splitting\n")
  } finally {
    web.kill()
    await web.exited()
    for (const at of Object.values(dirs)) fs.rmSync(at, { recursive: true, force: true })
  }
}, AFTER_BOOT + 15_000)

test("a boot under push: off attempts nothing, however far behind the branch is", async () => {
  const dirs = served()
  diverged(dirs)
  const web = startWeb({
    root: dirs.root,
    policy: {"commit": "manual", "push": "off"}, extra: [],
    env: { XDG_STATE_HOME: dirs.state },
  })
  try {
    await web.address()
    await Bun.sleep(3_000)
    expect(web.said()).not.toContain("olai git:")
    expect(gitIn(dirs.bare)("log", "--format=%s", "-1").trim()).toBe("theirs")
  } finally {
    web.kill()
    await web.exited()
    for (const at of Object.values(dirs)) fs.rmSync(at, { recursive: true, force: true })
  }
}, AFTER_BOOT + 15_000)

test("a boot under push: auto takes in a divergence and pushes, with no tab open", async () => {
  const dirs = served()
  diverged(dirs)
  const web = startWeb({
    root: dirs.root,
    policy: {"commit": "manual", "push": "auto"}, extra: [],
    env: { XDG_STATE_HOME: dirs.state },
  })
  try {
    await web.address()
    const tip = await until(
      () => gitIn(dirs.bare)("log", "--format=%s", "-1", "main").trim(),
      (top) => top === "olai: earlier",
      AFTER_BOOT,
    )
    expect(tip).toBe("olai: earlier")
    expect(gitIn(dirs.bare)("log", "--format=%s", "-2", "main")
      .replace(/\n/g, " | ")).toContain("theirs")
  } finally {
    web.kill()
    await web.exited()
    for (const at of Object.values(dirs)) fs.rmSync(at, { recursive: true, force: true })
  }
}, AFTER_BOOT + 15_000)
