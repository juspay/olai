/**
 * THE MEMORY DOOR — the one thing that has to survive a restart.
 *
 * A refresh token, the address it belongs to, the scope Google granted and when
 * the account was connected, plus the inbox history cursor. Everything else (the
 * access token, the generated Himalaya config, the pending authorization) is
 * derived or short-lived, and dies with the activation that made it.
 *
 * ## Where the file is, and who chose the path
 *
 * Core's, not this plugin's: `LocalState` is one opaque JSON record per plugin
 * per vault, at `$XDG_STATE_HOME/olai/mail/<hash-of-served-directory>.json`
 * (`@olai/server`'s `localStateFor`, `@olai/state`'s `fileForLocal`). The hash
 * is what makes *this serve's* mailbox different from another serve's, and it
 * is core's arithmetic rather than a directory this plugin invents — a plugin
 * that spelled its own path would be a second answer to "which file is this
 * serve's".
 *
 * ## Why a second permit, when core already orders the writes
 *
 * `LocalState`'s own permit orders core's `save` against core's `load`. This one
 * orders THIS PLUGIN's read-modify-write against itself: the account machine
 * loads once at boot and then writes whole records as the token moves, so
 * between a `load` and the first `save` there is a window a second caller could
 * slip into — and the caller that would slip in is the next activation of the
 * same row (a person toggling the switch), which is exactly the case this
 * plugin's file cannot afford to lose a refresh token to. The shape is
 * `olai-plugin-xyne-spaces`' `./local.ts`, one field set over.
 *
 * ## A malformed record is ABSENCE — and only a STRANGER is said out loud
 *
 * A record that does not parse is not a defect and must not stop the row: this
 * file is written by a plugin that may have been a different version, and the
 * honest reading of a token-shaped thing olai cannot understand is *no account*.
 * Losing a connection is recoverable in one press; a serve that will not boot
 * over a JSON key is not.
 *
 * The warning is for the case that is actually strange — an object holding
 * something OTHER than the fields olai writes. Two ordinary states must not
 * warn: a serve that has never connected (`LocalState.load` answers `null`) and
 * a serve whose account was disconnected (core saves `{}` and writes it back as
 * `{cwd}`, the served directory it keys the record by). A row that warned on
 * every boot of every fresh serve would be a warning nobody reads, which is the
 * only way a real one gets missed.
 */

import type { LocalState, Refusal } from "@olai/plugin-api/services"
import { Effect, Semaphore } from "effect"

/** WHAT OLai REMEMBERS ABOUT AN ACCOUNT. `address` and `scope` are `null` until
 *  the first profile call and the first exchange respectively; `connectedAt` is
 *  the moment the record was first written, which is what the panel's "since"
 *  reads. */
export interface MemoryRecord {
  readonly refreshToken: string
  readonly address: string | null
  readonly scope: string | null
  readonly historyId: string | null
  readonly connectedAt: string
}

const text = (value: unknown): string | null =>
  typeof value === "string" && value.trim() !== "" ? value : null

/** The record a raw object holds, or `undefined` when it is not one. Only
 *  `refreshToken` is required: a record written before this plugin asked for a
 *  profile is still a usable connection. */
export const recordOf = (raw: Record<string, unknown> | null): MemoryRecord | undefined => {
  if (raw === null) return undefined
  const refreshToken = text(raw["refreshToken"])
  if (refreshToken === null) return undefined
  return {
    refreshToken,
    address: text(raw["address"]),
    scope: text(raw["scope"]),
    connectedAt: text(raw["connectedAt"]) ?? "",
    historyId: text(raw["historyId"]),
  }
}

export const valuesOf = (record: MemoryRecord): Record<string, unknown> => ({
  refreshToken: record.refreshToken,
  address: record.address,
  scope: record.scope,
  connectedAt: record.connectedAt,
  historyId: record.historyId,
})

export interface Memory {
  /** The record as of the last successful write, or `undefined` when there is
   *  none — which is what the account machine's boot reads. */
  readonly current: () => MemoryRecord | undefined
  readonly remember: (record: MemoryRecord) => Effect.Effect<void, Refusal>
  /** Forget, which is what a disconnect does after Google has revoked. */
  readonly advance: (connection: string, historyId: string | null) => Effect.Effect<void, Refusal>
  readonly forget: () => Effect.Effect<void, Refusal>
}

/**
 * Open the file once and keep it behind one write permit for the life of the
 * activation.
 *
 * The warn line is a parameter rather than a logger import: this module is the
 * parse, and the plugin's own logging decision belongs to the half that owns
 * the plugin (`../server.ts`).
 */
export const openMemory = (door: LocalState, warn: (line: string) => void): Effect.Effect<Memory> =>
  Effect.gen(function*() {
    const raw = yield* door.load
    const loaded = recordOf(raw)
    // `cwd` is core's own key on every record it writes; anything else in
    // there is somebody else's object, which is worth a line.
    if (loaded === undefined && raw !== null && Object.keys(raw).some((key) => key !== "cwd")) {
      warn("mail: the memory record is not a record olai wrote — reading it as no account")
    }
    let held: MemoryRecord | undefined = loaded
    const writing = yield* Semaphore.make(1)
    return {
      current: () => held,
      remember: (record) =>
        writing.withPermit(Effect.gen(function*() {
          const next = held?.connectedAt === record.connectedAt && held.address === record.address ? { ...record, historyId: held.historyId } : record
          yield* door.save(valuesOf(next))
          held = next
        })),
      advance: (connection, historyId) => writing.withPermit(Effect.gen(function*() {
        if (!held || held.connectedAt !== connection) return
        const next = { ...held, historyId }
        yield* door.save(valuesOf(next))
        held = next
      })),
      forget: () =>
        writing.withPermit(Effect.gen(function*() {
          yield* door.save({})
          held = undefined
        })),
    }
  })
