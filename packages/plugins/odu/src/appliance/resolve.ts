/**
 * WHERE A `worktree` VALUE ACTUALLY IS — the named gap, and the rule that
 * closes it.
 *
 * ## The gap, stated
 *
 * A node carries `worktree .worktrees/live-properties`. That
 * value is RELATIVE and it does not name its repository: the same six
 * characters are a directory under juspay/olai, under juspay/odu and under
 * juspay/kolu, and the board writes them the same way in all three. A socket
 * probe needs an absolute path. The human named this as the gap to design
 * (2026-08-29) and ruled that whatever is argued here is reviewable like the
 * rest of the diff, so the argument is written where the rule is.
 *
 * ## The rule, in four lines
 *
 *   1. **An absolute value is used as written.** No repo, no root, no
 *      arithmetic — a board that grows tired of the guessing can end it one
 *      value at a time, and this line is what makes that a real option rather
 *      than a suggestion.
 *   2. **A relative value is joined onto its node's CHECKOUT**, which is
 *      `<repos root>/<repo>`. The repo comes from the node's own `pr-url`
 *      (`https://github.com/juspay/odu/pull/94` → `odu`) — the human's own
 *      suggestion, and the right source for it: a PR URL is a VALUE somebody
 *      wrote on the node.
 *   3. **Where there is no PR URL, a repository the vault walk handed over
 *      is spent the same way.** That name is not invented here — inventing
 *      one from thin air is still the wrong door. The walk may supply it
 *      from where the row lives (`projects/<repo>/…`); a relative checkout
 *      in a file that is not under that prefix, with no PR URL, still
 *      resolves to nothing. Reading the file path as THE rule (replacing
 *      the URL) would be a fact about the vault's LAYOUT, and a rule that
 *      depends on layout breaks silently when somebody reorganises a
 *      directory. Spending it only in the window before a PR exists is the
 *      2026-09-02 close: four settles of a boarded checkout the watcher
 *      never placed, because this function refused to look.
 *   4. **The repos root is the served directory's own parent**, unless
 *      `$OLAI_REPOS_DIR` says otherwise. The board and the repositories it
 *      boards are checkouts side by side — `~/code/oss.olai` beside
 *      `~/code/odu` — and that adjacency is not a coincidence this rule is
 *      exploiting: it is the same premise the board's own relative values
 *      already rest on. A machine laid out otherwise says so once, in a
 *      variable, rather than by editing a hundred rows.
 *
 * A node with a relative `worktree`, no `pr-url`, and no repository handed
 * over resolves to NOTHING and is not probed. The two facts a node must
 * carry for a face are a path and which tree it is in; a name the walk did
 * not supply is not a fact, and inventing the second from thin air is
 * exactly the wrong door this repo's display rules refuse everywhere else.
 *
 * ## Why a wrong answer here is cheap, which is what makes the rule acceptable
 *
 * The resolution is not believed — it is PROBED. A path that resolves wrong
 * has no `.ci/odu.sock` under it, and a checkout with no live run is the
 * ordinary steady state of every checkout on the machine (`@odu/run-client`'s
 * README: absence is a state, not an error). So a mis-resolution costs a chip
 * that does not appear; it can never produce a chip that is WRONG, and it can
 * never produce an error. That asymmetry is the whole of why a derived path is
 * allowed to be a rule at all: the socket is the proof, and the arithmetic is
 * only a way of finding something to ask.
 *
 * Nothing in this module touches the filesystem. It says where to look, and
 * the dial finds out — `@olai/kolu-client`'s `socket.ts`, one appliance over,
 * keeps the same line for the same reason.
 */

import { isAbsolute, join, resolve as resolvePath } from "node:path"

/** The variable a machine whose checkouts do NOT sit beside its vault sets.
 *  Named once. */
export const REPOS_DIR = "OLAI_REPOS_DIR"

/** What a node must carry for this to answer: the path it wrote, and the URL
 *  that says which repository it is in. Both are strings off the record —
 *  `olai-plugin-odu`'s vault walk hands them over (`worktrees.ts`), so
 *  this module never learns what an outline node is. */
export interface Worktree {
  /** The `worktree` property's value, verbatim. */
  readonly value: string
  /** The `pr-url` property's value, or `undefined` for a node that has not
   *  opened one yet. A node may carry SEVERAL (a fact can be a list) and the
   *  walk hands over the first — every one of them names the same repository
   *  in the case that matters, and a node whose PRs are in two repositories
   *  has a `worktree` that can only be in one of them anyway. */
  readonly prUrl?: string
  /**
   * THE REPOSITORY THE VAULT WALK HANDED OVER, when it has one.
   *
   * A relative `worktree` does not name its tree, and a PR URL is the usual
   * source of that name ({@link repoIn}). A lane that runs CI before it opens
   * a PR has no URL yet — the 2026-09-02 silent doorbell, four settles of a
   * boarded checkout the watcher never placed. The walk may therefore hand a
   * repository of its own (from where the row lives); this is that name, and
   * inventing one HERE would still be the wrong door. Spent only when
   * {@link repoIn} answers nothing.
   */
  readonly repo?: string
}

