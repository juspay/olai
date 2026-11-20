import { collector, findSaid } from "@olai/log/testlib"
import { expect, test } from "bun:test"
import { Cause, Effect, Exit, Fiber } from "effect"
import * as fs from "node:fs"
import * as os from "node:os"
import * as path from "node:path"

import { gitIn as git, isRoot, repoAt } from "./fixtures.testlib.ts"
import { type Audit, type Dirt, open, type Repo } from "./git.ts"

const OLAI: Audit = { prefix: "olai", trailer: "X-Olai-Writer" }

// The default five seconds can kill an otherwise healthy git when shards
// compete for one runner.
const GIT_SUITE_TIMEOUT = 30_000
const WEDGED_SUITE_TIMEOUT = GIT_SUITE_TIMEOUT * 2

const loose = (): { readonly root: string; readonly file: string } => {
  const root = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), "olai-git-")))
  const file = path.join(root, "a.olai")
  fs.writeFileSync(file, `{"id":"a","ord":"a0","title":"a"}\n`)
  return { root, file }
}

const repo = (
  options: { readonly seed?: boolean } = {},
): { readonly root: string; readonly file: string } => {
  const made = loose()
  repoAt(made.root, options)
  return made
}

const asEffect = <A, E = never>(
  root: string,
  use: (git: Repo) => Effect.Effect<A, E>,
): Effect.Effect<A, E> =>
  Effect.flatMap(open(root), (opening) =>
    opening._tag !== "Opened"
      ? Effect.die(new Error(`${root} is not a work tree: ${opening._tag}`))
      : use(opening.repo))

const asked = <A>(
  root: string,
  use: (git: Repo) => Effect.Effect<A, unknown>,
): Promise<A> => Effect.runPromise(Effect.orDie(asEffect(root, use)))

const surveyed = async (root: string): Promise<Extract<Dirt, { _tag: "Surveyed" }>> => {
  const dirt = await asked(root, (git) => git.dirty)
  if (dirt._tag !== "Surveyed") throw new Error(`git would not survey ${root}: ${dirt.said}`)
  return dirt
}

test("a directory that is not a work tree opens as NoRepo, which is not an error", async () => {
  const { root } = loose()
  expect(await Effect.runPromise(open(root))).toEqual({ _tag: "NoRepo" })
})

test("a bare repository is NoRepo: there is nowhere for the files to be", async () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "olai-git-bare-"))
  git(root)("init", "--quiet", "--bare")
  expect(await Effect.runPromise(open(root))).toEqual({ _tag: "NoRepo" })
})

test("a git that cannot answer is Unusable carrying its words, not NoRepo", async () => {
  const { root } = loose()
  fs.rmSync(root, { recursive: true, force: true })

  const opening = await Effect.runPromise(open(root))
  expect(opening._tag).toBe("Unusable")
  if (opening._tag !== "Unusable") throw new Error("unreachable")
  expect(opening.said).not.toBe("")
})

test("a dirty file answers in all three spellings, from a served subdirectory", async () => {
  const { root } = repo()
  fs.mkdirSync(path.join(root, "notes"))
  fs.writeFileSync(path.join(root, "notes", "b.olai"), `{"id":"b","ord":"a0","title":"b"}\n`)

  const served = path.join(root, "notes")
  expect((await surveyed(served)).files).toEqual([
    {
      path: "notes/b.olai",
      served: "b.olai",
      at: path.join(served, "b.olai"),
      how: "untracked",
      from: null,
    },
  ])
  expect(await asked(served, (git) => Effect.succeed(git.served))).toBe("notes/")
})

test("a served subdirectory still sees the dirt above it, marked as outside", async () => {
  const { root } = repo()
  fs.mkdirSync(path.join(root, "notes"))
  fs.writeFileSync(path.join(root, "notes", "b.olai"), `{"id":"b","ord":"a0","title":"b"}\n`)
  fs.writeFileSync(path.join(root, "README.md"), "edited by hand\n")

  const found = (await surveyed(path.join(root, "notes"))).files
  expect(found.map((one) => [one.path, one.served]).sort()).toEqual([
    ["README.md", null],
    ["notes/b.olai", "b.olai"],
  ])
})

test("dirty keeps how each file moved", async () => {
  const { root, file } = repo()
  const run = git(root)
  fs.writeFileSync(path.join(root, "gone.olai"), `{"id":"g","ord":"a0","title":"g"}\n`)
  fs.writeFileSync(path.join(root, "moved.md"), "to be renamed\n")
  run("add", "-A")
  run("commit", "--quiet", "-m", "more fixtures")

  fs.writeFileSync(file, `{"id":"a","ord":"a0","title":"edited"}\n`)
  fs.rmSync(path.join(root, "gone.olai"))
  fs.renameSync(path.join(root, "moved.md"), path.join(root, "landed.md"))
  fs.writeFileSync(path.join(root, "fresh.md"), "brand new\n")
  fs.writeFileSync(path.join(root, "staged.md"), "added to the index by hand\n")
  run("add", "staged.md")
  // A rename is only detected once both halves are staged.
  run("add", "-A", "moved.md", "landed.md")

  const how = new Map(
    (await surveyed(root)).files.map((one) => [one.path, one.how]),
  )
  expect(how.get("a.olai")).toBe("modified")
  expect(how.get("gone.olai")).toBe("deleted")
  expect(how.get("fresh.md")).toBe("untracked")
  expect(how.get("staged.md")).toBe("added")
  expect(how.get("landed.md")).toBe("renamed")
  expect(how.has("moved.md")).toBe(false)
})

test("a staged rename is ONE entry naming both sides", async () => {
  const { root } = repo()
  const run = git(root)
  fs.writeFileSync(path.join(root, "Kept.md"), `{"id":"m","ord":"a0","title":"m"}\n`)
  run("add", "-A")
  run("commit", "--quiet", "-m", "more fixtures")
  run("mv", "Kept.md", "Kept.olai")

  const moved = (await surveyed(root)).files
  expect(moved).toEqual([
    {
      path: "Kept.olai",
      served: "Kept.olai",
      at: path.join(root, "Kept.olai"),
      how: "renamed",
      from: {
        path: "Kept.md",
        served: "Kept.md",
        at: path.join(root, "Kept.md"),
      },
    },
  ])
})

