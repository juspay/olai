/**
 * WHAT A TOOL SAYS TWICE HAS TO AGREE WITH ITS OWN SCHEMA — and only the
 * compiler can check it, which is what this file is.
 *
 * There is no table here any more. Every tool went out to the row that owns it
 * (juspay/olai#546), and the walk that decodes each read's answer against its
 * own `answers` declaration went with them: it is published as a harness
 * ({@link ./tools.testlib.ts}) and each row runs it over its own table —
 * `olai-plugin-outlines` over the three node reads, `olai-plugin-markdown` over
 * the two document ones, `olai-plugin-search` over its one with the real
 * matcher behind the door. The escaped-newline ban on what an agent actually
 * READS travelled the same way, as {@link escapedIn}, and is asserted by every
 * row that has a tool.
 *
 * WHAT STAYED IS WHAT THIS PACKAGE STILL OWNS: the four constructors. Each
 * entry a row writes says one thing twice — the schema an agent fills in, and
 * then something ABOUT that schema: a read's asker takes the request, an act's
 * does too, a write names the field its own name decides and is written in the
 * planner's vocabulary, and the schema itself has to have FIELDS. A walk over a
 * table can see none of it, in any package: a `Tool` erases every entry to a
 * shape whose `ask` takes `never` and whose `fixed` is a bag of `unknown`. The
 * constructors are exported for the rows to build with, and pinned here.
 */

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

/**
 * THE FIRST CALL IS THE ONLY ONE THAT COMPILES. It annotates nothing and hands
 * `args` to a door wanting a `NodeRequest`, so a lost inference — `unknown`,
 * which is what the request parameter's old `| Schema.Top` union left — fails
 * here.
 *
 * THE OTHER FOUR ARE EXPECTED TO BE REFUSED, and `@ts-expect-error` fails the
 * build when the line it guards compiles — which is what rules out the other
 * way this goes wrong, an `any` swallowing the wrong annotation and leaving the
 * directive unused. EACH BODY IS VALID ON ITS OWN, deliberately: a refusal that
 * would also be a refusal for some second reason proves nothing about the
 * first, so `asking.node({ id })` and `ops.commit({})` are calls that type-check
 * — leaving the parameter annotation as the only thing on the line that can
 * fail.
 *
 * None of the five is a tool and none reaches a row's table; what is under test
 * is the constructors, and a table is only how they are normally called.
 */
test("what a tool says twice has to agree with its own schema", () => {
  const tool = read(
    "read_node",
    "Read a node",
    "One node in full.",
    NodeRequest,
    NodeAnswer,
    (asking, args) => asking.node(args),
  )
  expect(tool.kind).toBe("read")

  read(
    "read_node",
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
    "create_outline",
    "Create an outline",
    "Start a new outline file.",
    CreateRequest,
    // @ts-expect-error — a write's `fixed` is a field of the request beside
    // it, and `CreateRequest`'s `op` is `"create"`.
    { op: "creat" },
  )

  write(
    "read_node",
    "Read a node",
    "Not a write at all.",
    // @ts-expect-error — and the schema itself has to be one the planner can
    // take: a read's request is not an arm of the write vocabulary, so this is
    // a tool `Running.run` could never answer.
    NodeRequest,
    {},
  )

  read(
    "read_node",
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
