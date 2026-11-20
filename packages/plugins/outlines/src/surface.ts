import { HomesAnswer, HomesRequest, NamedAnswer, NamedRequest, OpFailure, TagsAnswer, TagsRequest, NodeAnswer, NodeRequest, OutlineAnswer, SubtreeAnswer, SubtreeRequest } from "@olai/format"
import { defineSurface } from "@kolu/surface/define"
import { Schema } from "effect"
import { editProcedures, writeProcedure } from "@olai/surface/dispatch"
import { FiledPageRequest, FiledPageReading } from "@olai/format"
import { OutlineEntry } from "./wire.ts"
import { MovingAnswer, MovingRequest, NarrowingAnswer, NarrowingRequest } from "@olai/format"
import { MARKS } from "@olai/format"
import type { WriteRequest } from "@olai/format"
import type { Edit } from "@olai/surface"

const procedures = {
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
    subtree: { input: SubtreeRequest, output: SubtreeAnswer, error: OpFailure },
    run: writeProcedure,
  },
}

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
procedures,
})

type MemberPath = {
  [Group in keyof typeof procedures]: `${Group & string}.${keyof (typeof procedures)[Group] & string}`
}[keyof typeof procedures]

export const dispatch = {
  "edit.apply": ["add", "move", "under", "toggle", "walk", "title", "desc", "date", "repeat", "prop", "split", "merge", "unmirror", "mirror", "trash", "duplicate", "see", "after", "place", "mark", "remove"],
  "ops.run": [...MARKS, "add", "title", "desc", "date", "repeat", "prop", "move", "split", "merge", "trash", "duplicate", "see", "mirror", "unmirror", "after", "update", "apply"],
} as const satisfies Partial<Record<MemberPath, ReadonlyArray<string>>> & {
  readonly "edit.apply": ReadonlyArray<Edit["verb"]>
  readonly "ops.run": ReadonlyArray<WriteRequest["op"]>
}
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
