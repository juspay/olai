/**
 * A DIRECTORY WITH NO BROWSER IN FRONT OF IT records itself, and shares what it
 * recorded.
 *
 * This is `git-policy-server-side` end to end, at the one seam where the whole
 * claim can be made: a real `olai web with git commit and push set to auto` as a child
 * process, a real work tree, a real bare remote, and no page open anywhere.
 *
 * It is the scenario the old arrangement could not have: Auto-commit was a
 * fifteen-second window inside a browser tab and Auto-push fired inside that
 * tab's own `git.commit` callback, so a directory nobody had open recorded
 * nothing, and `commit: auto and push: auto` on a headless serve committed every
 * write on its own and pushed none of them. Both halves are the server's now.
 *
 * IT WAITS OUT THE REAL WINDOW, which is why it is the slowest test in this
 * package. The span is a product decision (`@olai/format`'s `QUIET_MS`) and
 * there is deliberately no flag to shorten it: a knob here would be a second
 * thing to explain about a feature whose point is not having to think about it.
 * The rules over the span are unit-tested with a short one
 * (`@olai/ops`' `pending.test.ts`); what this file is for is that the whole
 * process really does it.
 */

import { expect, test } from "bun:test"
import * as fs from "node:fs"
import * as os from "node:os"
import * as path from "node:path"

import { QUIET_MS } from "@olai/format"
import { gitIn, repoAt, writerOf } from "olai-plugin-git/testlib"

import { startWeb } from "./child.testlib.ts"

/** The window, plus room for a git subprocess and a slow CI runner. What is
 *  being told apart is "after the window" from "never". */
const AFTER_THE_WINDOW = QUIET_MS + 30_000

/** Poll until `look` answers, or give up saying what it last saw — the shape
 *  every wait in this suite has, because "it never happened" and "it happened
 *  and said something else" are two different failures. */
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
  // The shared fixture, so this file cannot drift from every other suite over
  // the branch name or an identity a CI runner has no `~/.gitconfig` for.
  repoAt(root)
  there("init", "--quiet", "--bare", "--initial-branch", "main")
  here("remote", "add", "origin", bare)
  here("push", "--quiet", "--set-upstream", "origin", "main")

  const web = startWeb({
    root,
    policy: {"commit": "auto", "push": "auto"}, extra: [],
    // Chat memory lives under the state home, and a test must not write
    // into the developer's own (`@olai/state`).
    env: { XDG_STATE_HOME: state },
  })
  try {
    await web.address()

    // A write NOBODY MADE THROUGH OLAI — a file saved in an editor — which is
    // the point of watching what is waiting rather than counting writes.
    fs.writeFileSync(path.join(root, "notes.md"), "the herb bed needs splitting\n")

    const remote = await until(
      () => there("log", "--format=%s").trim(),
      (said) => said.startsWith("olai:"),
      AFTER_THE_WINDOW,
    )
    // Recorded, and SHARED — on the remote, with nobody's browser involved.
    expect(remote.split("\n")[0]).toStartWith("olai:")
    expect(here("status", "--porcelain").trim()).toBe("")
    // ... and the trailer says who: not `web`, which is the lie a headless
    // serve would otherwise tell in every commit it makes.
    expect(writerOf(root)).toBe("auto")
    // ONE commit for the one quiet spell, not one per write.
    expect(here("log", "--format=%s", "--grep", "^olai").trim().split("\n"))
      .toHaveLength(1)
  } finally {
    web.kill()
    await web.exited()
    for (const at of [root, bare, state]) fs.rmSync(at, { recursive: true, force: true })
  }
}, AFTER_THE_WINDOW + 15_000)

/**
 * WHAT A RESTART LOOKS LIKE — the human's ruling on the one fork the two
 * reviews split on (2026-08-22).
 *
 * `olai.service` is `Restart=always`, and nothing about a refusal is written
 * down: a deploy, a crash or a `systemctl restart` starts a process holding no
 * stop and no words. That is deliberate for the STOP; on its own it would put
 * `push-failure-invisible` straight back, because a branch that has been
 * refusing for hours would come up reading `✓ committed · N unpushed` with the
 * reason nowhere and — on a clean tree — never attempt again, since a push
 * follows a settled commit made in THIS process.
 *
 * So the words are re-earned: one push at boot, under `push: auto` and no
 * other mode. These two are that ruling as a real serve — a child process over
 * a real repository whose upstream somebody else has moved.
 */
