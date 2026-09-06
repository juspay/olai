/**
 * THE LEDGER ROW'S TWO AGENT VERBS — record what is waiting, send it on.
 *
 * They were entries in `@olai/ops`' one closed `TOOLS` table, which meant a
 * general package named this row's vocabulary and a serve without a ledger
 * still advertised `git_commit` and `git_push` to an agent that would be refused in
 * words by a door nobody stood behind. A tool leaves with the row that owns it
 * now (juspay/olai#546).
 *
 * THEY REACH THE LEDGER THROUGH THE `Acting` DOOR — `ops.commit` / `ops.push`,
 * the same door `@olai/ops` refuses in words when no ledger is mounted — and
 * NOT through this row's own surface: the adapter has no sibling segment for
 * `surface://` cells, and this row still puts nothing on the agent face
 * ({@link ./wire.ts}). So the two tools are this row's to declare and core's to
 * dispatch, which is the same split every other row's tools have.
 */

import { CommitRequest } from "@olai/format"
import { act, NoArgs, type Tool } from "@olai/ops"

export const tools: ReadonlyArray<Tool> = [
  act(
    "commit",
    "Commit what you changed",
    "Record what is waiting in the repository as one git commit — the audit trail of what this tool wrote. Writes land on disk immediately and WAIT for this; nothing commits on your behalf. Call it when a train of thought is finished, not after every edit, and give `message` saying what the work was (`reconcile the roadmap with the #70-#81 merges`) — an omitted one is composed from what changed, which can only describe the edits and not why you made them.\n\nIT SWEEPS THE WHOLE REPOSITORY, not only the outlines: every file that differs from HEAD, including a `.md` or a source file a person edited by hand, and including anything untracked that `.gitignore` does not cover. What is waiting is the pending set: `outlines` with their node-level changes, `others` as paths with a status each, and `served` saying which part of the repository olai serves. Give `paths` (repository-root-relative, as pending lists them) to commit only some of it; what you leave out stays waiting for a commit and a message of its own. A path nothing is waiting on is refused rather than quietly skipped. A row that says `renamed` names both halves in `from`, and it is ONE path to give — the commit carries the side it came from with it.\n\nIt never touches git's index, so anything staged by hand is left exactly as it was, and it refuses while the repository is mid-merge, mid-rebase or on a detached HEAD.",
    CommitRequest,
    (ops, args) => ops.commit(args),
  ),

  act(
    "push",
    "Push what is recorded",
    "Send the current branch to the upstream it already tracks. One verb and no arguments: no remote to pick, no refspec, never a force, and nothing that resolves a divergence — pending carries `unpushed` (the upstream's name and how many commits it is missing), and that is what this sends. Answers `NothingToPush` for a branch already in sync, and hands back git's own words verbatim when it refuses: authentication, a non-fast-forward, a branch with no upstream at all. Those are the terminal's business to resolve; report what git said rather than retrying.",
    NoArgs,
    (ops) => ops.push,
  ),
]