test("a copy leaves its source to be its own row, whichever order git prints", async () => {
  const { root } = repo()
  const run = git(root)
  fs.writeFileSync(path.join(root, "notes.md"), "the original\n")
  run("add", "-A")
  run("commit", "--quiet", "-m", "more fixtures")

  fs.writeFileSync(path.join(root, "Copy.md"), "the original\n")
  fs.writeFileSync(path.join(root, "notes.md"), "the original, edited\n")
  run("add", "-A")
  run("config", "status.renames", "copies")

  const found = (await surveyed(root)).files
  expect(found.map((one) => [one.path, one.how, one.from?.path ?? null]).sort())
    .toEqual([
      ["Copy.md", "added", null],
      ["notes.md", "modified", null],
    ])
})

test("a commit records a staged rename instead of refusing on a pathspec", async () => {
  const { root } = repo()
  const run = git(root)
  fs.writeFileSync(path.join(root, "Kept.md"), `{"id":"m","ord":"a0","title":"m"}\n`)
  run("add", "-A")
  run("commit", "--quiet", "-m", "more fixtures")
  run("mv", "Kept.md", "Kept.olai")

  const done = await asked(root, (git) =>
    git.commit({
      paths: [path.join(root, "Kept.md"), path.join(root, "Kept.olai")],
      message: "olai: the rename\n\nX-Olai-Writer: mcp\n",
    }))
  expect(done._tag === "Failed" ? done.said : "").not.toContain("pathspec")
  expect(done._tag).toBe("Committed")

  expect(run("show", "--name-status", "--find-renames", "--format=", "HEAD").trim())
    .toBe("R100\tKept.md\tKept.olai")
  expect(run("status", "--porcelain").trim()).toBe("")
  expect(run("diff", "--cached", "--name-only").trim()).toBe("")
})

test("a commit records a staged deletion, which has nothing to stage", async () => {
  const { root } = repo()
  const run = git(root)
  fs.writeFileSync(path.join(root, "gone.md"), "not for long\n")
  run("add", "-A")
  run("commit", "--quiet", "-m", "more fixtures")
  run("rm", "--quiet", "gone.md")

  const done = await asked(root, (git) =>
    git.commit({
      paths: [path.join(root, "gone.md")],
      message: "olai: the removal\n\nX-Olai-Writer: mcp\n",
    }))
  expect(done._tag === "Failed" ? done.said : "").not.toContain("pathspec")
  expect(done._tag).toBe("Committed")
  expect(run("show", "--name-status", "--format=", "HEAD").trim()).toBe("D\tgone.md")
  expect(run("status", "--porcelain").trim()).toBe("")
})

test("a clean repository on a branch is ready", async () => {
  const { root } = repo()
  expect(await asked(root, (git) => git.state)).toEqual({ _tag: "Ready", branch: "main" })
})

test("a repository mid-merge says so rather than committing", async () => {
  const { root, file } = repo()
  const run = git(root)
  run("checkout", "--quiet", "-b", "other")
  fs.writeFileSync(file, `{"id":"a","ord":"a0","title":"other"}\n`)
  run("commit", "--quiet", "-am", "other")
  run("checkout", "--quiet", "main")
  fs.writeFileSync(file, `{"id":"a","ord":"a0","title":"main"}\n`)
  run("commit", "--quiet", "-am", "main")
  try {
    run("merge", "other")
  } catch {
  }

  const repoState = await asked(root, (git) => git.state)
  expect(repoState._tag).toBe("Blocked")
  expect(repoState._tag === "Blocked" ? repoState.reason : null).toBe("merge")
})

test("a detached HEAD is blocked, in git's own words", async () => {
  const { root } = repo()
  const run = git(root)
  run("checkout", "--quiet", "--detach", "HEAD")

  const repoState = await asked(root, (git) => git.state)
  expect(repoState._tag).toBe("Blocked")
  expect(repoState._tag === "Blocked" ? repoState.reason : null).toBe("detached")
  expect(repoState._tag === "Blocked" ? repoState.said : "").not.toBe("")
})

test("a repository mid-rebase says rebase, not detached", async () => {
  const { root, file } = repo()
  const run = git(root)
  run("checkout", "--quiet", "-b", "other")
  fs.writeFileSync(file, `{"id":"a","ord":"a0","title":"other"}\n`)
  run("commit", "--quiet", "-am", "other")
  run("checkout", "--quiet", "main")
  fs.writeFileSync(file, `{"id":"a","ord":"a0","title":"main"}\n`)
  run("commit", "--quiet", "-am", "main")
  run("checkout", "--quiet", "other")
  try {
    run("rebase", "main")
  } catch {
  }

  const repoState = await asked(root, (git) => git.state)
  expect(repoState._tag).toBe("Blocked")
  expect(repoState._tag === "Blocked" ? repoState.reason : null).toBe("rebase")
})

test("a repository mid-cherry-pick says so", async () => {
  const { root, file } = repo()
  const run = git(root)
  run("checkout", "--quiet", "-b", "other")
  fs.writeFileSync(file, `{"id":"a","ord":"a0","title":"other"}\n`)
  run("commit", "--quiet", "-am", "other")
  run("checkout", "--quiet", "main")
  fs.writeFileSync(file, `{"id":"a","ord":"a0","title":"main"}\n`)
  run("commit", "--quiet", "-am", "main")
  try {
    run("cherry-pick", "other")
  } catch {
  }

  const repoState = await asked(root, (git) => git.state)
  expect(repoState._tag).toBe("Blocked")
  expect(repoState._tag === "Blocked" ? repoState.reason : null).toBe("cherry-pick")
})

test("dirty names every file that moved, tracked or not", async () => {
  const { root, file } = repo()
  fs.writeFileSync(file, `{"id":"a","ord":"a0","title":"edited"}\n`)
  fs.writeFileSync(path.join(root, "new.olai"), `{"id":"n","ord":"a0","title":"n"}\n`)
  fs.writeFileSync(path.join(root, "notes.md"), "not an outline\n")

  const found = await surveyed(root)
  expect(found.files.map((one) => one.path).sort())
    .toEqual(["a.olai", "new.olai", "notes.md"])
  expect(found.upstream).toBe(null)
})

