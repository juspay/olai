import {
  assemble,
  bodiedDocument,
  bodyKind,
  type Document,
  fileKind,
  type KindVocabulary,
  nodesIn,
  parserFor,
  type Claims,
  type Reading,
  stopping,
  unkept,
  validate,
  type Verdict,
  verdictOf,
} from "@olai/format"
import type { Codec } from "@olai/store"
import { Result } from "effect"

export const codecFor = (kinds: KindVocabulary, table: { readonly current: Claims }): Codec<Document, Reading, Verdict> => ({
  match: (path) => fileKind(table.current, path) !== null,

  byName: (path) => {
    const claims = table.current
    return unkept(claims, path) ? Result.succeed(bodiedDocument(claims, path, null)) : null
  },

  decode: (path, contents) => {
    const claims = table.current
    if (bodyKind(claims, path) !== null) return Result.succeed(bodiedDocument(claims, path, contents))
    const format = parserFor(claims, path)
    return format === null
      ? Result.fail(verdictOf([{ file: path, line: 0, code: "unreadable-file", message: `No active format claims ${path}` }]))
      : Result.mapError(format.parse(path, contents, claims), verdictOf)
  },

  validate: (files, since) => {
    const claims = table.current
    return validate(
      claims,
      assemble(claims, files),
      since === undefined ? undefined : {
        read: since.value,
        delta: {
          upserts: since.changed.map(
            (file) => [file, { nodes: nodesIn(files.get(file)) }] as const,
          ),
          removes: since.removed,
        },
      },
      kinds,
    )
  },

  unreadable: (failure) =>
    verdictOf([{
      file: failure.path,
      line: 0,
      code: "unreadable-directory",
      message:
        `${failure.message} — the outline below is the last one that loaded, and it will catch up on its own once the directory can be read again.`,
    }]),

  unread: (failure) =>
    Result.fail(verdictOf([{
      file: failure.path,
      line: 0,
      code: "unreadable-file" as const,
      message: `${failure.message} — this file is in the directory and will not open.`,
    }])),

  stopping: (outcome, paths, standing) => {
    if (Result.isFailure(outcome)) return outcome.failure
    const claims = table.current
    const departed = paths.filter(path => fileKind(claims, path) === null)
    if (departed.length > 0) return verdictOf(departed.map(file => ({
      file, line: 0, code: "unreadable-file" as const,
      message: `No active row claims ${file}, so it cannot be written.`,
    })))
    return stopping(outcome.success.set, paths, standing.set)
  },
})
