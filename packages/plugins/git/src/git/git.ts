import { Hung, run } from "@kolu/child"
import { Effect, Semaphore } from "effect"
import * as fs from "node:fs"
import { join, resolve } from "node:path"

import type { How, Lock, Reason, RepoState, UnlockResult } from "@olai/format"

const BUDGET = 10_000

/**
 * The INDEX GATE: `git status` refreshes the index and `git commit` writes it,
 * so two fibers doing both lose to `index.lock`. One permit per git directory,
 * keyed on `gitDir` so two handles of one repository share it.
 */
const indexGates = new Map<string, Semaphore.Semaphore>()

const indexGate = (gitDir: string): Semaphore.Semaphore => {
  const had = indexGates.get(gitDir)
  if (had !== undefined) return had
  const made = Semaphore.makeUnsafe(1)
  indexGates.set(gitDir, made)
  return made
}

const holdIndex = <A, E, R>(
  gitDir: string,
  op: Effect.Effect<A, E, R>,
): Effect.Effect<A, E, R> => indexGate(gitDir).withPermit(op)

interface Said {
  readonly ok: boolean
  readonly said: string
  readonly out: string
  readonly hung?: true
}

const git = (root: string, argv: ReadonlyArray<string>): Effect.Effect<Said> =>
  Effect.promise(async () => {
    try {
      const result = await run("git", [...argv], {
        cwd: root,
        timeout: BUDGET,
        maxBuffer: 32 * 1024 * 1024,
        // `LC_ALL=C` so git's own sentences are the ones {@link NOT_A_REPO}
        // reads — a translated git would be reported as unusable rather than
        // as no repository. `GIT_TERMINAL_PROMPT=0` so a repository that wants
        // a credential fails instead of sitting on a prompt nobody can answer.
        env: { ...process.env, LC_ALL: "C", GIT_TERMINAL_PROMPT: "0" },
      })
      return { ok: result.ok, said: result.said, out: result.out }
    } catch (cause) {
      if (!(cause instanceof Hung)) throw cause
      return { ok: false, said: cause.message, out: cause.out, hung: true }
    }
  })

interface Placement {
  readonly gitDir: string
  readonly prefix: string
  readonly top: string
}

/** git's own answer for "there is no repository here", pinned to English by the
 *  `LC_ALL=C` the runner sets. Matched rather than inferred from the exit code
 *  because 128 is also what a repository git REFUSES to use answers with. */
const NOT_A_REPO = /not a git repository/i

type Placing =
  | { readonly _tag: "Placed"; readonly placement: Placement }
  | { readonly _tag: "NoRepo" }
  | { readonly _tag: "Unusable"; readonly said: string }

const NO_REPO = { _tag: "NoRepo" } as const

const place = (root: string): Effect.Effect<Placing> =>
  Effect.map(
    git(root, [
      "rev-parse",
      "--is-inside-work-tree",
      "--absolute-git-dir",
      "--show-prefix",
    ]),
    ({ ok, out, said }) => {
      if (!ok) {
        return NOT_A_REPO.test(said)
          ? NO_REPO
          : ({ _tag: "Unusable", said } as const)
      }
      // `--show-prefix` prints an EMPTY line at the repository root, which is
      // why the raw stdout is split rather than the trimmed message.
      const lines = out.split("\n")
      // A bare repository answers `false`: there is nowhere for the files to be.
      if (lines[0]?.trim() !== "true") return NO_REPO
      const gitDir = lines[1]?.trim()
      if (gitDir === undefined || gitDir === "") return NO_REPO
      const prefix = lines[2]?.trim() ?? ""
      return {
        _tag: "Placed",
        placement: { gitDir, prefix, top: topOf(root, prefix) },
      } as const
    },
  )

/**
 * A BARE repository makes `rev-parse --show-toplevel` fail — "this operation
 * must be run in a work tree" — so the root is climbed from the prefix instead.
 * Asking git would also answer with its realpath, where climbing keeps the
 * caller's own spelling, symlinks and all.
 */
