import {
  armedOn,
  brokenBy,
  BusyFailure,
  COMMIT_BUTTON,
  COMMIT_MODES,
  COMMIT_TOOL,
  type CommitMode,
  type CommitRequest,
  type CommitResult,
  changesOf,
  composed,
  type Derived,
  claims,
  type GitPolicy,
  type GitState,
  type How,
  isReady,
  type LastCommit,
  type Lock,
  type Node,
  nodesOf,
  NOTHING_PENDING,
  type Other,
  type OpFailure,
  type OutlineError,
  outlineNames,
  type Pending,
  QUIET_MS,
  type PushResult,
  type Reading,
  type Reason,
  type RepoState,
  type UnlockResult,
  type Unpushed,
  Writer,
  type Wrote,
} from "@olai/format"
import type { WaitingOutline } from "@olai/plugin-api/services"
import type { Ops } from "@olai/ops"
import * as Git from "../git/git.ts"
import { Duration, Effect, Scope, Semaphore, Stream, SubscriptionRef } from "effect"

import { type Committed, remembering } from "./committed.ts"
import { AUDIT, signed } from "./message.ts"

export { COMMIT_BUTTON, COMMIT_MODES, COMMIT_TOOL, type CommitMode }

export type { GitState }

const gitOf = (
  repo: RepoState,
  policy: GitPolicy,
  settled: Settled,
): GitState => {
  const rest = {
    policy,
    pushSaid: settled.pushSaid,
    paused: settled.paused,
    lock: null,
  }
  if (settled.refusal !== null) {
    return {
      status: "error",
      said: settled.refusal.said,
      ...rest,
      lock: settled.refusal.lock,
    }
  }
  switch (repo._tag) {
    case "Off":
      return { status: "off", said: null, ...rest }
    case "NoRepo":
      return { status: "none", said: null, ...rest }
    case "Unusable":
      return { status: "error", said: repo.said, ...rest }
    case "Ready":
    case "Blocked":
      return { status: "repo", said: null, ...rest }
  }
}

interface Refusal {
  readonly said: string
  readonly lock: Lock | null
}

interface Settled {
  readonly refusal: Refusal | null
  readonly pushSaid: string | null
  readonly paused: string | null
}

const NOTHING_SETTLED: Settled = {
  refusal: null,
  pushSaid: null,
  paused: null,
}

export const whyOf = (
  mode: CommitMode,
  repo: RepoState,
  refused: string | null,
  writer: Writer,
): string => {
  if (refused !== null) return `git refused the commit: ${refused}`
  switch (repo._tag) {
    case "Off":
      return COMMITS_OFF
    case "NoRepo":
      return "the served directory is not a git work tree, so there is nothing to commit to"
    case "Unusable":
      return `git could not be asked about this directory: ${repo.said}`.trim()
    case "Blocked":
      return `${busy(repo.reason)}, so the write is on disk but cannot be ` +
        `committed — finish that first, then commit`
    case "Ready":
      switch (mode) {
        case "off":
          return COMMITS_OFF
        case "manual":
          return "waiting to be committed: writes accumulate under commit: manual (the " +
            `default) until ${commitDoor(writer)} asks for one`
        case "auto":
          return `waiting to be committed: commit: auto records everything waiting ` +
            `once writes stop arriving for ${Math.round(QUIET_MS / 1000)} seconds`
      }
  }
}

const COMMITS_OFF =
  "this directory is served with commit: off, so writes are not committed"

const busy = (reason: Reason): string =>
  reason === "detached"
    ? "the repository is on a detached HEAD"
    : `the repository is mid-${reason}`

export const commitDoor = (writer: Writer): string => {
  switch (writer) {
    case "web":
    case "move":
    case "filer":
    case "auto":
      return COMMIT_BUTTON
    case "mcp":
      return COMMIT_TOOL
    case "chat-agent":
      return `${COMMIT_TOOL} or ${COMMIT_BUTTON}`
    case "sleep":
      return COMMIT_BUTTON
  }
}

export interface Options {
  readonly ops: Pick<Ops, "parserFor">
  readonly root: string
  readonly at: Effect.Effect<Reading | null>
  readonly policy: () => GitPolicy
  readonly onSettled?: () => void
  readonly quiet?: Duration.Input
  readonly committed?: Committed
}