test("a status git refuses is Unusable with its words, not an empty tree", async () => {
  const { root } = repo()
  const opening = await Effect.runPromise(open(root))
  if (opening._tag !== "Opened") throw new Error("the fixture is not a work tree")
  fs.rmSync(path.join(root, ".git"), { recursive: true, force: true })

  const dirt = await Effect.runPromise(opening.repo.dirty)
  expect(dirt._tag).toBe("Unusable")
  expect(dirt._tag === "Unusable" ? dirt.said : "").not.toBe("")
})

test("dirty says where the branch stands against its upstream", async () => {
  const { root, file } = repo()
  const bare = fs.mkdtempSync(path.join(os.tmpdir(), "olai-git-remote-"))
  git(bare)("init", "--quiet", "--bare")
  const run = git(root)
  run("remote", "add", "origin", bare)
  run("push", "--quiet", "--set-upstream", "origin", "main")

  const level = await surveyed(root)
  expect(level.upstream).toEqual({ name: "origin/main", ahead: 0 })

  fs.writeFileSync(file, `{"id":"a","ord":"a0","title":"edited"}\n`)
  run("commit", "--quiet", "-am", "one of mine")
  expect((await surveyed(root)).upstream)
    .toEqual({ name: "origin/main", ahead: 1 })

  const sent = await asked(root, (git) => git.push)
  expect(sent._tag).toBe("Pushed")
  expect((await surveyed(root)).upstream)
    .toEqual({ name: "origin/main", ahead: 0 })
  expect(git(bare)("log", "--format=%s", "-1", "main").trim()).toBe("one of mine")
}, GIT_SUITE_TIMEOUT)

test("a push git refuses is an answer carrying its words", async () => {
  const { root } = repo()
  const { layer, said } = collector()

  const sent = await Effect.runPromise(
    asEffect(root, (git) => git.push).pipe(Effect.provide(layer)),
  )
  expect(sent._tag).toBe("Refused")
  expect(sent.said).not.toBe("")

  const warned = findSaid(said, "the branch was not pushed")
  expect(warned?.level).toBe("Warn")
  expect(String(warned?.annotations.said)).not.toBe("")
})

test("the last commit is olai's own, never the repository's HEAD", async () => {
  const { root, file } = repo()
  const run = git(root)

  expect(await asked(root, (git) => git.last(OLAI))).toBe(null)

  fs.writeFileSync(file, `{"id":"a","ord":"a0","title":"edited"}\n`)
  await asked(root, (git) =>
    git.commit({
      paths: [file],
      message: "olai: one edit\n\nX-Olai-Writer: chat-agent\n",
    }))
  fs.writeFileSync(path.join(root, "b.olai"), `{"id":"b","ord":"a0","title":"b"}\n`)
  run("add", "-A")
  run("commit", "--quiet", "-m", "mine, by hand")

  const last = await asked(root, (git) => git.last(OLAI))
  expect(last?.message).toBe("olai: one edit")
  expect(last?.trailer).toBe("chat-agent")
  expect(last?.sha).toMatch(/^[0-9a-f]{40}$/)
  expect(last?.at).not.toBe("")
})

test("a commit carrying the prefix but no trailer has an empty one", async () => {
  const { root, file } = repo()
  const run = git(root)
  fs.writeFileSync(file, `{"id":"a","ord":"a0","title":"edited"}\n`)
  run("add", "-A")
  run("commit", "--quiet", "-m", "olai: typed by a person")

  expect((await asked(root, (git) => git.last(OLAI)))?.trailer).toBe("")
})

test("an unrecognised trailer arrives verbatim rather than swallowed", async () => {
  const { root, file } = repo()
  const run = git(root)
  fs.writeFileSync(file, `{"id":"a","ord":"a0","title":"edited"}\n`)
  run("add", "-A")
  run("commit", "--quiet", "-m", "olai: from elsewhere\n\nX-Olai-Writer: some-other-tool\n")

  expect((await asked(root, (git) => git.last(OLAI)))?.trailer).toBe("some-other-tool")
})

test("show is the named commit's copy, and Absent for a file it never had", async () => {
  const { root, file } = repo()
  fs.writeFileSync(file, `{"id":"a","ord":"a0","title":"edited"}\n`)

  const head = await asked(root, (git) => git.head)
  expect(head).toMatch(/^[0-9a-f]{40}$/)
  expect(await asked(root, (git) => git.show(head ?? "", "a.olai")))
    .toEqual({ _tag: "Text", text: `{"id":"a","ord":"a0","title":"a"}\n` })
  expect(await asked(root, (git) => git.show(head ?? "", "never.olai")))
    .toEqual({ _tag: "Absent" })
})

test("a path no commit has is Absent; a git that could not answer is Unusable", async () => {
  const { root, file } = repo()
  const head = (await asked(root, (git) => git.head)) ?? ""

  fs.writeFileSync(path.join(root, "new.olai"), `{"id":"n","ord":"a0","title":"n"}\n`)
  git(root)("add", "new.olai")
  expect(await asked(root, (git) => git.show(head, "new.olai"))).toEqual({ _tag: "Absent" })
  fs.writeFileSync(file, `{"id":"a","ord":"a0","title":"staged edit"}\n`)
  git(root)("add", "a.olai")
  expect(await asked(root, (git) => git.show(head, "a.olai")))
    .toEqual({ _tag: "Text", text: `{"id":"a","ord":"a0","title":"a"}\n` })

  const refused = await asked(root, (git) => git.show("not-a-revision", "a.olai"))
  expect(refused._tag).toBe("Unusable")
  expect(refused._tag === "Unusable" ? refused.said : "").toContain("invalid object name")
})