const topOf = (root: string, prefix: string): string =>
  prefix === ""
    ? root
    : resolve(root, prefix.split("/").filter((step) => step !== "").map(() => "..").join("/"))

/** A rebase leaves a detached HEAD behind, so this list is checked
 *  BEFORE the branch is asked for — otherwise every rebase would report as
 *  "detached", which is true and not the useful half. */
const IN_PROGRESS: ReadonlyArray<readonly [string, Reason]> = [
  ["rebase-merge", "rebase"],
  ["rebase-apply", "rebase"],
  ["MERGE_HEAD", "merge"],
  ["CHERRY_PICK_HEAD", "cherry-pick"],
]

export interface Repo {
  readonly served: string
  readonly state: Effect.Effect<RepoState>
  readonly dirty: Effect.Effect<Dirt>
  readonly head: Effect.Effect<string | null>
  readonly show: (commit: string, path: string) => Effect.Effect<Shown>
  readonly last: (audit: Audit) => Effect.Effect<Recorded | null>
  readonly commit: (what: CommitInput) => Effect.Effect<Done>
  readonly fetch: Effect.Effect<Fetched>
  readonly standing: Effect.Effect<Standing | null>
  readonly integrate: (onto: Standing) => Effect.Effect<Integrated>
  readonly push: Effect.Effect<Sent>
  readonly unlock: Effect.Effect<UnlockResult, UnlockRefused>
}

export type Opening =
  | { readonly _tag: "Opened"; readonly repo: Repo }
  | { readonly _tag: "NoRepo" }
  | { readonly _tag: "Unusable"; readonly said: string }

export const open = (root: string): Effect.Effect<Opening> =>
  Effect.map(place(root), (placing) => {
    if (placing._tag !== "Placed") return placing
    const gitDir = placing.placement.gitDir
    return {
      _tag: "Opened" as const,
      repo: {
        served: placing.placement.prefix,
        state: state(root, placing.placement),
        dirty: holdIndex(gitDir, dirty(root, placing.placement)),
        head: head(root),
        show: (commit: string, path: string) => show(root, commit, path),
        last: (audit: Audit) => last(root, audit),
        commit: (what: CommitInput) =>
          holdIndex(gitDir, commit(root, placing.placement, what)),
        fetch: fetch(root),
        standing: standing(root),
        integrate: (onto: Standing) =>
          integrate(root, placing.placement, onto),
        push: push(root),
        unlock: unlock(placing.placement),
      },
    }
  })

const state = (
  root: string,
  placed: Placement,
): Effect.Effect<RepoState> =>
  Effect.gen(function*() {
    const inGitDir = new Set(
      fs.existsSync(placed.gitDir) ? fs.readdirSync(placed.gitDir) : [],
    )
    for (const [file, reason] of IN_PROGRESS) {
      if (inGitDir.has(file)) {
        return {
          _tag: "Blocked",
          reason,
          said: `${file} is present in ${placed.gitDir}`,
        } as const
      }
    }

    const branch = yield* git(root, ["symbolic-ref", "--short", "HEAD"])
    return branch.ok
      ? ({ _tag: "Ready", branch: branch.said } as const)
      : ({ _tag: "Blocked", reason: "detached", said: branch.said } as const)
  })

export interface Spelled {
  readonly path: string
  readonly served: string | null
  readonly at: string
}

export interface Dirty extends Spelled {
  readonly how: How
  readonly from: Spelled | null
}

export interface Upstream {
  readonly name: string
  readonly ahead: number
}

export type Dirt =
  | {
    readonly _tag: "Surveyed"
    readonly files: ReadonlyArray<Dirty>
    readonly upstream: Upstream | null
  }
  | { readonly _tag: "Unusable"; readonly said: string }

/**
 * `--porcelain -z` because the plain form quotes anything unusual and `-z` does
 * not; `-uall` because a brand-new outline is untracked.
 *
 * `status.relativePaths=false` is pinned rather than assumed: the parsing below
 * strips the served prefix off what git printed, which is only right while git
 * prints repo-relative paths.
 */
