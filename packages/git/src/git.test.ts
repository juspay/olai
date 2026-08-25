/**
 * The plumbing, against real repositories.
 *
 * Two things are worth holding here and neither is "git works". The first is
 * the SHAPE OF A REFUSAL: a git that says no is a line and never a failed
 * write, so the message has to be stable and git's own words have to ride it as
 * a FIELD rather than interpolated into the sentence. The second is
 * {@link state}, which is new — nothing used to ask whether the repository was
 * mid-merge, mid-rebase or on a detached HEAD before committing, and an agent
 * marking a node done in the middle of a conflict could swallow a resolution.
 * A blocked repository is the one answer that cannot be tested by reading the
 * code, so it is tested by putting a repository in that state.
 */

import { collector, findSaid } from "@olai/log/testlib"
import { expect, test } from "bun:test"
import { Effect } from "effect"
import * as fs from "node:fs"
import * as os from "node:os"
import * as path from "node:path"

import { gitIn as git, repoAt } from "./fixtures.testlib.ts"
import { type Audit, type Dirt, open, type Repo } from "./git.ts"

/** The audit convention the packages above this one actually use, so what the
 *  tests read back is what olai writes — handed in, because which prefix and
 *  which trailer a caller signs with is exactly what this package does not
 *  know. */
const OLAI: Audit = { prefix: "olai", trailer: "X-Olai-Writer" }

/** A directory with a file in it and no repository anywhere it can reach —
 *  `/tmp` is not itself a work tree, and nothing here walks upwards past it. */
const loose = (): { readonly root: string; readonly file: string } => {
  const root = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), "olai-git-")))
  const file = path.join(root, "a.olai")
  fs.writeFileSync(file, `{"id":"a","ord":"a0","title":"a"}\n`)
  return { root, file }
}

/** The same directory, with a repository and one commit in it — or with the
 *  repository and NO commit, which is the shape `head` has to answer `null`
 *  for. */
const repo = (
  options: { readonly seed?: boolean } = {},
): { readonly root: string; readonly file: string } => {
  const made = loose()
  repoAt(made.root, options)
  return made
}

/** Every question below is asked of a repository, so this is the prologue they
 *  share: open the directory, or fail the test saying it is not one. */
const asEffect = <A>(
  root: string,
  use: (git: Repo) => Effect.Effect<A>,
): Effect.Effect<A> =>
  Effect.flatMap(open(root), (opening) =>
    opening._tag !== "Opened"
      ? Effect.die(new Error(`${root} is not a work tree: ${opening._tag}`))
      : use(opening.repo))

const asked = <A>(
  root: string,
  use: (git: Repo) => Effect.Effect<A>,
): Promise<A> => Effect.runPromise(asEffect(root, use))

/** The survey, for the tests that are about what it FOUND rather than about a
 *  git that could not answer — which has its own test, and which every one of
 *  these would otherwise have to narrow past. */
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

/**
 * The distinction #108 was filed for, and the one this socket must never give
 * back.
 *
 * Every way of failing to ANSWER the question used to be the same `null`, which
 * a caller read as "not a repository" — so a service with no git on its PATH,
 * and a repository git refuses to use (dubious ownership is the one people
 * actually hit), both told the reader their notes were not under version
 * control. Anything git says that is not its own "not a git repository" is
 * `Unusable`, and it arrives with what git said.
 */
test("a git that cannot answer is Unusable carrying its words, not NoRepo", async () => {
  const { root } = loose()
  fs.rmSync(root, { recursive: true, force: true })

  const opening = await Effect.runPromise(open(root))
  expect(opening._tag).toBe("Unusable")
  if (opening._tag !== "Unusable") throw new Error("unreachable")
  expect(opening.said).not.toBe("")
})

/**
 * The three spellings, from a served SUBDIRECTORY — where they are three
 * different strings and the difference matters.
 *
 * git prints `notes/b.olai`, because git speaks repo-relative paths. What
 * comes back also says what the SERVED root calls it, and where it is on disk,
 * which is the whole reason the placement belongs to the handle rather than to
 * a caller.
 */
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

/**
 * The bug this whole item was filed for: serving `docs/` and editing a
 * `README.md` one level up said nothing was waiting.
 *
 * A file OUTSIDE the served directory comes back with `served: null`, which is
 * exactly the news a caller needs — it is dirty, and olai does not serve it, so
 * nothing above can have anything to say about what is in it.
 */
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

