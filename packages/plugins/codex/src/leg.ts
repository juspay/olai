/**
 * CODEX-ACP'S WIRE, read conservatively.
 *
 * The adapter exposes useful display titles for tool calls, but neither the
 * call id nor the `_meta` carried to olai exposes the stable programmatic tool
 * name/server pair. Those titles are not an approval boundary. Consequently a
 * Codex permission request is always left to the person: failing to recognise
 * a call may cost a click, while guessing could grant authority nobody gave.
 *
 * Codex's native subagent metadata is similarly richer than ACP's flat feed,
 * but it identifies threads rather than the one spawning call Leg needs. This
 * first integration draws those calls flat instead of inventing parentage.
 */
import { namedExactly, type Leg, type Meta } from "@olai/acp/engine"

const fieldIn = (value: unknown, key: string): unknown =>
  typeof value === "object" && value !== null && !Array.isArray(value)
    ? (value as Record<string, unknown>)[key]
    : undefined

export const STEER_METHOD = "_session/steering"
export const STEER_TIMEOUT = "30 seconds"

/** The extension is advertised at the initialize response's top-level meta. */
export const STEERING_ADVERTISED = (initialized: unknown): boolean =>
  fieldIn(fieldIn(fieldIn(initialized, "_meta"), "steering"), "supported") === true

/**
 * Both success outcomes mean the adapter consumed the message. In particular,
 * `startedNewTurn` must not fall through to an ordinary prompt or Codex hears
 * the same words twice. Unknown and failed outcomes stay fail-safe and fall
 * back to that ordinary prompt.
 */
export const steerTaken = (answered: unknown): boolean => {
  const outcome = fieldIn(answered, "outcome")
  return outcome === "injected" || outcome === "startedNewTurn"
}

export const CODEX: Leg = {
  toolNameIn: (_meta: Meta) => null,
  toolNameOf: () => null,
  allowedWithoutAsking: () => null,
  parentToolUse: () => null,
  spawned: () => null,
  backgroundTask: () => null,
  taskNotification: () => null,
  listedIn: () => null,
  prologueIn: () => null,
  // `agent-full-access` disables approvals and grants unrestricted host access;
  // olai does not silently select it. Codex keeps its adapter default instead.
  bypassMode: null,
  steering: {
    method: STEER_METHOD,
    meta: undefined,
    timeout: STEER_TIMEOUT,
    taken: steerTaken,
    advertised: STEERING_ADVERTISED,
  },
  // codex-acp advertises steering, not ordinary busy-turn prompt queueing.
  queues: () => false,
  rawMessages: null,
  models: { config: "model", nameIn: namedExactly },
}
