# @olai/git — git, as plumbing

Nothing here decides anything. It shells out to `git`, and every answer is a
value: a repository that cannot take a commit, a file that moved, a refusal with
git's own words on it. What any of that MEANS — which dirty files matter, what a
commit message says, who a writer is — belongs to
[`@olai/ops`](../ops/README.md).

It was `ops/src/git.ts` until the commit UI grew to see the whole repository.
Extracting it was the answer to "should we take a git library?": the handroll is
411 careful lines that already work, `simple-git` is a dependency plus an Effect
adapter replacing them, `isomorphic-git` reimplements git and can diverge from
the one on your PATH, and `dugite` bundles a binary. A package with **one
dependency (`effect`) and no workspace sibling at all** is the anti-bloat answer.

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

Answering `null` for both of the last two is exactly the collapse that left a
person staring at `committed: false` with nowhere to read why. "Your notes are
not a repository" and "this service has no git" are two different pieces of
news.

## The handle

Five verbs, and they are business questions rather than the commands behind
them — nothing here says `rev-parse`, and nothing above says it either:

| verb | answers |
|---|---|
| `state` | whether the repository can take a commit right now, and why not when it cannot |
| `dirty` | every served file git thinks has moved |
| `show(file)` | one served file as HEAD has it, or `null` when HEAD does not |
| `last(audit)` | the newest commit matching a caller's own audit filter |
| `commit(what)` | commit exactly these paths with exactly this message |

WHERE the served directory sits — the git directory, and what the root is called
from the repository root — is asked once, when the handle is opened, and then
belongs to the handle. Git speaks repo-relative paths and the callers speak
served-root-relative ones, and a consumer that had to carry that around would be
a consumer this volatility had leaked into.

## What was stripped on the way down

Two olai-isms, and both are now handed in rather than known:

- **who wrote a commit.** `last` returns the trailer VERBATIM — `""` for a
  commit carrying none. Which strings are writers is a statement about olai, and
  the ops layer classifies.
- **the audit convention.** `last(audit)` takes the subject prefix and the
  trailer key, so this package is a git that can be pointed at any convention
  rather than one that knows about `olai:` and `X-Olai-Writer`.

## Two properties that are decisions

- **It cannot fail a write.** A commit runs after the bytes are already on disk
  and already on screen, so turning git's refusal into a failed op would be a lie
  about what happened. A missing binary, a non-zero exit, a timeout — every
  outcome comes back as an answer.
- **Only the files named**, on both `add` and `commit`. A served directory is a
  working tree with other work in it, and this **never touches the index**: a
  commit that swept up a half-finished edit somebody had staged would be a far
  worse failure than not committing at all.

Never `--amend` — an audit trail that can be edited after the fact is not one.
Always `--no-verify` — a served directory's hooks belong to whatever project it
is part of, and a linter refusing an outline write would leave the bytes on disk
and the reason somewhere nobody is looking.

## Deliberate subtleties

| | why |
|---|---|
| `LC_ALL=C` | the "not a git repository" classification is a string match, and a translated git would be reported as unusable |
| `GIT_TERMINAL_PROMPT=0` | a repository that wants a credential fails instead of sitting on a prompt nobody can answer |
| a 10s budget | a wedged hook or a lock held by another process cannot hold a caller open forever |
| `--porcelain -z` | the plain form quotes anything unusual; `-z` does not, and a path may contain a newline |
| `-uall` | a brand-new outline is untracked, and is exactly what a first commit is for |
| markers before the branch | a rebase also detaches HEAD, and "detached" is the less useful half of that truth |

## Two subpaths, neither of them product

`./state` is `RepoState` and `Reason` — the vocabulary with no subprocess in it.
It exists because those values travel the wire: `@olai/format` re-exports them
for its pending schema, the browser imports that schema, and a browser bundle
must never reach `node:child_process`.

`./testlib` is `repoAt` — a real repository in the states a commit path has to
tell apart, published so the packages above build their fixtures the same way.
Real git rather than a fake, because what those tests are about is what git
does; a fake would only reproduce what we already believe.
