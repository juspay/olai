/**
 * THE VAULT HALF of board-driven CI discovery — which nodes name a worktree,
 * and whether the vault has TYPED that key as a path at all.
 *
 * HERE rather than in `@olai/odu-client` because it is a reading of the SET
 * and nothing to do with odu: it would be exactly this function if the runs
 * came from somewhere else entirely. Keeping it on this side is what lets that
 * package name no olai package at all — a walk over `Located` there would have
 * put the vault's format in "how olai reaches odu", which is two subjects in
 * one manifest. It is `./claimants.ts`'s arrangement, one property over, and
 * deliberately the same shape.
 *
 * ## Why it is not called `lanes.ts`, which it was
 *
 * Because a LANE is not olai's word. It is the orchestrator's board's — a
 * dispatched piece of work, with an agent on it and a PR at the end — and that
 * is process vocabulary belonging to one vault that happens to be this app's
 * heaviest user (the human's review of #433). olai's own vocabulary has nodes,
 * properties and declared types, and no opinion about why somebody wrote a
 * fact down.
 *
 * What this module actually asks is a question in that vocabulary and reads
 * the same either way: WHICH NODES CARRY A `worktree`, in a vault that has
 * declared that key a `path`. A directory of recipes with a `worktree` on one
 * of them gets the same probe and the same chip, and nothing in the code has
 * to be re-read as a metaphor for it.
 *
 * ## THE DECLARATION LICENCES THE PROBE
 *
 * This is where typed properties do work in the live-properties seam, and it
 * is worth stating plainly because it is not where a reader would first look
 * for it. A `worktree` value is a decision-shaped name; what turns it into a
 * path olai will join `.ci/odu.sock` onto is the vault's own declaration —
 * `{"title":"worktree","custom":{"type":"path"}}`. A vault that declares the
 * key something else, or a vault that declares nothing at all, gets NO PROBE:
 * the promise that this key's values are paths is the vault's to make
 * (`@olai/format`'s `typing.ts` — a `path` is fenced against whitespace and
 * against the commentary a bare `text` key invites), and a face that assumed
 * it would be guessing at exactly the fact typing exists to fence.
 *
 * That the SELECTION of a face is by key while the LICENCE is by declared type
 * is the seam's own division and is argued where the table is
 * (`@olai/web`'s `props/live.ts`): declarations do not travel to a browser
 * (juspay/olai#395), so the tab cannot key on one — but the server holds them,
 * and this is the one question that has to be asked where they are.
 *
 * An UNDECLARED key is not probed either, and that is the sharper half of the
 * same rule rather than an inconsistency with the terminal door beside it. The
 * door reads a value and looks it up in a fleet somebody else is keeping — a
 * wrong value finds nothing and the block says so in words. This walk hands a
 * path to a socket dial in a directory nobody asked about, so the bar is
 * higher: somebody has to have said, in the vault, that this key holds paths.
 *
 * What crosses is four strings per node (`@olai/odu-client`'s
 * `WorktreeNode`). The probe is odu's, the walk is olai's, and that shape is
 * the only place they meet.
 */

import {
  customText,
  declarationsOf,
  declaredFor,
  type Derived,
  isRegular,
} from "@olai/format"
import type { WorktreeNode } from "@olai/odu-client"
import { PR_URL_KEY, WORKTREE_KEY } from "@olai/surface"

/**
 * Every node carrying a `worktree` property, in a vault that declares that key
 * a `path`.
 *
 * IT TAKES THE WHOLE DERIVATION rather than the node list `claimantsIn` takes,
 * and the one extra thing it reads is the reason: what the vault DECLARES is a
 * fact about the set, answered once per revision off a memo the validator has
 * already paid for (`declarationsOf` is a `WeakMap` on the derivation). Handing
 * the nodes alone would have meant either a second walk of the declarations
 * file here or a `boolean` computed by the caller — one wasteful, the other a
 * question asked in a place that cannot see why.
 *
 * A GENERATOR, for `claimantsIn`'s reason: a revision that names no worktree —
 * which is almost every revision in almost every vault — allocates nothing,
 * because the caller walks this once and keeps only what it found. And the
 * declaration is asked BEFORE the loop, so a vault that types nothing pays one
 * map lookup per revision and not one per record.
 *
 * MIRRORS ARE SKIPPED. A mirror carries no properties of its own; it is a
 * second placement of the node that does, so asking it would be asking the
 * wrong record — and its target is in this same walk. Two rows probing one
 * checkout would also be two dials of one socket, which is the thing the
 * watcher's first-writer-wins rule then has to clean up.
 *
 * `pr-url` rides along UNCHECKED against its own declaration, and that is an
 * asymmetry rather than an oversight: the `worktree` value is what becomes a
 * path, and the PR URL only ever narrows where that path is looked for. A
 * value that is not a URL resolves to no repository and the node is dropped
 * (`@olai/odu-client`'s `repoIn`), which is the same outcome a wrong
 * declaration would have bought, reached without a second gate.
 */
export function* worktreesIn(derived: Derived): Generator<WorktreeNode> {
  if (declaredFor(declarationsOf(derived), WORKTREE_KEY)?.type.kind !== "path") return
  for (const located of derived.nodes) {
    if (!isRegular(located)) continue
    const value = customText(located.node, WORKTREE_KEY)
    if (value === undefined) continue
    yield {
      node: located.node.id,
      title: located.node.title,
      value,
      prUrl: customText(located.node, PR_URL_KEY),
    }
  }
}
