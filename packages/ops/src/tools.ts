import { askedOf } from "./asked.ts"
import { outlineAt } from "./refusals.ts"
import { Effect, Result, Schema } from "effect"

import {
  CommitRequest,
  type CommitResult,
  isOpFailure,
  DocumentAnswer,
  DocumentBody,
  DocumentRequest,
  NodeAnswer,
  NodeRequest,
  type OpFailure,
  OutlineAnswer,
  type PathsAnswer,
  type PushResult,
  type Reading,
  SearchAnswer,
  SearchRequest,
  SubtreeAnswer,
  SubtreeRequest,
  type WriteRequest as Request,
  type WriteResult as Applied,
} from "@olai/format"
import type { KindVocabulary } from "@olai/format"
import type { Search } from "./ops.ts"

import * as Query from "./query.ts"

type Arguments = Schema.Constraint & { readonly fields: Schema.Struct.Fields }

interface Described {
  readonly name: string
  readonly title: string
  readonly description: string
  readonly schema: Arguments
}

export interface Asking {
  readonly outlines: Effect.Effect<OutlineAnswer, OpFailure>
  readonly paths: Effect.Effect<PathsAnswer, OpFailure>
  readonly node: (request: NodeRequest) => Effect.Effect<NodeAnswer, OpFailure>
  readonly subtree: (
    request: SubtreeRequest,
  ) => Effect.Effect<SubtreeAnswer, OpFailure>
  readonly search: (
    request: SearchRequest,
  ) => Effect.Effect<SearchAnswer, OpFailure>
  readonly documents: Effect.Effect<DocumentAnswer, OpFailure>
  readonly document: (
    request: DocumentRequest,
  ) => Effect.Effect<DocumentBody, OpFailure>
}

export const asking = (
  read: Effect.Effect<Reading & { readonly outlineRow: string }, OpFailure>,
  now: () => string,
  kinds: KindVocabulary,
  search: Search,
): Asking => ({
  outlines: Effect.map(read, (at) => ({
    outlines: Query.outlines(at.set, at.derived),
  })),
  paths: Effect.map(read, (at) => Query.paths(at.claims, at.outlineRow, at.set)),
  node: (request) =>
    Effect.map(
      Effect.flatMap(read, (at) =>
        Effect.fromResult(Query.detail(at, request.id, request.fields, new Set(at.set.documents.map(one => one.path))))),
      (found) => found ?? { missing: request.id },
    ),
  subtree: (request) =>
    Effect.flatMap(read, (at) => Effect.fromResult(Query.subtree(at, request))),
  search: (request) =>
    Effect.flatMap(read, (at) => {
      if (request.file !== undefined) {
        const admitted = outlineAt(askedOf(at.claims, at.set), request.file)
        if (Result.isFailure(admitted)) return Effect.fail(admitted.failure)
      }
      return search.nodes({ at, query: request, now: now(), kinds })
    }),
  documents: Effect.map(read, (at) => ({ documents: Query.documents(at.set) })),
  document: (request) =>
    Effect.flatMap(read, (at) => Effect.fromResult(Query.document(at.claims, at.set, request.file))),
})

export interface Running {
  readonly run: (request: Request) => Effect.Effect<Applied, OpFailure>
}

export interface Acting {
  readonly commit: (request: CommitRequest) => Effect.Effect<CommitResult>
  readonly push: Effect.Effect<PushResult>
}

export interface Planning {
  readonly claims: import("@olai/format").Claims
  readonly outlineRow: string
  readonly paths: ReadonlyArray<string>
  readonly login: string | null
  readonly now: () => string
}

export type Tool =
  | (Described & {
    readonly kind: "read"
    readonly answers: Schema.Top
    readonly ask: (
      asking: Asking,
      args: never,
    ) => Effect.Effect<unknown, OpFailure>
  })
  | (Described & {
    readonly kind: "write"
    readonly fixed: Readonly<Record<string, unknown>>
  })
  | (Described & {
    readonly kind: "act"
    readonly act: (ops: Acting, args: never) => Effect.Effect<unknown, never>
  })
  | (Described & {
    readonly kind: "plan"
    readonly plan: (
      at: Planning,
      args: never,
    ) => Result.Result<Request, OpFailure>
  })
  | (Described & {
    readonly kind: "surface"
    readonly mutates: boolean
    readonly call: (client: never, args: never) => Effect.Effect<unknown, OpFailure>
  })

export const landed = <A>(call: Effect.Effect<A, unknown>): Effect.Effect<A, OpFailure> =>
  Effect.catch(
    call,
    (failure) => isOpFailure(failure) ? Effect.fail(failure) : Effect.die(failure),
  )

export const NoArgs = Schema.Struct({})

export const read = <S extends Arguments, R>(
  name: string,
  title: string,
  description: string,
  schema: S,
  answers: Schema.Codec<R, R, never, never>,
  ask: (asking: Asking, args: S["Type"]) => Effect.Effect<R, OpFailure>,
): Tool => ({
  name,
  title,
  description,
  schema,
  kind: "read",
  answers,
  ask,
})

export const write = <S extends Arguments & { readonly Type: Request }>(
  name: string,
  title: string,
  description: string,
  schema: S,
  fixed: Partial<S["Type"]>,
): Tool => ({ name, title, description, schema, kind: "write", fixed })

export const act = <S extends Arguments>(
  name: string,
  title: string,
  description: string,
  schema: S,
  answer: (ops: Acting, args: S["Type"]) => Effect.Effect<unknown, never>,
): Tool => ({
  name,
  title,
  description,
  schema,
  kind: "act",
  act: answer,
})

export const calls = <S extends Arguments, C>(
  name: string,
  title: string,
  description: string,
  schema: S,
  mutates: boolean,
  answer: (client: C, args: S["Type"]) => Effect.Effect<unknown, OpFailure>,
): Tool => ({
  name,
  title,
  description,
  schema,
  kind: "surface",
  mutates,
  call: answer as (client: never, args: never) => Effect.Effect<unknown, OpFailure>,
})

export const plan = <S extends Arguments>(
  name: string,
  title: string,
  description: string,
  schema: S,
  resolve: (at: Planning, args: S["Type"]) => Result.Result<Request, OpFailure>,
): Tool => ({
  name,
  title,
  description,
  schema,
  kind: "plan",
  plan: resolve,
})
