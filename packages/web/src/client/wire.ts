import { supplyManagement } from "../host/management.ts"
import { connectSocket } from "./connection/socket.ts"
import { restartRows, signatureOf, type Named } from "./connection/signature.ts"
import { bootstrapSelected } from "../host/bootstrap.ts"
import { loadRows, retryableModule } from "../host/loading.ts"
import type { bootStatus } from "../host/boot-status.ts"
import { BROWSER_BOOT_PATH, BROWSER_MODULES_ID } from "@olai/plugin-api/mount"
import { connectSurfaces } from "@kolu/surface-app/solid"
import type { Surface, SurfaceSpec } from "@kolu/surface/define"
import type { BrowserHalf, BrowserRow } from "@olai/bundle"
import { surface } from "@olai/surface"
import { createEffect, createRoot, createSignal } from "solid-js"

import { browserReports, browserRequiresReload, composeTo } from "../host/runtime.ts"

const CORE = "olai"

const live = await connectSurfaces({
  connect: connectSocket,
  core: { surface, name: CORE },
  surfaces: {} as Record<string, Surface<SurfaceSpec>>,
  retired: () =>
    console.warn(
      "olai: the server retired this tab — it was replaced by a newer process, so this page will not update again until it is reloaded",
    ),
})

let composedRows: ReadonlyArray<Named> | undefined

const [rosterChanges, setRosterChanges] = createSignal(0)
export const rosterChanging = (): boolean => rosterChanges() > 0

const rerost = async (want: ReadonlyArray<Named>): Promise<void> => {
  const signature = signatureOf(want)
  setRosterChanges((count) => count + 1)
  const mine = inFlight.then(() => rerostNow(want, signature), () => rerostNow(want, signature))
  inFlight = mine.then(() => {}, () => {})
  try {
    await mine
  } finally {
    setRosterChanges((count) => count - 1)
  }
}

let rows: ReadonlyArray<BrowserRow> = []

export const useBrowserRows = (built: ReadonlyArray<BrowserRow>): void => {
  const raw = document.getElementById(BROWSER_MODULES_ID)?.textContent
  const urls: Record<string, string> = raw ? JSON.parse(raw) : {}
  rows = built.map((row) => ({ ...row, load: retryableModule(row.load, () => urls[row.id], importModule) }))
}

let receivedRoster = false
let boot: ReturnType<typeof bootStatus> | undefined
let selectedRows: ReadonlyArray<Named> = []
export const useBootStatus = (status: ReturnType<typeof bootStatus>): void => { boot = status }
export const retryBrowser = async (): Promise<void> => {
  composedRows = undefined
  if (!receivedRoster) return bootstrapBrowser()
  await rerost(selectedRows)
}
export const bootstrapBrowser = async (): Promise<void> => {
  try {
    await bootstrapSelected({
      authoritative: () => receivedRoster,
      request: () => fetch(BROWSER_BOOT_PATH, { cache: "no-store", signal: AbortSignal.timeout(5000) }),
      apply: (selected) => rerost(selected.map((id) => ({ id, chunk: null }))),
    })
  } catch (error) {
    if (receivedRoster) return
    console.warn("olai: browser bootstrap could not be read", error)
    boot?.failed(`olai couldn't start in this tab. Check the connection and try again. (${String(error)})`, retryBrowser)
  }
}

let inFlight: Promise<void> = Promise.resolve()

const SOCKET_REFRESH_DEADLINE_MS = 30_000