export interface Committing {
  readonly status: Effect.Effect<Status>
  readonly pending: Effect.Effect<Pending>
  readonly waiting: Effect.Effect<ReadonlyArray<WaitingOutline>>
  readonly commit: (
    request: CommitRequest,
    writer: Writer,
  ) => Effect.Effect<CommitResult>
  readonly push: Effect.Effect<PushResult>
  readonly git: Effect.Effect<GitState>
  readonly whyWaiting: (writer: Writer) => Effect.Effect<string>
  readonly wrote: (writer: Writer) => void
  readonly observe: (pending: Pending) => Effect.Effect<void>
  readonly hold: Effect.Effect<void, never, Scope.Scope>
  readonly loop: Effect.Effect<void>
  readonly catchUp: Effect.Effect<void>
  readonly resume: Effect.Effect<void>
  readonly unlock: Effect.Effect<UnlockResult, OpFailure>
}

const OFF: RepoState = { _tag: "Off" }

export interface Status {
  readonly pending: Pending
  readonly git: GitState
}

interface Served {
  readonly file: string
  readonly path: string
  readonly at: string
  readonly how: How
  readonly from: Git.Spelled | null
}

interface Survey {
  readonly git: Git.Repo | null
  readonly repo: RepoState
  readonly served: string
  readonly outlines: ReadonlyArray<Served>
  readonly others: ReadonlyArray<Git.Dirty>
  readonly unpushed: Unpushed | null
  readonly last: Pending["last"]
}

const NO_FILES: ReadonlySet<string> = new Set()
const NO_ERRORS: ReadonlyMap<string, ReadonlyArray<OutlineError>> = new Map()

const NOTHING_ASKED = {
  git: null,
  served: "",
  outlines: [],
  others: [],
  unpushed: null,
  last: null,
} as const

interface Detail {
  readonly changes: Pending["changes"]
  readonly unreadable: ReadonlyArray<string>
}