/** The porcelain XY letters, which were surveyed and thrown away one line
 *  later. Every arm, in one repository, because the collapse of X and Y is a
 *  decision rather than an accident. */
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
  // A rename git only sees once both halves are staged.
  run("add", "-A", "moved.md", "landed.md")

  const how = new Map(
    (await surveyed(root)).files.map((one) => [one.path, one.how]),
  )
  expect(how.get("a.olai")).toBe("modified")
  expect(how.get("gone.olai")).toBe("deleted")
  expect(how.get("fresh.md")).toBe("untracked")
  expect(how.get("staged.md")).toBe("added")
  // A rename is ONE entry that names both sides — see the test below. The side
  // it came from is not an entry of its own: it is not a file waiting to be
  // deleted, it is half of the one above.
  expect(how.get("landed.md")).toBe("renamed")
  expect(how.has("moved.md")).toBe(false)
})

/**
 * A rename is ONE thing that happened, and the survey has to say so.
 *
 * Two entries — a `renamed` arrival and a `deleted` departure with nothing
 * joining them — is what left a person's commit panel reading `Kept.md deleted`
 * after a `git mv Kept.md Kept.olai`, with the file that actually holds their
 * notes nowhere near it. Git knows both halves and prints them on one line; the
 * entry keeps them together, in the same three spellings the arriving side has.
 */
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

/**
 * A COPY is not a rename, and its source is somebody else's row.
 *
 * Git only prints `C` when a reader has asked for copy detection
 * (`status.renames=copies`), so this is a repository configured the way the
 * handful of people who want that configure it. What it costs to get wrong is
 * not rare at all: a copy's source is a file that is STILL THERE, so folding it
 * into the copy's entry both hid a staged edit to it — the porcelain prints
 * `C dest\0src` before `M src` whenever `dest` sorts first — and put it on the
 * pathspec of any commit that ticked the copy, sweeping that edit in unasked.
 *
 * Both orderings, because the swallow only showed up in one of them.
 */
test("a copy leaves its source to be its own row, whichever order git prints", async () => {
  const { root } = repo()
  const run = git(root)
  fs.writeFileSync(path.join(root, "notes.md"), "the original\n")
  run("add", "-A")
  run("commit", "--quiet", "-m", "more fixtures")

  // `Copy.md` sorts BEFORE `notes.md`, so the porcelain prints the copy first
  // and the source's own modification second.
  fs.writeFileSync(path.join(root, "Copy.md"), "the original\n")
  fs.writeFileSync(path.join(root, "notes.md"), "the original, edited\n")
  run("add", "-A")
  run("config", "status.renames", "copies")

  const found = (await surveyed(root)).files
  expect(found.map((one) => [one.path, one.how, one.from?.path ?? null]).sort())
    .toEqual([
      // The arrival is an arrival. WHERE git thinks it was copied from is git's
      // inference about content, not a second file waiting to be committed.
      ["Copy.md", "added", null],
      // And the source's staged edit is still here, as its own row and its own
      // tick — which is the whole of what folding it in had taken away.
      ["notes.md", "modified", null],
    ])
})

/**
 * The MCP face's own reproduction, at the plumbing.
 *
 * `git mv old new` by hand and then a commit answered
 * `fatal: pathspec 'old' did not match any files` — git's raw refusal, carried
 * all the way out to an agent's reply. The cause is one call: the `add` that
 * makes an untracked file committable was handed a path that has already left
 * the working tree, and `git add` looks only at the working tree and the index.
 * A path with nothing on disk has nothing to stage; `git commit -- <path>`
 * records its departure out of HEAD, which is what git's own porcelain does.
 */
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

  // ONE commit, and git reads it back as the rename it is rather than as an
  // unrelated add beside a deletion.
  expect(run("show", "--name-status", "--find-renames", "--format=", "HEAD").trim())
    .toBe("R100\tKept.md\tKept.olai")
  expect(run("status", "--porcelain").trim()).toBe("")
  // And the INDEX is what a person's next `git commit` in a terminal will see:
  // nothing staged that this call left behind. `status` being empty says the
  // work tree matches HEAD; this says the index does too, which is the promise
  // {@link keptIndex} makes and the one a clean tree can hide.
  expect(run("diff", "--cached", "--name-only").trim()).toBe("")
})

