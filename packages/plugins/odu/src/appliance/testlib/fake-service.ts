#!/usr/bin/env bun

import { readFileSync, watchFile } from "node:fs"
import { Effect, Stream } from "effect"
import { implementSurface, inMemoryStore } from "@kolu/surface/server"
import { serveSurfaceApp } from "@kolu/surface-app/serve"
import {
  CI_CONTRACT_VERSION,
  CI_ROW,
  HOST_CONTRACT_VERSION,
  oduServiceSurface,
  UNKNOWN_SERVICE,
  type NodesFrame,
  type RunRow,
  type ServiceCell,
} from "@odu/service-client/surface"

const port = Number(process.argv[2])
const fixturePath = process.argv[3]
if (!Number.isFinite(port) || fixturePath === undefined) {
  console.error("fake-service: usage: fake-service.ts <port> <fixture.json>")
  process.exit(2)
}

interface Fixture {
  readonly rows?: Record<string, string>
  readonly runs?: Record<string, { readonly row: RunRow; readonly frame?: NodesFrame }>
}

const load = (): Fixture => JSON.parse(readFileSync(fixturePath, "utf8")) as Fixture

let fixture = load()

const serviceOf = (): ServiceCell => ({
  ...UNKNOWN_SERVICE,
  identity: {
    ...UNKNOWN_SERVICE.identity,
    pid: process.pid,
    origin: `http://127.0.0.1:${port}`,
    protocolVersion: HOST_CONTRACT_VERSION,
    storageVersion: 1,
    rows: { [CI_ROW]: CI_CONTRACT_VERSION, ...fixture.rows },
  },
  readiness: { state: "ready", since: Date.now(), reconciled: 0 },
})

const serviceStore = inMemoryStore<ServiceCell>(serviceOf())

const runs = new Map<string, RunRow>()
const frames = new Map<string, NodesFrame>()

const applyFixture = (next: Fixture): void => {
  fixture = next
  serviceStore.set(serviceOf())
  runs.clear()
  frames.clear()
  for (const [id, one] of Object.entries(next.runs ?? {})) {
    runs.set(id, one.row)
    if (one.frame !== undefined) frames.set(id, one.frame)
  }
}
applyFixture(fixture)

const spec = oduServiceSurface.spec as {
  cells?: Record<string, { default: unknown }>
  collections?: Record<string, unknown>
  streams?: Record<string, unknown>
  procedures?: Record<string, Record<string, unknown>>
}

const floor = <T,>(keys: Iterable<string>, one: (key: string) => T): Record<string, T> =>
  Object.fromEntries([...keys].map((key) => [key, one(key)]))

const refuse = () => Effect.fail(new Error("fake-service: this verb is not offered"))

const implemented = implementSurface(oduServiceSurface, {
  cells: {
    ...floor(Object.keys(spec.cells ?? {}), (key) => ({
      store: inMemoryStore(spec.cells?.[key]?.default),
    })),
    service: { store: serviceStore },
  },
  collections: {
    ...floor(Object.keys(spec.collections ?? {}), () => ({
      readAll: () => new Map(),
      upsert: () => {},
      remove: () => {},
    })),
    runs: {
      readAll: () => runs,
      upsert: () => {},
      remove: () => {},
    },
  },
  streams: {
    ...floor(Object.keys(spec.streams ?? {}), () => ({
      source: () => Stream.never,
    })),
    nodes: {
      source: (input: { readonly runId: string }) => {
        const frame = frames.get(input.runId)
        return frame === undefined ? Stream.empty : Stream.make(frame)
      },
    },
  },
  procedures: floor(Object.keys(spec.procedures ?? {}), (ns) =>
    floor(Object.keys(spec.procedures?.[ns] ?? {}), () => refuse),
  ),
} as never)

watchFile(fixturePath, { interval: 200 }, () => {
  try {
    applyFixture(load())
  } catch (error) {
    console.error(`fake-service: could not reload ${fixturePath}: ${String(error)}`)
  }
})

await Effect.runPromise(
  Effect.scoped(Effect.gen(function*() {
    const origin = yield* serveSurfaceApp({
      host: "127.0.0.1",
      port,
      allowedOrigins: [],
      group: oduServiceSurface.group,
      handlers: implemented.handlers,
    })
    process.stdout.write(`listening ${origin}\n`)
    yield* Effect.never
  })),
)
