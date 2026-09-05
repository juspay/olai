/**
 * Scope-owned UI locations. Only root is permanent. Contracts are ordinary
 * values owned by their consumers; the host knows neither JSX nor app nouns.
 * A contribution can wait for a declaration without suspending its plugin.
 * Readers see it only while the entire chain of declaring locations exists.
 */
import { Effect, type Scope } from "effect"
import { registry, roster } from "./registry.ts"

export interface Location<T> {
  readonly name: string
  readonly cardinality: "one" | "many"
  /** Carries the contribution type without requiring a runtime instance. */
  readonly _value?: (_: T) => T
}

export const location = <T>(name: string, cardinality: Location<T>["cardinality"] = "many"): Location<T> => {
  if (!/^[a-z][a-z0-9-]*(?:\.[a-z][a-z0-9-]*)*$/.test(name)) {
    throw new Error(`Invalid location name: "${name}"`)
  }
  return Object.freeze({ name, cardinality })
}

export interface Contribution<T> {
  readonly owner: string
  readonly value: T
}

interface Declaration {
  readonly owner: string
  readonly parent: string
  readonly cardinality: "one" | "many"
}

interface Entry {
  readonly contribution: Contribution<unknown>
  readonly location: string
  readonly cardinality: "one" | "many"
}

export interface LocationOwner {
  readonly declare: <T>(slot: Location<T>, parent: string) => Effect.Effect<void, never, Scope.Scope>
  readonly contribute: <T>(slot: Location<T>, value: T) => Effect.Effect<void, never, Scope.Scope>
}

export interface LocationReport {
  readonly name: string
  readonly owner: string
  readonly state: "active" | "waiting"
  readonly waitingFor?: string
}

export interface Locations {
  /** The host binds this name from the calling fiber, never from plugin input. */
  readonly forOwner: (owner: string) => LocationOwner
  readonly read: <T>(slot: Location<T>) => ReadonlyArray<Contribution<T>>
  readonly inspect: () => ReadonlyArray<LocationReport>
}

export const locations = (config: {
  readonly changed?: () => void
  readonly reading?: () => void
} = {}): Locations => {
  const declarations = registry<string, Declaration>(config.changed)
  const entries = roster<Entry>(config.changed)

  const waitingFor = (name: string): string | undefined => {
    while (name !== "root") {
      const declaration = declarations.read().get(name)
      if (!declaration) return name
      name = declaration.parent
    }
    return undefined
  }

  const validate = <T>(slot: Location<T>, owner: string): void => {
    if (!/^[a-z][a-z0-9-]*(?:\.[a-z][a-z0-9-]*)*$/.test(slot.name)
      || (slot.cardinality !== "one" && slot.cardinality !== "many")) {
      throw new Error(`Locations: "${owner}" supplied an invalid location contract for "${slot.name}"`)
    }
    const declaration = declarations.read().get(slot.name)
    const prior = entries.read().find((entry) => entry.location === slot.name)
    const cardinality = slot.name === "root" ? "one" : declaration?.cardinality ?? prior?.cardinality
    if (cardinality !== undefined && cardinality !== slot.cardinality) {
      throw new Error(`Locations: "${owner}" disagrees with "${declaration?.owner ?? prior?.contribution.owner ?? "host"}" about cardinality of "${slot.name}"`)
    }
  }

  return {
    forOwner: (owner) => ({
      declare: (slot, parent) => Effect.suspend(() => {
        validate(slot, owner)
        if (slot.name === "root") return Effect.die(new Error(`Locations: "${owner}" cannot redeclare host location "root"`))
        // Check the proposed graph before claiming anything. This also catches
        // a cycle closed by a late provider whose parent was previously absent.
        if (!/^[a-z][a-z0-9-]*(?:\.[a-z][a-z0-9-]*)*$/.test(parent)) {
          return Effect.die(new Error(`Locations: "${owner}" supplied invalid parent "${parent}" for "${slot.name}"`))
        }
        let cursor = parent
        const path = [`${slot.name} (${owner})`]
        while (cursor !== "root") {
          const declaration = declarations.read().get(cursor)
          path.push(`${cursor} (${declaration?.owner ?? owner})`)
          if (cursor === slot.name) return Effect.die(new Error(`Locations: ownership cycle ${path.join(" -> ")}`))
          if (!declaration) break
          cursor = declaration.parent
        }
        return declarations.claim(slot.name, { owner, parent, cardinality: slot.cardinality },
          (held) => `Locations: "${owner}" and "${held.owner}" both declare "${slot.name}"`)
      }),
      contribute: (slot, value) => Effect.suspend(() => {
        validate(slot, owner)
        const prior = entries.read().find((entry) => entry.location === slot.name)
        if (slot.cardinality === "one" && prior) {
          return Effect.die(new Error(`Locations: "${owner}" and "${prior.contribution.owner}" both occupy single location "${slot.name}"`))
        }
        return entries.hold({ contribution: { owner, value }, location: slot.name, cardinality: slot.cardinality })
      }),
    }),
    read: <T>(slot: Location<T>): ReadonlyArray<Contribution<T>> => {
      config.reading?.()
      validate(slot, "reader")
      if (waitingFor(slot.name)) return []
      // Preserve entry identity when an unrelated location changes. Keyed UI
      // readers must not remount surviving contributions (and lose drafts).
      return entries.read().filter((entry) => entry.location === slot.name)
        .map((entry) => entry.contribution as Contribution<T>)
    },
    inspect: () => {
      config.reading?.()
      return entries.read().map((entry) => {
        const missing = waitingFor(entry.location)
        return {
          name: entry.location,
          owner: entry.contribution.owner,
          state: missing === undefined ? "active" : "waiting",
          ...(missing === undefined ? {} : { waitingFor: missing }),
        }
      })
    },
  }
}
