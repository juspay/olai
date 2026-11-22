/**
 * WHAT DECODE TELLS THE SERVER'S LOG: every text of a decoded document the
 * parser threw on, and which text it was (`./read.ts`'s `unreadIn`).
 */
import { expect, test } from "bun:test"

import { read, type Read } from "@olai/prose/read.ts"

import { outlineDocument } from "./document.ts"
import { keepRecordRead } from "./kept.ts"
import { isMirror, type Located } from "./node.ts"
import { TEST_CLAIMS } from "./claims.testlib.ts"
import { nodesOf } from "./fixtures.testlib.ts"
import { bodiedDocument, unreadIn } from "./read.ts"

const FAILED: Read = { ...read("a title"), refused: { kind: "failed", cause: new Error("the parser's own bug") } }
const DEPTH: Read = { ...read("a note"), refused: { kind: "depth" } }

test("each record text the parser threw on is named by the record and the field, and nothing else is", () => {
  const written = nodesOf([
    `{"id":"kitchen","ord":"a0","title":"kitchen","desc":"tiles"}`,
    `{"id":"porch","ord":"a1","title":"porch"}`,
    `{"id":"garden","ord":"a2","title":"garden","desc":"beds"}`,
  ].join("\n") + "\n")
  // The same records, unread: a spread carries no reading (`./kept.ts`).
  const nodes: ReadonlyArray<Located> = written.map((one) => isMirror(one.node) ? one : { ...one, node: { ...one.node } })
  const [kitchen, porch, garden] = nodes.map((one) => one.node)
  if (kitchen === undefined || porch === undefined || garden === undefined || isMirror(kitchen) || isMirror(porch) || isMirror(garden)) {
    throw new Error("three records")
  }
  keepRecordRead(kitchen, { title: FAILED, desc: read("tiles") })
  keepRecordRead(porch, { title: read("porch"), desc: null })
  keepRecordRead(garden, { title: read("garden"), desc: DEPTH })
  expect(unreadIn(outlineDocument(TEST_CLAIMS, "a.olai", nodes))).toEqual([
    { where: "kitchen title", refusal: FAILED.refused! },
    { where: "garden note", refusal: { kind: "depth" } },
  ])
})

test("a document the parser read says nothing", () => {
  expect(unreadIn(bodiedDocument(TEST_CLAIMS, "notes/finishes.md", "# Finishes\n\nmatte, *not* gloss"))).toEqual([])
})