const diverged = (dirs: { readonly root: string; readonly bare: string }, conflict = ""): void => {
  const theirs = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), "olai-theirs-")))
  gitIn(theirs)("clone", "--quiet", dirs.bare, ".")
  gitIn(theirs)("config", "user.email", "them@example.com")
  gitIn(theirs)("config", "user.name", "them")
  fs.writeFileSync(path.join(theirs, "theirs.md"), "somebody else's work\n")
  if (conflict !== "") {
    // The other side edits the ONE line of the seeded file...
    fs.writeFileSync(path.join(theirs, "garden.olai"), conflict)
  }
  gitIn(theirs)("add", "-A")
  gitIn(theirs)("commit", "--quiet", "-m", "theirs")
  gitIn(theirs)("push", "--quiet")
  fs.rmSync(theirs, { recursive: true, force: true })
  // ... and this side has a commit of its own, so the branch is genuinely
  // unshared. `conflict` edits the SAME line of the seeded file this side
  // then edits too, which is what makes the take-in a stop rather than a
  // clean one — the pick lands on a line both sides changed.
  if (conflict !== "") {
    fs.writeFileSync(path.join(dirs.root, "garden.olai"), "the herb bed needs splitting\n")
  } else {
    fs.writeFileSync(path.join(dirs.root, "notes.md"), "the herb bed needs splitting\n")
  }
  gitIn(dirs.root)("add", "-A")
  gitIn(dirs.root)("commit", "--quiet", "-m", "olai: earlier")
}

/** A repository with a bare remote, and the state home the child writes to.
 *  Torn down by the caller. */
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

/** How long a boot's own push may take before it is a hang rather than a slow
 *  machine — no window is waited here, so this is a git subprocess and not a
 *  product decision. */
const AFTER_BOOT = 15_000

/** The conflicting pair, shared by the boot tests: the other machine edits
 *  the seeded line, and so does this side. */
const CONFLICT = "theirs own the garden\n"
test("a boot under push: auto re-earns git's words about a branch it cannot send", async () => {
  const dirs = served()
  // The conflicting take-in, so the re-earned words are the CONFLICT's own —
  // a boot that takes in a plain divergence is a boot that succeeds.
  diverged(dirs, CONFLICT)
  const web = startWeb({
    root: dirs.root,
    policy: {"commit": "manual", "push": "auto"}, extra: [],
    env: { XDG_STATE_HOME: dirs.state },
  })
  try {
    await web.address()
    // The take-in's refusal, in git's own words, on the server's own log —
    // which is the same `said()` that puts it on the cell every open tab
    // reads. The abort means the SERVED tree keeps this side's commit.
    const said = await until(
      () => web.said(),
      (all) => all.includes("the take-in conflicted"),
      AFTER_BOOT,
    )
    expect(said).toContain("the take-in conflicted")
    expect(said).toContain("CONFLICT")
    // Never a force and never a pull: the remote is exactly where the other
    // machine left it, and this side's commit is still unshared.
    expect(gitIn(dirs.bare)("log", "--format=%s", "-1").trim()).toBe("theirs")
    expect(gitIn(dirs.root)("log", "--format=%s", "-1").trim()).toBe("olai: earlier")
    // The served tree is the one that kept this side's commit — the take-in
    // failed before any move, and no markers leaked into the served directory.
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
    // Given the same time the serve above needed to refuse in, and then some:
    // a directory whose pushes are somebody's own button press has not asked
    // this process to make one.
    await Bun.sleep(3_000)
    // Not one of the verbs a take-in-and-push would have run: no fetch, no
    // integration, no push — a bare remote left exactly where the other
    // machine put it, and nothing said over the pipes.
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
    // The push lands — poll for the remote's own record of it rather than
    // sleeping "long enough": the awaited condition is the branch moving,
    // and a poll either sees it happen or times out with the child's words.
    const tip = await until(
      () => gitIn(dirs.bare)("log", "--format=%s", "-1", "main").trim(),
      (top) => top === "olai: earlier",
      AFTER_BOOT,
    )
    expect(tip).toBe("olai: earlier")
    // The other side's commit is under this side's — a rebase took it in
    // rather than a force overwriting it.
    expect(gitIn(dirs.bare)("log", "--format=%s", "-2", "main")
      .replace(/\n/g, " | ")).toContain("theirs")
  } finally {
    web.kill()
    await web.exited()
    for (const at of Object.values(dirs)) fs.rmSync(at, { recursive: true, force: true })
  }
}, AFTER_BOOT + 15_000)