test("head names the commit, moves when a commit lands, and is null before the first", async () => {
  const { root, file } = repo({ seed: false })
  expect(await asked(root, (git) => git.head)).toBe(null)

  const run = git(root)
  run("add", "-A")
  run("commit", "--quiet", "-m", "first")
  const first = await asked(root, (git) => git.head)
  expect(first).toMatch(/^[0-9a-f]{40}$/)

  fs.writeFileSync(file, `{"id":"a","ord":"a0","title":"edited"}\n`)
  run("commit", "--quiet", "-am", "second")
  const second = await asked(root, (git) => git.head)
  expect(second).toMatch(/^[0-9a-f]{40}$/)
  expect(second).not.toBe(first)

  expect(await asked(root, (git) => git.show(first ?? "", "a.olai")))
    .toEqual({ _tag: "Text", text: `{"id":"a","ord":"a0","title":"a"}\n` })
})

test("show names a file the way the repository does, from a served subdirectory", async () => {
  const { root } = repo()
  fs.mkdirSync(path.join(root, "notes"))
  fs.writeFileSync(path.join(root, "notes", "b.olai"), `{"id":"b","ord":"a0","title":"b"}\n`)
  fs.writeFileSync(path.join(root, "above.md"), "one level up\n")
  const run = git(root)
  run("add", "-A")
  run("commit", "--quiet", "-m", "more fixtures")

  const served = path.join(root, "notes")
  const head = (await asked(served, (git) => git.head)) ?? ""
  expect(await asked(served, (git) => git.show(head, "notes/b.olai")))
    .toEqual({ _tag: "Text", text: `{"id":"b","ord":"a0","title":"b"}\n` })
  expect(await asked(served, (git) => git.show(head, "above.md")))
    .toEqual({ _tag: "Text", text: "one level up\n" })
})

test("git refusing is a warning with git's own words in a field, and a Failed", async () => {
  const { root } = repo()
  const outside = loose().file
  const { layer, said } = collector()

  const done = await Effect.runPromise(
    asEffect(root, (git) => git.commit({ paths: [outside], message: "olai: a" }))
      .pipe(Effect.provide(layer)),
  )

  expect(done._tag).toBe("Failed")
  expect(done._tag === "Failed" ? done.lock : undefined).toBe(null)

  const warned = findSaid(said, "could not stage the write")
  expect(warned?.level).toBe("Warn")
  expect(String(warned?.annotations.said)).not.toBe("")
  expect(warned?.message).not.toContain("fatal")
})

test("a commit is the named paths, the message, and the sha it made", async () => {
  const { root, file } = repo()
  fs.writeFileSync(file, `{"id":"a","ord":"a0","title":"edited"}\n`)
  fs.writeFileSync(path.join(root, "untouched.olai"), `{"id":"u","ord":"a0","title":"u"}\n`)

  const done = await asked(root, (git) =>
    git.commit({ paths: [file], message: "olai: one edit\n\nX-Olai-Writer: web\n" }))
  expect(done._tag).toBe("Committed")
  expect(done._tag === "Committed" ? done.sha : "").toMatch(/^[0-9a-f]{40}$/)

  const run = git(root)
  expect(run("log", "--format=%s", "-1").trim()).toBe("olai: one edit")
  expect(run("log", "--format=%(trailers:key=X-Olai-Writer,valueonly)", "-1").trim())
    .toBe("web")
  expect(run("status", "--porcelain").trim()).toBe("?? untouched.olai")
})

test("a refused commit puts the index back exactly as it was", async () => {
  const { root, file } = repo()
  const run = git(root)
  const index = path.join(root, ".git", "index")

  fs.writeFileSync(path.join(root, "mine.md"), "half-finished, staged by hand\n")
  run("add", "mine.md")
  fs.writeFileSync(path.join(root, "mine.md"), "…and typed into since\n")
  fs.writeFileSync(file, `{"id":"a","ord":"a0","title":"edited"}\n`)

  run("config", "commit.gpgsign", "true")
  run("config", "gpg.program", path.join(root, "no-such-gpg"))

  const before = {
    bytes: fs.readFileSync(index),
    entries: run("ls-files", "-s"),
    status: run("status", "--porcelain"),
  }

  const { layer } = collector()
  const done = await Effect.runPromise(
    asEffect(root, (git) => git.commit({ paths: [file], message: "olai: one edit" }))
      .pipe(Effect.provide(layer)),
  )
  expect(done._tag).toBe("Failed")
  expect(done._tag === "Failed" ? done.said : "").not.toBe("")
  expect(done._tag === "Failed" ? done.lock : undefined).toBe(null)
  expect(run("log", "--format=%s").trim()).toBe("fixtures")

  expect(fs.readFileSync(index).equals(before.bytes)).toBe(true)
  expect(run("ls-files", "-s")).toBe(before.entries)
  expect(run("status", "--porcelain")).toBe(before.status)
  expect(before.status).toContain("AM mine.md")
  expect(before.status).toContain(" M a.olai")
})

const plantLock = (at: string, ageMs: number): number => {
  fs.writeFileSync(at, "")
  const stamp = (Date.now() - ageMs) / 1000
  fs.utimesSync(at, stamp, stamp)
  return fs.statSync(at).mtimeMs
}

const lockAt = (root: string): string => path.join(root, ".git", "index.lock")

test("a commit git refused over a lock file carries the file and when it was left", async () => {
  const { root, file } = repo()
  const run = git(root)
  const lock = lockAt(root)
  const planted = plantLock(lock, 10 * 60_000)
  fs.writeFileSync(file, `{"id":"a","ord":"a0","title":"edited"}\n`)

  const done = await asked(root, (git) =>
    git.commit({ paths: [file], message: "olai: one edit" }))

  expect(done._tag).toBe("Failed")
  if (done._tag !== "Failed") throw new Error("unreachable")
  expect(done.said).toContain("index.lock")
  expect(done.lock).not.toBe(null)
  expect(Math.abs((done.lock?.since ?? 0) - planted)).toBeLessThan(5_000)
  expect(run("log", "--format=%s").trim()).toBe("fixtures")
  expect(fs.existsSync(lock)).toBe(true)
  fs.rmSync(lock)
})