const dirty = (
  root: string,
  placed: Placement,
): Effect.Effect<Dirt> =>
  Effect.gen(function*() {
    const status = yield* git(root, [
      "-c",
      "status.relativePaths=false",
      "status",
      "--porcelain",
      "-z",
      "-uall",
      "--branch",
    ])
    if (!status.ok) return { _tag: "Unusable", said: status.said } as const

    const files: Array<Dirty> = []
    const seen = new Set<string>()
    const spell = (path: string): Spelled => ({
      path,
      served: path.startsWith(placed.prefix)
        ? path.slice(placed.prefix.length)
        : null,
      at: join(placed.top, path),
    })
    const take = (path: string, how: How, from: string | undefined): void => {
      if (from !== undefined && from !== "") seen.add(from)
      if (path === "" || seen.has(path)) return
      seen.add(path)
      files.push({
        ...spell(path),
        how,
        from: from === undefined || from === "" ? null : spell(from),
      })
    }

    let upstream: Upstream | null = null
    const tokens = status.out.split("\0")
    for (let at = 0; at < tokens.length; at++) {
      const entry = tokens[at]
      if (entry === undefined) continue
      if (entry.startsWith("## ")) {
        upstream = tracking(entry.slice(3))
        continue
      }
      if (entry.length < 4) continue
      const how = howOf(entry[0] ?? " ", entry[1] ?? " ")
      // A rename or a copy is followed by a SECOND token naming where it came
      // from. BOTH consume it — the cursor has to move either way or every
      // entry after this one is read as a path — and only a RENAME keeps it.
      const paired = entry[0] === "R" || entry[0] === "C"
      const other = paired ? tokens[++at] : undefined
      take(entry.slice(3), how, entry[0] === "R" ? other : undefined)
    }
    return { _tag: "Surveyed", files, upstream } as const
  })

const howOf = (x: string, y: string): How => {
  if (x === "?") return "untracked"
  if (x === "R" || y === "R") return "renamed"
  if (x === "A" || y === "A" || x === "C" || y === "C") return "added"
  if (x === "D" || y === "D") return "deleted"
  return "modified"
}

const tracking = (header: string): Upstream | null => {
  const [, tracked] = header.split("...")
  if (tracked === undefined) return null
  const name = tracked.split(" [")[0]?.trim() ?? ""
  if (name === "") return null
  const ahead = /\bahead (\d+)/.exec(tracked)
  return { name, ahead: ahead === null ? 0 : Number(ahead[1]) }
}

const head = (root: string): Effect.Effect<string | null> =>
  Effect.map(
    git(root, ["rev-parse", "--verify", "HEAD"]),
    (said) => (said.ok ? said.out.trim() : null),
  )

export type Shown =
  | { readonly _tag: "Text"; readonly text: string }
  | { readonly _tag: "Absent" }
  | { readonly _tag: "Unusable"; readonly said: string }

const ABSENT = { _tag: "Absent" } as const

/**
 * git's own words for "that commit does not have that path", both of the
 * spellings it has, pinned to English by the same `LC_ALL=C`. Matched rather
 * than inferred from the exit code: 128 is also what an invalid revision, a
 * repository git refuses to use and a hook that wrote to stderr answer with.
 *
 * The path itself is not matched across a newline (`.` does not), so a file
 * whose name contains one falls through to `Unusable`.
 */
const NOT_IN_COMMIT = /^fatal: path .*(?:does not exist in|exists on disk, but not in) '/m

const show = (
  root: string,
  commit: string,
  path: string,
): Effect.Effect<Shown> =>
  Effect.map(git(root, ["show", `${commit}:${path}`]), (shown) => {
    if (shown.ok) return { _tag: "Text", text: shown.out } as const
    return NOT_IN_COMMIT.test(shown.said)
      ? ABSENT
      : ({ _tag: "Unusable", said: shown.said } as const)
  })

export interface Audit {
  readonly prefix: string
  readonly trailer: string
}

