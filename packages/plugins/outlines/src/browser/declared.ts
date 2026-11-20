import { heldService } from "@olai/ui-primitives/held.ts"

import { Result } from "effect"
import { type Accessor, createEffect, createSignal, onCleanup, untrack } from "solid-js"

import type { NamedAnswer, OpFailure } from "@olai/format"
import { reachable } from "@olai/web/client/connection/reaching.ts"
import { runAsync } from "@olai/web/client/run.ts"
import { connectionReadout } from "@olai/web/client/wire.ts"
import { client } from "../client.ts"

const GATHER_MS = 0

type Named = NamedAnswer["named"][number]
type Told = ReadonlyMap<string, Named>

interface Batch {
  readonly seq: number
  readonly ids: Set<string>
  readonly answer: Promise<Result.Result<Told, OpFailure>>
}

export interface Declared {
  readonly title: (id: string) => string | null
  readonly named: (id: string) => string | null
  readonly want: (ids: ReadonlyArray<string>) => void
  readonly told: (id: string) => string | null | undefined
}


export const createDeclarations = () => {
let asked = 0

let gathering: Batch | null = null

let generation = 0
let cancelGather: (() => void) | undefined
const askAll = (ids: ReadonlyArray<string>): Batch => {
  if (gathering === null) {
    const mine = generation
    const wanted = new Set<string>()
    const answer = new Promise<Result.Result<Told, OpFailure>>((settle) => {
      const timeout = setTimeout(() => {
        cancelGather = undefined
        if (mine !== generation) { settle(Result.succeed(new Map())); return }
        gathering = null
        settle(
          runAsync(client().procedures.nodes.named({ ids: [...wanted] })).then((outcome) =>
            Result.isFailure(outcome)
              ? Result.fail(outcome.failure)
              : Result.succeed<Told>(

                new Map(outcome.success.named.map((one) => [one.asked, one])),
              )
          ),
        )
      }, GATHER_MS)
      cancelGather = () => { clearTimeout(timeout); settle(Result.succeed(new Map())) }
    })
    gathering = { seq: ++asked, ids: wanted, answer }
  }
  for (const id of ids) gathering.ids.add(id)
  return gathering
}

const [failed, setFailed] = createSignal<string | null>(null)
const declaringFailure: Accessor<string | null> = failed

let reported = 0

const said = (seq: number, message: string | null): void => {
  if (seq < reported) return
  reported = seq
  setFailed(message)
}


const createDeclared = (
  failure?: (message: string, ids: ReadonlyArray<string>) => void,
): Declared => {
  let alive = true
  const mine = generation
  onCleanup(() => { alive = false })
  const [known, setKnown] = createSignal<ReadonlyMap<string, Named | null>>(new Map())
  const asking = new Set<string>()
  const [wanted, setWanted] = createSignal<ReadonlyArray<string>>([])

  createEffect(() => {
    const ids = wanted()
    if (!reachable(connectionReadout())) return
    const told = untrack(known)
    const fresh = ids.filter((id) => !told.has(id) && !asking.has(id))
    if (fresh.length === 0) return
    for (const id of fresh) asking.add(id)
    const { seq, answer } = askAll(fresh)
    void answer
      .then((outcome) => {
        if (!alive || mine !== generation) return
        if (Result.isFailure(outcome)) {
          said(seq, outcome.failure.message)
          failure?.(outcome.failure.message, fresh)
          return
        }
        said(seq, null)
        const next = new Map(untrack(known))
        for (const id of fresh) next.set(id, outcome.success.get(id) ?? null)
        setKnown(next)
      })
      .finally(() => {
        for (const id of fresh) asking.delete(id)
      })
  })

  return {
    title: (id) => known().get(id)?.title ?? null,
    named: (id) => known().get(id)?.id ?? null,
    want: (ids) => {
      setWanted(ids)
    },
    told: (id) => { const node = known().get(id); return node === undefined ? undefined : node?.id ?? null },
  }
}


const clearDeclared = (): void => { ++generation; cancelGather?.(); cancelGather = undefined; gathering = null; setFailed(null) }

  onCleanup(clearDeclared)
  return { create: createDeclared, failure: declaringFailure, clear: clearDeclared }
}
const heldDeclarations = heldService<ReturnType<typeof createDeclarations>>()
export const holdDeclarations = heldDeclarations.hold
export const createDeclared = (failure?: (message: string, ids: ReadonlyArray<string>) => void): Declared => {
  const owner = heldDeclarations.read()
  if (!owner) throw new Error("declarations outside the outlines activation")
  return owner.create(failure)
}
export const declaringFailure: Accessor<string | null> = () => heldDeclarations.read()?.failure() ?? null