test("unlock holds a fresh lock, removes a stale one, and is Absent with none at all", async () => {
  const { root } = repo()
  const lock = lockAt(root)

  expect(await asked(root, (git) => git.unlock)).toEqual({ _tag: "Absent" })

  const fresh = plantLock(lock, 1_000)
  const held = await asked(root, (git) => git.unlock)
  expect(held._tag).toBe("Held")
  expect(held._tag === "Held" ? Math.abs(held.since - fresh) : 0).toBeLessThan(5_000)
  expect(fs.existsSync(lock)).toBe(true)

  plantLock(lock, 10 * 60_000)
  expect(await asked(root, (git) => git.unlock)).toEqual({ _tag: "Removed" })
  expect(fs.existsSync(lock)).toBe(false)

  expect(await asked(root, (git) => git.unlock)).toEqual({ _tag: "Absent" })
})

test("a lock that cannot be removed fails with the errno's own words, and stays", async () => {
  // Root ignores the directory mode, so the unwritable case cannot be provoked there.
  if (isRoot()) return
  const { root } = repo()
  const at = lockAt(root)
  plantLock(at, 10 * 60_000)

  const dir = path.dirname(at)
  fs.chmodSync(dir, 0o500)
  try {
    const exit = await Effect.runPromiseExit(asEffect(root, (git) => git.unlock))
    expect(Exit.isFailure(exit)).toBe(true)
    if (Exit.isFailure(exit)) {
      expect(Cause.pretty(exit.cause)).toContain("permission denied")
    }
  } finally {
    fs.chmodSync(dir, 0o700)
  }

  expect(fs.existsSync(at)).toBe(true)
  fs.rmSync(at)
})

test("a lock in a linked worktree is found under that worktree's own git directory", async () => {
  const { root } = repo()
  const run = git(root)
  const where = fs.mkdtempSync(path.join(os.tmpdir(), "olai-git-linked-"))
  const linked = path.join(where, "linked")
  run("worktree", "add", "--quiet", "--detach", linked)

  const theirs = lockAt(root)
  const mine = path.join(root, ".git", "worktrees", path.basename(linked), "index.lock")
  const planted = plantLock(mine, 10 * 60_000)
  plantLock(theirs, 10 * 60_000)

  const added = path.join(linked, "linked.olai")
  fs.writeFileSync(added, `{"id":"l","ord":"a0","title":"l"}\n`)
  const done = await asked(linked, (git) =>
    git.commit({ paths: [added], message: "olai: linked" }))

  expect(done._tag).toBe("Failed")
  expect(done._tag === "Failed" ? Math.abs((done.lock?.since ?? 0) - planted) : 0)
    .toBeLessThan(5_000)

  expect(await asked(linked, (git) => git.unlock)).toEqual({ _tag: "Removed" })
  expect(fs.existsSync(mine)).toBe(false)
  expect(fs.existsSync(theirs)).toBe(true)

  fs.rmSync(theirs)
  fs.rmSync(where, { recursive: true, force: true })
})

test("a commit stopped before it lands stages nothing and leaves no backup behind", async () => {
  const { root } = repo()
  const run = git(root)
  // A clean filter runs on the way INTO the index, which is how `git add` is
  // made slow without a hook.
  fs.writeFileSync(path.join(root, ".gitattributes"), "slow.md filter=slow\n")
  run("config", "filter.slow.clean", "sh -c 'sleep 3; cat'")
  run("add", ".gitattributes")
  run("commit", "-m", "attributes")
  const slow = path.join(root, "slow.md")
  fs.writeFileSync(slow, "one line\n")
  const before = run("log", "--format=%s")

  await Effect.runPromise(Effect.scoped(Effect.gen(function*() {
    const committing = yield* Effect.forkChild(
      asEffect(root, (git) => git.commit({ paths: [slow], message: "olai: slow" })),
    )
    yield* Effect.sleep("600 millis")
    yield* Fiber.interrupt(committing)
  })))

  expect(run("diff", "--cached", "--name-only").trim()).toBe("")
  expect(run("log", "--format=%s")).toBe(before)
  expect(fs.readdirSync(path.join(root, ".git")).filter((one) => one.startsWith("olai-index-")))
    .toEqual([])
}, GIT_SUITE_TIMEOUT)

test("a commit stopped after it lands keeps it, and does not un-stage what it recorded", async () => {
  const { root } = repo()
  const run = git(root)
  // `post-commit` runs after the commit is already in, which is the window.
  const hook = path.join(root, ".git", "hooks", "post-commit")
  fs.writeFileSync(hook, "#!/bin/sh\nsleep 3\n")
  fs.chmodSync(hook, 0o755)
  const fresh = path.join(root, "fresh.olai")
  fs.writeFileSync(fresh, `{"id":"f","ord":"a0","title":"f"}\n`)

  await Effect.runPromise(Effect.scoped(Effect.gen(function*() {
    const committing = yield* Effect.forkChild(
      asEffect(root, (git) => git.commit({ paths: [fresh], message: "olai: hooked" })),
    )
    yield* Effect.sleep("1200 millis")
    yield* Fiber.interrupt(committing)
  })))

  expect(run("log", "--format=%s").trim().split("\n")[0]).toBe("olai: hooked")
  expect(run("status", "--porcelain").trim()).toBe("")
  expect(fs.readdirSync(path.join(root, ".git")).filter((one) => one.startsWith("olai-index-")))
    .toEqual([])
}, GIT_SUITE_TIMEOUT)

test("a commit whose hook outlives the budget is not un-staged over a landed commit", async () => {
  const { root } = repo()
  const run = git(root)
  const hook = path.join(root, ".git", "hooks", "post-commit")
  fs.writeFileSync(hook, "#!/bin/sh\nsleep 14\n")
  fs.chmodSync(hook, 0o755)
  const fresh = path.join(root, "wedged.olai")
  fs.writeFileSync(fresh, `{"id":"w","ord":"a0","title":"w"}\n`)

  const done = await asked(root, (git) => git.commit({ paths: [fresh], message: "olai: wedged" }))
  expect(done._tag).toBe("Failed")
  expect(run("log", "--format=%s").trim().split("\n")[0]).toBe("olai: wedged")
  expect(run("status", "--porcelain").trim()).toBe("")
  expect(fs.readdirSync(path.join(root, ".git")).filter((one) => one.startsWith("olai-index-")))
    .toEqual([])
}, WEDGED_SUITE_TIMEOUT)