/**
 * The other departing half, and the same one-line fix under it: a `git rm`.
 *
 * `git add -- <a path that is gone>` is the same pathspec fatal the rename hit,
 * reached without any rename at all — which makes it the narrower statement of
 * what the filter is for. The commit still names it, and `git commit -- <path>`
 * records the removal out of HEAD with nothing staged for it.
 */
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
  // A conflicting merge leaves MERGE_HEAD behind, which is the whole point.
  try {
    run("merge", "other")
  } catch {
    // Expected: the merge conflicts, and that is the state under test.
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

// EVERY served file that moved, including the ones that are not outlines:
// which of them matter is a statement about the format, and this module has
// none of that in it.
// A conflicting rebase leaves `rebase-merge` behind, and it also detaches
// HEAD — which is exactly why the markers are read BEFORE the branch is asked
// for. Reported as "detached", this would be true and useless: the thing to do
// about it is `git rebase --continue`, not `git checkout`.
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
    // Expected: the rebase stops on the conflict, which is the state under test.
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
    // Expected: it conflicts, leaving CHERRY_PICK_HEAD.
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
  // Nothing to push to, which is not the same as nothing to push — a
  // repository nobody has given a remote has nowhere for a branch to go.
  expect(found.upstream).toBe(null)
})

/**
 * A status git REFUSES is not a clean tree.
 *
 * It used to answer with no files and no upstream, which every reader above
 * draws as "nothing waiting, nothing to push" — so a repository that became
 * unreadable under a running server would have shown `✓ committed` with the
 * reason nowhere. That is #108's own mistake one call over, and HACKING's rule
 * is the same one: git's words come back, and the caller publishes them.
 */
test("a status git refuses is Unusable with its words, not an empty tree", async () => {
  const { root } = repo()
  // The git directory taken out from under a handle that is already open —
  // which is what a survey meeting a repository it cannot read looks like.
  const opening = await Effect.runPromise(open(root))
  if (opening._tag !== "Opened") throw new Error("the fixture is not a work tree")
  fs.rmSync(path.join(root, ".git"), { recursive: true, force: true })

  const dirt = await Effect.runPromise(opening.repo.dirty)
  expect(dirt._tag).toBe("Unusable")
  expect(dirt._tag === "Unusable" ? dirt.said : "").not.toBe("")
})

/**
 * How far ahead of its upstream the branch is, off the header line the status
 * call is already printing — one subprocess for both halves of "what is not
 * recorded, and what is not shared".
 */
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

  // And pushing it is one verb with nothing to decide: the current branch, to
  // the upstream it already has.
  const sent = await asked(root, (git) => git.push)
  expect(sent._tag).toBe("Pushed")
  expect((await surveyed(root)).upstream)
    .toEqual({ name: "origin/main", ahead: 0 })
  expect(git(bare)("log", "--format=%s", "-1", "main").trim()).toBe("one of mine")
})

/**
 * A push that git refuses comes back with git's own words, exactly as a refused
 * commit does. Never a failed effect, and never a silent nothing — this is the
 * one thing about pushing a person cannot find out any other way from inside
 * the app.
 */
test("a push git refuses is an answer carrying its words", async () => {
  const { root } = repo()
  const { layer, said } = collector()

  const sent = await Effect.runPromise(
    asEffect(root, (git) => git.push).pipe(Effect.provide(layer)),
  )
  expect(sent._tag).toBe("Refused")
  // A branch with no upstream and no remote: git says so, at length, and what
  // it says is what a reader is shown.
  expect(sent.said).not.toBe("")

  const warned = findSaid(said, "the branch was not pushed")
  expect(warned?.level).toBe("Warn")
  expect(String(warned?.annotations.said)).not.toBe("")
})

test("the last commit is olai's own, never the repository's HEAD", async () => {
  const { root, file } = repo()
  const run = git(root)

  // Nothing of olai's yet, however many commits the person has made.
  expect(await asked(root, (git) => git.last(OLAI))).toBe(null)

  fs.writeFileSync(file, `{"id":"a","ord":"a0","title":"edited"}\n`)
  await asked(root, (git) =>
    git.commit({
      paths: [file],
      message: "olai: one edit\n\nX-Olai-Writer: chat-agent\n",
    }))
  // ... and a person's commit on top of it does not become olai's.
  fs.writeFileSync(path.join(root, "b.olai"), `{"id":"b","ord":"a0","title":"b"}\n`)
  run("add", "-A")
  run("commit", "--quiet", "-m", "mine, by hand")

  const last = await asked(root, (git) => git.last(OLAI))
  expect(last?.message).toBe("olai: one edit")
  expect(last?.trailer).toBe("chat-agent")
  expect(last?.sha).toMatch(/^[0-9a-f]{40}$/)
  expect(last?.at).not.toBe("")
})

