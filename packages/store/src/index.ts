/**
 * @olai/store — files on disk, kept as a validated snapshot.
 *
 * Generic over content: the caller brings the codec, and this package holds no
 * knowledge of outlines. See {@link ./store.ts} for the sync loop and for what
 * the write gate adds without changing this surface.
 */

export type { Codec } from "./codec.ts"
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