const rerostNow = async (want: ReadonlyArray<Named>, signature: string): Promise<void> => {
  if (composedRows !== undefined && signature === signatureOf(composedRows)) return
  try {
    const { loaded: halves, failed, reloadRequired } = await loadRows(
      want.flatMap((one) => {
        if (one.chunk !== null) return [{ id: one.id, load: () => chunkAt(one.chunk!) }]
        const row = rows.find((each) => each.id === one.id)
        return row === undefined ? [] : [row]
      }),
    )
    const established = live.connectionEpoch()
    await live.redial(surfaceMapOf(halves))
    if (live.connectionEpoch() === established && live.link.wire.status() === "open") {
      let detach = () => {}
      let deadline: ReturnType<typeof setTimeout> | undefined
      try {
        await new Promise<void>((resolve, reject) => {
          deadline = setTimeout(() => reject(new Error("plugin roster socket refresh timed out")), SOCKET_REFRESH_DEADLINE_MS)
          detach = live.link.wire.onStatus((status) => {
            if (status === "open") resolve()
            else if (status === "retired") reject(new Error("plugin roster socket retired during refresh"))
          })
          live.link.wire.forceReconnect()
        })
      } finally {
        detach()
        clearTimeout(deadline)
      }
    }
    const restart = restartRows(composedRows ?? [], want)
    console.debug(
      `olai: roster frame — redialling${restart.length === 0 ? "" : `; restarting ${restart.join(", ")}`}`,
    )
    await composeTo(
      halves,
      (plugin) => (live.clients as Record<string, unknown>)[plugin],
      failed,
      reloadRequired,
      new Set(restart),
    )
    composedRows = want
    const failedReports = [...browserReports()].filter(([, report]) => report.state === "failed")
    const failures = failedReports.map(([name]) => name)
    if (failures.length) boot?.failed(`Some plugins couldn't start: ${failures.join(", ")}.`
      + (reloadRequired.size ? " Reload the page to fix this." : " Try again."),
      reloadRequired.size ? async () => { globalThis.location.reload() } : retryBrowser,
      reloadRequired.size ? "reload" : "retry")
    else boot?.clear()
  } catch (refused) {
    boot?.failed(`olai couldn't load its plugins in this tab. Try again. (${String(refused)})`, retryBrowser)
    console.error(
      "olai: this tab could not follow the server's plugin roster, so it is still serving the previous one",
      refused,
    )
    return
  }
}

const importModule = (url: string): Promise<BrowserHalf> =>
  import(url) as Promise<BrowserHalf>
const dynamicModules = new Map<string, () => Promise<BrowserHalf>>()
const chunkAt = (url: string): Promise<BrowserHalf> => {
  let load = dynamicModules.get(url)
  if (!load) {
    load = retryableModule(() => importModule(url), () => url, importModule)
    dynamicModules.set(url, load)
  }
  return load()
}

const surfaceMapOf = (
  halves: ReadonlyArray<BrowserHalf>,
): Record<string, Surface<SurfaceSpec>> =>
  Object.fromEntries(
    halves.flatMap((half) =>
      half.surface === undefined
        ? []
        : [[half.default.name, half.surface as Surface<SurfaceSpec>] as const]
    ),
  )

const FIRST_ROSTER_MS = 1500

let settle: () => void = () => {}
export const firstRoster: Promise<void> = new Promise<void>((resolve) => {
  settle = resolve
  setTimeout(resolve, FIRST_ROSTER_MS)
})

createRoot(() => {
  const roster = live.core.cells.plugins.use()
  createEffect(() => {
    const value = roster.value()
    if (value === undefined) return
    receivedRoster = true
    const want = value.built
      .filter((row) => row.running)
      .map((row) => ({
        id: row.name,
        chunk: row.source?.chunk ?? null,
        generation: row.generation ?? 0,
      }))
    selectedRows = want
    if (composedRows !== undefined && signatureOf(want) === signatureOf(composedRows)) {
      settle()
      return
    }
    void rerost(want).then(settle)
  })
  let was: string | undefined
  createEffect(() => {
    const readout = live.readout()
    const status = readout.status
    if (status === was) return
    if (status === "degraded") {
      console.warn(
        `olai: partly connected — these subscriptions stopped: ${readout.stopped.join(", ")}`,
      )
    } else if (was === "degraded") {
      console.info("olai: every subscription is arriving again")
    }
    was = status
  })
})

export const olai = live.core

export const connectionReadout = live.readout

export const connectionEpoch = live.connectionEpoch

await supplyManagement({
  roster: () => olai.cells.plugins.use().value,
  reports: browserReports,
  changing: rosterChanging,
  set: (name, enabled) => olai.procedures.plugins.set({ name, enabled }),
  configure: (name, key, value) => olai.procedures.plugins.configure({ name, key, value }),
  retry: retryBrowser,
  requiresReload: browserRequiresReload,
  reload: () => globalThis.location.reload(),
})
