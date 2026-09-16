/**
 * THE MAIL PLUGIN — olai's own judgement about a Gmail mailbox.
 *
 * ## What lives here
 *
 * Everything that says `mail`: the account cell and the two connect procedures
 * (`./wire.ts`), the token broker and the state machine (`./server.ts`,
 * `./account.ts`), the protocol (`./oauth.ts`), the pinned binary's runner and
 * its frozen verb table (`./himalaya/`), the memory record (`./local.ts`), the
 * redirect's landing (`./route.ts`), and the header pill plus the panel row's
 * Connect face (`./browser.tsx`).
 *
 * ## What deliberately does not
 *
 * No `@odu/*`-shaped client package: Himalaya publishes no client library this
 * repo could consume and no MCP face a conversation could dial, so the plugin
 * shells out to one absolute path the Nix build baked (`nix/himalaya.nix`) and
 * nothing of Himalaya is imported here. That is why PR 2's tools are this
 * plugin's own rather than a projection of somebody else's real code, and it is
 * the only reason this package has a `himalaya/` directory at all.
 *
 * The wire identity is re-exported rather than restated: `name` is the sibling
 * key, the panel row id, the docs slug and the word a vault's row selection
 * takes, and it is spelled once — in `./wire.ts` — so a face looked up by it and
 * a docs page addressed by it cannot be two spellings.
 */

export { faces, name, surface } from "./wire.ts"
export { type Account, AccountStatus, MAIL_UNCONNECTED, MailRefusal } from "./wire.ts"

export { kinds } from "./kinds.ts"