/** Where checkouts live on this machine, decided once at the composition root
 *  and handed in — the env is a parameter rather than a read of `process.env`
 *  for `rendezvousIn`'s reason: the decision is a pure function with a test
 *  beside it, and the one real read happens where a process reaches for the
 *  real world. */
export const reposRootIn = (
  env: Record<string, string | undefined>,
  served: string,
): string => {
  const told = env[REPOS_DIR]
  // An empty variable is an unset one — a shell exporting `OLAI_REPOS_DIR=`
  // is saying it has nothing to tell us, and joining onto "" would resolve
  // every relative worktree against the process's cwd.
  if (told !== undefined && told !== "") return resolvePath(told)
  // The DIRECTORY the served vault sits in — `~/code` for a vault at
  // `~/code/oss.olai`. `resolve` first so a served path given relative (the
  // dev loop's `just serve docs`) is answered absolutely, and `..` after, so
  // the answer is a real parent rather than a path with a `..` in it that
  // every later `join` would carry.
  return resolvePath(served, "..")
}

/**
 * THE REPOSITORY a PR URL names, or `undefined` for a value that is not one.
 *
 * `https://github.com/juspay/odu/pull/94` → `odu`. Deliberately narrow: the
 * second path segment of a forge URL, and nothing clever. A value that is not
 * a URL, a URL with too few segments, a value carrying a URL inside a sentence
 * — all of them answer `undefined`, which is the same founding rule
 * `@olai/format`'s `meaning.ts` states about doors: the entire value has to BE
 * the name of the thing, because a wrong answer is worse than none.
 *
 * The HOST is not checked. GitHub is what the board uses today and a
 * self-hosted forge would have the same `<owner>/<repo>` shape; refusing one
 * because its hostname is unfamiliar would be this module having an opinion
 * about where a team keeps its code.
 */
export const repoIn = (prUrl: string | undefined): string | undefined => {
  if (prUrl === undefined) return undefined
  let url: URL
  try {
    url = new URL(prUrl.trim())
  } catch {
    return undefined
  }
  if (url.protocol !== "http:" && url.protocol !== "https:") return undefined
  // THE PARSER IS THE FIRST FENCE and it is worth naming, because the obvious
  // guard here would be dead code: `new URL` normalises `.` and `..` out of a
  // pathname before anybody can read it, so a value spelled
  // `…/juspay/../pull/1` never arrives here as a traversal — it arrives as a
  // different, harmless pair of segments. What actually stops a value steering
  // a join out of the repos root is {@link worktreeAt}'s containment check,
  // which is asked of the RESOLVED path and therefore covers both halves at
  // once rather than each of them approximately.
  const [owner, repo] = url.pathname.split("/").filter((part) => part !== "")
  return owner === undefined ? undefined : repo
}

/**
 * A REPOSITORY NAME, or `undefined` for a string that is not one.
 *
 * One path segment, nothing that climbs, nothing that is a path. The vault
 * walk may hand {@link Worktree.repo} over from a file prefix; this is the
 * fence that keeps a prefix of `..` or `olai/nested` from becoming a join.
 * {@link worktreeAt}'s containment check is the second fence, asked of the
 * resolved path, so a name that slipped through here still cannot leave the
 * repos root.
 */
const repoName = (name: string | undefined): string | undefined => {
  if (name === undefined) return undefined
  const trimmed = name.trim()
  if (
    trimmed === "" || trimmed === "." || trimmed === ".."
    || trimmed.includes("/") || trimmed.includes("\\")
  ) return undefined
  return trimmed
}

/**
 * The absolute checkout root a `worktree` value names, or `undefined` for one
 * this rule cannot place.
 *
 * `reposRoot` is {@link reposRootIn}'s answer, computed once per server rather
 * than per node per sweep.
 */
export const worktreeAt = (
  worktree: Worktree,
  reposRoot: string,
): string | undefined => {
  const written = worktree.value.trim()
  if (written === "") return undefined
  if (isAbsolute(written)) return resolvePath(written)
  const repo = repoIn(worktree.prUrl) ?? repoName(worktree.repo)
  if (repo === undefined) return undefined
  // `resolve` rather than a bare `join`, so a value carrying `..` cannot
  // climb out of the checkout it was written under — the same fence
  // `repoIn` keeps on the repository name, one segment further down.
  const at = resolvePath(join(reposRoot, repo), written)
  return at.startsWith(`${resolvePath(reposRoot)}/`) ? at : undefined
}