export interface Recorded {
  readonly sha: string
  readonly message: string
  readonly at: string
  readonly trailer: string
}

const last = (
  root: string,
  audit: Audit,
): Effect.Effect<Recorded | null> =>
  Effect.map(
    git(root, [
      "log",
      "-1",
      `--grep=^${audit.prefix}`,
      `--format=%H%x00%s%x00%aI%x00%(trailers:key=${audit.trailer},valueonly)`,
    ]),
    ({ ok, out }) => {
      if (!ok) return null
      const [sha, message, at, writer] = out.split("\0")
      if (sha === undefined || sha.trim() === "") return null
      return {
        sha: sha.trim(),
        message: message ?? "",
        at: at ?? "",
        trailer: writer?.trim() ?? "",
      }
    },
  )

export type Done =
  | { readonly _tag: "Committed"; readonly sha: string }
  | { readonly _tag: "Failed"; readonly said: string; readonly lock: Lock | null }

/**
 * `lstat` rather than `existsSync`, which follows symlinks: a symbolic link
 * whose target is gone is still a file git tracks and still a file a commit
 * must be able to name.
 */
const there = (at: string): boolean =>
  fs.lstatSync(at, { throwIfNoEntry: false }) !== undefined

export interface CommitInput {
  readonly paths: ReadonlyArray<string>
  readonly message: string
}

/**
 * `--no-verify` skips hooks and skips nothing else, so a repository configured
 * to SIGN its commits with no key to sign them refuses every olai commit — and
 * the `add` before it staged the selection every time. So the index file is
 * copied before the staging and put back if anything goes wrong, by a rename,
 * which is atomic.
 *
 * Doing the whole thing under a temporary `GIT_INDEX_FILE` instead is wrong:
 * commit an untracked `b.txt` that way and the real index, which never learnt
 * about it, reads `D  b.txt` — a file present in HEAD and absent from the index
 * is a staged DELETION. Git's own `git commit -- <paths>` writes the committed
 * paths back into the real index for exactly that reason.
 */
interface Index {
  readonly keep: () => void
  readonly settle: () => void
}

let backups = 0

const keptIndex = (placed: Placement): Index => {
  const index = join(placed.gitDir, "index")
  const backup = join(placed.gitDir, `olai-index-${process.pid}-${++backups}`)
  const had = fs.existsSync(index)
  if (had) fs.copyFileSync(index, backup)
  let keep = false
  let settled = false
  return {
    keep: () => { keep = true },
    settle: () => {
      if (settled) return
      settled = true
      if (keep) {
        if (had) fs.rmSync(backup, { force: true })
        return
      }
      if (had) fs.renameSync(backup, index)
      else fs.rmSync(index, { force: true })
    },
  }
}

const INDEX_LOCK = "index.lock"

export class UnlockRefused extends Error {
  constructor(why: string) {
    super(why)
    this.name = "UnlockRefused"
  }
}

/**
 * GIT'S OWN WORDS WHEN A LOCK FILE IS IN THE WAY, pinned to English by the
 * `LC_ALL=C` the runner sets.
 *
 * The path inside it is never used: what olai stats and what olai unlinks is
 * `join(gitDir, INDEX_LOCK)`, because a LINKED WORKTREE's
 * `--absolute-git-dir` is `.git/worktrees/<name>`, so its lock is the one in
 * THERE, which is the git directory this handle already has.
 */
const LOCK_SAID = /Unable to create '.+\/index\.lock': File exists/

const mtimeOf = (at: string): number | null => {
  try {
    return fs.statSync(at).mtimeMs
  } catch {
    return null
  }
}

const lockBehind = (placed: Placement, said: string): Lock | null => {
  if (!LOCK_SAID.test(said)) return null
  const since = mtimeOf(join(placed.gitDir, INDEX_LOCK))
  return since === null ? null : { since }
}

