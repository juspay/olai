/**
 * The stamp table's blind spot, on demand — what a test writes when it needs a
 * change this store's loop is ENTITLED not to see.
 *
 * A stamp is mtime+size ({@link ./disk.ts}'s trade), so the one change the
 * probe cannot notice is a same-length rewrite with the timestamp put back:
 * exactly what `git rebase` and `git checkout` leave behind, and the shape
 * every drift test in this repository is about
 * (`stale-set-reads-clean-writes-refuse`).
 *
 * HERE, AND PUBLISHED, for the reason `@olai/format`'s own `./testlib` is: the
 * alternative is each package above growing a byte-identical copy of the same
 * diagnostic, and this one carries an INVARIANT rather than a convenience. A
 * "same-length" constant that is one byte out is visible to the ordinary loop,
 * which turns a drift test into a probe test that passes for the wrong reason
 * — and that is not hypothetical: it was already true of one test in this tree
 * for as long as the check was made by eye. The throw below is what stops the
 * whole class, and a second copy of it is a second place for it to be softened.
 *
 * The volatility it encapsulates is this package's own: what a stamp is made
 * of, and therefore what can hide inside one. A caller above states the file
 * and the bytes and never has to know either.
 */

import * as fs from "node:fs"
import * as path from "node:path"

/**
 * Put `file` down the way a git operation leaves it: different bytes at the
 * same length, with the timestamp restored — so no listing, no stat and no
 * probe this store runs can tell it moved.
 *
 * THROWS on a replacement it cannot actually hide, because a helper that
 * quietly failed to do the one thing it is named for would leave a suite full
 * of tests asserting the wrong mechanism.
 */
export const replaceBehindTheStamps = (
  root: string,
  file: string,
  contents: string,
): void => {
  const at = path.join(root, file)
  const stamp = fs.statSync(at)
  if (stamp.size !== Buffer.byteLength(contents)) {
    throw new Error(
      `${file}: a replacement of ${Buffer.byteLength(contents)} bytes over ` +
        `${stamp.size} is visible to the stamps — this helper only hides ` +
        `same-length ones`,
    )
  }
  fs.writeFileSync(at, contents)
  fs.utimesSync(at, stamp.atime, stamp.mtime)
}
