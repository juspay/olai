/** The engine's inspector face crosses a declared, scoped service.
 *
 * This door describes the face; it neither constructs plugin definitions nor
 * reads chat's wire. Chat owns the standing and the drawing over it. Each
 * engine owns the component that registers that drawing, so its slot claim is
 * stamped with its own identity and withdraws when either owner leaves.
 */
import { serviceTag } from "@olai/plugin-api/contracts"
import type { PluginsRowFace } from "olai-plugin-plugin-inspector/slots"

export interface EnginesService {
  readonly row: (engine: string) => PluginsRowFace
  /**
   * WHICH ENGINES THIS MACHINE CAN ACTUALLY START, best first — the fold every
   * "pick an agent" gesture in this tree already draws from, now readable by a
   * row that is not chat.
   *
   * A `not-here` row is NOT in it, on purpose: a caller asking this question is
   * about to START something, and an engine a person enabled and this machine
   * cannot run is a row chat owes them an explanation for ({@link row} draws
   * that explanation) rather than an option. The ORDER is the bundle's, which
   * is the order chat's own picker draws — a second ordering would be a second
   * answer to which agent is the obvious one.
   *
   * A PLAIN FUNCTION read inside the caller's reactive scope, so it tracks: an
   * engine row switched off at the plugins panel leaves this list on the next
   * frame, and a consumer drawing a picker off it re-draws rather than offering
   * an agent that is no longer there.
   */
  readonly installed: () => ReadonlyArray<{ readonly id: string; readonly name: string }>
}
export const engines = serviceTag<EnginesService>("chat.engines")
