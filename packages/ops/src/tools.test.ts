import {
  CommitRequest,
  CreateRequest,
  NodeAnswer,
  NodeRequest,
  type SearchRequest,
} from "@olai/format"
import { expect, test } from "bun:test"
import { Schema } from "effect"

import {
  act,
  type Acting,
  type Arguments,
  type Asking,
  read,
  write,
  type WriteArguments,
} from "./tools.ts"

type Assert<T extends true> = T
type Refuses<From, To> = [From] extends [To] ? false : true

const readingNodes = read<typeof NodeRequest, NodeAnswer>
const actingOnCommits = act<typeof CommitRequest>
const writingCreates = write<typeof CreateRequest>

const askerOfAnotherRequest = (asking: Asking, _args: SearchRequest) => asking.node({ id: "paint" })
const actorOfAnotherRequest = (ops: Acting, _args: NodeRequest) => ops.commit({})

type _AReadsAskerTakesTheRequestBesideIt = Assert<
  Refuses<typeof askerOfAnotherRequest, Parameters<typeof readingNodes>[5]>
>

type _AnActsAnswererTakesTheRequestBesideIt = Assert<
  Refuses<typeof actorOfAnotherRequest, Parameters<typeof actingOnCommits>[4]>
>

type _AWritesFixedIsAFieldOfItsRequest = Assert<
  Refuses<{ readonly op: "creat" }, Parameters<typeof writingCreates>[4]>
>

type _AWriteTakesAnArmOfTheWriteVocabulary = Assert<Refuses<typeof NodeRequest, WriteArguments>>

type _AToolsArgumentsAreNamedFields = Assert<Refuses<typeof Schema.String, Arguments>>

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

  const made = write(
    "files_create",
    "Create an outline",
    "Start a new outline file.",
    CreateRequest,
    { op: "create" },
  )
  expect(made.kind).toBe("write")
})
