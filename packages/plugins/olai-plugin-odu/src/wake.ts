/**
 * WHAT THE STRIP'S DOORBELL CONTROL SAYS, in odu's own words — the same
 * contract `olai-plugin-kolu`'s `./wake.ts` fulfills, one appliance over, and
 * its header argues the whole shape: core owns the row, the picker, the
 * numeral and the clearing; the plugin owns every word, because the four ways
 * a wake could be described have nothing in common but that they are wakes.
 *
 * THE SUBJECT LEADS AND THE FILE DOES NOT: the file is the FILTER a person
 * swaps — which lanes' CI this conversation hears about — and "CI" is what
 * the doorbell IS. The counter is a count of held bodies, and each body is
 * `CI event`: the honest name for what one of them is ABOUT.
 *
 * The KINDS are the one member here a person never reads, and kolu's own
 * `./wake.test.ts` argues the whole of why the annotation is `NodeKind` and
 * not `FileKind`: a scope is a filter, and what odu filters BY is the
 * `odu-worktree` values on a file's un-done NODES ({@link ./doorbell.ts}), so
 * a file that holds no nodes claims nobody, for ever. `FileKind` would type-
 * check a `document` green and hand back the exact defect this member exists
 * to retire; `./wake.test.ts` holds the annotation hard, against the PRODUCTION
 * SLOT rather than a union restated in the test.
 *
 * The FAULTS are a sentence per WAY this doorbell can stop watching — `gone`
 * for the file that stops being served, `unwatchable` for the file that is
 * right there and holds nothing a claim can be read out of. They name no
 * file (core declines to punch a hole in a plugin's sentence; the strip draws
 * the path two inches away), and they deny the heartbeat reading outright:
 * "quiet and fine" and "watching nothing" must never be confusable, on any
 * channel. The odu half has NO heartbeat of its own — nothing drives one:
 * kolu's rides its watcher's own beat, and odu's sweep is a poll for
 * absences; the two silence floors a conversation has here are the fault
 * sentences and the picker's clear, and a third would say nothing.
 */

import type { NodeKind } from "@olai/format"

/**
 * THE KIND OF FILE AN ODU WAKE CAN BE POINTED AT — one, the outline.
 *
 * Typed against the record-holding union rather than spelled as a suffix:
 * a word the registry never had and a word the registry has for a file with
 * no nodes in it are BOTH the same class of error here, and `NodeKind` is
 * what turns both into type errors rather than into a picker that offers
 * wrong files on somebody else's machine. `olai-plugin-kolu`'s `./wake.ts`
 * argues both halves of that in full, and this list is one entry for the
 * same reason its neighbour's is: nothing in this package derives a claim
 * out of prose.
 */
const KINDS: readonly [NodeKind, ...Array<NodeKind>] = ["outline"]

/** odu's doorbell, as the strip says it. See the header for why the drawn half
 *  is three pieces and why the subject leads. */
export const wake = {
  /** What the wake is ON. */
  subject: "wake on CI runs",
  /** The lead-in to the file picker: the file is the FILTER, and this is the
   *  word that says so without saying "filter". */
  from: "runs from",
  /** What core is holding, in odu's own noun and in both numbers — core
   *  supplies the numeral and joins them. A `CI event` is what one held body
   *  is ABOUT: the run going red, or the run settling. */
  waiting: { one: "CI event waiting", many: "CI events waiting" },
  /** WHICH FILES THIS MAY BE POINTED AT — see the header. */
  kinds: KINDS,
  /**
   * ... and the sentences, one per way this doorbell can stop watching, keyed by
   * the cause's own word. Core INDEXES by the cause it recorded rather than
   * choosing between arms, so a third cause is a compile error here rather
   * than the wrong sentence there.
   */
  faults: {
    /**
     * THE FILE WENT. The same three parts kolu's carry — the first line a
     * glance can read, the attribution, the denial and the way out — because a
     * person may receive either doorbell's sentence and must not have to learn
     * two shapes of message.
     */
    gone: [
      "The file this conversation's CI wake was pointed at is no longer in the served directory — renamed, moved, or deleted.",
      "",
      "Written by olai's odu watcher, not by a person.",
      "",
      "No CI runs are being watched for this conversation any more. Nothing is claimed, nothing will be derived, and nothing is being held back — this is not a quiet board, it is a doorbell with no file behind it. Point the wake control at a file that exists and it starts again.",
    ].join("\n"),
    /**
     * ... and THE FILE IS THERE AND HAS NOTHING ODU CAN READ: it holds no
     * nodes, and the claimed set is the un-done NODES' `odu-worktree` values,
     * so nothing in it can ever claim a run. Reachable only from a pick made
     * before the picker filtered, a tab left open from an older serve, or a
     * record edited by hand — so it is nobody's mistake to be scolded for,
     * and the last clause says what to press.
     */
    unwatchable: [
      "The file this conversation's CI wake is pointed at is not an outline — it is served, and it holds no nodes, so nothing in it can claim a CI run.",
      "",
      "Written by olai's odu watcher, not by a person.",
      "",
      "No CI runs are being watched for this conversation. Nothing is claimed, nothing will be derived, and nothing is being held back — this is not a quiet board, it is a doorbell pointed at a file that can never carry a claim. Point the wake control at an outline and it starts.",
    ].join("\n"),
  },
}
