/**
 * Cordis exports `FiberState` as a `const enum`. olai typechecks with
 * `isolatedModules`, which cannot consume a const enum from another package
 * as a value. The numbers are the upstream order, pinned here so a spike
 * test can name FAILED without the compiler inlining a phantom.
 */
export const FiberState = {
  PENDING: 0,
  LOADING: 1,
  ACTIVE: 2,
  FAILED: 3,
  DISPOSED: 4,
  UNLOADING: 5,
} as const
