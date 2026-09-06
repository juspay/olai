import { expect, test } from "bun:test"
import { NodeServices } from "@effect/platform-node"
import { Effect, Queue, Stream, Schema } from "effect"
import { addressOf, NO_KINDS } from "@olai/format"
import { codecFor, make as makeOps } from "@olai/ops"
import * as Store from "@olai/store"
import { mkdtempSync, writeFileSync, unlinkSync, rmSync } from "node:fs"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { capabilitiesOver } from "./capabilities.testlib.ts"
import { bind } from "./runtime.ts"
import { watchFault } from "./fault.ts"
import { DocumentPageRequest, type CorePageReading } from "@olai/surface"

test("Markdown owns live frontmatter and missing-file metadata with outlines absent", () => Effect.gen(function*() {
  const root = mkdtempSync(join(tmpdir(),"olai-markdown-capability-"))
  yield* Effect.addFinalizer(() => Effect.sync(() => rmSync(root,{recursive:true,force:true})))
  const file = join(root,"notes.md")
  writeFileSync(join(root,"other.md"),"Another document\n")
  writeFileSync(file,"---\nagent: first\n---\nHello\n")
  const store = yield* Store.make({root,codec:codecFor(NO_KINDS),watch:false,settle:"10 millis"})
  const ops = makeOps({store,root})
  yield* Effect.addFinalizer(() => ops.close)
  const plugins = yield* capabilitiesOver(store,ops,root,{rows:["markdown"]})
  const wired = yield* bind({plugins,hostname:"test",startedAt:""})
  const faults = yield* watchFault(wired.bound)
  yield* Effect.addFinalizer(() => Effect.promise(() => wired.bound.close()))
  yield* Effect.addFinalizer(() => faults.stopped)
  expect(wired.bound.handlers["surface/page/get"]).toBeUndefined()
  expect(wired.bound.handlers["surface/outlines/get"]).toBeUndefined()
  const get = wired.bound.handlers["surface/documentPage/get"]!
  const request = {kind:"at",address:addressOf("notes.md", null)}
  const stream = get(request) as Stream.Stream<CorePageReading>
  const frames = yield* Queue.unbounded<CorePageReading>()
  yield* Effect.forkScoped(Stream.runForEach(stream, frame => Queue.offer(frames,frame)))
  const first = yield* Queue.take(frames)
  expect(first).toMatchObject({shows:{kind:"document",props:{agent:"first"}}})
  writeFileSync(file,"---\nagent: updated\n---\nChanged\n")
  yield* store.refresh("verified")
  const second = yield* Queue.take(frames)
  expect(second).toMatchObject({shows:{kind:"document",props:{agent:"updated"}}})
  unlinkSync(file)
  yield* store.refresh("verified")
  const missing = yield* Queue.take(frames)
  expect(missing).toMatchObject({shows:{kind:"nothing",sought:"document",requested:"notes.md"}})
}).pipe(Effect.scoped,Effect.provide(NodeServices.layer),Effect.runPromise))

test("Markdown metadata refuses outline and node addresses", () => {
  const accepts = Schema.is(DocumentPageRequest)
  expect(accepts({kind:"at",address:addressOf("notes.md",null)})).toBe(true)
  expect(accepts({kind:"at",address:addressOf("house.olai",null)})).toBe(false)
  expect(accepts({kind:"at",address:addressOf(null,"node")})).toBe(false)
  expect(accepts({kind:"at",address:null})).toBe(false)
  expect(accepts({kind:"trash"})).toBe(false)
})
