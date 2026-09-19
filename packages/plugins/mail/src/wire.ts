/**
 * MAIL'S OWN SURFACE — one cell and two procedures, and that is the whole of
 * what a Gmail account looks like from a tab.
 *
 * The cell is the ACCOUNT: whether this serve holds a Gmail authorization, who
 * it is for, and — on the arm where something is wrong — the reason. Three
 * states rather than a boolean, for the reason kolu's link cell and
 * `olai-plugin-xyne-spaces`' own give: *no account* and *an account Google
 * refused* have opposite fixes, and one `false` would make Connect the answer
 * to both.
 *
 * The two procedures are the only WRITES on this surface, and both are
 * browser-only (see {@link faces}): a connect is a person at a panel pressing a
 * button, and an agent that wants mail has the tools this plugin registers in
 * two PRs' time. `connect.begin` hands back the Google authorization URL to
 * open; `connect.disconnect` revokes at Google and forgets the record.
 *
 * `connect.begin` takes the ORIGIN the page is looking at, and that is the one
 * thing this surface asks a browser for. The redirect URI Google will be handed
 * must be the address of THIS serve as the browser reached it, and a socket
 * carries no `Host` — the connection `who.get` reads belongs to core
 * (`@olai/server`'s `CurrentWho`), and there is no per-connection service a
 * plugin may claim for itself. The page knows its own origin exactly, so it
 * says so; the server composes `${origin}${REDIRECT_PATH}`, keeps it in the
 * record and hands it to Google. That is also the only value here a person has
 * to type into Google Cloud Console, which is why it is ON the cell rather than
 * recomputed at each use.
 *
 * ## THIS ENTRY'S OWN FENCE, inherited whole
 *
 * The composed group is on the static graph of everything that reads the
 * surface, so this module may import the framework, `effect` and nothing else —
 * no `solid-js`, no `@olai/format`, no `node:` builtin. That is
 * `olai-plugin-odu`'s own rule one appliance over (`./wire.ts` there), and what
 * asserts it is `@olai/plugin-api`'s `fence.test.ts`, which walks the whole
 * closure of the door this module is reached through.
 */

import { defineSurface } from "@kolu/surface/define"
import { Schema } from "effect"

/** The sibling key, the plugins-panel row id, the docs slug, and the word the
 *  file's row selection takes. Spelled once, here. */
export const name = "mail"

/**
 * WHAT THIS PLUGIN ASKS GOOGLE FOR, verbatim — and the ruling it carries.
 *
 * `gmail.modify` covers reading a mailbox, labelling, archiving (a label
 * removal), trashing, untrashing and writing drafts. It technically permits
 * sending too: the verb table, not this scope, forbids sending. It does NOT cover permanent delete, which
 * needs the whole `https://mail.google.com/` scope; permanent delete is
 * therefore not offered at all (PR 4 of the plan says so in its own words)
 * rather than widening every account's consent screen for a verb this product
 * does not have. One scope, and the account cell reports it back exactly as
 * Google granted it, because a consent screen a person read is a fact they are
 * owed rather than a constant this file knows.
 */
export const SCOPE = "https://www.googleapis.com/auth/gmail.modify"

/** THE PATH GOOGLE REDIRECTS TO, on this serve. Registered in Google Cloud
 *  Console as part of the absolute URI, one path segment past the app's own —
 *  `_olai/` draws no page, so this route is a plain-HTTP door and not a page
 *  that has to exist (`olai-plugin-vault`'s `/media/…` lives at the same
 *  depth for the same reason). */
export const REDIRECT_PATH = "/_olai/mail/oauth"

/** The three arms, spelled once. */
export const AccountStatus = Schema.Literals(["absent", "connected", "fault"])
export type AccountStatus = typeof AccountStatus.Type

/**
 * THE ACCOUNT, as the pill and the panel row read it.
 *
 * Every field is on every arm on purpose. A connected account and a faulted one
 * differ in which of them are `null`, and a reader that had to check the status
 * before knowing whether `why` exists would be a reader composing the state
 * machine again in a renderer.
 */
