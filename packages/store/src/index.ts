/**
 * @olai/store — files on disk, loaded into a validated snapshot.
 *
 * Generic over content: the caller brings the codec, and this package holds no
 * knowledge of outlines. See {@link ./store.ts} for the design and for what
 * phases 3 and 4 add without changing this surface.
 */

export { type Codec, make, type Rev, type Store } from "./store.ts"