export const make = (options: Options): Committing => {
  const committedSide = options.committed ?? remembering(options.ops)

  const mode = (): CommitMode => options.policy().commit

  const counts = new Map<Writer, number>()
  const wrote = (writer: Writer): void => {
    counts.set(writer, (counts.get(writer) ?? 0) + 1)
  }
  const counted = (): ReadonlyArray<Wrote> =>
    [...counts].map(([writer, ops]) => ({ writer, ops }))

  const pushPermit = Semaphore.makeUnsafe(1)

  let settled: Settled = NOTHING_SETTLED

  const committed = (refusal: Refusal | null): void => {
    settled = { ...settled, refusal, paused: stopBy(refusal?.said ?? null) }
  }

  type PushedOutcome = "ok" | "overlap" | "refused"
  const pushed = (said: string | null, outcome: PushedOutcome): void => {
    settled = {
      ...settled,
      pushSaid: said,
      paused: outcome === "refused" ? stopBy(said) : settled.paused,
    }
  }

  const charge = (
    kind: "overlap" | "conflict",
    said: string,
    paths: ReadonlyArray<string>,
  ): string => {
    const named = paths.join(", ")
    const base = kind === "overlap"
      ? "changes here overlap changes the upstream took in, so nothing moved"
      : "the upstream's changes conflict with the ones here, so nothing moved"
    const gesture = kind === "overlap"
      ? "commit what is yours first, then push again"
      : "resolve it in a terminal — `git pull --rebase`, then Resume"
    return `${base}${named === "" ? "" : ` (${named})`} — ${gesture}. git said: ${said}`
  }
  const stopBy = (said: string | null): string | null =>
    settled.paused ?? (said !== null && mode() === "auto" ? said : null)

  let opened: Git.Repo | null = null
  const repository: Effect.Effect<Git.Opening> = Effect.suspend(() =>
    opened !== null
      ? Effect.succeed({ _tag: "Opened", repo: opened } as const)
      : Effect.map(Git.open(options.root), (opening) => {
        if (opening._tag === "Opened") opened = opening.repo
        return opening
      })
  )

  const survey: Effect.Effect<Survey> = Effect.gen(function*() {
    if (mode() === "off") {
      return { ...NOTHING_ASKED, repo: OFF } as const
    }
    const opening = yield* repository
    if (opening._tag !== "Opened") {
      return { ...NOTHING_ASKED, repo: opening } as const
    }
    const git = opening.repo
    const [repo, dirt, last] = yield* Effect.all(
      [git.state, git.dirty, git.last(AUDIT)],
      { concurrency: 3 },
    )

    if (dirt._tag === "Unusable") {
      yield* Effect.annotateLogs(
        Effect.logWarning("olai git: the working tree could not be surveyed"),
        { said: dirt.said },
      )
      return {
        ...NOTHING_ASKED,
        repo: { _tag: "Unusable", said: dirt.said },
        last: last === null ? null : recorded(last),
      } as const
    }

    const outlines: Array<Served> = []
    const others: Array<Git.Dirty> = []
    for (const entry of dirt.files) {
      if (entry.served !== null && options.ops.parserFor(entry.served) !== null) {
        outlines.push({
          file: entry.served,
          path: entry.path,
          at: entry.at,
          how: entry.how,
          from: entry.from,
        })
      } else {
        others.push(entry)
      }
    }

    return {
      git,
      repo,
      served: git.served,
      outlines,
      others,
      unpushed: dirt.upstream === null
        ? null
        : { upstream: dirt.upstream.name, commits: dirt.upstream.ahead },
      last: last === null ? null : recorded(last),
    }
  })

  const detail = (survey: Survey): Effect.Effect<Detail> =>
    Effect.gen(function*() {
      const git = survey.git
      if (git === null || survey.outlines.length === 0) {
        return { changes: [], unreadable: [] }
      }

      const at = yield* options.at

      const served: Pick<Derived, "byFile"> = at?.derived ?? { byFile: new Map() }
      const known = at === null ? NO_FILES : outlineNames(at.set)
      const broken = at === null ? NO_ERRORS : brokenBy(at.set)

      const unreadable = new Set<string>()
      const readable = survey.outlines.filter((one) => {
        if (at === null || broken.has(one.file)) {
          unreadable.add(one.file)
          return false
        }
        return true
      })

      const asks = readable.map(was)
      const copies = yield* committedSide.at(git, asks.map((one) => one.ask))

      const before = new Map<string, ReadonlyArray<Node>>()
      const after = new Map<string, ReadonlyArray<Node>>()
      readable.forEach((one, at) => {
        const asked = asks[at]
        const key = asked?.key ?? one.file
        const copy = asked === undefined ? undefined : copies.get(asked.ask)
        if (copy?._tag === "Unparsed") {
          if (options.ops.parserFor(key) !== null) unreadable.add(one.file)
          return
        }
        if (copy?._tag === "Nodes") before.set(key, copy.nodes)
        if (known.has(one.file)) {
          after.set(one.file, nodesOf(served, one.file).map((located) => located.node))
        }
      })

      return { changes: changesOf(at?.claims ?? claims([]), before, after), unreadable: [...unreadable] }
    })

  const status: Effect.Effect<Status> = Effect.gen(function*() {
    const looked = yield* survey
    if (looked.unpushed === null || looked.unpushed.commits === 0) {
      settled = { ...settled, pushSaid: null }
    }
    const git = gitOf(looked.repo, options.policy(), settled)
    if (looked.repo._tag === "Off") return { pending: NOTHING_PENDING, git }
    const { changes, unreadable } = yield* detail(looked)
    const others = looked.others.map(otherOf)
    return {
      pending: {
        repo: looked.repo,
        changes,
        outlines: looked.outlines.map(({ file, path, how, from }) => ({
          file,
          path,
          how,
          from: from?.path ?? null,
        })),
        others,
        unreadable,
        served: looked.served,
        unpushed: looked.unpushed,
        wrote: counted(),
        message: composed((yield* options.at)?.claims ?? claims([]), changes, others),
        last: looked.last,
      },
      git,
    }
  })

  const commit = (
    request: CommitRequest,
    writer: Writer,
  ): Effect.Effect<CommitResult> =>
    Effect.gen(function*() {
      if (holding > 0 && request.paths === undefined && writer === "chat-agent") {
        return {
          _tag: "Failed",
          said: "olai is tidying this directory's memory, so a commit that names no paths " +
            "would record work the pass does not own — the pass commits its own writes when " +
            "its turn ends, and a named commit is still yours",
          lock: null,
        } as const
      }

      const looked = yield* survey
      if (looked.repo._tag !== "Ready" || looked.git === null) {
        return { _tag: "Blocked", repo: looked.repo } as const
      }

      const picked = pick(looked, request.paths)
      if (picked.missing.length > 0) {
        return {
          _tag: "Failed",
          said: `nothing is waiting on ${picked.missing.join(", ")}, so nothing was ` +
            `committed — ask again with what \`pending\` lists`,
          lock: null,
        } as const
      }
      if (picked.outlines.length + picked.others.length === 0) {
        return { _tag: "NothingToCommit" } as const
      }

      const { changes } = yield* detail({ ...looked, outlines: picked.outlines })
      const others = picked.others.map(otherOf)
      const done = yield* looked.git.commit({
        paths: [...picked.outlines, ...picked.others].flatMap((one) =>
          one.from === null ? [one.at] : [one.from.at, one.at]
        ),
        message: signed(request.message ?? composed((yield* options.at)?.claims ?? claims([]), changes, others), writer),
      })
      if (done._tag === "Failed") {
        committed({ said: done.said, lock: done.lock })
        options.onSettled?.()
        return done
      }
      committed(null)

      if (request.paths === undefined) counts.clear()
      options.onSettled?.()
      if (options.policy().push === "auto") yield* push

      return {
        _tag: "Committed",
        sha: done.sha,
        changes: changes.length,
        others: others.length,
      } as const
    })

  const push: Effect.Effect<PushResult> = Effect.gen(function*() {
    if (mode() === "off") return { _tag: "Blocked", repo: OFF } as const
    const opening = yield* repository
    if (opening._tag !== "Opened") {
      return { _tag: "Blocked", repo: opening } as const
    }
    const git = opening.repo

    const repo = yield* git.state
    if (repo._tag !== "Ready") return { _tag: "Blocked", repo } as const

    const integratedPush: Effect.Effect<PushResult> = Effect.gen(function*() {
      const second = yield* git.dirty
      if (second._tag === "Unusable") {
        return { _tag: "Blocked", repo: { _tag: "Unusable", said: second.said } } as const
      }
      if (second.upstream !== null && second.upstream.ahead === 0) {
        return { _tag: "NothingToPush" } as const
      }
      const fetched = yield* git.fetch
      if (fetched._tag === "Refused") {
        pushed(fetched.said, "refused")
        options.onSettled?.()
        return { _tag: "Failed", said: fetched.said } as const
      }
      const standing = yield* git.standing

      let integrated = 0
      if (standing !== null && standing.behind > 0) {
        const done = yield* git.integrate(standing)
        if (done._tag === "Overlapped") {
          const said = charge("overlap", done.said, done.paths)
          pushed(said, "overlap")
          options.onSettled?.()
          return { _tag: "Failed", said } as const
        }
        if (done._tag === "Conflicted") {
          const said = charge("conflict", done.said, done.paths)
          pushed(said, "refused")
          options.onSettled?.()
          return { _tag: "Failed", said } as const
        }
        if (done._tag === "Refused") {
          pushed(done.said, "refused")
          options.onSettled?.()
          return { _tag: "Failed", said: done.said } as const
        }
        integrated = done.taken
      }

      const sending = yield* git.standing
      const sends = sending === null ? 0 : sending.ahead

      const outcome = yield* git.push
      if (outcome._tag === "Refused") {
        pushed(outcome.said, "refused")
        options.onSettled?.()
        return { _tag: "Failed", said: outcome.said } as const
      }

      pushed(null, "ok")
      options.onSettled?.()
      return {
        _tag: "Pushed",
        upstream: standing === null ? "" : standing.name,
        commits: sends,
        integrated,
      } as const
    })

    return yield* Semaphore.withPermit(pushPermit)(integratedPush).pipe(
      Effect.catchDefect((defect) =>
        Effect.annotateLogs(
          Effect.logError("olai git: the push could not run"),
          { cause: String(defect) },
        ).pipe(
          Effect.as({
            _tag: "Blocked",
            repo: { _tag: "Unusable", said: "the push could not run" },
          } as const),
        ),
      ),
    )
  })

  const whyWaiting = (writer: Writer): Effect.Effect<string> =>
    Effect.gen(function*() {
      if (mode() === "off") return whyOf("off", OFF, null, writer)

      const opening = yield* repository
      if (opening._tag !== "Opened") return whyOf(mode(), opening, null, writer)

      const repo = yield* opening.repo.state
      return whyOf(mode(), repo, settled.refusal?.said ?? null, writer)
    })

  const arming = Effect.runSync(SubscriptionRef.make(""))

  let looked: Pending = NOTHING_PENDING

  let holding = 0

  const observe = (pending: Pending): Effect.Effect<void> => {
    looked = pending
    return SubscriptionRef.set(arming, armedOn(mode(), settled.paused, holding > 0, pending))
  }

  const hold: Effect.Effect<void, never, Scope.Scope> = Effect.acquireRelease(
    Effect.gen(function*() {
      holding += 1
      yield* SubscriptionRef.set(arming, "")
    }),
    () =>
      Effect.gen(function*() {
        holding = Math.max(0, holding - 1)
        if (holding === 0) yield* observe(looked)
      }),
  )

  const record: Effect.Effect<void> = Effect.gen(function*() {
    if (armedOn(mode(), settled.paused, holding > 0, looked) === "") return
    yield* commit({}, "auto")
  })

  const loop: Effect.Effect<void> = Stream.runForEach(
    Stream.debounce(
      Stream.changes(SubscriptionRef.changes(arming)),
      options.quiet ?? Duration.millis(QUIET_MS),
    ),
    (flurry) =>
      flurry === "" ? Effect.void : Effect.catchCause(record, (cause) =>
        Effect.annotateLogs(
          Effect.logError("olai git: the auto-commit loop failed to record"),
          { cause: String(cause) },
        )),
  )

  const catchUp: Effect.Effect<void> = Effect.gen(function*() {
    if (options.policy().push !== "auto") return
    const looked = yield* survey
    if (looked.unpushed === null || looked.unpushed.commits === 0) return
    yield* push
  })

  const resume: Effect.Effect<void> = Effect.sync(() => {
    if (settled.paused === null) return
    settled = { ...settled, paused: null }
    options.onSettled?.()
  })

  const unlock: Effect.Effect<UnlockResult, OpFailure> = Effect.gen(function*() {
    const opening = yield* repository
    if (opening._tag !== "Opened") return { _tag: "Absent" } as const
    const answer = yield* Effect.mapError(
      opening.repo.unlock,
      (cause) => new BusyFailure({ reason: cause.message }),
    )
    if (answer._tag === "Held") {
      if (settled.refusal !== null) {
        settled = {
          ...settled,
          refusal: { ...settled.refusal, lock: { since: answer.since } },
        }
        options.onSettled?.()
      }
      return answer
    }
    settled = { ...settled, refusal: null, paused: null }
    options.onSettled?.()
    return answer
  })

  const repoState: Effect.Effect<RepoState> = Effect.gen(function*() {
    if (mode() === "off") return OFF
    const opening = yield* repository
    if (opening._tag !== "Opened") return opening
    return yield* opening.repo.state
  })

  return {
    status,
    pending: Effect.map(status, (both) => both.pending),
    waiting: Effect.map(status, (both) =>
      both.pending.outlines.map((one) => ({ file: one.file, path: one.path }))),
    commit,
    push,
    whyWaiting,
    wrote,
    observe,
    hold,
    loop,
    catchUp,
    resume,
    unlock,
    git: Effect.map(repoState, (repo) =>
      gitOf(repo, options.policy(), settled)),
  }
}