/**
 * Remove the stale `index.lock` git refused a write over, or say why not.
 *
 * A lock younger than {@link BUDGET} may belong to a git that is still writing
 * it — olai's own git gets exactly that long — and removing somebody else's
 * lock mid-write is how two writers corrupt one index. git's `index.lock`
 * carries no pid, so nothing can ask whether the process that left it is
 * alive, and the mtime is the only signal there is.
 */
const unlock = (placed: Placement): Effect.Effect<UnlockResult, UnlockRefused> =>
  Effect.gen(function*() {
    const at = join(placed.gitDir, INDEX_LOCK)
    const since = mtimeOf(at)
    if (since === null) return { _tag: "Absent" } as const
    if (Date.now() - since < BUDGET) return { _tag: "Held", since } as const
    yield* Effect.try({
      try: () => fs.unlinkSync(at),
      catch: (cause) =>
        new UnlockRefused(cause instanceof Error ? cause.message : String(cause)),
    })
    return { _tag: "Removed" } as const
  })

/**
 * `--no-verify` because a served directory's hooks belong to whatever project
 * it is part of: a linter refusing an outline write would leave the bytes on
 * disk and the reason somewhere nobody is looking. It skips hooks and nothing
 * else, so where the repository signs its commits olai's are signed too, and
 * where no key exists every commit in it fails the same way in a terminal.
 */
const commit = (
  root: string,
  placed: Placement,
  what: CommitInput,
): Effect.Effect<Done> =>
  Effect.acquireUseRelease(
    Effect.sync(() => keptIndex(placed)),
    (index) =>
      Effect.gen(function*() {
        // `git add` looks at the working tree and the index and NOWHERE ELSE:
        // the departing half of a staged `git mv` is in neither, so handing it
        // that path refuses the whole call with
        // `fatal: pathspec '<old>' did not match any files`. Skipping it loses
        // nothing — `git commit -- <paths>` records a departure out of HEAD
        // and the index without any staging at all.
        const staging = what.paths.filter(there)
        if (staging.length > 0) {
          const staged = yield* Effect.uninterruptible(git(root, ["add", "--", ...staging]))
          if (!staged.ok) {
            yield* Effect.annotateLogs(
              Effect.logWarning("olai git: could not stage the write"),
              { said: staged.said },
            )
            return {
              _tag: "Failed",
              said: staged.said,
              lock: lockBehind(placed, staged.said),
            } as const
          }
        }

        const committed = yield* Effect.uninterruptible(Effect.gen(function*() {
          const said = yield* git(
            root,
            ["commit", "--no-verify", "-m", what.message, "--", ...what.paths],
          )
          if (said.ok) {
            index.keep()
            return said
          }
          if (said.hung !== true) return said
          // `git commit -- <paths>` writes those paths back into the real
          // index, so a landed commit leaves nothing staged for them and a
          // commit that never ran leaves what the `add` staged. git's own
          // window between moving the ref and writing the index back is
          // microseconds wide, and the budget's kill lands in a HOOK, which is
          // after both; nothing here can narrow it further.
          const staged = yield* git(root, ["diff", "--cached", "--name-only", "--", ...what.paths])
          if (staged.ok && staged.out.trim() === "") index.keep()
          return said
        }))
        if (!committed.ok) {
          yield* Effect.annotateLogs(
            Effect.logWarning("olai git: the write was not committed"),
            { commitMessage: what.message.split("\n")[0] ?? "", said: committed.said },
          )
          return {
            _tag: "Failed",
            said: committed.said,
            lock: lockBehind(placed, committed.said),
          } as const
        }

        const head = yield* git(root, ["rev-parse", "HEAD"])
        return { _tag: "Committed", sha: head.ok ? head.said : "" } as const
      }),
    (index) => Effect.sync(index.settle),
  )

export type Sent =
  | { readonly _tag: "Pushed"; readonly said: string }
  | { readonly _tag: "Refused"; readonly said: string }

