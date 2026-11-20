import { Effect } from "effect"
import { NO_DIRECTORY, type Ops } from "./ops.ts"

const refused = Effect.fail(NO_DIRECTORY)
const noGate: Ops = {
  parserFor: () => null,
  waiting: Effect.succeed([]),
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
  commit: () => Effect.succeed({ _tag: "Failed", said: NO_DIRECTORY.reason, lock: null }),
  push: Effect.succeed({ _tag: "Failed", said: NO_DIRECTORY.reason }),
  resume: Effect.void,
  hold: Effect.void,
}

export const liveOps = (offered: () => Ops | undefined): Ops => {
  const current = () => offered() ?? noGate
  return {
    parserFor: path => current().parserFor(path),
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
    waiting: Effect.suspend(() => current().waiting),
    resume: Effect.suspend(() => current().resume),
    hold: Effect.suspend(() => current().hold),
  }
}
