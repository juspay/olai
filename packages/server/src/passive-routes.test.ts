import { expect, test } from "bun:test"
import { Effect, Exit, Scope } from "effect"
import { HttpRouter, HttpServerResponse } from "effect/unstable/http"
import { listener } from "./listener.ts"

test("supplemental routes never open a port and follow the last transport", () => Effect.runPromise(Effect.scoped(Effect.gen(function*() {
  const port = yield* listener({host:"127.0.0.1",port:0})
  yield* port.register({passive:true,routes:HttpRouter.add("GET","/supplement",HttpServerResponse.text("available"))})
  expect(yield* port.start).toBeUndefined()
  const active = yield* Scope.make()
  yield* port.register({routes:HttpRouter.add("GET","/transport",HttpServerResponse.text("ready"))}).pipe(Scope.provide(active))
  const url = yield* port.start
  expect(url).toBeDefined()
  expect(yield* Effect.promise(async ()=>(await fetch(`${url}/supplement`)).text())).toBe("available")
  yield* Scope.close(active,Exit.void)
  expect(yield* port.start).toBeUndefined()
  const closed = yield* Effect.promise(()=>fetch(`${url}/supplement`).then(()=>false,()=>true))
  expect(closed).toBe(true)
}))))
