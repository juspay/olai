import {
  CommitRequest,
  CreateRequest,
  NodeAnswer,
  NodeRequest,
  type SearchRequest,
} from "@olai/format"
import { expect, test } from "bun:test"
import { Schema } from "effect"

import { act, read, write } from "./tools.ts"

test("what a tool says twice has to agree with its own schema", () => {
  const tool = read(
    "outlines_read",
    "Read a node",
    "One node in full.",
    NodeRequest,
    NodeAnswer,
    (asking, args) => asking.node(args),
  )
  expect(tool.kind).toBe("read")

  read(
    "outlines_read",
    "Read a node",
    "One node in full.",
    NodeRequest,
    NodeAnswer,
    // @ts-expect-error — the schema beside it says `NodeRequest`, so an asker
    // claiming to take a `SearchRequest` is not a reader of this tool.
    (asking, args: SearchRequest) => asking.node({ id: "paint" }),
  )

  act(
    "commit",
    "Commit what you changed",
    "Record what is waiting as one git commit.",
    CommitRequest,
    // @ts-expect-error — the same rule on the act arm, which has its own
    // signature and could lose it on its own.
    (ops, args: NodeRequest) => ops.commit({}),
  )

  write(
    "files_create",
    "Create an outline",
    "Start a new outline file.",
    CreateRequest,
    // @ts-expect-error — a write's `fixed` is a field of the request beside
    // it, and `CreateRequest`'s `op` is `"create"`.
    { op: "creat" },
  )

  write(
    "outlines_read",
    "Read a node",
    "Not a write at all.",
    // @ts-expect-error — and the schema itself has to be one the planner can
    // take: a read's request is not an arm of the write vocabulary, so this is
    // a tool `Running.run` could never answer.
    NodeRequest,
    {},
  )

  read(
    "outlines_read",
    "Read a node",
    "Not an object at all.",
    // @ts-expect-error — and it has to have FIELDS. This is the one bound a
    // table cannot speak for, and the reason it is here: every schema the floor
    // hands a row is a struct, so `Arguments` holding and `Arguments` not being
    // there look identical from a table. A call arrives as a JSON object; a
    // schema that is not one has nothing for `argsOf` to take apart and nothing
    // for an agent to fill in.
    Schema.String,
    NodeAnswer,
    (asking) => asking.node({ id: "paint" }),
  )
})
