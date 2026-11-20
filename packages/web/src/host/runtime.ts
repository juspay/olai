import type { BrowserHalf } from "@olai/bundle"
import {
  type App,
  type Mounted,
  type RowReport,
  mountPlugin,
  openApp,
  standing,
} from "@olai/plugin-api"
import { Effect, Stream } from "effect"
import { createSignal } from "solid-js"

const [moved, setMoved] = createSignal(0)

let composing = 0
let missed = false

const told = (): void => {
  if (composing > 0) {
    missed = true
    return
  }
  setMoved((at) => at + 1)
  void refreshReports()
}

let clients: ((plugin: string) => unknown) | null = null

const run = standing()

const owners = new Map<string, string>()

export const app: App = await run(
  openApp({
    changed: told,
    ownerFor: (fiber) => owners.get(fiber) ?? fiber,
    reading: () => void moved(),
    clientFor: (plugin) => clients?.(plugin) ?? null,
  }),
)


const mounted = new Map<string, Mounted>()

const failures = new Map<string, Extract<RowReport, { readonly state: "failed" }>>()
let loadFailures: ReadonlyMap<string, string> = new Map()
let reloadRequired: ReadonlySet<string> = new Set()
export const browserRequiresReload = (name: string): boolean => {
  browserReports()
  return reloadRequired.has(name)
}
const [browserReports, setReports] = createSignal<ReadonlyMap<string, RowReport>>(new Map())
let reporting = 0
const refreshReports = async (): Promise<void> => {
  const generation = ++reporting
  const snapshot = await Promise.all([...mounted].map(async ([name, row]) => [name, await run(row.report)] as const))
  if (generation === reporting) setReports(new Map([
    ...snapshot,
    ...app.integrations().flatMap((entry, index): Array<readonly [string, RowReport]> => {
      if (entry.state === "active" || entry.state === "off") return []
      return [[`${entry.owner}/location-${index}`, entry.state === "failed"
        ? { state: "failed", fault: `${entry.name}: ${entry.fault}` }
        : { state: "waiting", missing: [entry.waitingFor ?? entry.name] }]]
    }),
    ...failures,
    ...[...loadFailures].map(([name, fault]) => [name, { state: "failed" as const, fault: `Module load failed: ${fault}` }] as const),
  ]))
}

await run(Effect.forkScoped(Stream.runForEach(app.changes, () =>
  Effect.promise(async () => { if (composing === 0) await refreshReports() }),
)))

export const composeTo = async (
  halves: ReadonlyArray<BrowserHalf>,
  clientFor: (plugin: string) => unknown,
  failedLoads: ReadonlyMap<string, string> = new Map(),
  reloads: ReadonlySet<string> = new Set(),
  restart: ReadonlySet<string> = new Set(),
): Promise<void> => {
  clients = clientFor
  loadFailures = failedLoads
  reloadRequired = reloads
  composing += 1
  try {
    await recompose(halves, restart)
    await run(app.settlePlugins([...mounted.keys()]))
    await run(app.retryIntegrations)
    await run(app.settled)
  } finally {
    composing -= 1
    await refreshReports()
    if (composing === 0 && missed) {
      missed = false
      setMoved((at) => at + 1)
    }
  }
}

const recompose = async (halves: ReadonlyArray<BrowserHalf>, restart: ReadonlySet<string>): Promise<void> => {
  const wanted = new Map(halves.flatMap((half) => [
    [half.default.name, { plugin: half.default, owner: half.default.name }] as const,
    ...Object.entries(half.components ?? {}).map(([local, component]) => {
      if (!/^[a-z][a-z0-9-]*$/.test(local)) throw new Error(`Invalid browser component name: ${local}`)
      const name = `${half.default.name}/${local}`
      return [name, { plugin: { ...component, name }, owner: half.default.name }] as const
    }),
  ]))
  for (const name of failures.keys()) if (!wanted.has(name)) {
    failures.delete(name)
    owners.delete(name)
  }
  // OUT FIRST, so a plugin that left has unwound its registrations before a
  // plugin that arrived can claim a key it was holding.
  for (const [name, plugin] of [...mounted]) {
    const owner = wanted.get(name)?.owner
    if (owner !== undefined && !restart.has(owner)) continue
    mounted.delete(name)
    await run(plugin.dispose)
    owners.delete(name)
  }
  for (const [name, { plugin: half, owner }] of wanted) {
    const existing = mounted.get(name)
    if (existing !== undefined) {
      const report = await run(existing.report)
      if (report.state !== "failed") continue
      await run(existing.dispose)
      mounted.delete(name)
      failures.set(name, report)
    }
    owners.set(name, owner)
    const plugin = await run(mountPlugin(app.host, half))
    mounted.set(name, plugin)
    failures.delete(name)
    const report = await run(plugin.report)
    if (report.state === "failed") {
      await run(plugin.dispose)
      mounted.delete(name)
      failures.set(name, report)
      console.error(
        `olai: the plugin "${name}" is running on the server, but its browser half failed to start — its faces are absent from this page`,
        report.fault,
      )
    }
  }
}

export { browserReports }

export const attachRenderer = (
  element: Element,
  rank?: (plugin: string) => number,
): Promise<void> => run(app.attach(element, rank))
