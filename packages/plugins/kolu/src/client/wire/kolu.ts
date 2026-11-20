import { PrInfoSchema } from "anyforge/schemas"
import { Schema } from "effect"

export const KoluStatus = Schema.Literals(["connected", "absent", "skew"])
export type KoluStatus = typeof KoluStatus.Type

export const KoluLink = Schema.Struct({
  status: KoluStatus,
  socket: Schema.String,
  told: Schema.Boolean,
  stateRoot: Schema.NullOr(Schema.String),
  surfaceVersion: Schema.NullOr(Schema.String),
  speaks: Schema.String,
  since: Schema.String,
})
export type KoluLink = typeof KoluLink.Type

export const KOLU_UNDIALED: KoluLink = {
  status: "absent",
  socket: "",
  told: false,
  stateRoot: null,
  surfaceVersion: null,
  speaks: "",
  since: "",
}

export const WatchPulse = Schema.Struct({
  at: Schema.String,
  everyMs: Schema.Number,
})

export type WatchPulse = typeof WatchPulse.Type

export const KOLU_UNPULSED: WatchPulse | null = null

export const sameKolu = (a: KoluLink, b: KoluLink): boolean =>
  a.status === b.status
  && a.socket === b.socket
  && a.told === b.told
  && a.stateRoot === b.stateRoot
  && a.surfaceVersion === b.surfaceVersion
  && a.speaks === b.speaks

export const TERMINAL_KEY = "terminal"

export const FleetOwner = Schema.Union([
  Schema.Struct({
    kind: Schema.Literal("node"),
    id: Schema.String,
    title: Schema.String,
    file: Schema.String,
  }),
  Schema.Struct({ kind: Schema.Literal("unowned") }),
])
export type FleetOwner = typeof FleetOwner.Type

export const UNOWNED: FleetOwner = { kind: "unowned" }

export const FleetPip = Schema.Struct({
  variant: Schema.String,
  glyph: Schema.String,
  active: Schema.Boolean,
  asking: Schema.Boolean,
  bytesLive: Schema.Boolean,
  hasAgent: Schema.Boolean,
  sleeping: Schema.Boolean,
  alert: Schema.Boolean,
  alertLabel: Schema.String,
})
export type FleetPip = typeof FleetPip.Type

export const FleetTerminal = Schema.Struct({
  id: Schema.String,
  pip: FleetPip,
  bucket: Schema.String,
  agentState: Schema.NullOr(Schema.String),
  label: Schema.String,
  labelColor: Schema.String,
  subline: Schema.Struct({ text: Schema.String, fromAgent: Schema.Boolean }),
  pr: Schema.NullOr(PrInfoSchema),
  recencyAt: Schema.NullOr(Schema.Number),
  themeName: Schema.NullOr(Schema.String),
  repo: Schema.NullOr(Schema.String),
  owner: FleetOwner,
})
export type FleetTerminal = typeof FleetTerminal.Type

export const SnapshotRequest = Schema.Struct({
  terminal: Schema.String,
  tailLines: Schema.optionalKey(Schema.Int.check(Schema.isGreaterThan(0))),
})
export type SnapshotRequest = typeof SnapshotRequest.Type

export const Snapshot = Schema.Struct({
  text: Schema.String,
  at: Schema.String,
})
export type Snapshot = typeof Snapshot.Type

export class SnapshotRefused extends Schema.TaggedError<SnapshotRefused>(
  "@olai/surface/SnapshotRefused",
)("SnapshotRefused", {
  reason: Schema.Literals(["no-padi", "no-terminal", "ambiguous"]),
  says: Schema.String,
}) {
  override get message(): string {
    return this.says
  }
}

export const KOLU_EVENT_KINDS = ["transition", "nag", "heartbeat"] as const

export const KoluEvent = Schema.Struct({
  id: Schema.String,
  kind: Schema.Literals(KOLU_EVENT_KINDS),
  at: Schema.String,
  row: Schema.NullOr(Schema.Struct({
    terminal: Schema.String,
    state: Schema.String,
    agentState: Schema.String,
    pip: FleetPip,
    bucket: Schema.String,
    label: Schema.String,
    labelColor: Schema.String,
    repo: Schema.NullOr(Schema.String),
    since: Schema.String,
  })),
  nag: Schema.optionalKey(
    Schema.Struct({
      index: Schema.Int.check(Schema.isGreaterThan(0)),
      left: Schema.optionalKey(Schema.Int.check(Schema.isGreaterThanOrEqualTo(0))),
    }),
  ),
})
export type KoluEvent = typeof KoluEvent.Type

export const reminderAccount = (
  nag: KoluEvent["nag"],
): { readonly index: number; readonly total: number | null; readonly last: boolean } | null => {
  if (nag === undefined) return null
  return {
    index: nag.index,
    total: nag.left === undefined ? null : nag.index + nag.left,
    last: nag.left === 0,
  }
}

export const TerminalFrame = Schema.Union([
  Schema.Struct({
    kind: Schema.Literal("refused"),
    says: Schema.String,
  }),
  Schema.Struct({
    kind: Schema.Literal("delta"),
    data: Schema.String,
  }),
  Schema.Struct({
    kind: Schema.Literal("snapshot"),
    data: Schema.String,
    grid: Schema.NullOr(Schema.Struct({ cols: Schema.Number, rows: Schema.Number })),
    topLine: Schema.Number,
  }),
])
export type TerminalFrame = typeof TerminalFrame.Type

export const TerminalAttach = Schema.Struct({
  terminal: Schema.String,
  grid: Schema.optional(Schema.Struct({ cols: Schema.Number, rows: Schema.Number })),
})
export type TerminalAttach = typeof TerminalAttach.Type
