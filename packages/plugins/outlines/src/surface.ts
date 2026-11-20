import { HomesAnswer, HomesRequest, NamedAnswer, NamedRequest, OpFailure, TagsAnswer, TagsRequest, NodeAnswer, NodeRequest, OutlineAnswer, SubtreeAnswer, SubtreeRequest } from "@olai/format"
import { defineSurface } from "@kolu/surface/define"
import { Schema } from "effect"
import { editProcedures, writeProcedure } from "@olai/surface/dispatch"
import { FiledPageRequest, FiledPageReading } from "@olai/format"
import { OutlineEntry } from "./wire.ts"
import { MovingAnswer, MovingRequest, NarrowingAnswer, NarrowingRequest } from "@olai/format"
import { MARKS } from "@olai/format"
export const surface = defineSurface({
collections: {
    outlines: {
      keySchema: Schema.String,
      schema: OutlineEntry,
      verbs: ["keys", "get", "deltas"],
    }
},
streams: {
page: {
      inputSchema: FiledPageRequest,
      outputSchema: FiledPageReading,
      arrayKey: "key",
    },
    narrowing: {
      inputSchema: NarrowingRequest,
      outputSchema: NarrowingAnswer,
    },
    tagCompletions: {
      inputSchema: TagsRequest,
      outputSchema: TagsAnswer,
    },
    moving: {
      inputSchema: MovingRequest,
      outputSchema: MovingAnswer,
    }
},
procedures: {
edit: editProcedures,
    vocabulary: {
      tags: {
        input: TagsRequest,
        output: TagsAnswer,
        error: OpFailure,
      },
    },
    nodes: {
      named: {
        input: NamedRequest,
        output: NamedAnswer,
        error: OpFailure,
      },
      homes: {
        input: HomesRequest,
        output: HomesAnswer,
        error: OpFailure,
      },
    },
ops: {
  outlines: { output: OutlineAnswer, error: OpFailure },
  node: { input: NodeRequest, output: NodeAnswer, error: OpFailure },
  subtree: { input: SubtreeRequest, output: SubtreeAnswer, error: OpFailure }, run: writeProcedure }
}
})
/**
 * IT MUST STAY EXHAUSTIVE AND DISJOINT ACROSS THE BUNDLE. A verb no row claims
 * reaches `writeEdit` with no writer and fails at runtime with "the capability
 * for X is not active" (`@olai/edit-history`'s `writing.ts`); two rows claiming
 * one verb makes the second `registerWriter` throw at mount. `@olai/server`'s
 * `capability-dispatch.test.ts` holds both halves over the whole catalog.
 */
export const dispatch = {
  "edit.apply": ["add", "move", "under", "toggle", "walk", "title", "desc", "date", "repeat", "prop", "split", "merge", "unmirror", "mirror", "trash", "duplicate", "see", "after", "place", "mark", "remove"],
  "ops.run": [...MARKS, "add", "title", "desc", "date", "repeat", "prop", "move", "split", "merge", "trash", "duplicate", "see", "mirror", "unmirror", "after", "update", "apply"],
} as const
export const resources = {
  outlines: "resource",
} as const

export const faces = {
  "browser": {
    "page": "resource",
    "narrowing": "resource",
    "tagCompletions": "resource",
    "moving": "resource",
    "edit.apply": "tool",
    "vocabulary.tags": "tool",
    "nodes.named": "tool",
    "nodes.homes": "tool"
  },
  "agent": {
    "outlines": "resource",
    "ops.outlines": "tool",
    "ops.node": "tool",
    "ops.subtree": "tool",
    "ops.run": "tool"
  }
} as const
