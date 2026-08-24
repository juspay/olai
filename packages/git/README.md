# @olai/git — git, as plumbing

Nothing here decides anything. It shells out to `git`, and every answer is a value: a repository that cannot take a commit, a file that moved, a refusal with git's own words on it. What any of that MEANS — which dirty files matter, what a commit message says, who a writer is — belongs to [`@olai/ops`](../ops/README.md).

It was `ops/src/git.ts` until the commit UI grew to see the whole repository. Extracting it was the answer to "should we take a git library?": the handroll is 411 careful lines that already work, `simple-git` is a dependency plus an Effect adapter replacing them, `isomorphic-git` reimplements git and can diverge from the one on your PATH, and `dugite` bundles a binary. A package with **one dependency (`effect`) and no workspace sibling at all** is the anti-bloat answer.

## The socket

```ts
import * as Git from "@olai/git"

const opening = yield* Git.open("/home/you/notes/docs")
```

Three arms, and the third is the whole of #108:

| arm | what it means |
|---|---|
| `Opened` | a work tree, and a `Repo` handle for it |
| `NoRepo` | the directory is not a work tree — a statement about the DIRECTORY |
| `Unusable` | git ran and could not answer, with what it said — no binary on the PATH, dubious ownership, a repository git refuses to use |

Answering `null` for both of the last two is exactly the collapse that left a person staring at a write that was not committed with nowhere to read why. "Your notes are not a repository" and "this service has no git" are two different pieces of news.

## The handle

Six verbs, and they are business questions rather than the commands behind them — nothing here says `rev-parse`, and nothing above says it either:

| verb | answers |
|---|---|
| `state` | whether the repository can take a commit right now, and why not when it cannot |
| `dirty` | every file in the REPOSITORY git thinks has moved, and how far ahead of its upstream the branch is |
| `show(path)` | one file of the repository as HEAD has it (repo-root-relative, the way `dirty` names it), or `null` when HEAD does not |
| `last(audit)` | the newest commit matching a caller's own audit filter |
| `commit(what)` | commit exactly these paths with exactly this message |
| `push` | send the current branch to the upstream it already tracks |

Plus one property, `served`: where the served directory sits from the repository root (`""` at the root, `"docs/"` inside one). WHERE it sits — that, and the git directory — is asked once when the handle is opened and then belongs to the handle. Git speaks repo-relative paths and the callers speak served-root-relative ones, and a consumer that had to carry that around would be a consumer this volatility had leaked into.

### Three spellings of one dirty file

```ts
{ path: "docs/roadmap.olai",  // repo-root-relative: what a person is shown, and the commit key
  served: "roadmap.olai",     // served-root-relative, or null for a file outside the served tree
  at: "/home/you/notes/docs/roadmap.olai",   // absolute: what `commit` takes
  how: "modified",             // the porcelain XY letters, read
  from: null }                 // the same three spellings again, for a rename's other half
```

Three, because three different callers ask, and the arithmetic between them is precisely what this package exists to keep. `how` is `modified | added | deleted | renamed | untracked`, and it is **git's** word rather than the person's: an unstaged `mv a b` is a `deleted` and an `untracked`, because that is what `git status` sees until both halves are staged. `dirty` answers with the upstream beside the files (`{name, ahead}`, or `null` when the branch tracks nothing) — two answers from the one `git status --branch`, since "what is not recorded" and "what is not shared" are wanted together.

A survey git REFUSES comes back as `Unusable` with its words rather than as an empty tree: a repository nobody can read the status of is not a clean one, and saying so is the difference between a reader being told and a reader being reassured.

## What was stripped on the way down

Two olai-isms, and both are now handed in rather than known:

- **who wrote a commit.** `last` returns the trailer VERBATIM — `""` for a commit carrying none. Which strings are writers is a statement about olai, and the ops layer classifies.
- **the audit convention.** `last(audit)` takes the subject prefix and the trailer key, so this package is a git that can be pointed at any convention rather than one that knows about `olai:` and `X-Olai-Writer`.

## Two properties that are decisions

