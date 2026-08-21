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
 * THE ORDER, applied — and the whole of what this module is.
 *
 * A `facesOf` stood beside it until `perf-faces-broken-walk`: same keys,
 * collecting one field off each entry, allocating a one-element array per file
 * to do it. That was a WALK over the directory rather than an order, and the
 * directory takes its own now (`./directory.ts`'s `walkOf`, one pass answering
 * both of its readings). Two things lived here because one of them called the
 * other, which is the accident of authoring order rather than a boundary.
 *
 * ONE CALLER, and that is not a reason to fold this into it. What is
 * encapsulated here is which order the client draws a directory in, and that
 * has changed under this signature once already — the paragraph above is the
 * record of it. A caller sees `sortByPath` either way.
 */
export const sortByPath = (paths: Iterable<string>): ReadonlyArray<string> =>
  [...paths].sort(byPath)