/** A commit carrying the prefix and no trailer comes back with an EMPTY one,
 *  rather than a guess — and rather than a `null` this file would have had to
 *  invent a vocabulary to justify. What "no writer recorded" means is decided
 *  one package up, which is the whole of the classification that moved out. */
test("a commit carrying the prefix but no trailer has an empty one", async () => {
  const { root, file } = repo()
  const run = git(root)
  fs.writeFileSync(file, `{"id":"a","ord":"a0","title":"edited"}\n`)
  run("add", "-A")
  run("commit", "--quiet", "-m", "olai: typed by a person")

  expect((await asked(root, (git) => git.last(OLAI)))?.trailer).toBe("")
})

/** And a trailer nothing here recognises is NOT filtered out: an unknown
 *  writer is news, and the classification that turns it into `null` is the
 *  caller's — this file hands over what git printed. */
test("an unrecognised trailer arrives verbatim rather than swallowed", async () => {
  const { root, file } = repo()
  const run = git(root)
  fs.writeFileSync(file, `{"id":"a","ord":"a0","title":"edited"}\n`)
  run("add", "-A")
  run("commit", "--quiet", "-m", "olai: from elsewhere\n\nX-Olai-Writer: some-other-tool\n")

  expect((await asked(root, (git) => git.last(OLAI)))?.trailer).toBe("some-other-tool")
})

test("show is the named commit's copy, and null for a file it never had", async () => {
  const { root, file } = repo()
  fs.writeFileSync(file, `{"id":"a","ord":"a0","title":"edited"}\n`)

  const head = await asked(root, (git) => git.head)
  expect(head).toMatch(/^[0-9a-f]{40}$/)
  expect(await asked(root, (git) => git.show(head ?? "", "a.olai")))
    .toBe(`{"id":"a","ord":"a0","title":"a"}\n`)
  expect(await asked(root, (git) => git.show(head ?? "", "never.olai"))).toBe(null)
})

/**
 * WHICH COMMIT, and the shapes where there is not one.
 *
 * The pairing is the point: a caller that keeps what {@link Repo.show} answered
 * keeps it under this sha, so a commit landing here has to produce a DIFFERENT
 * one — that is what makes a remembered copy impossible to serve for the wrong
 * revision (`@olai/ops`' `committed.ts`). A repository with no commits yet
 * answers `null` rather than a sentinel, which is the same answer a git that
 * could not be asked gives, and the same answer `show` would give for every
 * path in it.
 */
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

  // ... and the first sha still answers what it always answered, which is the
  // property the cache one package up is built on.
  expect(await asked(root, (git) => git.show(first ?? "", "a.olai")))
    .toBe(`{"id":"a","ord":"a0","title":"a"}\n`)
})

/**
 * REPO-ROOT-RELATIVE, from a served subdirectory — the spelling {@link Dirty}
 * hands out, and the reason it is that one.
 *
 * It took the SERVED name and prefixed it, which can name everything under the
 * served root and nothing above it. That is a hole rather than a restriction:
 * the side a rename INTO a served directory came from lives above it, and a
 * caller with only the served spelling had no way to ask for it. `HEAD:<path>`
 * is repo-root-relative in git's own object syntax whatever directory it runs
 * in, so the prefix was never doing anything the caller could not do better.
 */
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
    .toBe(`{"id":"b","ord":"a0","title":"b"}\n`)
  // The one the served spelling could not reach at all.
  expect(await asked(served, (git) => git.show(head, "above.md"))).toBe("one level up\n")
})

test("git refusing is a warning with git's own words in a field, and a Failed", async () => {
  const { root } = repo()
  // A path git will not stage, because it is not in this repository at all.
  // What is under test is the SHAPE of the refusal rather than this particular
  // way of provoking one — a commit runs after the bytes are already on disk
  // and on screen, so every way git can say no has to come back as an answer.
  const outside = loose().file
  const { layer, said } = collector()

  const done = await Effect.runPromise(
    asEffect(root, (git) => git.commit({ paths: [outside], message: "olai: a" }))
      .pipe(Effect.provide(layer)),
  )

  // Never fails the write, and never claims to have committed.
  expect(done._tag).toBe("Failed")

  const warned = findSaid(said, "could not stage the write")
  expect(warned?.level).toBe("Warn")
  // The message is the stable half; what git actually said varies, so it is an
  // annotation — greppable by field rather than by substring, which is the
  // whole reason it is not in the sentence.
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
  // The file nobody named is still untracked: only the paths given are ever
  // staged, because a served directory is a working tree with other work in it.
  expect(run("status", "--porcelain").trim()).toBe("?? untouched.olai")
})

