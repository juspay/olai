/**
 * @olai/git — git, as plumbing, and nothing that decides anything.
 *
 * One socket ({@link open}) and one handle behind it, whose verbs are business
 * questions rather than the commands that answer them: what state the
 * repository is in, what has moved in it, which commit HEAD names and what THAT
 * commit had in a file, what was last recorded under a caller's own audit
 * filter, commit exactly these paths, push the current branch. Nothing here
 * says `rev-parse`, and nothing above says it either.
 *
 * It is a LEAF beside `@olai/child`: `effect`, `@olai/child` and `node:fs`.
 * The subprocess socket is the sibling's; this package's runner rides it, and
 * the index gate (#360) stays here — it is the caller's, not the socket's.
 * That is what the extraction bought — the file was already plumbing that
 * decided nothing, and the two olai-isms it still carried (a writer
 * vocabulary, and an audit convention) are handed in now.
 *
 * The `./state` subpath is the half of this package with no subprocess in it,
 * and it is a carve-out with a reason: {@link RepoState} travels the wire, so
 * `@olai/format` re-exports it and the BROWSER ends up importing it — and a
 * browser bundle must never reach `node:child_process`. Same shape as the
 * `./testlib` subpath one package over, for the same kind of reason.
 */

export {
  type Audit,
  type CommitInput,
  type Dirt,
  type Dirty,
  type Done,
  open,
  type Opening,
  type Recorded,
  type Repo,
  type Sent,
  type Shown,
  type Spelled,
  type Upstream,
} from "./git.ts"
export { How, Reason, RepoState } from "./state.ts"