const push = (root: string): Effect.Effect<Sent> =>
  Effect.gen(function*() {
    const sent = yield* git(root, ["push"])
    if (!sent.ok) {
      yield* Effect.annotateLogs(
        Effect.logWarning("olai git: the branch was not pushed"),
        { said: sent.said },
      )
      return { _tag: "Refused", said: sent.said } as const
    }
    return { _tag: "Pushed", said: sent.said } as const
  })

export interface Standing {
  readonly upstream: string
  readonly name: string
  readonly ahead: number
  readonly behind: number
}

export type Fetched =
  | { readonly _tag: "Fetched" }
  | { readonly _tag: "Refused"; readonly said: string }

const fetch = (root: string): Effect.Effect<Fetched> =>
  Effect.gen(function*() {
    const said = yield* git(root, ["fetch"])
    if (!said.ok) {
      yield* Effect.annotateLogs(
        Effect.logWarning("olai git: the fetch was refused"),
        { said: said.said },
      )
      return { _tag: "Refused", said: said.said } as const
    }
    return { _tag: "Fetched" } as const
  })

const standing = (root: string): Effect.Effect<Standing | null> =>
  Effect.gen(function*() {
    const ref = yield* git(root, ["rev-parse", "--symbolic-full-name", "@{upstream}"])
    if (!ref.ok) return null
    const upstream = ref.out.trim()
    if (upstream === "") return null
    const [behind, ahead] = (yield* git(
      root,
      ["rev-list", "--left-right", "--count", `${upstream}...HEAD`],
    )).out.trim().split(/\s+/)
    const name = upstream.replace(/^refs\/remotes\//, "")
    return {
      upstream,
      name,
      ahead: Number(ahead ?? 0),
      behind: Number(behind ?? 0),
    } as const
  })

export type Integrated =
  | { readonly _tag: "Integrated"; readonly from: string; readonly to: string; readonly taken: number }
  | { readonly _tag: "Overlapped"; readonly said: string; readonly paths: ReadonlyArray<string> }
  | { readonly _tag: "Conflicted"; readonly said: string; readonly paths: ReadonlyArray<string> }
  | { readonly _tag: "Refused"; readonly said: string }

/**
 * A rebase conflict names its files on lines that start `CONFLICT`; a
 * `read-tree` overlap names its path inside `Entry '<path>' not uptodate` or
 * `Untracked working tree file '<path>'`, and has no `CONFLICT` line at all.
 */
const refusalPaths = (said: string): ReadonlyArray<string> =>
  [...said.matchAll(
    /CONFLICT \([^)]*\): ([^\n]+)|Entry '([^']+)' not uptodate|Untracked working tree file '([^']+)'/g,
  )]
    .map((match) => match[1] ?? match[2] ?? match[3])
    .filter((one): one is string => one !== undefined)

let integrations = 0

/**
 * `--no-checkout` plus `reset --hard` is what keeps the project's
 * `post-checkout` hook from running, and the served tree's `status` does not
 * see the worktree at all. The rebase is configured with config keys rather
 * than flags so an older git ignores them instead of refusing them.
 * `read-tree -m -u` refuses before writing anything when a path the upstream
 * changed has local changes (`Entry 'x' not uptodate. Cannot merge.`) or an
 * untracked file would be overwritten, which is the OVERLAP answer; the third
 * argument to `update-ref` is a compare-and-swap, so a commit typed in a
 * terminal during the rebase makes it refuse rather than be dropped.
 *
 * Next to nothing here is index-gated, but THIS is: no olai commit may land
 * between the rebase reading `HEAD` and the ref moving.
 */
