/**
 * `process.off(<signal>, …)` — restored, because bun-types takes it away.
 *
 * `@types/node`'s `NodeJS.Process` declares the signal overload for `on`,
 * `once`, `addListener`, `removeListener`, `prependListener` and `emit` — and
 * NOT for `off`, which a process inherits from `EventEmitter` as the generic
 * `off<K>(eventName: Key<K, T>, …)`. bun-types then MERGES its own
 * `off(event: "memoryPressure", …)` onto that same interface
 * (`bun-types/overrides.d.ts:112`), and a merged declaration's overloads are
 * tried FIRST — so in a tree with `types: ["bun"]` the only `off` a caller
 * reaches is the memory-pressure one, and
 *
 *     for (const sig of ["SIGTERM", "SIGINT"] as const) process.off(sig, h)
 *
 * fails with TS2345, `not assignable to parameter of type "memoryPressure"`.
 * The same call spelled `process.on` compiles, because node declared that arm.
 *
 * It is a TYPES defect and not a runtime one: Bun's `process.off("SIGTERM", h)`
 * does exactly what node's does. So this states the true signature rather than
 * widening anything — one arm, matching node's own spelling for the six
 * siblings that have it.
 *
 * This is the SECOND time this tree has hit the shape (`package.json`'s
 * `//overrides` note is the first: "a call to `.on` does not typecheck"), and
 * that pin — `@types/node` at 22 — does not reach this one, because the
 * collision here is a merge that WINS rather than a version that nests.
 *
 * Why it is needed at all, given no olai source calls `process.off`: olai
 * consumes kolu as raw TypeScript, so `tsc` compiles every hydrated module the
 * import graph reaches. `@kolu/padi-client/dial` reaches
 * `@kolu/surface-daemon`'s barrel, which value-re-exports `daemonMain.ts`,
 * whose teardown unregisters its signal handlers (`daemonMain.ts:521`).
 * juspay/kolu#2216's guard records that barrel as the known cost of
 * `connectPadi`; closing it upstream needs leaf entries on both daemon
 * packages and is drishti-gated. Until then this file is what lets a consumer
 * compile what the barrel hands it.
 */

declare global {
  namespace NodeJS {
    interface Process {
      off(event: Signals, listener: SignalsListener): this
    }
  }
}

export {}