- **It cannot fail a write.** A commit runs after the bytes are already on disk and already on screen, so turning git's refusal into a failed op would be a lie about what happened. A missing binary, a non-zero exit, a timeout — every outcome comes back as an answer.
- **Only the files named**, on both `add` and `commit`. A served directory is a working tree with other work in it, and a commit that swept up a half-finished edit somebody had staged would be a far worse failure than not committing at all. The `add` names only the ones that are THERE: it exists so an untracked file is committable, and a path that has left the working tree has nothing for it to do. Handing it one anyway is what answered `fatal: pathspec '<old>' did not match any files` over somebody's own `git mv` — `git add` reads the working tree and the index and nowhere else, while `git commit -- <path>` records a departure straight out of HEAD.
- **A refusal leaves the index exactly as it found it.** The `add` a commit needs (an untracked file is not committable without one) writes the real index, so when the commit then refuses, the index file is put back — bit-identical, by a copy made before the staging and an atomic rename after. Otherwise a refused commit left the selection staged, and the next `git commit` in a terminal would record the files olai had just said it could not. The obvious alternative — never touch the index at all, by running under a temporary `GIT_INDEX_FILE` — is wrong: a file in HEAD and absent from the index reads as a staged DELETION, so the real index would show `D` against every file olai committed. Git's own `git commit -- <paths>` writes them back for that reason, and so does this.

Never `--amend` — an audit trail that can be edited after the fact is not one. Always `--no-verify` — a served directory's hooks belong to whatever project it is part of, and a linter refusing an outline write would leave the bytes on disk and the reason somewhere nobody is looking.

**Signing is deliberately NOT skipped** — there is no `--no-gpg-sign` here, and that is the same decision seen from the other side. A hook is the project's rule about the commits people type, and it can refuse this write for reasons that have nothing to do with it. A signature is the repository owner's statement about their own history, and an olai commit is a commit in it: where a key exists it is signed like every other one, and where none does, every commit in that repository fails the same way in a terminal too — with gpg's own words, carried back to the panel and to the agent's reply. Forcing the signature off would quietly write unsigned commits into a history whose owner asked for signed ones.

## Deliberate subtleties

| | why |
|---|---|
| `LC_ALL=C` | the "not a git repository" classification is a string match, and a translated git would be reported as unusable |
| `GIT_TERMINAL_PROMPT=0` | a repository that wants a credential fails instead of sitting on a prompt nobody can answer |
| a 10s budget | a wedged hook or a lock held by another process cannot hold a caller open forever |
| one git at a time per handle | `git status` refreshes the index and `git commit` writes it; two fibers doing both lose to `index.lock` |
| `--porcelain -z` | the plain form quotes anything unusual; `-z` does not, and a path may contain a newline |
| `-uall` | a brand-new outline is untracked, and is exactly what a first commit is for |
| no pathspec on `status` | the survey is the whole repository: serving `docs/` and being told nothing about a dirty root `README.md` is the bug this package's caller was filed for |
| `-c status.relativePaths=false` | porcelain paths are repo-relative here whatever the reader's config says, because the prefix arithmetic depends on it |
| markers before the branch | a rebase also detaches HEAD, and "detached" is the less useful half of that truth |
| `git push` with no arguments | the current branch to the upstream it has; a remote or a refspec is a choice somebody has to make, and `--force` is never one of them |

## Two subpaths, neither of them product

`./state` is `RepoState` and `Reason` — the vocabulary with no subprocess in it. It exists because those values travel the wire: `@olai/format` re-exports them for its pending schema, the browser imports that schema, and a browser bundle must never reach `node:child_process`.

`./testlib` is `repoAt` — a real repository in the states a commit path has to tell apart, published so the packages above build their fixtures the same way. Real git rather than a fake, because what those tests are about is what git does; a fake would only reproduce what we already believe. Identity is pinned on the spawn (`GIT_AUTHOR_NAME` and friends, never empty) as well as in the repository-local config: env beats config, and an empty `GIT_AUTHOR_NAME` is empty, not unset.
