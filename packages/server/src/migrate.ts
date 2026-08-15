/**
 * The one-time flip: every outline in the served directory, rewritten into the
 * shape the format now declares.
 *
 * A node's facts used to be fields of its record and are one `props` map now
 * (`@olai/format`'s `props.ts`). This is the step that moves a vault across,
 * and it runs BEFORE the store is opened — which is not a preference about
 * ordering but the only place it can go. The store's codec decodes with the
 * CURRENT schema, so an outline still in the old shape does not parse at all:
 * every file would arrive `broken`, the snapshot would be null, and a migration
 * that read the store would have nothing to read. It reads the disk instead,
 * and hands the store a directory that is already in one shape.
 *
 * EAGER AND ONCE. The alternative — accept both shapes for ever — is a format
 * with two spellings of every fact, and every rule downstream asking which one
 * it got. One sweep, and afterwards there is exactly one shape in the world.
 * A second start finds nothing to do, because `migrateOutline` answers
 * `unchanged` for a file already across and nothing is rewritten: idempotence
 * falls out of reading the files rather than out of a marker somebody has to
 * remember to write.
 *
 * IT DOES NOT COMMIT. The rewrite lands in the working tree and the vault's own
 * next commit carries it, which is the right shape for a change of this size:
 * one clean flip in the history, made by the person whose repository it is,
 * next to nothing else. A migration that committed on its own behalf would put
 * a commit nobody asked for in front of whatever they were in the middle of.
 *
 * ALL FILES OR NONE, the same bargain `Store.commit` strikes and for the same
 * reason: every rewrite is staged beside its destination first, and only then
 * are the renames done. A directory half in each shape is one no reader has a
 * rule for, and the window where a crash could leave one is the width of the
 * renames rather than of the whole sweep.
 */

import { fileKind, migrateOutline, serializeOutline } from "@olai/format"
import { Disk, type PlatformFailure } from "@olai/store"
import { Effect, FileSystem, Path } from "effect"

/** A file that was NOT migrated, and every reason a record in it stopped the
 *  sweep. It is left byte for byte as it was, so the next start meets the same
 *  file and says the same thing. */
export interface Left {
  readonly file: string
  readonly why: ReadonlyArray<{ readonly line: number; readonly why: string }>
}

export interface Migration {
  /** The outlines that were rewritten, in path order. Empty on every start
   *  after the first. */
  readonly migrated: ReadonlyArray<string>
  readonly left: ReadonlyArray<Left>
}

/**
 * Migrate every outline under `root`.
 *
 * WHAT IT CANNOT DO IT SAYS OUT LOUD. A file holding a record with two marks,
 * or one caught half-written by some other tool, is left alone and reported —
 * never guessed at, because there is no rule for choosing which of two marks to
 * throw away that is not a person's decision. Startup CONTINUES: a file that
 * did not migrate is a file that will not decode, which is exactly the case the
 * set already degrades gracefully around (one outline shows its errors, the
 * rest stay live). Refusing to boot would take the whole vault away over one
 * line somebody can fix in a second — and they can only fix it if olai is up to
 * show them where it is.
 *
 * The log is the surface here, and deliberately: this runs before there is a
 * browser to tell, and what the reader sees afterwards is the outline's own
 * error panel naming the same `file:line`. What the log adds is the sentence
 * the validator cannot say, because only this module still knows what the old
 * shape meant.
 */
export const migrateDirectory = (
  root: string,
): Effect.Effect<Migration, PlatformFailure, FileSystem.FileSystem | Path.Path> =>
  Effect.gen(function*() {
    const disk = yield* Disk.make(root)
    const listing = yield* disk.listing((path) => fileKind(path) === "outline")

    const staged: Array<{ readonly from: string; readonly to: string }> = []
    const left: Array<Left> = []

    for (const file of listing.keys()) {
      const contents = yield* disk.read(file)
      // Vanished between the listing and the read. The store is about to walk
      // the directory again for itself, and a file that is not there is not
      // this step's problem to report.
      if (contents === null) continue

      const result = migrateOutline(contents)
      if (result.kind === "unchanged") continue
      if (result.kind === "left") {
        left.push({ file, why: result.why })
        continue
      }
      staged.push({ from: yield* disk.stage(file, serializeOutline(result.records)), to: file })
    }

    // Every rename after every write, so a failure while staging costs nothing
    // but the temp files — which are dot-named and claimed by no codec, so even
    // the ones left behind by a crash are invisible to the set.
    for (const { from, to } of staged) yield* disk.publish(from, to)

    const migrated = staged.map(({ to }) => to)
    if (migrated.length > 0) {
      yield* Effect.logInfo(
        `properties: rewrote ${migrated.length} outline${
          migrated.length === 1 ? "" : "s"
        } into the props shape — commit when you are ready`,
      ).pipe(Effect.annotateLogs({ files: migrated.join(", ") }))
    }
    for (const one of left) {
      for (const { line, why } of one.why) {
        yield* Effect.logWarning(
          `properties: ${one.file}:${line} was left as it is — ${why}`,
        )
      }
    }

    return { migrated, left }
  })