test("a commit that lands leaves the index agreeing with it", async () => {
  const { root } = repo()
  const run = git(root)
  const fresh = path.join(root, "new.olai")
  fs.writeFileSync(fresh, `{"id":"n","ord":"a0","title":"n"}\n`)

  expect((await asked(root, (git) => git.commit({ paths: [fresh], message: "olai: new" })))._tag)
    .toBe("Committed")

  expect(run("status", "--porcelain").trim()).toBe("")
  expect(run("ls-files", "-s")).toContain("new.olai")
})

test("a survey and a commit at once never fight index.lock", async () => {
  const { root, file } = repo()
  fs.writeFileSync(file, `{"id":"a","ord":"a0","title":"edited"}\n`)

  const rounds = await asked(root, (handle) =>
    Effect.all(
      Array.from({ length: 8 }, () =>
        Effect.all([
          handle.commit({ paths: [file], message: "olai: concurrent" }),
          handle.dirty,
          handle.state,
          handle.last(OLAI),
        ], { concurrency: 4 })),
      { concurrency: 4 },
    ))

  for (const [done, dirt] of rounds) {
    expect(done?._tag === "Failed" ? done.said : "").not.toContain("index.lock")
    expect(dirt?._tag === "Unusable" ? dirt.said : "").not.toContain("index.lock")
  }
  expect(
    rounds.some(([done]) => done?._tag === "Committed"),
  ).toBe(true)
})

test("two handles on one repository still never fight index.lock", async () => {
  const { root, file } = repo()
  fs.writeFileSync(file, `{"id":"a","ord":"a0","title":"edited"}\n`)

  const opened = await Promise.all([
    Effect.runPromise(open(root)),
    Effect.runPromise(open(root)),
  ])
  const handles = opened.map((one) => {
    if (one._tag !== "Opened") throw new Error(`${root} is not a work tree: ${one._tag}`)
    return one.repo
  })
  const left = handles[0]
  const right = handles[1]
  if (left === undefined || right === undefined) throw new Error("unreachable")

  const rounds = await Effect.runPromise(
    Effect.all(
      Array.from({ length: 8 }, () =>
        Effect.all([
          left.commit({ paths: [file], message: "olai: concurrent" }),
          right.dirty,
          left.state,
          right.last(OLAI),
        ], { concurrency: 4 })),
      { concurrency: 4 },
    ),
  )

  for (const [done, dirt] of rounds) {
    expect(done?._tag === "Failed" ? done.said : "").not.toContain("index.lock")
    expect(dirt?._tag === "Unusable" ? dirt.said : "").not.toContain("index.lock")
  }
  expect(
    rounds.some(([done]) => done?._tag === "Committed"),
  ).toBe(true)
})

const diverged = async (): Promise<{
  readonly root: string
  readonly file: string
  readonly bare: string
  readonly theirs: string
}> => {
  const made = repo()
  const bare = fs.mkdtempSync(path.join(os.tmpdir(), "olai-git-remote-"))
  git(bare)("init", "--quiet", "--bare", "--initial-branch", "main")
  const run = git(made.root)
  run("remote", "add", "origin", bare)
  run("push", "--quiet", "--set-upstream", "origin", "main")

  const theirs = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), "olai-git-theirs-")))
  git(theirs)("clone", "--quiet", bare, ".")
  git(theirs)("config", "user.email", "them@example.com")
  git(theirs)("config", "user.name", "them")
  fs.writeFileSync(path.join(theirs, "theirs.md"), "the other machine\n")
  git(theirs)("add", "-A")
  git(theirs)("commit", "--quiet", "-m", "theirs")
  git(theirs)("push", "--quiet", "origin", "main")

  fs.writeFileSync(made.file, `{"id":"a","ord":"a0","title":"mine"}\n`)
  run("commit", "--quiet", "-am", "mine")
  return { root: made.root, file: made.file, bare, theirs }
}

test("fetch moves the remote-tracking ref; a remote that cannot be reached is Refused with words", async () => {
  const { root, bare } = await diverged()
  const run = git(root)
  expect(run("log", "--format=%s", "origin/main", "-1").trim()).toBe("fixtures")
  const fetched = await asked(root, (g) => g.fetch)
  expect(fetched).toEqual({ _tag: "Fetched" })
  expect(run("log", "--format=%s", "origin/main", "-1").trim()).toBe("theirs")

  run("remote", "set-url", "origin", fs.mkdtempSync(path.join(os.tmpdir(), "olai-git-gone-")))
  const refused = await Effect.runPromise(
    asEffect(root, (g) => g.fetch).pipe(Effect.provide(collector().layer)),
  )
  expect(refused._tag).toBe("Refused")
  if (refused._tag === "Refused") expect(refused.said).not.toBe("")
  expect(git(bare)("log", "--format=%s", "-1", "main").trim()).toBe("theirs")
}, GIT_SUITE_TIMEOUT)

test("standing reads ahead and behind and the upstream, and is null with no upstream", async () => {
  const { root } = await diverged()
  const before = await asked(root, (g) => g.standing)
  expect(before).toEqual({
    upstream: "refs/remotes/origin/main",
    name: "origin/main",
    ahead: 1,
    behind: 0,
  })

  await asked(root, (g) => g.fetch)
  expect(await asked(root, (g) => g.standing)).toEqual({
    upstream: "refs/remotes/origin/main",
    name: "origin/main",
    ahead: 1,
    behind: 1,
  })

  const unborn = repo()
  git(unborn.root)("checkout", "--quiet", "-b", "feature")
  expect(await asked(unborn.root, (g) => g.standing)).toBe(null)
}, GIT_SUITE_TIMEOUT)