const integrate = (
  root: string,
  placed: Placement,
  onto: Standing,
): Effect.Effect<Integrated> =>
  Effect.gen(function*() {
    const head = yield* git(root, ["rev-parse", "--verify", "HEAD"])
    if (!head.ok || head.out.trim() === "") {
      return { _tag: "Refused", said: head.said } as const
    }
    const from = head.out.trim()
    const worktreeName = `olai-integrate-${process.pid}-${++integrations}`
    const worktree = join(placed.gitDir, worktreeName)

    const sweep = yield* git(root, ["worktree", "list", "--porcelain"])
    if (sweep.ok) {
      for (const entry of sweep.out.split("\n")) {
        const match = /^worktree (.*\/olai-integrate-(\d+)-(\d+))$/.exec(entry)
        if (match === null) continue
        const pid = match[2]
        if (pid === undefined || pid === String(process.pid)) continue
        if (isAlive(Number(pid))) continue
        const at = match[1]
        if (at === undefined) continue
        yield* git(root, ["worktree", "remove", "--force", at])
      }
      yield* git(root, ["worktree", "prune"])
    }

    return yield* holdIndex(
      placed.gitDir,
      Effect.acquireUseRelease(
        Effect.gen(function*() {
          const added = yield* git(root, ["worktree", "add", "--no-checkout", "--detach", worktree, from])
          // `-C`, never `--git-dir`: the checkout directory holds a `.git`
          // file pointing at `.git/worktrees/<name>`, which is where the
          // rebase's state lives, and `--git-dir` does not follow it.
          if (!added.ok) return added
          return yield* git(
            root,
            ["-C", worktree, "reset", "--hard", "--quiet", "HEAD"],
          )
        }),
        (prepared) =>
          Effect.gen(function*() {
            if (!prepared.ok) {
              return { _tag: "Refused", said: prepared.said } as const
            }
            const rebased = yield* git(root, [
              "-C",
              worktree,
              "-c",
              "rebase.updateRefs=false",
              "-c",
              "rebase.autoStash=false",
              "-c",
              "rerere.enabled=false",
              "rebase",
              "--no-verify",
              onto.upstream,
            ])
            if (!rebased.ok) {
              if (/CONFLICT \(content\)|CONFLICT \(modify\/delete\)|CONFLICT \(add\/add\)/.test(rebased.said)) {
                yield* git(root, ["-C", worktree, "rebase", "--abort"])
                yield* Effect.annotateLogs(
                  Effect.logWarning("olai git: the take-in conflicted, nothing moved"),
                  { said: rebased.said },
                )
                return { _tag: "Conflicted", said: rebased.said, paths: refusalPaths(rebased.said) } as const
              }
              return { _tag: "Refused", said: rebased.said } as const
            }

            return yield* Effect.uninterruptible(Effect.gen(function*() {
              const to = (yield* git(root, ["-C", worktree, "rev-parse", "HEAD"])).out.trim()
              if (to === "" || to === from) {
                return { _tag: "Integrated", from, to: to === "" ? from : to, taken: 0 } as const
              }
              const moved = yield* git(root, ["read-tree", "-m", "-u", from, to])
              if (!moved.ok) {
                return { _tag: "Overlapped", said: moved.said, paths: refusalPaths(moved.said) } as const
              }
              const branch = (yield* git(root, ["symbolic-ref", "--short", "HEAD"])).out.trim()
              const ref = branch === "" ? "HEAD" : `refs/heads/${branch}`
              const set = yield* git(root, [
                "update-ref",
                "-m",
                `olai: integrated ${onto.name}`,
                ref,
                to,
                from,
              ])
              if (set.ok) {
                return { _tag: "Integrated", from, to, taken: onto.behind } as const
              }
              yield* git(root, ["read-tree", "-m", "-u", to, from])
              return { _tag: "Refused", said: set.said } as const
            }))
          }),
        () =>
          Effect.gen(function*() {
            yield* git(root, ["worktree", "remove", "--force", worktree])
            yield* git(root, ["worktree", "prune"])
          }),
      ),
    )
  })

/** Whether a pid belongs to a live process. `kill(pid, 0)` answers without
 *  signalling. */
const isAlive = (pid: number): boolean => {
  try {
    process.kill(pid, 0)
    return true
  } catch (error) {
    // `ESRCH` is the one certain "dead"; anything else — `EPERM` for a live
    // process we may not signal, `EINVAL` for a pid out of range — is not a
    // corpse to sweep.
    return (error as NodeJS.ErrnoException).code !== "ESRCH"
  }
}
