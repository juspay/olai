/**
 * @olai/store — files on disk, kept as a validated snapshot.
 *
 * Generic over content: the caller brings the codec, and this package holds no
 * knowledge of outlines. See {@link ./store.ts} for the sync loop and for what
 * the write gate adds without changing this surface.
 */

export type { Codec } from "./codec.ts"
/**
 * The directory itself, under the store rather than inside it.
 *
 * Exported for ONE caller and worth naming: a step that has to rewrite every
 * served file BEFORE a store can be opened over them — `@olai/server`'s boot
 * migration, whose whole problem is that the files do not yet decode. It needs
 * exactly what the probe needs (the pruned walk, root-relative paths, stage and
 * rename) and it must need it in the same words, because a second walk would be
 * a second answer to which files this directory serves — one of them run at
 * boot, over the very files the other is about to judge.
 */
export * as Disk from "./disk.ts"
export { PlatformFailure, ROOT_ITSELF, StaleWrite } from "./errors.ts"
export {
  type Change,
  make,
  type Options,
  type Rev,
  type Snapshot,
  type Store,
  type Write,
} from "./store.ts"