test("integrate rebases the unpushed commits onto the upstream, and cleans up after itself", async () => {
  const { root, file, bare } = await diverged()
  const run = git(root)
  await asked(root, (g) => g.fetch)
  const standing = await asked(root, (g) => g.standing)
  if (standing === null) throw new Error("expected an upstream")

  const old = run("rev-parse", "HEAD").trim()
  const done = await asked(root, (g) => g.integrate(standing))

  expect(done._tag).toBe("Integrated")
  if (done._tag !== "Integrated") throw new Error("unreachable")
  expect(done.taken).toBe(1)
  expect(done.from).toBe(old)
  expect(fs.readFileSync(path.join(root, "theirs.md"), "utf8")).toBe("the other machine\n")
  expect(run("rev-parse", "HEAD").trim()).toBe(done.to)
  expect(run("log", "--format=%s", "-1").trim()).toBe("mine")
  expect(run("worktree", "list").trim().split("\n")).toHaveLength(1)
  expect(fs.readdirSync(path.join(root, ".git")).filter((name) => name.startsWith("olai-integrate-")))
    .toHaveLength(0)
  expect(fs.existsSync(path.join(root, ".git", "rebase-merge"))).toBe(false)
  expect(git(bare)("log", "--format=%s", "-1", "main").trim()).toBe("theirs")
  expect((await Effect.runPromise(open(root)))._tag).toBe("Opened")
  fs.rmSync(path.join(root, "theirs.md"), { force: true })
}, GIT_SUITE_TIMEOUT)

test("integrate preserves a hand-staged entry and an unstaged edit for a path the upstream did not change", async () => {
  const { root, file } = await diverged()
  const run = git(root)
  await asked(root, (g) => g.fetch)
  const standing = await asked(root, (g) => g.standing)
  if (standing === null) throw new Error("expected an upstream")

  const staged = `{"id":"a","ord":"a0","title":"staged"}\n`
  const further = `{"id":"a","ord":"a0","title":"staged, and still working"}\n`
  fs.writeFileSync(file, staged)
  run("add", file)
  fs.writeFileSync(file, further)

  const done = await asked(root, (g) => g.integrate(standing))
  expect(done._tag).toBe("Integrated")
  expect(fs.readFileSync(file, "utf8")).toBe(further)
  expect(run("diff", "--cached", "--", file).trim()).toContain('"staged"')
  expect(run("diff", "--", file).trim()).toContain("still working")
  fs.rmSync(path.join(root, "theirs.md"), { force: true })
}, GIT_SUITE_TIMEOUT)

test("integrate with an uncommitted edit in a path the upstream changed is Overlapped, nothing moved", async () => {
  const { root, file, theirs } = await diverged()
  const run = git(root)
  await asked(root, (g) => g.fetch)
  const standing = await asked(root, (g) => g.standing)
  if (standing === null) throw new Error("expected an upstream")

  fs.writeFileSync(path.join(root, "theirs.md"), "half a thought\n")
  const old = run("rev-parse", "HEAD").trim()

  const done = await asked(root, (g) => g.integrate(standing))
  expect(done._tag).toBe("Overlapped")
  if (done._tag === "Overlapped") expect(done.paths).toEqual(["theirs.md"])
  expect(run("rev-parse", "HEAD").trim()).toBe(old)
  expect(fs.readFileSync(path.join(root, "theirs.md"), "utf8")).toBe("half a thought\n")
  expect(run("worktree", "list").trim().split("\n")).toHaveLength(1)
  fs.rmSync(theirs, { recursive: true, force: true })
}, GIT_SUITE_TIMEOUT)

test("integrate with an untracked file where the upstream added one is Overlapped, nothing moved", async () => {
  const { root, theirs } = await diverged()
  const run = git(root)
  await asked(root, (g) => g.fetch)
  const standing = await asked(root, (g) => g.standing)
  if (standing === null) throw new Error("expected an upstream")
  const old = run("rev-parse", "HEAD").trim()
  fs.writeFileSync(path.join(root, "theirs.md"), "mine is here\n")

  const done = await asked(root, (g) => g.integrate(standing))
  expect(done._tag).toBe("Overlapped")
  if (done._tag === "Overlapped") {
    expect(done.said).toContain("would be overwritten")
    expect(done.paths).toEqual(["theirs.md"])
  }
  expect(run("rev-parse", "HEAD").trim()).toBe(old)
  expect(fs.readFileSync(path.join(root, "theirs.md"), "utf8")).toBe("mine is here\n")
  fs.rmSync(theirs, { recursive: true, force: true })
}, GIT_SUITE_TIMEOUT)

test("integrate on a conflict is Conflicted naming the path, tree clean, nothing left behind", async () => {
  const made = repo()
  const bare = fs.mkdtempSync(path.join(os.tmpdir(), "olai-git-remote-"))
  git(bare)("init", "--quiet", "--bare", "--initial-branch", "main")
  const run = git(made.root)
  fs.writeFileSync(path.join(made.root, "both.txt"), "base content\n")
  run("add", "both.txt")
  run("commit", "--quiet", "-m", "base both")
  run("remote", "add", "origin", bare)
  run("push", "--quiet", "--set-upstream", "origin", "main")

  const other = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), "olai-git-theirs-")))
  git(other)("clone", "--quiet", bare, ".")
  git(other)("config", "user.email", "them@example.com")
  git(other)("config", "user.name", "them")
  fs.writeFileSync(path.join(other, "both.txt"), "their line\n")
  git(other)("commit", "--quiet", "-am", "theirs")
  git(other)("push", "--quiet", "origin", "main")

  fs.writeFileSync(path.join(made.root, "both.txt"), "my line\n")
  run("commit", "--quiet", "-am", "mine")
  await asked(made.root, (g) => g.fetch)
  const at = await asked(made.root, (g) => g.standing)
  if (at === null) throw new Error("expected an upstream")
  const old = run("rev-parse", "HEAD").trim()

  const done = await asked(made.root, (g) => g.integrate(at))
  expect(done._tag).toBe("Conflicted")
  if (done._tag === "Conflicted") {
    expect(done.said).toContain("both.txt")
    expect(done.paths.join(" ")).toContain("both.txt")
    expect(done.said).toContain("CONFLICT")
  }
  expect(run("rev-parse", "HEAD").trim()).toBe(old)
  expect(fs.readFileSync(path.join(made.root, "both.txt"), "utf8")).toBe("my line\n")
  expect(fs.existsSync(path.join(made.root, ".git", "rebase-merge"))).toBe(false)
  expect(run("worktree", "list").trim().split("\n")).toHaveLength(1)
})

