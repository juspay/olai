/**
 * What one of a node's edge fields NAMES, resolved for reading: the ids it
 * holds, each with the title to show for it.
 *
 * ONE reading, because two surfaces do it — the row of links a node draws
 * (`./EdgeRefs.tsx`) and the panel that writes them (`./EdgePanel.tsx`, which
 * lists what the node says now with an `×` on each) — and they had already
 * disagreed about the case where the indexes have not arrived: one kept the raw
 * ids, the other drew nothing. That is the shape of drift `./relation.ts` was
 * written to prevent one field over, so the resolution lives beside the words.
 *
 * NOTHING ABOUT A TARGET IS STORED ON THE SOURCE, which is why this is resolved
 * at view time at all: a retitle on the target is free, and a link cannot
 * disagree with the page it opens. The rule for what an id names is the
 * format's own (`nodeNamed`, which follows a mirror to the node standing at
 * it) — the same one blockedness resolves its own targets with. A set under the
 * stale banner can hold a dangling id the validator would refuse; the title
 * falls back to the id, so the page says what the file says rather than drawing
 * a blank.
 *
 * THE NAMES ARRIVE AS AN ACCESSOR and are read LAST, which is a reactivity
 * decision rather than a signature accident: a node carrying nothing on this
 * field — almost every node — must not subscribe to the page's whole reading,
 * or every row of a large outline re-runs on every frame the server publishes.
 * Called inside the caller's own memo, this reads the cheap field first and the
 * table only when there is something to look up.
 *
 * WHAT THE TABLE IS: the ids THIS PAGE points at, resolved where the set is and
 * sent with the page (`@olai/format`'s `page.ts`, and `../reading.tsx`). It was
 * a lookup in the tab's own copy of every record in the directory until PR 10
 * of `https://github.com/juspay/oss.olai/blob/master/olai/brainstorming/vault-in-browser.md`; the rule for what an id names is
 * the same one, `nodeNamed`, run on the side that holds the vault.
 *
 * A TARGET NAMED TWICE IS NAMED ONCE, and that is decided here, at the read,
 * because it is what the WRITE already says: `set_see` / `set_after` treat the
 * field as a SET — re-adding a target the node already names is a silent no-op
 * (`@olai/ops`'s `planEdges`) — so a file saying the same thing three times is
 * saying it once, and the surfaces reading it say it once (ruled 2026-08-16,
 * human). A `.olai` is plain text: nothing stops a hand or a merge from writing
 * the repeat, and the validator does not refuse it.
 *
 * That makes the KEY honest, which is the half that broke. Both readers draw a
 * link per target keyed by the target's id (`../NodeRefs.tsx`), and a key names
 * a row only while a target appears once: three rows under one key are one
 * element handed to the framework three times, and the next store frame's list
 * reconciliation dies mid-draw taking the page with it — PR #202's crash, at
 * the next list along. Keying by POSITION would close the crash and draw three
 * identical pills for ever, which is the client disagreeing with the writer
 * about what the file means.
 *
 * BY THE ID AS WRITTEN, not by the node it resolves to, for the same reason:
 * that is the identity the write layer's own set is over. Two DIFFERENT ids
 * standing at one node (a mirror named beside its target) are two things the
 * file says, they key apart, and collapsing them here would be this read
 * deciding something no writer has.
 */

import type { RegularNode } from "@olai/format"
import type { Accessor } from "solid-js"

import type { Names } from "../names.ts"
import type { NodeRef } from "../ref.ts"
import type { Relation } from "./relation.ts"

export const namedBy = (
  node: RegularNode,
  relation: Relation,
  names: Accessor<Names>,
): ReadonlyArray<NodeRef> => {
  const named = node[relation]
  if (named === undefined || named.length === 0) return []
  const table = names()
  // A `Set` keeps insertion order, so a repeat is dropped where the SECOND
  // one stands and the list still reads as the file wrote it.
  return [...new Set(named)].map((id) => {
    const found = table(id)
    return {
      id,
      title: found?.title ?? id,
      // from "" when dangling: the title is the id, not outline prose.
      from: found?.file ?? "",
    }
  })
}
