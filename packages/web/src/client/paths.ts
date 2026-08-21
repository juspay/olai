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
 * THE ORDER, applied — the whole of what this module is.
 *
 * It had a `facesOf` beside it, which took the same keys and collected one
 * field off each entry. That was a walk over the directory, and the directory
 * now takes its own (`./directory.ts`'s `walkOf`, which answers both of its
 * readings in one pass and allocated a one-element array per file to answer
 * one). What is left here is the ORDER, which is what the header above argues
 * about and the one thing that was never the caller's to decide.
 */
export const sortByPath = (paths: Iterable<string>): ReadonlyArray<string> =>
  [...paths].sort(byPath)