test("interrupting integrate mid-rebase removes the worktree", async () => {
  const { root, theirs } = await diverged()
  const run = git(root)
  manyCommits(root, run, 40)
  await asked(root, (g) => g.fetch)
  const standing = await asked(root, (g) => g.standing)
  if (standing === null) throw new Error("expected an upstream")

  const before = run("worktree", "list").trim().split("\n").length
  let exit: Exit.Exit<unknown, unknown> | undefined
  await Effect.runPromise(Effect.gen(function*() {
    const fiber = yield* asEffect(root, (g) => g.integrate(standing)).pipe(Effect.forkChild)
    let found = false
    for (let i = 0; i < 400; i++) {
      if (fs.readdirSync(path.join(root, ".git")).some((n) => n.startsWith("olai-integrate-"))) {
        found = true
        break
      }
      yield* Effect.sleep("5 millis")
    }
    expect(found).toBe(true)
    yield* Fiber.interrupt(fiber)
    exit = yield* Fiber.await(fiber)
  }))
  expect(exit?._tag).toBe("Failure")
  expect(exit !== undefined && Exit.hasInterrupts(exit)).toBe(true)
  expect(run("worktree", "list").trim().split("\n").length).toBe(before)
  expect(fs.readdirSync(path.join(root, ".git")).filter((n) => n.startsWith("olai-integrate-")))
    .toHaveLength(0)
  fs.rmSync(theirs, { recursive: true, force: true })
}, GIT_SUITE_TIMEOUT)


const manyCommits = (root: string, run: (...argv: ReadonlyArray<string>) => string, n: number): void => {
  const file = path.join(root, "a.olai")
  for (let i = 0; i < n; i++) {
    fs.writeFileSync(file, `{"id":"a","ord":"a0","title":"mine ${i}"}\n`)
    run("add", "a.olai")
    run("commit", "--quiet", "-m", `mine ${i}`)
  }
}

const worktreeCount = (run: (...argv: ReadonlyArray<string>) => string): number =>
  run("worktree", "list").trim().split("\n").length

test("a stale olai-integrate-<deadpid> worktree is swept at the start of the next integrate", async () => {
  const { root, theirs } = await diverged()
  const run = git(root)
  await asked(root, (g) => g.fetch)
  const standing = await asked(root, (g) => g.standing)
  if (standing === null) throw new Error("expected an upstream")

  const gitDir = run("rev-parse", "--git-dir").trim()
  const stale = path.join(gitDir, "olai-integrate-2147483647-1")
  run("worktree", "add", "--no-checkout", "--detach", stale, "HEAD")
  expect(worktreeCount(run)).toBe(2)

  await asked(root, (g) => g.integrate(standing))
  expect(worktreeCount(run)).toBe(1)
  expect(fs.existsSync(stale)).toBe(false)
  fs.rmSync(theirs, { recursive: true, force: true })
}, GIT_SUITE_TIMEOUT)
test("integrate's compare-and-swap refuses when a terminal commit landed, and does not drop it", async () => {
  const { root, theirs } = await diverged()
  const run = git(root)
  await asked(root, (g) => g.fetch)
  const standing = await asked(root, (g) => g.standing)
  if (standing === null) throw new Error("expected an upstream")
  const from = run("rev-parse", "HEAD").trim()

  const tree = run("rev-parse", "HEAD^{tree}").trim()
  const terminal = run("commit-tree", tree, "-p", from, "-m", "terminal commit").trim()
  const hooks = path.join(root, ".git", "hooks")
  fs.mkdirSync(hooks, { recursive: true })
  const hook = `#!/bin/sh\nrepo="${root}"\nterminal="${terminal}"\ngit -C "$repo" update-ref refs/heads/main "$terminal"\nexit 0\n`
  fs.writeFileSync(path.join(hooks, "post-checkout"), hook)
  fs.chmodSync(path.join(hooks, "post-checkout"), 0o755)

  const done = await asked(root, (g) => g.integrate(standing))
  expect(done._tag).toBe("Refused")
  if (done._tag === "Refused") expect(done.said).not.toBe("")
  expect(run("rev-parse", "HEAD").trim()).toBe(terminal)
  expect(run("status", "--porcelain").trim()).toBe("")
  expect(run("log", "--format=%s", "-1").trim()).toBe("terminal commit")
  expect(worktreeCount(run)).toBe(1)
  fs.unlinkSync(path.join(hooks, "post-checkout"))
  fs.rmSync(theirs, { recursive: true, force: true })
}, GIT_SUITE_TIMEOUT)

test("the served survey stays Ready and worktree-free while an integrate is in flight", async () => {
  const { root, theirs } = await diverged()
  const run = git(root)
  manyCommits(root, run, 40)
  await asked(root, (g) => g.fetch)
  const standing = await asked(root, (g) => g.standing)
  if (standing === null) throw new Error("expected an upstream")

  await Effect.runPromise(Effect.gen(function*() {
    const fiber = yield* asEffect(root, (g) => g.integrate(standing)).pipe(Effect.forkChild)
    let found = false
    for (let i = 0; i < 400; i++) {
      if (fs.readdirSync(path.join(root, ".git")).some((n) => n.startsWith("olai-integrate-"))) {
        found = true
        break
      }
      yield* Effect.sleep("5 millis")
    }
    expect(found).toBe(true)
    const mid = yield* asEffect(root, (g) => g.state)
    expect(mid._tag).toBe("Ready")
    if (mid._tag !== "Ready") throw new Error("expected Ready mid-integrate")
    const servedStatus = run("status", "--porcelain")
    const serveProbe = run("status", "--porcelain", "--", "a.olai")
    expect(serveProbe).toBe("")
    expect(servedStatus.split("\n").some((l) => l.includes("olai-integrate-"))).toBe(false)
    yield* Fiber.await(fiber)
  }))
  expect(fs.readdirSync(path.join(root, ".git")).filter((n) => n.startsWith("olai-integrate-")))
    .toHaveLength(0)
  fs.rmSync(theirs, { recursive: true, force: true })
}, GIT_SUITE_TIMEOUT)