export const Account = Schema.Struct({
  status: AccountStatus,
  /** The address `gmail profile` answered, once there is a token to ask with. */
  address: Schema.NullOr(Schema.String),
  /** `messagesTotal` from the same profile — the one number the panel shows,
   *  because a mailbox's size is how a person checks the connection is REALLY
   *  their mailbox and not an accidentally-consented empty one. */
  messages: Schema.NullOr(Schema.Number),
  /** When the access token was last refreshed, ISO. Moves on every successful
   *  refresh, which is the panel's only sign that the broker is alive. */
  refreshedAt: Schema.NullOr(Schema.String),
  /** The scope Google granted, verbatim. */
  scope: Schema.String,
  /** The redirect URI this serve will hand Google — derived from the origin the
   *  page connected from, and the string a person registers in Google Cloud. */
  redirect: Schema.String,
  /** The fault's reason: Google's own error word (`invalid_grant`), or the
   *  sentence a missing door composed. `null` off the fault arm. */
  reason: Schema.NullOr(Schema.String),
  /**
   * WHETHER THE FAULT IS A WAIT RATHER THAN A VERDICT — the serve is retrying
   * on its own backoff and a press is not what clears it (`../account.ts` says
   * which failures are which). A FIELD rather than a word appended to `reason`,
   * because it is what the faces branch on: the pill's tooltip, the row's
   * grouping and whether a button is drawn at all. `false` off the fault arm.
   */
  retrying: Schema.Boolean,
  /**
   * WHETHER A PRESS OF CONNECT WOULD REACH GOOGLE — the pinned binary is
   * there and both credential doors are set. The row reads it BEFORE drawing
   * its connect button, because two of the three fault reasons are ones no
   * press can fix: a serve started outside the Nix build cannot be repaired
   * from a panel, and an operator's missing credential is not a button's.
   *
   * Server-computed rather than derived by a renderer, because the facts are
   * the environment's and the renderer has none of them — and one predicate
   * answers for the button AND for `needs()` (which files the row under Needs
   * you), so a row can never be filed as asking while its own face offers
   * nothing.
   */
  canConnect: Schema.Boolean,
})
export type Account = typeof Account.Type

/** The seed. A serve that has not looked is not *no account* — it is a serve
 *  that has not looked — and it is spelled `absent` anyway for kolu's
 *  `KOLU_UNDIALED` reason, which `olai-plugin-xyne-spaces` repeats: a fourth
 *  `unknown` arm would reach every renderer for a boot window measured in
 *  milliseconds. */
export const MAIL_UNCONNECTED: Account = {
  status: "absent",
  address: null,
  messages: null,
  refreshedAt: null,
  scope: SCOPE,
  redirect: "",
  reason: null,
  retrying: false,
  canConnect: false,
}

export const sameAccount: (a: Account, b: Account) => boolean = Schema.toEquivalence(Account)

/**
 * WHAT A CONNECT OR A DISCONNECT SAYS WHEN IT SAYS NO.
 *
 * A sentence rather than a thrown string, because it crosses the wire: the
 * panel draws it beside the button that failed, and a person has to be able to
 * tell *the environment carries no OAuth client* from *Google refused the
 * exchange* without reading a server log. Declared HERE rather than imported
 * from `@olai/format`, because this module may not name that package (see the
 * header) — the shape is the same one every refusal in this tree keeps
 * (`_tag` and a reason), so a caller that narrows on `_tag` narrows the same
 * way twice.
 */
export class MailRefusal extends Schema.TaggedError<MailRefusal>(
  "@olai/plugin-mail/MailRefusal",
)("MailRefusal", { reason: Schema.String }) {
  override get message(): string {
    return this.reason
  }
}

/** The authorization URL, and nothing else — the tab opens it. */
export const ConnectBegun = Schema.Struct({ url: Schema.String })

export const surface = defineSurface({
  cells: {
    account: {
      schema: Account,
      default: MAIL_UNCONNECTED,
      verbs: ["get"],
      equals: sameAccount,
    },
  },
  procedures: {
    connect: {
      /** Ask for an authorization URL. The `origin` is the page's own
       *  (`location.origin`) and becomes the redirect URI Google is handed. */
      begin: {
        input: Schema.Struct({ origin: Schema.String }),
        output: ConnectBegun,
        error: MailRefusal,
      },
      /** Revoke at Google, forget the record, publish `absent`. */
      disconnect: {
        output: Schema.Struct({}),
        error: MailRefusal,
      },
    },
  },
})

/**
 * THE BROWSER'S ALONE, all three members.
 *
 * The cell is a reading of a credential this serve holds; an agent acting as
 * the account is what the tools are for (PR 2), and nothing about a token's
 * provenance belongs on the agent's surface either way. The two procedures are
 * worse than private if an agent could call them: `connect.begin` would hand
 * whoever asked an authorization URL to paste anywhere, and `disconnect` would
 * let a conversation unauthorize the mailbox it was asked about.
 *
 * `mutates: true` on both, because the exposure SHAPE is what a host reads if
 * this map is ever projected onto a face that asks — and neither verb is a
 * read: `begin` arms a pending authorization and republishes the cell with the
 * redirect it just made knowable, and `disconnect` revokes a grant at Google.
 */
export const faces = {
  browser: {
    account: "resource",
    "connect.begin": { tool: { mutates: true } },
    "connect.disconnect": { tool: { mutates: true } },
  },
} as const
