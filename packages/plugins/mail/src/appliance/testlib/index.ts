/**
 * THE MAIL APPLIANCE, AS ONE DOOR.
 *
 * A scenario about Gmail hands a serve two values, and both come from here:
 *
 *   - `OLAI_HIMALAYA` is `startFakeHimalaya(...).path` — ONE absolute path to
 *     an executable the fake wrote, spawned as `<path> -c <config> --json
 *     <verb…>`. The plugin's whole interface with Himalaya is that spawn, so a
 *     fake that is not a program would test the plugin's spelling of the
 *     boundary rather than the boundary. `./fake-himalaya.ts` says why, and
 *     what it refuses.
 *   - `OLAI_MAIL_GOOGLE` is `startFakeGoogle(...).origin` — one loopback origin
 *     serving the authorization, token and revoke endpoints the flow spends.
 *     `./fake-google.ts` says why it is a real server and what it refuses.
 *
 * They are two fakes rather than one because they are two services with two
 * failure arms: a scenario that wants a revoked grant moves Google's fixture
 * and leaves the mailbox alone, and one that wants a mailbox that refuses a
 * verb does the opposite.
 *
 * `./fixtures.ts` is the third export and a different kind of thing: the TABLES
 * a scenario's `@mail-himalaya:<name>` and `@mail-google:<name>` tags resolve
 * through. They are here rather than in `packages/tests/` because which
 * addresses and which refusals this row stands behind is the row's statement,
 * the same way its testids are. What the harness must do BEYOND starting the
 * fakes and resolving those names lives in `packages/tests/support/` — this
 * door knows nothing about scenarios, tags or serves, and the plugin never
 * imports it. `src/appliance/` is the appliance side of the package, and this
 * subpath is the only door on it.
 */

// THE BINARY THE PLUGIN SPAWNS. `startFakeHimalaya(fixture)` writes it and
// returns the path to put in `OLAI_HIMALAYA`; `rewrite` moves what the NEXT
// call answers; `speaks` is what it answers at all; `stop` removes the
// directory. `PINNED_VERSION` is the `--version` first line a fixture replaces.
export { PINNED_VERSION, SPEAKS, startFakeHimalaya } from "./fake-himalaya.ts" // `MailFixture` is what a scenario writes, `FakeHimalaya` what it holds.
export type { FakeHimalaya, MailFixture } from "./fake-himalaya.ts"

// THE GOOGLE THE FLOW TALKS TO: one origin for the consent screen, the token
// endpoint and the revocation, with every request it was handed (`requests`),
// every access token it minted (`issued`), every token revoked (`revoked`), and
// `rewrite` to move what it ANSWERS without moving its origin.
export { startFakeGoogle } from "./fake-google.ts" // `origin` goes in `OLAI_MAIL_GOOGLE`; `FakeGoogleInput` is the fixture, and what `rewrite` takes.
export type { FakeGoogle, FakeGoogleInput, GoogleRequest } from "./fake-google.ts"

// ...AND THE FIXTURES THE TWO TAGS NAME. The tables live here rather than in a
// scenario's own file because the HARNESS has to resolve `@mail-himalaya:<name>`
// and `@mail-google:<name>` at spawn, and this is the door it already reaches
// this plugin through — one import line for the fakes and their fixtures, and no
// relative climb into another package's `e2e/`. `DOORS` is the pair of values
// `@mail-doors` sets; `fixtureNamed` is the sentence a name nobody wrote earns.
export { ADDRESS, DOORS, fixtureNamed, GOOGLES, MAILBOXES, MESSAGES } from "./fixtures.ts"
