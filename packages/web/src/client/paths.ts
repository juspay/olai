/**
 * The order a directory's files are drawn in.
 *
 * One rule, and it exists because the app now assembles the file list itself:
 * the outlines arrive as a keyed COLLECTION, whose key order is ARRIVAL order —
 * the snapshot's order on a fresh subscription, and appended after that — so an
 * outline created while the tab was open would sit at the bottom of the sidebar
 * until a reload. Order is a property of the paths, so it is applied here
 * rather than promised by the wire.
 *
 * WHICH order is not this module's to decide, and that changed with slice 4 of
 * `model-indices`. It used to be the client's own segment-by-segment compare,
 * documented as matching what a directory walk produces and true of that — but
 * the SET has an order too (`@olai/format`'s `assemble`), and the two answered
 * differently for exactly one pair of paths: a file and a directory sharing a
 * name, where a plain string compare puts `wing.olai` ahead of
 * `wing/kitchen.olai` and a walk that descends does not. That was harmless
 * while the client flattened its entries and re-derived in whatever order it
 * liked; it stopped being harmless when the client began PATCHING the format's
 * view, which places an arriving file by the set's order. So there is one
 * comparator now — `byPath`, in the format, spent by `assemble`, by the patcher
 * and here — and the walk's answer is the one it gives.
 */

import { byPath } from "@olai/format"

/**
 * THE FACES OF A KEYED COLLECTION, in the order its keys came — skipping a key
 * whose entry has not arrived yet.
 *
 * Its one caller is the DIRECTORY (`./directory.ts`, over the wire's `heads`),
 * and the absence it exists for is the frame between a key set and the entry
 * that fills it. It was two callers when the browser read a second collection
 * of faces; the sort that joined their two answers went with the second one
 * (`vault-in-browser`'s PR 10 — one collection, already in path order).
 */
export const facesOf = <T>(
  keys: ReadonlyArray<string>,
  entry: (key: string) => T | undefined,
): ReadonlyArray<T> =>
  keys.flatMap((key) => {
    const face = entry(key)
    return face === undefined ? [] : [face]
  })


export const sortByPath = (paths: Iterable<string>): ReadonlyArray<string> =>
  [...paths].sort(byPath)
