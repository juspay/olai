/** A transport's view of the current gate. This acquires nothing and keeps no
 * store, cache or write counter. Each invocation resolves the offered Ops;
 * the provider's scope owns the gate and its accepted writes. */
import { Effect } from "effect"
import { NO_DIRECTORY, type Ops } from "./ops.ts"

const refused = Effect.fail(NO_DIRECTORY)
const noGate: Ops = {
  read: refused,
  run: () => refused,
  outlines: refused,
  paths: refused,
  node: () => refused,
  subtree: () => refused,
  documents: refused,
  document: () => refused,
  search: () => refused,
  narrowing: () => refused,
  named: () => refused,
  homes: () => refused,
  page: () => refused,
  moving: () => refused,
  tags: () => refused,
  idle: Effect.void,
  commit: () => Effect.succeed({ _tag: "Failed", said: NO_DIRECTORY.reason }),
  push: Effect.succeed({ _tag: "Failed", said: NO_DIRECTORY.reason }),
  resume: Effect.void,
}

export const liveOps = (offered: () => Ops | undefined): Ops => {
  const current = () => offered() ?? noGate
  return {
    read: Effect.suspend(() => current().read),
    run: (...args) => Effect.suspend(() => current().run(...args)),
    outlines: Effect.suspend(() => current().outlines),
    paths: Effect.suspend(() => current().paths),
    node: (ask) => Effect.suspend(() => current().node(ask)),
    subtree: (ask) => Effect.suspend(() => current().subtree(ask)),
    documents: Effect.suspend(() => current().documents),
    document: (ask) => Effect.suspend(() => current().document(ask)),
    search: (ask) => Effect.suspend(() => current().search(ask)),
    narrowing: (ask) => Effect.suspend(() => current().narrowing(ask)),
    named: (ask) => Effect.suspend(() => current().named(ask)),
    homes: (ask) => Effect.suspend(() => current().homes(ask)),
    page: (ask) => Effect.suspend(() => current().page(ask)),
    moving: (ask) => Effect.suspend(() => current().moving(ask)),
    tags: (ask) => Effect.suspend(() => current().tags(ask)),
    idle: Effect.suspend(() => current().idle),
    commit: (...args) => Effect.suspend(() => current().commit(...args)),
    push: Effect.suspend(() => current().push),
    resume: Effect.suspend(() => current().resume),
  }
}
