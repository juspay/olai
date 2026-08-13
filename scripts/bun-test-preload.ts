/**
 * What `bun test` is missing to IMPORT the client: a `location`.
 *
 * The client's modules are written for a browser, and the unit tests import
 * them in Node anyway — deliberately, because the rules they hold (the undo
 * stack's ordering, a menu's verbs) must not be checkable only by pressing a
 * key in a browser. Importing them drags in `wire.ts`, whose one connect
 * derives its dial URL from `location.origin` at connect time (juspay/kolu#2165)
 * and fails LOUD when there is no `location` — the right answer for a real
 * Node caller, which should say the URL it means, and the wrong one for a test
 * that only wanted `applying`'s two moods and got a dead import for it.
 *
 * So the tests get the one global the wire reads, pointing into the reserved
 * `.invalid` TLD: the dial fails, as it always did here — before #2165 the url
 * thunk threw on `location` at dial time — on the socket's own retry fiber,
 * out of every test's way. Nothing else in this tree branches on `location`
 * existing; a real browser (the e2e suite) never loads this file.
 */

if (typeof globalThis.location === "undefined") {
  // A `URL` has every property the wire reads (`origin`); the cast says this
  // is a stand-in for tests, not a `Location`.
  globalThis.location = new URL("http://olai.invalid") as unknown as Location
}

/**
 * NO TEST DIALS A MODEL.
 *
 * The unit lane stands real servers up (`server/src/serve.test.ts`,
 * `server/src/mcp/serve.test.ts` spawn the real composition roots), and their
 * boot resolves an embedder. Detection is fail-closed, so nothing here would
 * FAIL without this — but "tends to find nothing" is not the claim the brief
 * makes. The claim is that no test path reaches a live model, and that is
 * only true if the suite says so rather than hoping the machine running it
 * has no Ollama up. A developer with `nomic-embed-text` pulled would
 * otherwise run a different suite from CI's: live embeddings, real writes
 * under `$XDG_CACHE_HOME/olai/recall/`, and a query timeout on the palette.
 *
 * The same isolation the e2e harness already gives the agent (a fake `kolu`
 * first on PATH) and git. Spelled as the literal here rather than imported
 * from `@olai/server`, because a preload that dragged the server's module
 * graph in would run it before every test in the workspace; the pins in
 * `recall/embedder.test.ts` are what keep the two spellings honest.
 */
process.env["OLAI_EMBED"] = "off"