const otherOf = (entry: Git.Dirty): Other => ({
  path: entry.path,
  how: entry.how,
  from: entry.from?.path ?? null,
})

interface Was {
  readonly ask: string
  readonly key: string
}

const was = (one: Served): Was =>
  one.from === null
    ? { ask: one.path, key: one.file }
    : { ask: one.from.path, key: one.from.served ?? one.from.path }

interface Picked {
  readonly outlines: ReadonlyArray<Served>
  readonly others: ReadonlyArray<Git.Dirty>
  readonly missing: ReadonlyArray<string>
}

const pick = (
  looked: Survey,
  paths: ReadonlyArray<string> | undefined,
): Picked => {
  if (paths === undefined) {
    return { outlines: looked.outlines, others: looked.others, missing: [] }
  }
  const wanted = new Set(paths)
  const outlines = looked.outlines.filter((one) => wanted.has(one.path))
  const others = looked.others.filter((one) => wanted.has(one.path))
  const found = new Set([
    ...outlines.map((one) => one.path),
    ...others.map((one) => one.path),
  ])
  return { outlines, others, missing: paths.filter((path) => !found.has(path)) }
}

const recorded = (last: Git.Recorded): LastCommit => ({
  sha: last.sha,
  message: last.message,
  at: last.at,
  writer: WRITERS.has(last.trailer) ? (last.trailer as Writer) : null,
})

const WRITERS: ReadonlySet<string> = new Set<string>(Writer.literals)