/**
 * A commit that REFUSES leaves the index exactly as it found it.
 *
 * This is the contract every layer above advertises — the MCP tool's text, the
 * wire schema, the panel's own prose all say olai never touches the index — and
 * until now it was true only on the success path. A commit is `add` then
 * `commit`, and when the commit refused, the `add` stayed: the next `git commit`
 * a person typed in a terminal would have recorded the very files olai had just
 * told them it could not.
 *
 * SIGNING is how it was found, and it is the case that makes it a bug rather
 * than a curiosity: `--no-verify` skips hooks and nothing else, so a repository
 * with `commit.gpgsign` and no usable key refuses EVERY olai commit — and
 * staged the selection every time. That configuration is what this test makes,
 * with a `gpg.program` that does not exist so the refusal does not depend on
 * what is installed on the machine running it.
 */
test("a refused commit puts the index back exactly as it was", async () => {
  const { root, file } = repo()
  const run = git(root)
  const index = path.join(root, ".git", "index")

  // Something staged BY HAND, and edited again afterwards, so the index holds a
  // blob that is neither HEAD's nor the working tree's — the state a careless
  // restore would flatten.
  fs.writeFileSync(path.join(root, "mine.md"), "half-finished, staged by hand\n")
  run("add", "mine.md")
  fs.writeFileSync(path.join(root, "mine.md"), "…and typed into since\n")
  // And what olai is about to be asked to commit.
  fs.writeFileSync(file, `{"id":"a","ord":"a0","title":"edited"}\n`)

  // A signature nothing can produce, which is a real repository's real setting.
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
  // Git's own words about the signature, not a sentence of ours.
  expect(done._tag === "Failed" ? done.said : "").not.toBe("")
  expect(run("log", "--format=%s").trim()).toBe("fixtures")

  // BIT-IDENTICAL, which is the strongest way to say "untouched" — and the
  // logical reading beside it, because that is the claim a person cares about:
  // their staged blob is still staged, and the outline olai could not commit is
  // not sitting in their index waiting to be swept into a commit of their own.
  expect(fs.readFileSync(index).equals(before.bytes)).toBe(true)
  expect(run("ls-files", "-s")).toBe(before.entries)
  expect(run("status", "--porcelain")).toBe(before.status)
  // `AM`: staged by hand, typed into since — both halves of what was there.
  expect(before.status).toContain("AM mine.md")
  // And the outline is MODIFIED rather than staged: the `add` this call made
  // has been taken back out.
  expect(before.status).toContain(" M a.olai")
})

/**
 * And the SUCCESS path still updates the index for what it committed, which is
 * the half a "never touch the index at all" fix would have broken.
 *
 * Doing the whole thing under a temporary `GIT_INDEX_FILE` leaves the real
 * index never having heard of a newly committed file — and a file that is in
 * HEAD and absent from the index reads as a staged DELETION, so a person's
 * `git status` would show `D` against the file olai had just recorded. Git's
 * own `git commit -- <paths>` writes those paths back into the real index for
 * exactly this reason.
 */
test("a commit that lands leaves the index agreeing with it", async () => {
  const { root } = repo()
  const run = git(root)
  const fresh = path.join(root, "new.olai")
  fs.writeFileSync(fresh, `{"id":"n","ord":"a0","title":"n"}\n`)

  expect((await asked(root, (git) => git.commit({ paths: [fresh], message: "olai: new" })))._tag)
    .toBe("Committed")

  // Clean, rather than a staged deletion of the file that was just committed.
  expect(run("status", "--porcelain").trim()).toBe("")
  expect(run("ls-files", "-s")).toContain("new.olai")
})

/**
 * A survey and a commit at once must not lose to git's `index.lock`.
 *
 * `git status` refreshes the index; `git commit` writes it. Two fibers doing
 * both in one repository used to fail the write with `File exists`, and the
 * quiet window recorded nothing under load. The permit is per git directory,
 * and only those two verbs take it.
 */
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

/**
 * TWO HANDLES, one repository — the gate is per `gitDir`, not per handle.
 * A handle-local semaphore would pass the test above and still lose here.
 */
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
